import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import fs from 'fs';

interface MediaRow {
	id: number;
	thumbnail_path: string | null;
}

export const GET: RequestHandler = async ({ params }) => {
	const db = getDb();
	const media = db.prepare('SELECT id, thumbnail_path FROM media WHERE id = ?').get(params.id) as MediaRow | undefined;

	if (!media || !media.thumbnail_path || !fs.existsSync(media.thumbnail_path)) {
		return new Response('No thumbnail', { status: 404 });
	}

	const data = fs.readFileSync(media.thumbnail_path);
	return new Response(data, {
		headers: {
			'Content-Type': 'image/jpeg',
			'Cache-Control': 'public, max-age=86400'
		}
	});
};
