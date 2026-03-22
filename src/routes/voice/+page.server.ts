import type { PageServerLoad } from './$types';
import type { Media } from '$lib/types';
import { getDb } from '$lib/server/database';

interface VoiceItem extends Media {
	tags: { name: string; category: string }[];
}

export const load: PageServerLoad = async ({ url }) => {
	const db = getDb();
	const tag = url.searchParams.get('tag');

	let query = 'SELECT DISTINCT m.* FROM media m';
	const params: unknown[] = [];

	if (tag) {
		query += ' JOIN media_tags mt ON m.id = mt.media_id JOIN tags t ON mt.tag_id = t.id';
		query += " WHERE m.category = 'voice' AND t.name = ?";
		params.push(tag);
	} else {
		query += " WHERE m.category = 'voice'";
	}

	query += ' ORDER BY m.created_at DESC';
	const items = db.prepare(query).all(...params) as Media[];

	const tags = db.prepare(`
		SELECT DISTINCT t.name, t.category FROM tags t
		JOIN media_tags mt ON t.id = mt.tag_id
		JOIN media m ON mt.media_id = m.id
		WHERE m.category = 'voice'
		ORDER BY t.name
	`).all() as { name: string; category: string }[];

	const voiceItems: VoiceItem[] = items.map((item) => {
		const itemTags = db.prepare(`
			SELECT t.name, t.category FROM tags t
			JOIN media_tags mt ON t.id = mt.tag_id
			WHERE mt.media_id = ?
		`).all(item.id) as { name: string; category: string }[];
		return { ...item, tags: itemTags };
	});

	return {
		items: voiceItems,
		tags,
		currentTag: tag
	};
};
