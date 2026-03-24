import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/database';
import { config, assertSafePath } from '$lib/server/config';
import fs from 'fs';
import path from 'path';

interface MediaRow {
	id: number;
	thumbnail_path: string | null;
	original_path: string;
}

export const GET: RequestHandler = async ({ params }) => {
	const db = getDb();
	const media = db.prepare('SELECT thumbnail_path FROM media WHERE id = ?').get(params.id) as MediaRow | undefined;

	if (!media || !media.thumbnail_path || !fs.existsSync(media.thumbnail_path)) {
		return new Response('No thumbnail', { status: 404 });
	}

	try { assertSafePath(media.thumbnail_path); } catch {
		return new Response('Forbidden', { status: 403 });
	}

	const nodeStream = fs.createReadStream(media.thumbnail_path);
	let closed = false;
	const webStream = new ReadableStream({
		start(controller) {
			nodeStream.on('data', (chunk) => {
				if (!closed) controller.enqueue(chunk);
			});
			nodeStream.on('end', () => {
				if (!closed) { closed = true; controller.close(); }
			});
			nodeStream.on('error', (err) => {
				if (!closed) { closed = true; controller.error(err); }
			});
		},
		cancel() {
			closed = true;
			nodeStream.destroy();
		}
	});
	return new Response(webStream, {
		headers: {
			'Content-Type': 'image/jpeg',
			'Cache-Control': 'public, max-age=86400'
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

	const fileDir = path.dirname(media.original_path);
	const baseName = path.basename(media.original_path, path.extname(media.original_path));
	const thumbPath = path.join(fileDir, `${baseName}-thumb.jpg`);

	const buffer = Buffer.from(await file.arrayBuffer());
	fs.writeFileSync(thumbPath, buffer);

	db.prepare("UPDATE media SET thumbnail_path = ?, updated_at = datetime('now') WHERE id = ?").run(thumbPath, media.id);

	return json({ success: true, thumbnail_path: thumbPath });
};
