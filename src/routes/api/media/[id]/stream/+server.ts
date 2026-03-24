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

export const GET: RequestHandler = async ({ params, request }) => {
	const db = getDb();
	const media = db.prepare('SELECT original_path FROM media WHERE id = ?').get(params.id) as { original_path: string } | undefined;

	if (!media) {
		return new Response('Not found', { status: 404 });
	}

	const filePath = media.original_path;

	try { assertSafePath(filePath); } catch {
		return new Response('Forbidden', { status: 403 });
	}

	if (!fs.existsSync(filePath)) {
		return new Response('File not found', { status: 404 });
	}

	const stat = fs.statSync(filePath);
	const fileSize = stat.size;
	const ext = path.extname(filePath).toLowerCase();

	const mimeTypes: Record<string, string> = {
		'.mp4': 'video/mp4',
		'.mkv': 'video/x-matroska',
		'.webm': 'video/webm',
		'.avi': 'video/x-msvideo',
		'.mov': 'video/quicktime',
		'.mp3': 'audio/mpeg',
		'.aac': 'audio/aac',
		'.flac': 'audio/flac',
		'.ogg': 'audio/ogg',
		'.wav': 'audio/wav',
		'.m4a': 'audio/mp4',
		'.wma': 'audio/x-ms-wma'
	};

	const contentType = mimeTypes[ext] || 'application/octet-stream';
	const range = request.headers.get('range');

	if (range) {
		const parts = range.replace(/bytes=/, '').split('-');
		const start = parseInt(parts[0], 10);
		const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
		const chunkSize = end - start + 1;

		return new Response(nodeToWebStream(fs.createReadStream(filePath, { start, end })), {
			status: 206,
			headers: {
				'Content-Range': `bytes ${start}-${end}/${fileSize}`,
				'Accept-Ranges': 'bytes',
				'Content-Length': String(chunkSize),
				'Content-Type': contentType
			}
		});
	}

	return new Response(nodeToWebStream(fs.createReadStream(filePath)), {
		headers: {
			'Content-Length': String(fileSize),
			'Content-Type': contentType,
			'Accept-Ranges': 'bytes'
		}
	});
};
