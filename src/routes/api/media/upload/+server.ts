import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { config } from '$lib/server/config';
import { computeFileHash } from '$lib/server/file-hash';
import { guessCategoryByExtension, isValidCategory, MEDIA_EXTENSIONS, extname } from '$lib/media-types';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

function sanitizeFilename(name: string): string {
	// Strip any directory components, then neutralise unsafe characters.
	const base = name.replace(/^.*[/\\]/, '');
	return base.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') || 'upload';
}

function uniquePath(dir: string, filename: string): string {
	const ext = path.extname(filename);
	const base = path.basename(filename, ext);
	let candidate = path.join(dir, filename);
	let i = 1;
	while (fs.existsSync(candidate)) {
		candidate = path.join(dir, `${base} (${i})${ext}`);
		i++;
	}
	return candidate;
}

export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const files = formData.getAll('files') as File[];
	const category = (formData.get('category') as string) || '';

	if (files.length === 0) {
		return json({ error: 'No files provided' }, { status: 400 });
	}
	if (category && !isValidCategory(category)) {
		return json({ error: `Invalid category: ${category}` }, { status: 400 });
	}

	const mediaPath = config.mediaPath;
	if (!fs.existsSync(mediaPath)) {
		fs.mkdirSync(mediaPath, { recursive: true });
	}

	const db = getDb();
	const insert = db.prepare('INSERT INTO media (title, category, original_path, file_hash, file_size) VALUES (?, ?, ?, ?, ?)');
	const results: { id: number; title: string; category: string }[] = [];
	const errors: { name: string; error: string }[] = [];

	for (const file of files) {
		const safeName = sanitizeFilename(file.name);

		if (!MEDIA_EXTENSIONS.has(extname(safeName))) {
			errors.push({ name: file.name, error: 'Unsupported file type' });
			continue;
		}

		const filePath = uniquePath(mediaPath, safeName);
		const title = path.basename(safeName, path.extname(safeName));
		const cat = category || guessCategoryByExtension(safeName);

		try {
			const webStream = file.stream();
			const nodeStream = Readable.fromWeb(webStream as import('stream/web').ReadableStream);
			await pipeline(nodeStream, fs.createWriteStream(filePath));

			const hash = computeFileHash(filePath);
			const size = fs.statSync(filePath).size;
			const result = insert.run(title, cat, filePath, hash, size);
			results.push({ id: Number(result.lastInsertRowid), title, category: cat });
		} catch (e) {
			// Roll back the partially written file so we don't leak orphans on disk.
			try { fs.unlinkSync(filePath); } catch { /* already gone */ }
			errors.push({ name: file.name, error: (e as Error).message });
		}
	}

	const status = results.length > 0 ? 201 : 400;
	return json({ uploaded: results, errors }, { status });
};
