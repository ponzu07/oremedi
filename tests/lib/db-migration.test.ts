import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import Database from 'better-sqlite3';
import { createDatabase } from '../../src/lib/server/db';

const TEST_DB_PATH = '/tmp/oremedi-legacy-migration-test.db';

function cleanup() {
	for (const suffix of ['', '-wal', '-shm']) {
		const p = TEST_DB_PATH + suffix;
		if (fs.existsSync(p)) fs.unlinkSync(p);
	}
}

// Reproduces a database created before the tags CHECK constraint was removed and
// verifies the migration preserves media_tags instead of cascade-deleting them.
describe('legacy tags CHECK migration', () => {
	beforeEach(cleanup);
	afterEach(cleanup);

	it('drops the CHECK constraint while preserving media_tags rows and FK integrity', () => {
		const raw = new Database(TEST_DB_PATH);
		raw.pragma('foreign_keys = ON');
		raw.exec(`
			CREATE TABLE media (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				title TEXT NOT NULL,
				category TEXT NOT NULL CHECK(category IN ('movie', 'live_video', 'voice', 'music')),
				duration INTEGER,
				original_path TEXT NOT NULL UNIQUE,
				thumbnail_path TEXT,
				transcode_status TEXT NOT NULL DEFAULT 'pending',
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
			);
			CREATE TABLE tags (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL,
				category TEXT NOT NULL CHECK(category IN ('artist','speaker','genre','custom')),
				UNIQUE(name, category)
			);
			CREATE TABLE media_tags (
				media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
				tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
				PRIMARY KEY (media_id, tag_id)
			);
		`);
		raw.prepare('INSERT INTO media (title, category, original_path) VALUES (?, ?, ?)').run('M', 'movie', '/media/m.mp4');
		raw.prepare('INSERT INTO tags (name, category) VALUES (?, ?)').run('Action', 'genre');
		raw.prepare('INSERT INTO media_tags (media_id, tag_id) VALUES (1, 1)').run();
		raw.close();

		const db = createDatabase(TEST_DB_PATH);

		// The CHECK constraint is gone.
		const tagsSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tags'").get() as { sql: string }).sql;
		expect(tagsSql).not.toContain('CHECK');

		// The association survived (the bug being fixed cascade-deleted it).
		const link = db.prepare('SELECT COUNT(*) AS c FROM media_tags').get() as { c: number };
		expect(link.c).toBe(1);

		// Referential integrity is intact.
		expect((db.pragma('foreign_key_check') as unknown[]).length).toBe(0);

		// A category that the old CHECK would have rejected now works, and new
		// associations can still be created (proves media_tags references live tags).
		const newTag = db.prepare('INSERT INTO tags (name, category) VALUES (?, ?)').run('Speaker A', 'speaker_custom');
		expect(() => db.prepare('INSERT INTO media_tags (media_id, tag_id) VALUES (?, ?)').run(1, Number(newTag.lastInsertRowid))).not.toThrow();

		db.close();
	});

	it('is a no-op on a fresh database (no CHECK to remove)', () => {
		const db = createDatabase(TEST_DB_PATH);
		const tagsSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tags'").get() as { sql: string }).sql;
		expect(tagsSql).not.toContain('CHECK');
		expect((db.pragma('foreign_key_check') as unknown[]).length).toBe(0);
		db.close();
	});
});
