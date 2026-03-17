import Database from 'better-sqlite3';

export function createDatabase(dbPath: string): Database.Database {
	const db = new Database(dbPath);

	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');

	db.exec(`
		CREATE TABLE IF NOT EXISTS media (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			category TEXT NOT NULL CHECK(category IN ('movie', 'live_video', 'voice', 'music')),
			duration INTEGER,
			original_path TEXT NOT NULL UNIQUE,
			converted_path TEXT,
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
			category TEXT NOT NULL CHECK(category IN ('artist', 'speaker', 'genre', 'custom')),
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
