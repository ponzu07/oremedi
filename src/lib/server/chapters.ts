import { execFileSync } from 'child_process';
import type Database from 'better-sqlite3';

interface FfprobeChapter {
	start_time: string;
	end_time: string;
	tags?: { title?: string };
}

export interface Chapter {
	start_time: number;
	end_time: number;
	title: string;
}

export function extractChapters(filePath: string): Chapter[] {
	try {
		const result = execFileSync('ffprobe', [
			'-v', 'error', '-show_chapters', '-of', 'json', filePath
		], { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf-8' });
		const data = JSON.parse(result);
		if (!data.chapters || data.chapters.length === 0) return [];

		return data.chapters.map((ch: FfprobeChapter, i: number) => ({
			start_time: parseFloat(ch.start_time),
			end_time: parseFloat(ch.end_time),
			title: ch.tags?.title || `Chapter ${i + 1}`
		}));
	} catch {
		return [];
	}
}

export function saveChapters(db: Database.Database, mediaId: number, chapters: Chapter[]) {
	db.prepare('DELETE FROM media_chapters WHERE media_id = ?').run(mediaId);
	if (chapters.length === 0) return;

	const insert = db.prepare(
		'INSERT INTO media_chapters (media_id, start_time, end_time, title) VALUES (?, ?, ?, ?)'
	);
	for (const ch of chapters) {
		insert.run(mediaId, ch.start_time, ch.end_time, ch.title);
	}
}

export function getChapters(db: Database.Database, mediaId: number): Chapter[] {
	return db.prepare(
		'SELECT start_time, end_time, title FROM media_chapters WHERE media_id = ? ORDER BY start_time'
	).all(mediaId) as Chapter[];
}
