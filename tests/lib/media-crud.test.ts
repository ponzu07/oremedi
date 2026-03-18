import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import { createDatabase } from '../../src/lib/server/db';

const TEST_DB_PATH = '/tmp/oremedi-media-test.db';

describe('media CRUD', () => {
	let db: ReturnType<typeof createDatabase>;

	beforeEach(() => {
		if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
		db = createDatabase(TEST_DB_PATH);
	});

	afterEach(() => {
		db.close();
		if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
	});

	it('inserts and retrieves media', () => {
		db.prepare(
			'INSERT INTO media (title, category, original_path) VALUES (?, ?, ?)'
		).run('Test Movie', 'movie', '/media/test.mp4');

		const media = db.prepare('SELECT * FROM media WHERE title = ?').get('Test Movie') as any;
		expect(media).toBeTruthy();
		expect(media.category).toBe('movie');
		expect(media.transcode_status).toBe('pending');
	});

	it('inserts and retrieves tags', () => {
		db.prepare('INSERT INTO tags (name, category) VALUES (?, ?)').run('Action', 'genre');
		const tag = db.prepare('SELECT * FROM tags WHERE name = ?').get('Action') as any;
		expect(tag).toBeTruthy();
		expect(tag.category).toBe('genre');
	});

	it('links media to tags', () => {
		const mediaResult = db.prepare(
			'INSERT INTO media (title, category, original_path) VALUES (?, ?, ?)'
		).run('Test', 'movie', '/media/test.mp4');
		const tagResult = db.prepare(
			'INSERT INTO tags (name, category) VALUES (?, ?)'
		).run('Action', 'genre');

		db.prepare(
			'INSERT INTO media_tags (media_id, tag_id) VALUES (?, ?)'
		).run(mediaResult.lastInsertRowid, tagResult.lastInsertRowid);

		const tags = db.prepare(`
			SELECT t.* FROM tags t
			JOIN media_tags mt ON t.id = mt.tag_id
			WHERE mt.media_id = ?
		`).all(mediaResult.lastInsertRowid);

		expect(tags).toHaveLength(1);
	});

	it('stores and retrieves metadata', () => {
		const mediaResult = db.prepare(
			'INSERT INTO media (title, category, original_path) VALUES (?, ?, ?)'
		).run('Test', 'movie', '/media/test.mp4');

		db.prepare(
			'INSERT INTO media_metadata (media_id, key, value) VALUES (?, ?, ?)'
		).run(mediaResult.lastInsertRowid, 'genre', 'Sci-Fi');

		const meta = db.prepare(
			'SELECT * FROM media_metadata WHERE media_id = ?'
		).all(mediaResult.lastInsertRowid) as any[];

		expect(meta).toHaveLength(1);
		expect(meta[0].key).toBe('genre');
		expect(meta[0].value).toBe('Sci-Fi');
	});

	it('cascades delete to metadata and tags', () => {
		const mediaResult = db.prepare(
			'INSERT INTO media (title, category, original_path) VALUES (?, ?, ?)'
		).run('Test', 'movie', '/media/test.mp4');

		const mediaId = mediaResult.lastInsertRowid;

		db.prepare(
			'INSERT INTO media_metadata (media_id, key, value) VALUES (?, ?, ?)'
		).run(mediaId, 'genre', 'Sci-Fi');

		const tagResult = db.prepare(
			'INSERT INTO tags (name, category) VALUES (?, ?)'
		).run('Action', 'genre');

		db.prepare(
			'INSERT INTO media_tags (media_id, tag_id) VALUES (?, ?)'
		).run(mediaId, tagResult.lastInsertRowid);

		db.prepare('DELETE FROM media WHERE id = ?').run(mediaId);

		const meta = db.prepare('SELECT * FROM media_metadata WHERE media_id = ?').all(mediaId);
		const mediaTags = db.prepare('SELECT * FROM media_tags WHERE media_id = ?').all(mediaId);

		expect(meta).toHaveLength(0);
		expect(mediaTags).toHaveLength(0);
	});
});
