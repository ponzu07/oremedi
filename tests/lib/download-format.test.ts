import { describe, it, expect } from 'vitest';
import { formatSize } from '../../src/lib/download-manager';

describe('formatSize', () => {
	it('formats byte scales', () => {
		expect(formatSize(0)).toBe('0 B');
		expect(formatSize(512)).toBe('512 B');
		expect(formatSize(1024)).toBe('1 KB');
		expect(formatSize(1536)).toBe('1.5 KB');
		expect(formatSize(1024 * 1024)).toBe('1 MB');
		expect(formatSize(1024 * 1024 * 1024)).toBe('1 GB');
	});

	it('does not overflow past GB (no "undefined" unit)', () => {
		const tb = 1024 ** 4;
		expect(formatSize(tb)).toBe('1 TB');
		expect(formatSize(tb * 2048)).not.toContain('undefined');
	});

	it('treats negative and non-finite inputs as zero', () => {
		expect(formatSize(-100)).toBe('0 B');
		expect(formatSize(NaN)).toBe('0 B');
		expect(formatSize(Infinity)).toBe('0 B');
	});
});
