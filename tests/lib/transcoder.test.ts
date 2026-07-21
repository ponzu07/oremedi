import { describe, it, expect } from 'vitest';
import { decideAction } from '../../src/lib/server/transcoder';

describe('decideAction', () => {
	it('skips browser-compatible codecs already in a browser container', () => {
		expect(decideAction({ video_codec: 'h264', audio_codec: 'aac', container: '.mp4' })).toBe('skip');
		expect(decideAction({ video_codec: 'vp9', audio_codec: 'opus', container: '.webm' })).toBe('skip');
		expect(decideAction({ video_codec: null, audio_codec: 'flac', container: '.mp4' })).toBe('skip');
	});

	it('remuxes compatible codecs that are in the wrong container', () => {
		expect(decideAction({ video_codec: 'hevc', audio_codec: 'aac', container: '.mkv' })).toBe('remux');
		expect(decideAction({ video_codec: 'h264', audio_codec: 'mp3', container: '.mov' })).toBe('remux');
	});

	it('transcodes when a codec is not browser-compatible', () => {
		expect(decideAction({ video_codec: 'mpeg4', audio_codec: 'aac', container: '.avi' })).toBe('transcode');
		expect(decideAction({ video_codec: 'h264', audio_codec: 'ac3', container: '.mkv' })).toBe('transcode');
		expect(decideAction({ video_codec: null, audio_codec: 'wmav2', container: '.wma' })).toBe('transcode');
	});
});
