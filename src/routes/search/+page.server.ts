import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/database';

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	if (!q) return { query: '', results: [] };

	const db = getDb();
	const results = db.prepare(`
		SELECT DISTINCT m.id, m.title, m.category, m.duration, m.thumbnail_path
		FROM media m
		LEFT JOIN media_tags mt ON m.id = mt.media_id
		LEFT JOIN tags t ON mt.tag_id = t.id
		WHERE m.title LIKE ? OR t.name LIKE ?
		ORDER BY m.title
	`).all(`%${q}%`, `%${q}%`) as { id: number; title: string; category: string; duration: number | null; thumbnail_path: string | null }[];

	const tagQuery = db.prepare(`
		SELECT t.name, t.category FROM tags t
		JOIN media_tags mt ON t.id = mt.tag_id
		WHERE mt.media_id = ?
	`);
	const resultsWithTags = results.map(r => ({
		...r,
		tags: tagQuery.all(r.id) as { name: string; category: string }[]
	}));

	return { query: q, results: resultsWithTags };
};
