type MediaCategory = 'movie' | 'live_video' | 'voice' | 'music';

type TranscodeStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'skipped';

export interface Media {
	id: number;
	title: string;
	category: MediaCategory;
	duration: number | null;
	original_path: string;
	thumbnail_path: string | null;
	transcode_status: TranscodeStatus;
	created_at: string;
	updated_at: string;
}
