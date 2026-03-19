import type { PageServerLoad } from './$types';
import type { Media } from '$lib/types';
import { getDb } from '$lib/server/database';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const db = getDb();
	const media = db.prepare('SELECT * FROM media WHERE id = ?').get(params.id) as Media | undefined;

	if (!media) {
		throw error(404, 'Media not found');
	}

	const metadata = db.prepare(
		'SELECT key, value FROM media_metadata WHERE media_id = ?'
	).all(params.id) as { key: string; value: string }[];

	const tags = db.prepare(`
		SELECT t.id, t.name, t.category FROM tags t
		JOIN media_tags mt ON t.id = mt.tag_id
		WHERE mt.media_id = ?
	`).all(params.id) as { id: number; name: string; category: string }[];

	return { media: { ...media, metadata, tags } };
};
