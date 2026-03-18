import { createDatabase } from './db';
import { config } from './config';
import fs from 'fs';
import path from 'path';

let db: ReturnType<typeof createDatabase> | null = null;

export function getDb() {
	if (!db) {
		const dir = path.dirname(config.databasePath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		db = createDatabase(config.databasePath);
	}
	return db;
}
