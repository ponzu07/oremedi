import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import fs from 'fs';
import path from 'path';

export const GET: RequestHandler = async ({ params }) => {
	const db = getDb();
	const media = db.prepare('SELECT title, original_path FROM media WHERE id = ?').get(params.id) as { title: string; original_path: string } | undefined;

	if (!media) {
		return new Response('Not found', { status: 404 });
	}

	if (!fs.existsSync(media.original_path)) {
		return new Response('File not found', { status: 404 });
	}

	const stat = fs.statSync(media.original_path);
	const ext = path.extname(media.original_path);
	const fileName = `${media.title}${ext}`;

	const stream = fs.createReadStream(media.original_path);
	const webStream = new ReadableStream({
		start(controller) {
			stream.on('data', (chunk) => controller.enqueue(chunk));
			stream.on('end', () => controller.close());
			stream.on('error', (err) => controller.error(err));
		}
	});

	return new Response(webStream, {
		headers: {
			'Content-Type': 'application/octet-stream',
			'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
			'Content-Length': String(stat.size)
		}
	});
};
