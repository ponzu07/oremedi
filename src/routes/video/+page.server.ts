import type { PageServerLoad } from './$types';
import type { Media } from '$lib/types';
import { getDb } from '$lib/server/database';

interface MovieRow extends Media {
	genre_value: string | null;
}

interface LiveItem extends Media {
	tags: { name: string; category: string }[];
	meta: Record<string, string>;
}

export const load: PageServerLoad = async ({ url }) => {
	const db = getDb();
	const sub = url.searchParams.get('sub'); // 'movie' | 'live' | null (all)
	const tag = url.searchParams.get('tag');
	const genre = url.searchParams.get('genre');

	let movies: MovieRow[] = [];
	let liveItems: LiveItem[] = [];
	let genres: string[] = [];
	let tags: { name: string; category: string }[] = [];

	// Fetch movies if sub is null (all) or 'movie'
	if (!sub || sub === 'movie') {
		let movieQuery = `
			SELECT m.*, GROUP_CONCAT(DISTINCT mm.value) as genre_value
			FROM media m
			LEFT JOIN media_metadata mm ON m.id = mm.media_id AND mm.key = 'genre'
			WHERE m.category = 'movie'
		`;
		const movieParams: unknown[] = [];

		if (genre) {
			movieQuery += ' AND mm.value = ?';
			movieParams.push(genre);
		}

		movieQuery += ' GROUP BY m.id ORDER BY m.title';
		movies = db.prepare(movieQuery).all(...movieParams) as MovieRow[];

		const genreRows = db.prepare(`
			SELECT DISTINCT value FROM media_metadata
			WHERE key = 'genre' AND media_id IN (SELECT id FROM media WHERE category = 'movie')
			ORDER BY value
		`).all() as { value: string }[];
		genres = genreRows.map((g) => g.value);
	}

	// Fetch live videos if sub is null (all) or 'live'
	if (!sub || sub === 'live') {
		let liveQuery = 'SELECT DISTINCT m.* FROM media m';
		const liveParams: unknown[] = [];

		if (tag) {
			liveQuery += ' JOIN media_tags mt ON m.id = mt.media_id JOIN tags t ON mt.tag_id = t.id';
			liveQuery += " WHERE m.category = 'live_video' AND t.name = ?";
			liveParams.push(tag);
		} else {
			liveQuery += " WHERE m.category = 'live_video'";
		}

		liveQuery += ' ORDER BY m.created_at DESC';
		const items = db.prepare(liveQuery).all(...liveParams) as Media[];

		// Get all tags for live videos
		tags = db.prepare(`
			SELECT DISTINCT t.name, t.category FROM tags t
			JOIN media_tags mt ON t.id = mt.tag_id
			JOIN media m ON mt.media_id = m.id
			WHERE m.category = 'live_video'
			ORDER BY t.name
		`).all() as { name: string; category: string }[];

		// Attach tags and metadata to each item
		liveItems = items.map((item) => {
			const itemTags = db.prepare(`
				SELECT t.name, t.category FROM tags t
				JOIN media_tags mt ON t.id = mt.tag_id
				WHERE mt.media_id = ?
			`).all(item.id) as { name: string; category: string }[];

			const meta = db.prepare(
				'SELECT key, value FROM media_metadata WHERE media_id = ?'
			).all(item.id) as { key: string; value: string }[];
			const metaObj: Record<string, string> = {};
			for (const m of meta) metaObj[m.key] = m.value;

			return { ...item, tags: itemTags, meta: metaObj };
		});
	}

	return {
		movies,
		liveItems,
		genres,
		tags,
		currentSub: sub,
		currentTag: tag,
		currentGenre: genre
	};
};
