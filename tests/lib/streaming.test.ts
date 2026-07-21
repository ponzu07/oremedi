import { describe, it, expect } from 'vitest';
import { parseRange } from '../../src/lib/server/streaming';

const SIZE = 1000;

describe('parseRange', () => {
	it('returns undefined when there is no Range header', () => {
		expect(parseRange(null, SIZE)).toBeUndefined();
		expect(parseRange(undefined, SIZE)).toBeUndefined();
		expect(parseRange('', SIZE)).toBeUndefined();
	});

	it('parses a closed range', () => {
		expect(parseRange('bytes=0-499', SIZE)).toEqual({ start: 0, end: 499 });
		expect(parseRange('bytes=200-799', SIZE)).toEqual({ start: 200, end: 799 });
	});

	it('parses an open-ended range', () => {
		expect(parseRange('bytes=500-', SIZE)).toEqual({ start: 500, end: 999 });
	});

	it('parses a suffix range (last N bytes)', () => {
		expect(parseRange('bytes=-100', SIZE)).toEqual({ start: 900, end: 999 });
		// Suffix larger than the file clamps to the whole file.
		expect(parseRange('bytes=-5000', SIZE)).toEqual({ start: 0, end: 999 });
	});

	it('clamps an end past EOF to the last byte', () => {
		expect(parseRange('bytes=990-100000', SIZE)).toEqual({ start: 990, end: 999 });
	});

	it('returns null (416) for unsatisfiable or malformed ranges', () => {
		expect(parseRange('bytes=1000-1200', SIZE)).toBeNull(); // start >= size
		expect(parseRange('bytes=500-200', SIZE)).toBeNull(); // reversed
		expect(parseRange('bytes=-0', SIZE)).toBeNull(); // zero-length suffix
		expect(parseRange('bytes=-', SIZE)).toBeNull(); // empty both sides
		expect(parseRange('bytes=abc-def', SIZE)).toBeNull(); // non-numeric
		expect(parseRange('items=0-10', SIZE)).toBeNull(); // wrong unit
	});
});
