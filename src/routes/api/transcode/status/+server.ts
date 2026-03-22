import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';

export const GET: RequestHandler = async () => {
	const db = getDb();

	const counts = db.prepare(
		`SELECT
			SUM(transcode_status = 'pending') as pending,
			SUM(transcode_status = 'processing') as processing,
			SUM(transcode_status = 'failed') as failed
		FROM media`
	).get() as { pending: number; processing: number; failed: number };

	const queue = db.prepare(
		"SELECT id, title, transcode_status FROM media WHERE transcode_status IN ('pending', 'processing') ORDER BY created_at"
	).all();

	return json({ ...counts, queue });
};
