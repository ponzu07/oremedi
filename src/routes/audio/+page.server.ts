import type { PageServerLoad } from './$types';
import type { Media } from '$lib/types';
import { getDb } from '$lib/server/database';

interface AudioItem extends Media {
	tags: { name: string; category: string }[];
}

export const load: PageServerLoad = async ({ url }) => {
	const db = getDb();
	const sub = url.searchParams.get('sub'); // 'music' | 'voice' | null (all)
	const tag = url.searchParams.get('tag');

	let musicItems: AudioItem[] = [];
	let voiceItems: AudioItem[] = [];
	let musicTags: { name: string; category: string }[] = [];
	let voiceTags: { name: string; category: string }[] = [];

	// Fetch music if sub is null (all) or 'music'
	if (!sub || sub === 'music') {
		let musicQuery = 'SELECT DISTINCT m.* FROM media m';
		const musicParams: unknown[] = [];

		if (tag && sub === 'music') {
			musicQuery += ' JOIN media_tags mt ON m.id = mt.media_id JOIN tags t ON mt.tag_id = t.id';
			musicQuery += " WHERE m.category = 'music' AND t.name = ?";
			musicParams.push(tag);
		} else {
			musicQuery += " WHERE m.category = 'music'";
		}

		musicQuery += ' ORDER BY m.title';
		const items = db.prepare(musicQuery).all(...musicParams) as Media[];

		musicTags = db.prepare(`
			SELECT DISTINCT t.name, t.category FROM tags t
			JOIN media_tags mt ON t.id = mt.tag_id
			JOIN media m ON mt.media_id = m.id
			WHERE m.category = 'music'
			ORDER BY t.name
		`).all() as { name: string; category: string }[];

		musicItems = items.map((item) => {
			const itemTags = db.prepare(`
				SELECT t.name, t.category FROM tags t
				JOIN media_tags mt ON t.id = mt.tag_id
				WHERE mt.media_id = ?
			`).all(item.id) as { name: string; category: string }[];
			return { ...item, tags: itemTags };
		});
	}

	// Fetch voice if sub is null (all) or 'voice'
	if (!sub || sub === 'voice') {
		let voiceQuery = 'SELECT DISTINCT m.* FROM media m';
		const voiceParams: unknown[] = [];

		if (tag && sub === 'voice') {
			voiceQuery += ' JOIN media_tags mt ON m.id = mt.media_id JOIN tags t ON mt.tag_id = t.id';
			voiceQuery += " WHERE m.category = 'voice' AND t.name = ?";
			voiceParams.push(tag);
		} else {
			voiceQuery += " WHERE m.category = 'voice'";
		}

		voiceQuery += ' ORDER BY m.created_at DESC';
		const items = db.prepare(voiceQuery).all(...voiceParams) as Media[];

		voiceTags = db.prepare(`
			SELECT DISTINCT t.name, t.category FROM tags t
			JOIN media_tags mt ON t.id = mt.tag_id
			JOIN media m ON mt.media_id = m.id
			WHERE m.category = 'voice'
			ORDER BY t.name
		`).all() as { name: string; category: string }[];

		voiceItems = items.map((item) => {
			const itemTags = db.prepare(`
				SELECT t.name, t.category FROM tags t
				JOIN media_tags mt ON t.id = mt.tag_id
				WHERE mt.media_id = ?
			`).all(item.id) as { name: string; category: string }[];
			return { ...item, tags: itemTags };
		});
	}

	return {
		musicItems,
		voiceItems,
		musicTags,
		voiceTags,
		currentSub: sub,
		currentTag: tag
	};
};
