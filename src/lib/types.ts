import type { MediaCategory } from '$lib/media-types';

export type { MediaCategory };

export type TranscodeStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'skipped';

export interface Media {
	id: number;
	title: string;
	category: MediaCategory;
	duration: number | null;
	original_path: string;
	thumbnail_path: string | null;
	transcode_status: TranscodeStatus;
	transcode_progress: number;
	file_hash: string | null;
	file_size: number | null;
	created_at: string;
	updated_at: string;
}
