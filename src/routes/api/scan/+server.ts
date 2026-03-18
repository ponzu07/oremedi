import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { config } from '$lib/server/config';
import fs from 'fs';
import path from 'path';

const MEDIA_EXTENSIONS = new Set([
	'.mp4', '.mkv', '.avi', '.wmv', '.flv', '.mov', '.webm',
	'.mp3', '.flac', '.aac', '.ogg', '.wav', '.m4a', '.wma'
]);

const VIDEO_EXTENSIONS = new Set([
	'.mp4', '.mkv', '.avi', '.wmv', '.flv', '.mov', '.webm'
]);

function scanDirectory(dir: string): string[] {
	const files: string[] = [];
	if (!fs.existsSync(dir)) return files;

	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...scanDirectory(fullPath));
		} else if (MEDIA_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
			files.push(fullPath);
		}
	}
	return files;
}

function guessCategory(filePath: string): string {
	const ext = path.extname(filePath).toLowerCase();
	const relativePath = filePath.replace(config.mediaPath, '').toLowerCase();

	if (relativePath.includes('/movie')) return 'movie';
	if (relativePath.includes('/live')) return 'live_video';
	if (relativePath.includes('/voice')) return 'voice';
	if (relativePath.includes('/music')) return 'music';

	return VIDEO_EXTENSIONS.has(ext) ? 'movie' : 'voice';
}

export const POST: RequestHandler = async () => {
	const db = getDb();
	const mediaPath = config.mediaPath;

	if (!fs.existsSync(mediaPath)) {
		return json({ error: `Media path not found: ${mediaPath}` }, { status: 400 });
	}

	const files = scanDirectory(mediaPath);
	const existingPaths = new Set(
		(db.prepare('SELECT original_path FROM media').all() as { original_path: string }[])
			.map((r) => r.original_path)
	);

	let added = 0;
	let skipped = 0;

	const insert = db.prepare(`
		INSERT INTO media (title, category, original_path)
		VALUES (?, ?, ?)
	`);

	for (const filePath of files) {
		if (existingPaths.has(filePath)) {
			skipped++;
			continue;
		}

		const title = path.basename(filePath, path.extname(filePath));
		const category = guessCategory(filePath);

		insert.run(title, category, filePath);
		added++;
	}

	return json({ added, skipped, total: files.length });
};
