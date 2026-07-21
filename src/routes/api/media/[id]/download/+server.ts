import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { assertSafePath } from '$lib/server/config';
import { fileWebStream } from '$lib/server/streaming';
import { extname } from '$lib/media-types';
import fs from 'fs';

export const GET: RequestHandler = async ({ params }) => {
	const db = getDb();
	const media = db.prepare('SELECT title, original_path FROM media WHERE id = ?').get(params.id) as { title: string; original_path: string } | undefined;

	if (!media) {
		return new Response('Not found', { status: 404 });
	}

	try { assertSafePath(media.original_path); } catch {
		return new Response('Forbidden', { status: 403 });
	}

	let stat: fs.Stats;
	try {
		stat = fs.statSync(media.original_path);
	} catch {
		return new Response('File not found', { status: 404 });
	}

	const fileName = `${media.title}${extname(media.original_path)}`;
	const etag = `"${stat.ino}-${stat.size}-${stat.mtimeMs.toString(36)}"`;

	return new Response(fileWebStream(media.original_path), {
		headers: {
			'Content-Type': 'application/octet-stream',
			'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
			'Content-Length': String(stat.size),
			'ETag': etag,
			'Cache-Control': 'private, max-age=604800'
		}
	});
};
