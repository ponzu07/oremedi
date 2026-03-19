import type { PageServerLoad } from './$types';
import type { Media } from '$lib/types';
import { getDb } from '$lib/server/database';

interface MovieRow extends Media {
	genre_value: string | null;
}

export const load: PageServerLoad = async ({ url }) => {
	const db = getDb();
	const genre = url.searchParams.get('genre');

	let query = `
		SELECT m.*, GROUP_CONCAT(DISTINCT mm.value) as genre_value
		FROM media m
		LEFT JOIN media_metadata mm ON m.id = mm.media_id AND mm.key = 'genre'
		WHERE m.category = 'movie'
	`;
	const params: unknown[] = [];

	if (genre) {
		query += ' AND mm.value = ?';
		params.push(genre);
	}

	query += ' GROUP BY m.id ORDER BY m.title';

	const movies = db.prepare(query).all(...params) as MovieRow[];

	const genres = db.prepare(`
		SELECT DISTINCT value FROM media_metadata
		WHERE key = 'genre' AND media_id IN (SELECT id FROM media WHERE category = 'movie')
		ORDER BY value
	`).all() as { value: string }[];

	return { movies, genres: genres.map((g) => g.value), currentGenre: genre };
};
