import type { PageServerLoad } from './$types';
import type { Media } from '$lib/types';
import { getDb } from '$lib/server/database';
import { getChapters } from '$lib/server/chapters';
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

	// Fetch all media in the same category for queue (audio only — video doesn't use siblings)
	const isVideo = media.category === 'movie' || media.category === 'live_video';
	const siblingMedia = isVideo
		? []
		: db.prepare(
			'SELECT id, title, category, thumbnail_path FROM media WHERE category = ? ORDER BY title'
		).all(media.category) as { id: number; title: string; category: string; thumbnail_path: string | null }[];

	const chapters = getChapters(db, media.id);

	return { media: { ...media, metadata, tags }, siblingMedia, chapters };
};
