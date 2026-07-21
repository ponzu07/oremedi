import Database from 'better-sqlite3';

export function createDatabase(dbPath: string): Database.Database {
	const db = new Database(dbPath);

	db.pragma('journal_mode = WAL');

	// Migrations run with foreign keys temporarily disabled so table rebuilds
	// cannot cascade-delete child rows. `foreign_keys` can only be toggled
	// outside a transaction, so set it here (before db.transaction) and restore
	// it after the migration commits.
	db.pragma('foreign_keys = OFF');

	const migrate = db.transaction(() => {
		// Remove the legacy CHECK constraint from tags.category if present.
		// Build a fresh table and rename it INTO place (rather than renaming the
		// old table out) so no child FK in media_tags is ever rewritten and the
		// DROP cannot cascade — preserving all media_tags rows.
		const tagsTableInfo = db.prepare(
			"SELECT sql FROM sqlite_master WHERE type='table' AND name='tags'"
		).get() as { sql: string } | undefined;
		if (tagsTableInfo?.sql?.includes('CHECK')) {
			db.exec(`
				CREATE TABLE tags_new (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					name TEXT NOT NULL,
					category TEXT NOT NULL,
					UNIQUE(name, category)
				);
				INSERT INTO tags_new (id, name, category) SELECT id, name, category FROM tags;
				DROP TABLE tags;
				ALTER TABLE tags_new RENAME TO tags;
			`);
		}

		// Media column migrations
		const mediaColumns = db.prepare("PRAGMA table_info('media')").all() as { name: string }[];
		const colNames = new Set(mediaColumns.map((c) => c.name));

		if (colNames.has('converted_path')) {
			db.exec('ALTER TABLE media DROP COLUMN converted_path');
		}
		if (mediaColumns.length > 0 && !colNames.has('transcode_progress')) {
			db.exec('ALTER TABLE media ADD COLUMN transcode_progress INTEGER NOT NULL DEFAULT 0');
		}
		if (mediaColumns.length > 0 && !colNames.has('file_hash')) {
			db.exec('ALTER TABLE media ADD COLUMN file_hash TEXT');
		}
		if (mediaColumns.length > 0 && !colNames.has('file_size')) {
			db.exec('ALTER TABLE media ADD COLUMN file_size INTEGER');
		}
	});
	migrate();

	// Verify the migration left referential integrity intact before re-enabling.
	const fkViolations = db.pragma('foreign_key_check') as unknown[];
	if (fkViolations.length > 0) {
		console.error('[db] foreign_key_check reported violations after migration:', fkViolations);
	}
	db.pragma('foreign_keys = ON');

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
			transcode_progress INTEGER NOT NULL DEFAULT 0,
			file_hash TEXT,
			file_size INTEGER,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE INDEX IF NOT EXISTS idx_media_category ON media(category);
		CREATE INDEX IF NOT EXISTS idx_media_created ON media(created_at);
		CREATE INDEX IF NOT EXISTS idx_media_status ON media(transcode_status);

		CREATE TABLE IF NOT EXISTS media_chapters (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
			start_time REAL NOT NULL,
			end_time REAL NOT NULL,
			title TEXT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_chapters_media ON media_chapters(media_id);

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
