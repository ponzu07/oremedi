// Shared media constants and helpers (client- and server-safe: no node-only imports).
// Single source of truth for extension sets, MIME types, and category logic.

export const MEDIA_CATEGORIES = ['movie', 'live_video', 'voice', 'music'] as const;
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

export function isValidCategory(value: unknown): value is MediaCategory {
	return typeof value === 'string' && (MEDIA_CATEGORIES as readonly string[]).includes(value);
}

export const VIDEO_EXTENSIONS = new Set([
	'.mp4', '.mkv', '.avi', '.wmv', '.flv', '.mov', '.webm'
]);

export const AUDIO_EXTENSIONS = new Set([
	'.mp3', '.flac', '.aac', '.ogg', '.wav', '.m4a', '.wma'
]);

export const MEDIA_EXTENSIONS = new Set([...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS]);

const MIME_TYPES: Record<string, string> = {
	'.mp4': 'video/mp4',
	'.mkv': 'video/x-matroska',
	'.webm': 'video/webm',
	'.avi': 'video/x-msvideo',
	'.mov': 'video/quicktime',
	'.wmv': 'video/x-ms-wmv',
	'.flv': 'video/x-flv',
	'.mp3': 'audio/mpeg',
	'.aac': 'audio/aac',
	'.flac': 'audio/flac',
	'.ogg': 'audio/ogg',
	'.wav': 'audio/wav',
	'.m4a': 'audio/mp4',
	'.wma': 'audio/x-ms-wma'
};

/** Lowercased file extension including the leading dot, or '' if none. */
export function extname(filename: string): string {
	const slash = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'));
	const base = slash >= 0 ? filename.slice(slash + 1) : filename;
	const dot = base.lastIndexOf('.');
	return dot > 0 ? base.slice(dot).toLowerCase() : '';
}

export function mimeTypeForFile(filename: string): string {
	return MIME_TYPES[extname(filename)] ?? 'application/octet-stream';
}

export function isVideoExtension(filename: string): boolean {
	return VIDEO_EXTENSIONS.has(extname(filename));
}

/**
 * Guess a media category from a filename's extension.
 * Video extensions map to 'movie'; everything else maps to `audioDefault`.
 * Callers with directory context (scan) apply their own path-based overrides first.
 */
export function guessCategoryByExtension(
	filename: string,
	audioDefault: MediaCategory = 'music'
): MediaCategory {
	return isVideoExtension(filename) ? 'movie' : audioDefault;
}
