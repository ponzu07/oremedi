import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { getChapters, saveChapters, type Chapter } from '$lib/server/chapters';

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

	let chapters: Chapter[];
	try { chapters = await request.json(); } catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}
	saveChapters(db, mediaId, chapters);

	return json({ success: true, chapters: getChapters(db, mediaId) });
};
