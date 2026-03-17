export type MediaCategory = 'movie' | 'live_video' | 'voice' | 'music';

export type TranscodeStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'skipped';

export interface Media {
	id: number;
	title: string;
	category: MediaCategory;
	duration: number | null;
	original_path: string;
	converted_path: string | null;
	thumbnail_path: string | null;
	transcode_status: TranscodeStatus;
	created_at: string;
	updated_at: string;
}

export interface Tag {
	id: number;
	name: string;
	category: 'artist' | 'speaker' | 'genre' | 'custom';
}

export interface MediaMetadata {
	key: string;
	value: string;
}
