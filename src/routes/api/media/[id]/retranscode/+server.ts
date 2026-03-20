import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';

export const POST: RequestHandler = async ({ params }) => {
	const db = getDb();
	const media = db.prepare('SELECT id, transcode_status FROM media WHERE id = ?').get(params.id) as
		| { id: number; transcode_status: string }
		| undefined;

	if (!media) {
		return json({ error: 'Not found' }, { status: 404 });
	}

	db.prepare(
		"UPDATE media SET transcode_status = 'pending', converted_path = NULL, updated_at = datetime('now') WHERE id = ?"
	).run(params.id);

	return json({ success: true });
};
