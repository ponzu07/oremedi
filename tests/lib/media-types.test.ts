import { describe, it, expect } from 'vitest';
import {
	extname,
	mimeTypeForFile,
	isValidCategory,
	guessCategoryByExtension,
	isVideoExtension
} from '../../src/lib/media-types';

describe('media-types', () => {
	it('extracts lowercased extensions and ignores directories', () => {
		expect(extname('movie.MP4')).toBe('.mp4');
		expect(extname('/media/sub/clip.MKV')).toBe('.mkv');
		expect(extname('song')).toBe('');
		expect(extname('.hidden')).toBe('');
		expect(extname('a.b.flac')).toBe('.flac');
	});

	it('maps known extensions to MIME types and falls back to octet-stream', () => {
		expect(mimeTypeForFile('a.mp4')).toBe('video/mp4');
		expect(mimeTypeForFile('a.mp3')).toBe('audio/mpeg');
		expect(mimeTypeForFile('a.xyz')).toBe('application/octet-stream');
	});

	it('validates categories against the allowed set', () => {
		expect(isValidCategory('movie')).toBe(true);
		expect(isValidCategory('live_video')).toBe(true);
		expect(isValidCategory('music')).toBe(true);
		expect(isValidCategory('podcast')).toBe(false);
		expect(isValidCategory(123)).toBe(false);
		expect(isValidCategory(undefined)).toBe(false);
	});

	it('detects video extensions', () => {
		expect(isVideoExtension('a.mp4')).toBe(true);
		expect(isVideoExtension('a.mkv')).toBe(true);
		expect(isVideoExtension('a.mp3')).toBe(false);
	});

	it('guesses category from extension with a configurable audio default', () => {
		expect(guessCategoryByExtension('film.mp4')).toBe('movie');
		expect(guessCategoryByExtension('song.mp3')).toBe('music');
		expect(guessCategoryByExtension('talk.flac', 'voice')).toBe('voice');
		expect(guessCategoryByExtension('clip.mkv')).toBe('movie'); // .mkv is video
		expect(guessCategoryByExtension('mystery.xyz')).toBe('music'); // unknown ext → audio default
	});
});
