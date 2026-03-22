import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import type Database from 'better-sqlite3';

const BROWSER_COMPATIBLE = new Set(['.mp4']);
const AUDIO_ONLY = new Set(['.mp3', '.flac', '.aac', '.ogg', '.wav', '.m4a', '.wma']);
const BROWSER_COMPATIBLE_AUDIO = new Set(['.mp3', '.aac', '.ogg', '.m4a']);

interface MediaRow {
	id: number;
	original_path: string;
	title: string;
}

type HwAccel = 'vaapi' | 'none';

function detectHwAccel(): HwAccel {
	// Check for VAAPI device (AMD/Intel)
	if (fs.existsSync('/dev/dri/renderD128')) {
		try {
			execSync('ffmpeg -init_hw_device vaapi=va:/dev/dri/renderD128 -f lavfi -i nullsrc -t 0.1 -vf "format=nv12,hwupload" -c:v h264_vaapi -f null - 2>&1', { stdio: 'pipe' });
			return 'vaapi';
		} catch {
			// VAAPI device exists but encoding failed
		}
	}
	return 'none';
}

function buildVideoArgs(input: string, output: string, hwAccel: HwAccel): string[] {
	if (hwAccel === 'vaapi') {
		return [
			'-hwaccel', 'vaapi',
			'-hwaccel_device', '/dev/dri/renderD128',
			'-hwaccel_output_format', 'vaapi',
			'-i', input,
			'-c:v', 'h264_vaapi',
			'-qp', '23',
			'-c:a', 'aac', '-b:a', '192k',
			'-movflags', '+faststart',
			'-y', output
		];
	}

	// Software fallback: optimized for AMD Ryzen R1600 (2C/4T)
	return [
		'-i', input,
		'-c:v', 'libx264',
		'-preset', 'faster',
		'-crf', '23',
		'-threads', '3',
		'-c:a', 'aac', '-b:a', '192k',
		'-movflags', '+faststart',
		'-y', output
	];
}

export function startTranscodeWorker(db: Database.Database, mediaPath: string, originalsPath: string) {
	const hwAccel = detectHwAccel();
	if (hwAccel === 'vaapi') {
		console.log('[transcoder] VAAPI hardware encoding enabled');
	} else {
		console.log('[transcoder] Using software encoding (libx264)');
	}

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
		const baseName = path.basename(next.original_path, ext);
		const fileDir = path.dirname(next.original_path);

		if (BROWSER_COMPATIBLE.has(ext) || BROWSER_COMPATIBLE_AUDIO.has(ext)) {
			if (isAudio) {
				db.prepare(
					"UPDATE media SET transcode_status = 'skipped', updated_at = datetime('now') WHERE id = ?"
				).run(next.id);
				setTimeout(processNext, 1000);
			} else {
				const thumbPath = path.join(fileDir, `${baseName}-thumb.jpg`);
				generateThumbnail(next.original_path, thumbPath, () => {
					db.prepare(
						"UPDATE media SET transcode_status = 'skipped', thumbnail_path = ?, updated_at = datetime('now') WHERE id = ?"
					).run(thumbPath, next.id);
					setTimeout(processNext, 1000);
				});
			}
			return;
		}

		const outputExt = isAudio ? '.aac' : '.mp4';
		const outputPath = path.join(fileDir, `${baseName}${outputExt}`);
		const thumbPath = isAudio ? null : path.join(fileDir, `${baseName}-thumb.jpg`);

		const args = isAudio
			? ['-i', next.original_path, '-c:a', 'aac', '-b:a', '192k', '-y', outputPath]
			: buildVideoArgs(next.original_path, outputPath, hwAccel);

		const ffmpeg = spawn('ffmpeg', args);

		ffmpeg.on('close', (code) => {
			if (code === 0) {
				const afterTranscode = () => {
					const relativePath = path.relative(mediaPath, next.original_path);
					const backupPath = path.join(originalsPath, relativePath);
					fs.mkdirSync(path.dirname(backupPath), { recursive: true });
					fs.renameSync(next.original_path, backupPath);

					db.prepare(
						"UPDATE media SET transcode_status = 'ready', original_path = ?, thumbnail_path = ?, updated_at = datetime('now') WHERE id = ?"
					).run(outputPath, thumbPath, next.id);
					setTimeout(processNext, 1000);
				};

				if (thumbPath) {
					generateThumbnail(next.original_path, thumbPath, afterTranscode);
				} else {
					afterTranscode();
				}
			} else if (code !== 0 && hwAccel !== 'none' && !isAudio) {
				// VAAPI failed, retry with software encoding
				console.warn(`[transcoder] VAAPI failed for "${next.title}", retrying with software`);
				const swArgs = buildVideoArgs(next.original_path, outputPath, 'none');
				const swFfmpeg = spawn('ffmpeg', swArgs);
				swFfmpeg.on('close', (swCode) => {
					if (swCode === 0) {
						const afterTranscode = () => {
							const relativePath = path.relative(mediaPath, next.original_path);
							const backupPath = path.join(originalsPath, relativePath);
							fs.mkdirSync(path.dirname(backupPath), { recursive: true });
							fs.renameSync(next.original_path, backupPath);

							db.prepare(
								"UPDATE media SET transcode_status = 'ready', original_path = ?, thumbnail_path = ?, updated_at = datetime('now') WHERE id = ?"
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
				swFfmpeg.on('error', () => {
					db.prepare(
						"UPDATE media SET transcode_status = 'failed', updated_at = datetime('now') WHERE id = ?"
					).run(next.id);
					setTimeout(processNext, 5000);
				});
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
