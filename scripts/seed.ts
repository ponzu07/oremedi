/**
 * サンプルデータ投入スクリプト
 * Usage: npx tsx scripts/seed.ts
 */
import { createDatabase } from '../src/lib/server/db.js';
import fs from 'fs';
import path from 'path';

const MEDIA_PATH = process.env.MEDIA_PATH ?? '/tmp/oremedi-media';
const DB_PATH = process.env.DATABASE_PATH ?? 'data/oremedi.db';
const THUMB_DIR = path.join(MEDIA_PATH, 'thumbnails');

fs.mkdirSync(THUMB_DIR, { recursive: true });

const db = createDatabase(DB_PATH);

// 既存データクリア
db.exec('DELETE FROM media_tags');
db.exec('DELETE FROM media_metadata');
db.exec('DELETE FROM tags');
db.exec('DELETE FROM media');

console.log('既存データをクリアしました');

// SVGサムネイル生成
function createThumbnail(filename: string, title: string, color: string): string {
	const thumbPath = path.join(THUMB_DIR, filename);
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
  <rect width="320" height="180" fill="${color}"/>
  <text x="160" y="90" text-anchor="middle" dominant-baseline="central"
    font-family="sans-serif" font-size="18" font-weight="bold" fill="white">${escapeXml(title)}</text>
</svg>`;
	fs.writeFileSync(thumbPath, svg);
	return thumbPath;
}

function escapeXml(str: string): string {
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// メディア登録
const insertMedia = db.prepare(`
	INSERT INTO media (title, category, duration, original_path, thumbnail_path, transcode_status)
	VALUES (?, ?, ?, ?, ?, ?)
`);

const insertMeta = db.prepare(`
	INSERT INTO media_metadata (media_id, key, value) VALUES (?, ?, ?)
`);

const insertTag = db.prepare(`
	INSERT OR IGNORE INTO tags (name, category) VALUES (?, ?)
`);

const getTag = db.prepare(`
	SELECT id FROM tags WHERE name = ? AND category = ?
`);

const insertMediaTag = db.prepare(`
	INSERT OR IGNORE INTO media_tags (media_id, tag_id) VALUES (?, ?)
`);

function addMedia(
	title: string,
	category: string,
	duration: number,
	filePath: string,
	transcodeStatus: string,
	thumbColor: string,
	metadata: Record<string, string>,
	tags: { name: string; category: string }[]
) {
	const thumbFile = filePath.replace(/[/\\]/g, '_').replace(/\.\w+$/, '.svg');
	const thumbPath = createThumbnail(thumbFile, title, thumbColor);
	const result = insertMedia.run(
		title, category, duration,
		`${MEDIA_PATH}/${filePath}`,
		thumbPath,
		transcodeStatus
	);
	const mediaId = Number(result.lastInsertRowid);

	for (const [key, value] of Object.entries(metadata)) {
		insertMeta.run(mediaId, key, value);
	}

	for (const tag of tags) {
		insertTag.run(tag.name, tag.category);
		const row = getTag.get(tag.name, tag.category) as { id: number };
		insertMediaTag.run(mediaId, row.id);
	}

	console.log(`  + ${title} (${category})`);
	return mediaId;
}

console.log('\nメディアを登録中...');

// Movies
addMedia(
	'Big Buck Bunny', 'movie', 10,
	'movies/big_buck_bunny.mp4', 'skipped', '#e67e22',
	{ genre: 'アニメーション', year: '2008', director: 'Sacha Goedegebure' },
	[{ name: 'アニメーション', category: 'genre' }, { name: 'コメディ', category: 'genre' }]
);

addMedia(
	'Sintel', 'movie', 10,
	'movies/sintel_trailer.mp4', 'skipped', '#8e44ad',
	{ genre: 'アニメーション', year: '2010', director: 'Colin Levy' },
	[{ name: 'アニメーション', category: 'genre' }, { name: 'ファンタジー', category: 'genre' }]
);

addMedia(
	'テスト動画 (WebM)', 'movie', 10,
	'movies/test_convert.webm', 'pending', '#95a5a6',
	{ genre: 'テスト' },
	[{ name: 'テスト', category: 'genre' }]
);

// Live Video
addMedia(
	'サンプルライブ映像', 'live_video', 10,
	'live/concert_sample.mp4', 'skipped', '#e74c3c',
	{ event_name: 'サンプルフェス 2026', venue: '東京ドーム', date: '2026-03-15' },
	[{ name: 'サンプルアーティスト', category: 'artist' }, { name: 'フェス', category: 'custom' }]
);

// Voice
addMedia(
	'サンプルスピーチ（短）', 'voice', 3,
	'voice/sample_speech.mp3', 'skipped', '#2ecc71',
	{},
	[{ name: 'テストスピーカー', category: 'speaker' }]
);

addMedia(
	'サンプルスピーチ（長）', 'voice', 9,
	'voice/sample_speech_long.mp3', 'skipped', '#27ae60',
	{},
	[{ name: 'テストスピーカー', category: 'speaker' }]
);

// Music
addMedia(
	'サンプル楽曲', 'music', 12,
	'music/sample_music.mp3', 'skipped', '#3498db',
	{ album: 'テストアルバム' },
	[{ name: 'テストアーティスト', category: 'artist' }, { name: 'テスト', category: 'genre' }]
);

const count = (db.prepare('SELECT COUNT(*) as count FROM media').get() as { count: number }).count;
console.log(`\n完了: ${count}件のメディアを登録しました`);

db.close();
