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

	const mediaTags = db.prepare(`
		SELECT mt.media_id, t.id, t.name, t.category FROM tags t
		JOIN media_tags mt ON t.id = mt.tag_id
	`).all() as { media_id: number; id: number; name: string; category: string }[];

	const tagsByMedia = new Map<number, { id: number; name: string; category: string }[]>();
	for (const mt of mediaTags) {
		if (!tagsByMedia.has(mt.media_id)) tagsByMedia.set(mt.media_id, []);
		tagsByMedia.get(mt.media_id)!.push({ id: mt.id, name: mt.name, category: mt.category });
	}

	const mediaWithTags = media.map(m => ({ ...m, tags: tagsByMedia.get(m.id) ?? [] }));

	const allTags = db.prepare('SELECT id, name, category FROM tags ORDER BY category, name').all() as { id: number; name: string; category: string }[];

	return { media: mediaWithTags, transcodeQueue, mediaPath: config.mediaPath, allTags };
};
