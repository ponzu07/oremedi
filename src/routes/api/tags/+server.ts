import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';

export const GET: RequestHandler = async ({ url }) => {
	const db = getDb();
	const category = url.searchParams.get('category');

	let query = 'SELECT * FROM tags';
	const params: unknown[] = [];

	if (category) {
		query += ' WHERE category = ?';
		params.push(category);
	}

	query += ' ORDER BY name';

	const tags = db.prepare(query).all(...params);
	return json(tags);
};
