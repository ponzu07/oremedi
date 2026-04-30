import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { config, assertSafePath } from '$lib/server/config';
import { isMediaAccessToken, verifyToken } from '$lib/server/auth';
import { getMediaContentType } from '$lib/server/media';
import { parseRangeHeader } from '$lib/server/http-range';
import fs from 'fs';

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

export const GET: RequestHandler = async ({ params, request, url }) => {
	const db = getDb();
	const media = db.prepare('SELECT original_path FROM media WHERE id = ?').get(params.id) as { original_path: string } | undefined;

	if (!media) {
		return new Response('Not found', { status: 404 });
	}

	const signedToken = url.searchParams.get('token');
	if (signedToken) {
		const payload = verifyToken(signedToken, config.jwtSecret);
		if (!isMediaAccessToken(payload, Number(params.id))) {
			return new Response('Unauthorized', { status: 401 });
		}
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

	// ETag based on inode, size, mtime
	const etag = `"${stat.ino}-${stat.size}-${stat.mtimeMs.toString(36)}"`;

	// 304 Not Modified
	if (request.headers.get('if-none-match') === etag) {
		return new Response(null, { status: 304 });
	}

	const contentType = getMediaContentType(filePath);
	const cacheHeaders = {
		'ETag': etag,
		'Cache-Control': 'private, max-age=604800, immutable',
		'Last-Modified': stat.mtime.toUTCString()
	};

	const range = request.headers.get('range');

	if (range) {
		const parsedRange = parseRangeHeader(range, fileSize);
		if (!parsedRange) {
			return new Response('Requested Range Not Satisfiable', {
				status: 416,
				headers: {
					'Content-Range': `bytes */${fileSize}`,
					'Accept-Ranges': 'bytes'
				}
			});
		}

		const { start, end } = parsedRange;
		const chunkSize = end - start + 1;

		return new Response(nodeToWebStream(fs.createReadStream(filePath, { start, end })), {
			status: 206,
			headers: {
				'Content-Range': `bytes ${start}-${end}/${fileSize}`,
				'Accept-Ranges': 'bytes',
				'Content-Length': String(chunkSize),
				'Content-Type': contentType,
				...cacheHeaders
			}
		});
	}

	return new Response(nodeToWebStream(fs.createReadStream(filePath)), {
		headers: {
			'Content-Length': String(fileSize),
			'Content-Type': contentType,
			'Accept-Ranges': 'bytes',
			...cacheHeaders
		}
	});
};
