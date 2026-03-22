import type { PageServerLoad } from './$types';
import type { Media } from '$lib/types';
import { getDb } from '$lib/server/database';
import { config } from '$lib/server/config';
import { getChapters } from '$lib/server/chapters';

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

	const chapterCounts = db.prepare(
		'SELECT media_id, COUNT(*) as count FROM media_chapters GROUP BY media_id'
	).all() as { media_id: number; count: number }[];
	const chapterCountMap = new Map(chapterCounts.map(c => [c.media_id, c.count]));

	const mediaWithTags = media.map(m => ({ ...m, tags: tagsByMedia.get(m.id) ?? [], chapterCount: chapterCountMap.get(m.id) ?? 0 }));

	const allTags = db.prepare('SELECT id, name, category FROM tags ORDER BY category, name').all() as { id: number; name: string; category: string }[];
	const tagCategories = db.prepare('SELECT DISTINCT category FROM tags ORDER BY category').all() as { category: string }[];
	const tagCategoryList = tagCategories.map(c => c.category);
	if (!tagCategoryList.includes('custom')) tagCategoryList.push('custom');

	return { media: mediaWithTags, transcodeQueue, mediaPath: config.mediaPath, allTags, tagCategories: tagCategoryList };
};
