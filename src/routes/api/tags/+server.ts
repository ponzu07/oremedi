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

export const PUT: RequestHandler = async ({ request }) => {
	const db = getDb();
	const { oldCategory, newCategory } = await request.json();

	if (!oldCategory || !newCategory) {
		return json({ error: 'oldCategory and newCategory required' }, { status: 400 });
	}

	const result = db.prepare('UPDATE tags SET category = ? WHERE category = ?').run(newCategory, oldCategory);
	return json({ updated: result.changes });
};

export const DELETE: RequestHandler = async ({ request }) => {
	const db = getDb();
	const { category } = await request.json();

	if (!category) {
		return json({ error: 'category required' }, { status: 400 });
	}

	const result = db.prepare('DELETE FROM tags WHERE category = ?').run(category);
	return json({ deleted: result.changes });
};
