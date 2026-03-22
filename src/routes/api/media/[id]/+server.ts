import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';

export const GET: RequestHandler = async ({ params }) => {
	const db = getDb();
	const media = db.prepare('SELECT * FROM media WHERE id = ?').get(params.id) as Record<string, unknown> | undefined;

	if (!media) {
		return json({ error: 'Not found' }, { status: 404 });
	}

	const metadata = db.prepare(
		'SELECT key, value FROM media_metadata WHERE media_id = ?'
	).all(params.id);

	const tags = db.prepare(`
		SELECT t.id, t.name, t.category FROM tags t
		JOIN media_tags mt ON t.id = mt.tag_id
		WHERE mt.media_id = ?
	`).all(params.id);

	return json({ ...media, metadata, tags });
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const db = getDb();
	const body = await request.json();
	const { title, category, duration, metadata, tags } = body;

	const existing = db.prepare('SELECT id FROM media WHERE id = ?').get(params.id);
	if (!existing) {
		return json({ error: 'Not found' }, { status: 404 });
	}

	db.prepare(`
		UPDATE media SET
			title = COALESCE(?, title),
			category = COALESCE(?, category),
			duration = COALESCE(?, duration),
			updated_at = datetime('now')
		WHERE id = ?
	`).run(title ?? null, category ?? null, duration ?? null, params.id);

	if (metadata && typeof metadata === 'object') {
		db.prepare('DELETE FROM media_metadata WHERE media_id = ?').run(params.id);
		const insertMeta = db.prepare(
			'INSERT INTO media_metadata (media_id, key, value) VALUES (?, ?, ?)'
		);
		for (const [key, value] of Object.entries(metadata)) {
			insertMeta.run(params.id, key, String(value));
		}
	}

	if (tags && Array.isArray(tags)) {
		db.prepare('DELETE FROM media_tags WHERE media_id = ?').run(params.id);
		for (const tag of tags) {
			const existingTag = db.prepare(
				'SELECT id FROM tags WHERE name = ? AND category = ?'
			).get(tag.name, tag.category) as { id: number } | undefined;

			let tagId: number;
			if (existingTag) {
				tagId = existingTag.id;
			} else {
				const tagResult = db.prepare(
					'INSERT INTO tags (name, category) VALUES (?, ?)'
				).run(tag.name, tag.category);
				tagId = Number(tagResult.lastInsertRowid);
			}

			db.prepare('INSERT OR IGNORE INTO media_tags (media_id, tag_id) VALUES (?, ?)').run(params.id, tagId);
		}
	}

	const updated = db.prepare('SELECT * FROM media WHERE id = ?').get(params.id) as Record<string, unknown>;
	const updatedMeta = db.prepare('SELECT key, value FROM media_metadata WHERE media_id = ?').all(params.id);
	const updatedTags = db.prepare(`
		SELECT t.id, t.name, t.category FROM tags t
		JOIN media_tags mt ON t.id = mt.tag_id
		WHERE mt.media_id = ?
	`).all(params.id);

	return json({ ...updated, metadata: updatedMeta, tags: updatedTags });
};

export const DELETE: RequestHandler = async ({ params }) => {
	const db = getDb();
	const existing = db.prepare('SELECT id FROM media WHERE id = ?').get(params.id);

	if (!existing) {
		return json({ error: 'Not found' }, { status: 404 });
	}

	db.prepare('DELETE FROM media WHERE id = ?').run(params.id);
	return json({ success: true });
};
