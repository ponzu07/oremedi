import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/database';

export const load: PageServerLoad = async ({ url }) => {
	const db = getDb();
	const tagFilter = url.searchParams.get('tag');

	let query = 'SELECT DISTINCT m.* FROM media m';
	const params: unknown[] = [];

	if (tagFilter) {
		query += ' JOIN media_tags mt ON m.id = mt.media_id JOIN tags t ON mt.tag_id = t.id';
		query += " WHERE m.category = 'live_video' AND t.name = ?";
		params.push(tagFilter);
	} else {
		query += " WHERE m.category = 'live_video'";
	}

	query += ' ORDER BY m.created_at DESC';
	const items = db.prepare(query).all(...params);

	// Get all tags for live videos
	const tags = db.prepare(`
		SELECT DISTINCT t.name, t.category FROM tags t
		JOIN media_tags mt ON t.id = mt.tag_id
		JOIN media m ON mt.media_id = m.id
		WHERE m.category = 'live_video'
		ORDER BY t.name
	`).all() as { name: string; category: string }[];

	// Get items with their tags for grouping
	const itemsWithTags = items.map((item: any) => {
		const itemTags = db.prepare(`
			SELECT t.name, t.category FROM tags t
			JOIN media_tags mt ON t.id = mt.tag_id
			WHERE mt.media_id = ?
		`).all(item.id) as { name: string; category: string }[];
		return { ...item, tags: itemTags };
	});

	// Get metadata for grouping (event_name, venue, date)
	const itemsWithMeta = itemsWithTags.map((item: any) => {
		const meta = db.prepare(
			'SELECT key, value FROM media_metadata WHERE media_id = ?'
		).all(item.id) as { key: string; value: string }[];
		const metaObj: Record<string, string> = {};
		for (const m of meta) metaObj[m.key] = m.value;
		return { ...item, meta: metaObj };
	});

	return { items: itemsWithMeta, tags, currentTag: tagFilter };
};
