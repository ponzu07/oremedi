import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { createMediaAccessToken } from '$lib/server/auth';
import { config } from '$lib/server/config';
import { getMediaContentType } from '$lib/server/media';

export const GET: RequestHandler = async ({ params, url }) => {
	const db = getDb();
	const media = db.prepare('SELECT id, original_path FROM media WHERE id = ?').get(params.id) as
		| { id: number; original_path: string }
		| undefined;

	if (!media) {
		return json({ error: 'Not found' }, { status: 404 });
	}

	const token = createMediaAccessToken(config.jwtSecret, media.id, '12h');
	const baseUrl = `${url.protocol}//${url.host}`;
	const streamUrl = `${baseUrl}/api/media/${params.id}/stream?token=${token}`;

	return json({
		url: streamUrl,
		contentType: getMediaContentType(media.original_path)
	});
};
