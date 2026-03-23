import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';

export const GET: RequestHandler = async ({ url }) => {
	const db = getDb();
	const category = url.searchParams.get('category');
	const search = url.searchParams.get('search');
	const tag = url.searchParams.get('tag');

	let query = `
		SELECT DISTINCT m.* FROM media m
	`;
	const conditions: string[] = [];
	const params: unknown[] = [];

	if (tag) {
		query += ` JOIN media_tags mt ON m.id = mt.media_id JOIN tags t ON mt.tag_id = t.id`;
		conditions.push('t.name = ?');
		params.push(tag);
	}

	if (category) {
		conditions.push('m.category = ?');
		params.push(category);
	}

	if (search) {
		conditions.push('m.title LIKE ?');
		params.push(`%${search}%`);
	}

	if (conditions.length > 0) {
		query += ' WHERE ' + conditions.join(' AND ');
	}

	query += ' ORDER BY m.created_at DESC';

	const media = db.prepare(query).all(...params);
	return json(media);
};

export const POST: RequestHandler = async ({ request }) => {
	const db = getDb();
	let body: Record<string, unknown>;
	try { body = await request.json(); } catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	const { title, category, original_path, duration, metadata, tags } = body;

	if (!title || !category || !original_path) {
		return json({ error: 'title, category, and original_path are required' }, { status: 400 });
	}

	const result = db.prepare(`
		INSERT INTO media (title, category, original_path, duration)
		VALUES (?, ?, ?, ?)
	`).run(title, category, original_path, duration ?? null);

	const mediaId = result.lastInsertRowid;

	if (metadata && typeof metadata === 'object') {
		const insertMeta = db.prepare(`
			INSERT INTO media_metadata (media_id, key, value) VALUES (?, ?, ?)
		`);
		for (const [key, value] of Object.entries(metadata)) {
			insertMeta.run(mediaId, key, String(value));
		}
	}

	if (tags && Array.isArray(tags)) {
		for (const tag of tags) {
			const existing = db.prepare(
				'SELECT id FROM tags WHERE name = ? AND category = ?'
			).get(tag.name, tag.category) as { id: number } | undefined;

			let tagId: number;
			if (existing) {
				tagId = existing.id;
			} else {
				const tagResult = db.prepare(
					'INSERT INTO tags (name, category) VALUES (?, ?)'
				).run(tag.name, tag.category);
				tagId = Number(tagResult.lastInsertRowid);
			}

			db.prepare('INSERT OR IGNORE INTO media_tags (media_id, tag_id) VALUES (?, ?)').run(mediaId, tagId);
		}
	}

	const created = db.prepare('SELECT * FROM media WHERE id = ?').get(mediaId);
	return json(created, { status: 201 });
};
