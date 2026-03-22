import Database from 'better-sqlite3';

export function createDatabase(dbPath: string): Database.Database {
	const db = new Database(dbPath);

	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');

	// Migrate: remove CHECK constraint from tags.category if it exists
	const tagsTableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tags'").get() as { sql: string } | undefined;
	if (tagsTableInfo?.sql?.includes('CHECK')) {
		db.exec(`
			ALTER TABLE tags RENAME TO tags_old;
			CREATE TABLE tags (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL,
				category TEXT NOT NULL,
				UNIQUE(name, category)
			);
			INSERT INTO tags SELECT * FROM tags_old;
			DROP TABLE tags_old;
		`);
	}

	// Migrate: drop converted_path column from media if it exists
	const mediaColumns = db.prepare("PRAGMA table_info('media')").all() as { name: string }[];
	if (mediaColumns.some(c => c.name === 'converted_path')) {
		db.exec("ALTER TABLE media DROP COLUMN converted_path");
	}

	db.exec(`
		CREATE TABLE IF NOT EXISTS media (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			category TEXT NOT NULL CHECK(category IN ('movie', 'live_video', 'voice', 'music')),
			duration INTEGER,
			original_path TEXT NOT NULL UNIQUE,
			thumbnail_path TEXT,
			transcode_status TEXT NOT NULL DEFAULT 'pending'
				CHECK(transcode_status IN ('pending', 'processing', 'ready', 'failed', 'skipped')),
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS media_metadata (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
			key TEXT NOT NULL,
			value TEXT NOT NULL,
			UNIQUE(media_id, key)
		);

		CREATE TABLE IF NOT EXISTS tags (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			category TEXT NOT NULL,
			UNIQUE(name, category)
		);

		CREATE TABLE IF NOT EXISTS media_tags (
			media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
			tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
			PRIMARY KEY (media_id, tag_id)
		);
	`);

	return db;
}
