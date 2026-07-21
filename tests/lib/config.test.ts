import { describe, it, expect } from 'vitest';
import { assertSafePath } from '../../src/lib/server/config';

// Uses the default MEDIA_PATH (/media) and ORIGINALS_PATH (/media-originals).
describe('assertSafePath', () => {
	it('allows paths inside the media directories', () => {
		expect(() => assertSafePath('/media/foo.mp4')).not.toThrow();
		expect(() => assertSafePath('/media/sub/dir/foo.mp4')).not.toThrow();
		expect(() => assertSafePath('/media-originals/bar.mkv')).not.toThrow();
	});

	it('allows the media directory roots themselves', () => {
		expect(() => assertSafePath('/media')).not.toThrow();
		expect(() => assertSafePath('/media-originals')).not.toThrow();
	});

	it('rejects paths outside the allowed directories', () => {
		expect(() => assertSafePath('/etc/passwd')).toThrow();
		expect(() => assertSafePath('/tmp/evil')).toThrow();
	});

	it('rejects traversal that escapes the media directory', () => {
		expect(() => assertSafePath('/media/../etc/passwd')).toThrow();
		expect(() => assertSafePath('/media/../../root/.ssh/id_rsa')).toThrow();
	});

	it('rejects sibling directories that merely share a prefix', () => {
		// /mediafoo must not pass as if it were inside /media.
		expect(() => assertSafePath('/mediafoo/x.mp4')).toThrow();
		expect(() => assertSafePath('/media-originals-evil/x.mp4')).toThrow();
	});
});
