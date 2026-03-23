import type { PageServerLoad } from './$types';
import type { Media } from '$lib/types';
import { getDb } from '$lib/server/database';

interface MusicItem extends Media {
	tags: { name: string; category: string }[];
}

export const load: PageServerLoad = async ({ url }) => {
	const db = getDb();
	const tag = url.searchParams.get('tag');

	let query = 'SELECT DISTINCT m.* FROM media m';
	const params: unknown[] = [];

	if (tag) {
		query += ' JOIN media_tags mt ON m.id = mt.media_id JOIN tags t ON mt.tag_id = t.id';
		query += " WHERE m.category = 'music' AND t.name = ?";
		params.push(tag);
	} else {
		query += " WHERE m.category = 'music'";
	}

	query += ' ORDER BY m.title';
	const items = db.prepare(query).all(...params) as Media[];

	const tags = db.prepare(`
		SELECT DISTINCT t.name, t.category FROM tags t
		JOIN media_tags mt ON t.id = mt.tag_id
		JOIN media m ON mt.media_id = m.id
		WHERE m.category = 'music'
		ORDER BY t.name
	`).all() as { name: string; category: string }[];

	const itemIds = items.map((i) => i.id);
	const tagsMap = new Map<number, { name: string; category: string }[]>();
	if (itemIds.length > 0) {
		const placeholders = itemIds.map(() => '?').join(',');
		const allTags = db.prepare(`
			SELECT mt.media_id, t.name, t.category FROM tags t
			JOIN media_tags mt ON t.id = mt.tag_id
			WHERE mt.media_id IN (${placeholders})
		`).all(...itemIds) as { media_id: number; name: string; category: string }[];
		for (const t of allTags) {
			if (!tagsMap.has(t.media_id)) tagsMap.set(t.media_id, []);
			tagsMap.get(t.media_id)!.push({ name: t.name, category: t.category });
		}
	}
	const musicItems: MusicItem[] = items.map((item) => ({
		...item,
		tags: tagsMap.get(item.id) ?? []
	}));

	return {
		items: musicItems,
		tags,
		currentTag: tag
	};
};
