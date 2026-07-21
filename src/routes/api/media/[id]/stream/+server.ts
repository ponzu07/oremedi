import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { assertSafePath } from '$lib/server/config';
import { fileWebStream, parseRange } from '$lib/server/streaming';
import { mimeTypeForFile } from '$lib/media-types';
import fs from 'fs';

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

	let stat: fs.Stats;
	try {
		stat = fs.statSync(filePath);
	} catch {
		return new Response('File not found', { status: 404 });
	}

	const fileSize = stat.size;

	// ETag based on inode, size, mtime
	const etag = `"${stat.ino}-${stat.size}-${stat.mtimeMs.toString(36)}"`;

	// 304 Not Modified
	if (request.headers.get('if-none-match') === etag) {
		return new Response(null, { status: 304 });
	}

	const contentType = mimeTypeForFile(filePath);
	// Media bytes change after (re)transcode while the URL stays the same, so
	// allow caching but force revalidation against the ETag rather than serving
	// an immutable copy for days.
	const cacheHeaders = {
		'ETag': etag,
		'Cache-Control': 'private, no-cache',
		'Last-Modified': stat.mtime.toUTCString()
	};

	const range = parseRange(request.headers.get('range'), fileSize);

	// Malformed or unsatisfiable range → 416
	if (range === null) {
		return new Response('Range Not Satisfiable', {
			status: 416,
			headers: { 'Content-Range': `bytes */${fileSize}`, 'Accept-Ranges': 'bytes' }
		});
	}

	if (range) {
		const chunkSize = range.end - range.start + 1;
		return new Response(fileWebStream(filePath, { start: range.start, end: range.end }), {
			status: 206,
			headers: {
				'Content-Range': `bytes ${range.start}-${range.end}/${fileSize}`,
				'Accept-Ranges': 'bytes',
				'Content-Length': String(chunkSize),
				'Content-Type': contentType,
				...cacheHeaders
			}
		});
	}

	return new Response(fileWebStream(filePath), {
		headers: {
			'Content-Length': String(fileSize),
			'Content-Type': contentType,
			'Accept-Ranges': 'bytes',
			...cacheHeaders
		}
	});
};
