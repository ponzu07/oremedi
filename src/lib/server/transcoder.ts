import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import type Database from 'better-sqlite3';

const BROWSER_COMPATIBLE = new Set(['.mp4']);
const AUDIO_ONLY = new Set(['.mp3', '.flac', '.aac', '.ogg', '.wav', '.m4a', '.wma']);

interface MediaRow {
	id: number;
	original_path: string;
	title: string;
}

export function startTranscodeWorker(db: Database.Database, convertedPath: string) {
	const processNext = () => {
		const next = db.prepare(
			"SELECT id, original_path, title FROM media WHERE transcode_status = 'pending' ORDER BY created_at LIMIT 1"
		).get() as MediaRow | undefined;

		if (!next) {
			setTimeout(processNext, 10000);
			return;
		}

		db.prepare("UPDATE media SET transcode_status = 'processing' WHERE id = ?").run(next.id);

		const ext = path.extname(next.original_path).toLowerCase();
		const isAudio = AUDIO_ONLY.has(ext);
		const relativePath = path.relative('/media', next.original_path);
		const outputDir = path.join(convertedPath, path.dirname(relativePath));
		const baseName = path.basename(next.original_path, ext);

		fs.mkdirSync(outputDir, { recursive: true });

		// Check if already browser-compatible MP4 with H.264
		if (BROWSER_COMPATIBLE.has(ext)) {
			const thumbPath = path.join(outputDir, `${baseName}-thumb.jpg`);

			// Generate thumbnail only (BROWSER_COMPATIBLE only contains .mp4, always video)
			generateThumbnail(next.original_path, thumbPath, () => {
				db.prepare(
					"UPDATE media SET transcode_status = 'skipped', thumbnail_path = ?, updated_at = datetime('now') WHERE id = ?"
				).run(thumbPath, next.id);
				setTimeout(processNext, 1000);
			});
			return;
		}

		const outputExt = isAudio ? '.aac' : '.mp4';
		const outputPath = path.join(outputDir, `${baseName}${outputExt}`);
		const thumbPath = isAudio ? null : path.join(outputDir, `${baseName}-thumb.jpg`);

		const args = isAudio
			? ['-i', next.original_path, '-c:a', 'aac', '-b:a', '192k', '-y', outputPath]
			: [
					'-i', next.original_path,
					'-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
					'-c:a', 'aac', '-b:a', '192k',
					'-movflags', '+faststart',
					'-y', outputPath
				];

		const ffmpeg = spawn('ffmpeg', args);

		ffmpeg.on('close', (code) => {
			if (code === 0) {
				const afterTranscode = () => {
					db.prepare(
						"UPDATE media SET transcode_status = 'ready', converted_path = ?, thumbnail_path = ?, updated_at = datetime('now') WHERE id = ?"
					).run(outputPath, thumbPath, next.id);
					setTimeout(processNext, 1000);
				};

				if (thumbPath) {
					generateThumbnail(next.original_path, thumbPath, afterTranscode);
				} else {
					afterTranscode();
				}
			} else {
				db.prepare(
					"UPDATE media SET transcode_status = 'failed', updated_at = datetime('now') WHERE id = ?"
				).run(next.id);
				setTimeout(processNext, 5000);
			}
		});

		ffmpeg.on('error', () => {
			db.prepare(
				"UPDATE media SET transcode_status = 'failed', updated_at = datetime('now') WHERE id = ?"
			).run(next.id);
			setTimeout(processNext, 5000);
		});
	};

	// Start polling after a short delay
	setTimeout(processNext, 2000);
}

function generateThumbnail(inputPath: string, outputPath: string, callback: () => void) {
	const ffmpeg = spawn('ffmpeg', [
		'-i', inputPath,
		'-ss', '00:00:30',
		'-vframes', '1',
		'-vf', 'scale=480:-1',
		'-y', outputPath
	]);

	ffmpeg.on('close', () => callback());
	ffmpeg.on('error', () => callback());
}
