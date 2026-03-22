import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import type Database from 'better-sqlite3';
import { computeFileHash } from '$lib/server/file-hash';

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

function getDuration(filePath: string): number | null {
	try {
		const result = execSync(
			`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
			{ stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf-8' }
		);
		const duration = parseFloat(result.trim());
		return isNaN(duration) ? null : duration;
	} catch {
		return null;
	}
}

function parseTimeToSeconds(timeStr: string): number {
	const match = timeStr.match(/(\d+):(\d+):(\d+)\.(\d+)/);
	if (!match) return 0;
	return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]) + parseInt(match[4]) / 100;
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

function runFfmpeg(
	args: string[],
	db: Database.Database,
	mediaId: number,
	totalDuration: number | null,
	onClose: (code: number | null) => void
) {
	const ffmpeg = spawn('ffmpeg', args);
	let lastProgress = 0;

	if (totalDuration && totalDuration > 0) {
		ffmpeg.stderr.on('data', (data: Buffer) => {
			const line = data.toString();
			const timeMatch = line.match(/time=(\d+:\d+:\d+\.\d+)/);
			if (timeMatch) {
				const currentTime = parseTimeToSeconds(timeMatch[1]);
				const progress = Math.min(99, Math.round((currentTime / totalDuration) * 100));
				if (progress > lastProgress) {
					lastProgress = progress;
					db.prepare("UPDATE media SET transcode_progress = ? WHERE id = ?").run(progress, mediaId);
				}
			}
		});
	}

	ffmpeg.on('close', onClose);
	ffmpeg.on('error', () => onClose(-1));
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

		db.prepare("UPDATE media SET transcode_status = 'processing', transcode_progress = 0 WHERE id = ?").run(next.id);
		console.log(`[transcoder] Processing: "${next.title}"`);

		const ext = path.extname(next.original_path).toLowerCase();
		const isAudio = AUDIO_ONLY.has(ext);
		const baseName = path.basename(next.original_path, ext);
		const fileDir = path.dirname(next.original_path);

		if (BROWSER_COMPATIBLE.has(ext) || BROWSER_COMPATIBLE_AUDIO.has(ext)) {
			if (isAudio) {
				db.prepare(
					"UPDATE media SET transcode_status = 'skipped', transcode_progress = 100, updated_at = datetime('now') WHERE id = ?"
				).run(next.id);
				console.log(`[transcoder] Skipped (compatible audio): "${next.title}"`);
				setTimeout(processNext, 1000);
			} else {
				const thumbPath = path.join(fileDir, `${baseName}-thumb.jpg`);
				generateThumbnail(next.original_path, thumbPath, () => {
					const duration = getDuration(next.original_path);
					db.prepare(
						"UPDATE media SET transcode_status = 'skipped', transcode_progress = 100, thumbnail_path = ?, duration = ?, updated_at = datetime('now') WHERE id = ?"
					).run(thumbPath, duration ? Math.round(duration) : null, next.id);
					console.log(`[transcoder] Skipped (compatible video): "${next.title}"`);
					setTimeout(processNext, 1000);
				});
			}
			return;
		}

		const totalDuration = getDuration(next.original_path);
		const outputExt = isAudio ? '.aac' : '.mp4';
		const outputPath = path.join(fileDir, `${baseName}${outputExt}`);
		const thumbPath = isAudio ? null : path.join(fileDir, `${baseName}-thumb.jpg`);

		const args = isAudio
			? ['-i', next.original_path, '-c:a', 'aac', '-b:a', '192k', '-y', outputPath]
			: buildVideoArgs(next.original_path, outputPath, hwAccel);

		const handleComplete = (code: number | null) => {
			if (code === 0) {
				const afterTranscode = () => {
					const relativePath = path.relative(mediaPath, next.original_path);
					const backupPath = path.join(originalsPath, relativePath);
					fs.mkdirSync(path.dirname(backupPath), { recursive: true });
					fs.renameSync(next.original_path, backupPath);

					const newHash = computeFileHash(outputPath);
					db.prepare(
						"UPDATE media SET transcode_status = 'ready', transcode_progress = 100, original_path = ?, thumbnail_path = ?, duration = ?, file_hash = ?, updated_at = datetime('now') WHERE id = ?"
					).run(outputPath, thumbPath, totalDuration ? Math.round(totalDuration) : null, newHash, next.id);
					console.log(`[transcoder] Done: "${next.title}"`);
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
				db.prepare("UPDATE media SET transcode_progress = 0 WHERE id = ?").run(next.id);
				const swArgs = buildVideoArgs(next.original_path, outputPath, 'none');
				runFfmpeg(swArgs, db, next.id, totalDuration, (swCode) => {
					if (swCode === 0) {
						const afterTranscode = () => {
							const relativePath = path.relative(mediaPath, next.original_path);
							const backupPath = path.join(originalsPath, relativePath);
							fs.mkdirSync(path.dirname(backupPath), { recursive: true });
							fs.renameSync(next.original_path, backupPath);

							const newHash = computeFileHash(outputPath);
							db.prepare(
								"UPDATE media SET transcode_status = 'ready', transcode_progress = 100, original_path = ?, thumbnail_path = ?, duration = ?, file_hash = ?, updated_at = datetime('now') WHERE id = ?"
							).run(outputPath, thumbPath, totalDuration ? Math.round(totalDuration) : null, newHash, next.id);
							console.log(`[transcoder] Done (software fallback): "${next.title}"`);
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
						console.error(`[transcoder] Failed: "${next.title}"`);
						setTimeout(processNext, 5000);
					}
				});
			} else {
				db.prepare(
					"UPDATE media SET transcode_status = 'failed', updated_at = datetime('now') WHERE id = ?"
				).run(next.id);
				console.error(`[transcoder] Failed: "${next.title}"`);
				setTimeout(processNext, 5000);
			}
		};

		runFfmpeg(args, db, next.id, totalDuration, handleComplete);
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
