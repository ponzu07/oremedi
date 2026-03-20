import type { PageServerLoad } from './$types';
import type { Media } from '$lib/types';
import { getDb } from '$lib/server/database';
import { config } from '$lib/server/config';

export const load: PageServerLoad = async () => {
	const db = getDb();
	const media = db.prepare('SELECT * FROM media ORDER BY created_at DESC').all() as Media[];
	const transcodeQueue = db.prepare(
		"SELECT * FROM media WHERE transcode_status IN ('pending', 'processing') ORDER BY created_at"
	).all() as Media[];

	return { media, transcodeQueue, mediaPath: config.mediaPath };
};
