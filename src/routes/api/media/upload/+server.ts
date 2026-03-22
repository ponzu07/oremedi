import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { config } from '$lib/server/config';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

const VIDEO_EXTENSIONS = new Set([
	'.mp4', '.mkv', '.avi', '.wmv', '.flv', '.mov', '.webm'
]);

function guessCategory(filename: string): string {
	const ext = path.extname(filename).toLowerCase();
	return VIDEO_EXTENSIONS.has(ext) ? 'movie' : 'music';
}

function sanitizeFilename(name: string): string {
	return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
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

	const mediaPath = config.mediaPath;
	if (!fs.existsSync(mediaPath)) {
		fs.mkdirSync(mediaPath, { recursive: true });
	}

	const db = getDb();
	const insert = db.prepare('INSERT INTO media (title, category, original_path) VALUES (?, ?, ?)');
	const results: { id: number; title: string; category: string }[] = [];

	for (const file of files) {
		const safeName = sanitizeFilename(file.name);
		const filePath = uniquePath(mediaPath, safeName);
		const title = path.basename(safeName, path.extname(safeName));
		const cat = category || guessCategory(file.name);

		const webStream = file.stream();
		const nodeStream = Readable.fromWeb(webStream as import('stream/web').ReadableStream);
		await pipeline(nodeStream, fs.createWriteStream(filePath));

		const result = insert.run(title, cat, filePath);
		results.push({ id: Number(result.lastInsertRowid), title, category: cat });
	}

	return json({ uploaded: results }, { status: 201 });
};
