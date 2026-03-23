import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { cancelTranscode } from '$lib/server/transcoder';

export const POST: RequestHandler = async ({ params }) => {
	const db = getDb();
	const cancelled = cancelTranscode(db, Number(params.id));

	if (!cancelled) {
		return json({ error: 'Cannot cancel' }, { status: 400 });
	}

	return json({ success: true });
};
