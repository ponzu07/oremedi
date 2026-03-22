import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { config } from '$lib/server/config';
import { computeFileHash } from '$lib/server/file-hash';
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

	const diskFiles = scanDirectory(mediaPath);
	const diskFileSet = new Set(diskFiles);

	// Load all existing media
	const allMedia = db.prepare('SELECT id, original_path, file_hash FROM media').all() as {
		id: number;
		original_path: string;
		file_hash: string | null;
	}[];

	const existingPaths = new Set(allMedia.map(m => m.original_path));
	const hashToMedia = new Map<string, { id: number; original_path: string }>();
	for (const m of allMedia) {
		if (m.file_hash) {
			hashToMedia.set(m.file_hash, { id: m.id, original_path: m.original_path });
		}
	}

	let added = 0;
	let moved = 0;
	let skipped = 0;
	let hashUpdated = 0;

	const insert = db.prepare('INSERT INTO media (title, category, original_path, file_hash) VALUES (?, ?, ?, ?)');
	const updatePath = db.prepare("UPDATE media SET original_path = ?, title = ?, updated_at = datetime('now') WHERE id = ?");
	const updateHash = db.prepare('UPDATE media SET file_hash = ? WHERE id = ?');

	// Phase 1: Backfill hashes for existing media that don't have one
	for (const m of allMedia) {
		if (!m.file_hash && fs.existsSync(m.original_path)) {
			const hash = computeFileHash(m.original_path);
			if (hash) {
				updateHash.run(hash, m.id);
				hashToMedia.set(hash, { id: m.id, original_path: m.original_path });
				hashUpdated++;
			}
		}
	}

	// Phase 2: Process disk files
	for (const filePath of diskFiles) {
		if (existingPaths.has(filePath)) {
			skipped++;
			continue;
		}

		const hash = computeFileHash(filePath);

		// Check if this file was moved/renamed (hash matches existing entry with missing file)
		if (hash && hashToMedia.has(hash)) {
			const existing = hashToMedia.get(hash)!;
			if (!fs.existsSync(existing.original_path)) {
				const newTitle = path.basename(filePath, path.extname(filePath));
				updatePath.run(filePath, newTitle, existing.id);
				existingPaths.delete(existing.original_path);
				existingPaths.add(filePath);
				moved++;
				continue;
			}
		}

		// New file
		const title = path.basename(filePath, path.extname(filePath));
		const category = guessCategory(filePath);
		insert.run(title, category, filePath, hash);
		added++;
	}

	// Phase 3: Detect orphans (DB entries where file no longer exists on disk)
	let orphaned = 0;
	for (const m of allMedia) {
		if (!diskFileSet.has(m.original_path) && !fs.existsSync(m.original_path)) {
			orphaned++;
		}
	}

	return json({ added, moved, skipped, orphaned, hashUpdated, total: diskFiles.length });
};
