import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';

export const GET: RequestHandler = async () => {
	const db = getDb();

	const pending = db.prepare(
		"SELECT COUNT(*) as count FROM media WHERE transcode_status = 'pending'"
	).get() as { count: number };

	const processing = db.prepare(
		"SELECT COUNT(*) as count FROM media WHERE transcode_status = 'processing'"
	).get() as { count: number };

	const failed = db.prepare(
		"SELECT COUNT(*) as count FROM media WHERE transcode_status = 'failed'"
	).get() as { count: number };

	const queue = db.prepare(
		"SELECT id, title, transcode_status FROM media WHERE transcode_status IN ('pending', 'processing') ORDER BY created_at"
	).all();

	return json({
		pending: pending.count,
		processing: processing.count,
		failed: failed.count,
		queue
	});
};
