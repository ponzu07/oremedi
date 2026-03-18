import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/database';

export const load: PageServerLoad = async () => {
	const db = getDb();
	const media = db.prepare('SELECT * FROM media ORDER BY created_at DESC').all();
	const tags = db.prepare('SELECT * FROM tags ORDER BY name').all();
	const transcodeQueue = db.prepare(
		"SELECT * FROM media WHERE transcode_status IN ('pending', 'processing') ORDER BY created_at"
	).all();

	return { media, tags, transcodeQueue };
};
