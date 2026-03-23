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

	const resultIds = results.map((r) => r.id);
	const tagsMap = new Map<number, { name: string; category: string }[]>();
	if (resultIds.length > 0) {
		const placeholders = resultIds.map(() => '?').join(',');
		const allTags = db.prepare(`
			SELECT mt.media_id, t.name, t.category FROM tags t
			JOIN media_tags mt ON t.id = mt.tag_id
			WHERE mt.media_id IN (${placeholders})
		`).all(...resultIds) as { media_id: number; name: string; category: string }[];
		for (const t of allTags) {
			if (!tagsMap.has(t.media_id)) tagsMap.set(t.media_id, []);
			tagsMap.get(t.media_id)!.push({ name: t.name, category: t.category });
		}
	}
	const resultsWithTags = results.map(r => ({
		...r,
		tags: tagsMap.get(r.id) ?? []
	}));

	return { query: q, results: resultsWithTags };
};
