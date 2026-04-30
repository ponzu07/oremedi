import { describe, expect, it } from 'vitest';
import { parseRangeHeader } from '../../src/lib/server/http-range';

describe('parseRangeHeader', () => {
	it('parses open-ended and bounded byte ranges', () => {
		expect(parseRangeHeader('bytes=100-199', 1000)).toEqual({ start: 100, end: 199 });
		expect(parseRangeHeader('bytes=100-', 1000)).toEqual({ start: 100, end: 999 });
	});

	it('parses suffix byte ranges', () => {
		expect(parseRangeHeader('bytes=-500', 1000)).toEqual({ start: 500, end: 999 });
		expect(parseRangeHeader('bytes=-5000', 1000)).toEqual({ start: 0, end: 999 });
	});

	it('clamps end offsets that exceed file size', () => {
		expect(parseRangeHeader('bytes=950-5000', 1000)).toEqual({ start: 950, end: 999 });
	});

	it('rejects malformed or unsatisfiable ranges', () => {
		expect(parseRangeHeader('bytes=abc-def', 1000)).toBeNull();
		expect(parseRangeHeader('bytes=-', 1000)).toBeNull();
		expect(parseRangeHeader('bytes=--', 1000)).toBeNull();
		expect(parseRangeHeader('bytes=-0', 1000)).toBeNull();
		expect(parseRangeHeader('bytes=500-100', 1000)).toBeNull();
		expect(parseRangeHeader('bytes=1000-1001', 1000)).toBeNull();
		expect(parseRangeHeader('items=1-2', 1000)).toBeNull();
	});
});
