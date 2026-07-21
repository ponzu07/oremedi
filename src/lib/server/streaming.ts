import fs from 'fs';
import { Readable } from 'stream';

/**
 * Wrap a file (or byte range) in a web ReadableStream that applies real
 * backpressure: Readable.toWeb reads from the fs stream only as the consumer
 * pulls, so a slow client cannot make the whole file pile up in memory. The
 * underlying fs stream is destroyed automatically when the web stream is
 * cancelled (client disconnect).
 */
export function fileWebStream(filePath: string, opts?: { start?: number; end?: number }): ReadableStream {
	const nodeStream = fs.createReadStream(filePath, opts);
	return Readable.toWeb(nodeStream) as unknown as ReadableStream;
}

export interface ParsedRange {
	start: number;
	end: number;
}

/**
 * Parse an HTTP Range header for a resource of `size` bytes.
 *  - returns `undefined` when there is no Range header (serve the full body)
 *  - returns `null` when the range is malformed or unsatisfiable (respond 416)
 *  - returns `{ start, end }` (inclusive, clamped to the file) when satisfiable
 *
 * Handles open-ended (`bytes=500-`), suffix (`bytes=-500`), reversed and
 * out-of-bounds ranges. Only a single range is supported (multipart ranges are
 * treated as unsatisfiable rather than mis-served).
 */
export function parseRange(header: string | null | undefined, size: number): ParsedRange | null | undefined {
	if (!header) return undefined;

	const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
	if (!match) return null;

	const [, rawStart, rawEnd] = match;
	if (rawStart === '' && rawEnd === '') return null;

	let start: number;
	let end: number;

	if (rawStart === '') {
		// Suffix range: final N bytes.
		const suffix = parseInt(rawEnd, 10);
		if (Number.isNaN(suffix) || suffix <= 0) return null;
		start = Math.max(0, size - suffix);
		end = size - 1;
	} else {
		start = parseInt(rawStart, 10);
		end = rawEnd === '' ? size - 1 : parseInt(rawEnd, 10);
	}

	if (Number.isNaN(start) || Number.isNaN(end)) return null;
	if (start > end) return null;
	if (start >= size) return null; // unsatisfiable
	if (end >= size) end = size - 1;

	return { start, end };
}
