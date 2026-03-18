import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { createToken } from '$lib/server/auth';
import { config } from '$lib/server/config';

export const GET: RequestHandler = async ({ params, url }) => {
	const db = getDb();
	const media = db.prepare('SELECT id FROM media WHERE id = ?').get(params.id);

	if (!media) {
		return json({ error: 'Not found' }, { status: 404 });
	}

	const token = createToken(config.jwtSecret, '4h');
	const baseUrl = `${url.protocol}//${url.host}`;
	const streamUrl = `${baseUrl}/api/media/${params.id}/stream?token=${token}`;

	return json({ url: streamUrl });
};
