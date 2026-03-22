import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';

export const PUT: RequestHandler = async ({ params, request }) => {
	const db = getDb();
	const body = await request.json();
	const { name, category } = body;

	const existing = db.prepare('SELECT id FROM tags WHERE id = ?').get(params.id);
	if (!existing) {
		return json({ error: 'Not found' }, { status: 404 });
	}

	db.prepare('UPDATE tags SET name = COALESCE(?, name), category = COALESCE(?, category) WHERE id = ?')
		.run(name ?? null, category ?? null, params.id);

	const updated = db.prepare('SELECT * FROM tags WHERE id = ?').get(params.id);
	return json(updated);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const db = getDb();
	const existing = db.prepare('SELECT id FROM tags WHERE id = ?').get(params.id);
	if (!existing) {
		return json({ error: 'Not found' }, { status: 404 });
	}

	db.prepare('DELETE FROM tags WHERE id = ?').run(params.id);
	return json({ success: true });
};
