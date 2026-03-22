import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import fs from 'fs';
import path from 'path';

interface MediaRow {
	title: string;
	original_path: string;
	converted_path: string | null;
}

export const GET: RequestHandler = async ({ params }) => {
	const db = getDb();
	const media = db.prepare('SELECT title, original_path, converted_path FROM media WHERE id = ?').get(params.id) as MediaRow | undefined;

	if (!media) {
		return new Response('Not found', { status: 404 });
	}

	const filePath = media.converted_path && fs.existsSync(media.converted_path)
		? media.converted_path
		: media.original_path;

	if (!fs.existsSync(filePath)) {
		return new Response('File not found', { status: 404 });
	}

	const stat = fs.statSync(filePath);
	const ext = path.extname(filePath);
	const fileName = `${media.title}${ext}`;

	const stream = fs.createReadStream(filePath);
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
