import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { assertSafePath } from '$lib/server/config';
import fs from 'fs';
import path from 'path';

function nodeToWebStream(stream: fs.ReadStream): ReadableStream {
	let closed = false;
	return new ReadableStream({
		start(controller) {
			stream.on('data', (chunk) => {
				if (!closed) controller.enqueue(chunk);
			});
			stream.on('end', () => {
				if (!closed) { closed = true; controller.close(); }
			});
			stream.on('error', (err) => {
				if (!closed) { closed = true; controller.error(err); }
			});
		},
		cancel() {
			closed = true;
			stream.destroy();
		}
	});
}

export const GET: RequestHandler = async ({ params }) => {
	const db = getDb();
	const media = db.prepare('SELECT title, original_path FROM media WHERE id = ?').get(params.id) as { title: string; original_path: string } | undefined;

	if (!media) {
		return new Response('Not found', { status: 404 });
	}

	try { assertSafePath(media.original_path); } catch {
		return new Response('Forbidden', { status: 403 });
	}

	if (!fs.existsSync(media.original_path)) {
		return new Response('File not found', { status: 404 });
	}

	const stat = fs.statSync(media.original_path);
	const ext = path.extname(media.original_path);
	const fileName = `${media.title}${ext}`;

	const etag = `"${stat.ino}-${stat.size}-${stat.mtimeMs.toString(36)}"`;

	return new Response(nodeToWebStream(fs.createReadStream(media.original_path)), {
		headers: {
			'Content-Type': 'application/octet-stream',
			'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
			'Content-Length': String(stat.size),
			'ETag': etag,
			'Cache-Control': 'private, max-age=604800'
		}
	});
};
