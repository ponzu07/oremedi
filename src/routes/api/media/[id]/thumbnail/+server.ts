import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/database';
import { assertSafePath } from '$lib/server/config';
import { fileWebStream } from '$lib/server/streaming';
import fs from 'fs';
import path from 'path';

interface MediaRow {
	id: number;
	thumbnail_path: string | null;
	original_path: string;
}

const MAX_THUMBNAIL_BYTES = 10 * 1024 * 1024; // 10MB

// JPEG (FFD8FF) / PNG (89 50 4E 47) / WebP (RIFF....WEBP) magic bytes
function looksLikeImage(buf: Buffer): boolean {
	if (buf.length < 12) return false;
	if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
	if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
	if (
		buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
		buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
	) return true;
	return false;
}

export const GET: RequestHandler = async ({ params, request }) => {
	const db = getDb();
	const media = db.prepare('SELECT thumbnail_path FROM media WHERE id = ?').get(params.id) as MediaRow | undefined;

	if (!media || !media.thumbnail_path) {
		return new Response('No thumbnail', { status: 404 });
	}

	try { assertSafePath(media.thumbnail_path); } catch {
		return new Response('Forbidden', { status: 403 });
	}

	let stat: fs.Stats;
	try {
		stat = fs.statSync(media.thumbnail_path);
	} catch {
		return new Response('No thumbnail', { status: 404 });
	}

	const etag = `"${stat.ino}-${stat.size}-${stat.mtimeMs.toString(36)}"`;
	if (request.headers.get('if-none-match') === etag) {
		return new Response(null, { status: 304 });
	}

	return new Response(fileWebStream(media.thumbnail_path), {
		headers: {
			'Content-Type': 'image/jpeg',
			'Cache-Control': 'public, no-cache',
			'ETag': etag,
			'Last-Modified': stat.mtime.toUTCString()
		}
	});
};

export const POST: RequestHandler = async ({ params, request }) => {
	const db = getDb();
	const media = db.prepare('SELECT id, thumbnail_path, original_path FROM media WHERE id = ?').get(params.id) as MediaRow | undefined;

	if (!media) {
		return json({ error: 'Not found' }, { status: 404 });
	}

	const formData = await request.formData();
	const file = formData.get('thumbnail') as File | null;

	if (!file || file.size === 0) {
		return json({ error: 'No file provided' }, { status: 400 });
	}
	if (file.size > MAX_THUMBNAIL_BYTES) {
		return json({ error: 'Thumbnail too large' }, { status: 413 });
	}

	const buffer = Buffer.from(await file.arrayBuffer());
	if (!looksLikeImage(buffer)) {
		return json({ error: 'Not a valid image file' }, { status: 400 });
	}

	const fileDir = path.dirname(media.original_path);
	const baseName = path.basename(media.original_path, path.extname(media.original_path));
	const thumbPath = path.join(fileDir, `${baseName}-thumb.jpg`);

	try { assertSafePath(thumbPath); } catch {
		return json({ error: 'Invalid path' }, { status: 403 });
	}

	fs.writeFileSync(thumbPath, buffer);
	db.prepare("UPDATE media SET thumbnail_path = ?, updated_at = datetime('now') WHERE id = ?").run(thumbPath, media.id);

	return json({ success: true, thumbnail_path: thumbPath });
};
