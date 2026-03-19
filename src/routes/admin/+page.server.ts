import type { PageServerLoad } from './$types';
import type { Media, Tag } from '$lib/types';
import { getDb } from '$lib/server/database';

export const load: PageServerLoad = async () => {
	const db = getDb();
	const media = db.prepare('SELECT * FROM media ORDER BY created_at DESC').all() as Media[];
	const tags = db.prepare('SELECT * FROM tags ORDER BY name').all() as Tag[];
	const transcodeQueue = db.prepare(
		"SELECT * FROM media WHERE transcode_status IN ('pending', 'processing') ORDER BY created_at"
	).all() as Media[];

	return { media, tags, transcodeQueue };
};
