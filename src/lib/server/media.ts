import path from 'path';

const MEDIA_MIME_TYPES: Record<string, string> = {
	'.mp4': 'video/mp4',
	'.mkv': 'video/x-matroska',
	'.webm': 'video/webm',
	'.avi': 'video/x-msvideo',
	'.mov': 'video/quicktime',
	'.mp3': 'audio/mpeg',
	'.aac': 'audio/aac',
	'.flac': 'audio/flac',
	'.ogg': 'audio/ogg',
	'.wav': 'audio/wav',
	'.m4a': 'audio/mp4',
	'.wma': 'audio/x-ms-wma'
};

export function getMediaContentType(filePath: string): string {
	return MEDIA_MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}
