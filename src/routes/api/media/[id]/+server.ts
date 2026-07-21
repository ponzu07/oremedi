import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { assertSafePath } from '$lib/server/config';
import { isValidCategory } from '$lib/media-types';
import fs from 'fs';

/** Best-effort delete of a media-owned file, guarded against path traversal. */
function safeUnlink(filePath: string | null | undefined) {
	if (!filePath) return;
	try {
		assertSafePath(filePath);
		fs.rmSync(filePath, { force: true });
	} catch {
		/* outside allowed dirs or already gone — ignore */
	}
}

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
	let body: Record<string, unknown>;
	try { body = await request.json(); } catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}
	const { title, category, duration, metadata, tags } = body;

	if (category != null && !isValidCategory(category)) {
		return json({ error: `Invalid category: ${category}` }, { status: 400 });
	}

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
	const existing = db.prepare('SELECT original_path, thumbnail_path FROM media WHERE id = ?')
		.get(params.id) as { original_path: string; thumbnail_path: string | null } | undefined;

	if (!existing) {
		return json({ error: 'Not found' }, { status: 404 });
	}

	db.prepare('DELETE FROM media WHERE id = ?').run(params.id);

	// Reclaim the on-disk files owned by this media (exact stored paths only).
	safeUnlink(existing.original_path);
	safeUnlink(existing.thumbnail_path);

	return json({ success: true });
};
