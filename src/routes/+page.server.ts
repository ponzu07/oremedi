import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/database';

export const load: PageServerLoad = async () => {
	const db = getDb();

	const recentByCategory = (category: string, limit: number = 5) =>
		db.prepare(
			'SELECT id, title, category, thumbnail_path, created_at FROM media WHERE category = ? ORDER BY created_at DESC LIMIT ?'
		).all(category, limit) as { id: number; title: string; category: string; thumbnail_path: string | null; created_at: string }[];

	return {
		movies: recentByCategory('movie'),
		liveVideos: recentByCategory('live_video'),
		voices: recentByCategory('voice'),
		music: recentByCategory('music')
	};
};
