import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { getChapters, saveChapters, isValidChapterArray, type Chapter } from '$lib/server/chapters';

export const GET: RequestHandler = async ({ params }) => {
	const db = getDb();
	const chapters = getChapters(db, Number(params.id));
	return json(chapters);
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const db = getDb();
	const mediaId = Number(params.id);

	const existing = db.prepare('SELECT id FROM media WHERE id = ?').get(mediaId);
	if (!existing) {
		return json({ error: 'Not found' }, { status: 404 });
	}

	let chapters: unknown;
	try { chapters = await request.json(); } catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}
	// Validate BEFORE touching the DB so a malformed body cannot wipe existing chapters.
	if (!isValidChapterArray(chapters)) {
		return json({ error: 'Expected an array of { start_time, end_time, title }' }, { status: 400 });
	}
	saveChapters(db, mediaId, chapters as Chapter[]);

	return json({ success: true, chapters: getChapters(db, mediaId) });
};
