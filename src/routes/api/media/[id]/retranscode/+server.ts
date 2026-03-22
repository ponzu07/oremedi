import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';

export const POST: RequestHandler = async ({ params }) => {
	const db = getDb();
	const media = db.prepare('SELECT id FROM media WHERE id = ?').get(params.id);

	if (!media) {
		return json({ error: 'Not found' }, { status: 404 });
	}

	db.prepare(
		"UPDATE media SET transcode_status = 'pending', updated_at = datetime('now') WHERE id = ?"
	).run(params.id);

	return json({ success: true });
};
