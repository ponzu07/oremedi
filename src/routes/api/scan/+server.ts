import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { config } from '$lib/server/config';
import { computeFileHash } from '$lib/server/file-hash';
import { MEDIA_EXTENSIONS, guessCategoryByExtension, extname, type MediaCategory } from '$lib/media-types';
import fs from 'fs';
import path from 'path';

function scanDirectory(dir: string): string[] {
	const files: string[] = [];
	if (!fs.existsSync(dir)) return files;

	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...scanDirectory(fullPath));
		} else if (MEDIA_EXTENSIONS.has(extname(entry.name))) {
			files.push(fullPath);
		}
	}
	return files;
}

function guessCategory(filePath: string): MediaCategory {
	const relativePath = filePath.replace(config.mediaPath, '').toLowerCase();

	if (relativePath.includes('/movie')) return 'movie';
	if (relativePath.includes('/live')) return 'live_video';
	if (relativePath.includes('/voice')) return 'voice';
	if (relativePath.includes('/music')) return 'music';

	// No directory hint: fall back to extension (audio defaults to 'voice' here).
	return guessCategoryByExtension(filePath, 'voice');
}

function fileSizeOf(filePath: string): number | null {
	try { return fs.statSync(filePath).size; } catch { return null; }
}

interface MediaEntry {
	id: number;
	original_path: string;
	file_hash: string | null;
	file_size: number | null;
}

export const POST: RequestHandler = async () => {
	const db = getDb();
	const mediaPath = config.mediaPath;

	if (!fs.existsSync(mediaPath)) {
		return json({ error: 'Media path not found' }, { status: 400 });
	}

	const diskFiles = scanDirectory(mediaPath);
	const diskFileSet = new Set(diskFiles);

	const allMedia = db.prepare('SELECT id, original_path, file_hash, file_size FROM media').all() as MediaEntry[];

	const existingPaths = new Set(allMedia.map((m) => m.original_path));
	const hashToMedia = new Map<string, MediaEntry>();
	for (const m of allMedia) {
		if (m.file_hash) hashToMedia.set(m.file_hash, m);
	}

	let added = 0;
	let moved = 0;
	let skipped = 0;
	let hashUpdated = 0;

	const insert = db.prepare('INSERT INTO media (title, category, original_path, file_hash, file_size) VALUES (?, ?, ?, ?, ?)');
	const updatePath = db.prepare("UPDATE media SET original_path = ?, title = ?, updated_at = datetime('now') WHERE id = ?");
	const updateHashSize = db.prepare('UPDATE media SET file_hash = ?, file_size = ? WHERE id = ?');

	// Phase 1: Backfill hash + size for existing media that lack them.
	for (const m of allMedia) {
		if ((!m.file_hash || m.file_size == null) && fs.existsSync(m.original_path)) {
			const hash = m.file_hash ?? computeFileHash(m.original_path);
			const size = m.file_size ?? fileSizeOf(m.original_path);
			if (hash) {
				updateHashSize.run(hash, size, m.id);
				m.file_hash = hash;
				m.file_size = size;
				hashToMedia.set(hash, m);
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
		const size = fileSizeOf(filePath);

		// Moved/renamed detection: a hash match is only trusted when the file
		// size also matches, since the hash covers just the first 64KB and could
		// otherwise re-point an existing media row at an unrelated file.
		if (hash && hashToMedia.has(hash)) {
			const existing = hashToMedia.get(hash)!;
			const sizeMatches = existing.file_size == null || size == null || existing.file_size === size;
			if (sizeMatches && !fs.existsSync(existing.original_path)) {
				const newTitle = path.basename(filePath, path.extname(filePath));
				updatePath.run(filePath, newTitle, existing.id);
				existingPaths.delete(existing.original_path);
				existingPaths.add(filePath);
				existing.original_path = filePath;
				moved++;
				continue;
			}
		}

		// New file
		const title = path.basename(filePath, path.extname(filePath));
		const category = guessCategory(filePath);
		insert.run(title, category, filePath, hash, size);
		added++;
	}

	// Phase 3: Detect orphans (DB entries whose file no longer exists on disk)
	let orphaned = 0;
	for (const m of allMedia) {
		if (!diskFileSet.has(m.original_path) && !fs.existsSync(m.original_path)) {
			orphaned++;
		}
	}

	return json({ added, moved, skipped, orphaned, hashUpdated, total: diskFiles.length });
};
