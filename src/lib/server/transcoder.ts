import { spawn, execFileSync, type ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import type Database from 'better-sqlite3';
import { computeFileHash } from '$lib/server/file-hash';
import { extractChapters, saveChapters } from '$lib/server/chapters';

let currentMediaId: number | null = null;
let currentProcess: ChildProcess | null = null;

export function cancelTranscode(db: Database.Database, mediaId: number): boolean {
	const media = db.prepare(
		"SELECT id, transcode_status FROM media WHERE id = ?"
	).get(mediaId) as { id: number; transcode_status: string } | undefined;
	if (!media) return false;

	if (media.transcode_status === 'pending') {
		db.prepare(
			"UPDATE media SET transcode_status = 'skipped', transcode_progress = 0, updated_at = datetime('now') WHERE id = ?"
		).run(mediaId);
		return true;
	}

	if (media.transcode_status === 'processing' && currentMediaId === mediaId && currentProcess) {
		currentProcess.kill('SIGTERM');
		// onClose handler in runFfmpeg will fire with non-zero code;
		// we mark as skipped here before that happens
		db.prepare(
			"UPDATE media SET transcode_status = 'skipped', transcode_progress = 0, updated_at = datetime('now') WHERE id = ?"
		).run(mediaId);
		return true;
	}

	return false;
}

const AUDIO_ONLY = new Set(['.mp3', '.flac', '.aac', '.ogg', '.wav', '.m4a', '.wma']);
const BROWSER_COMPATIBLE_AUDIO = new Set(['.mp3', '.aac', '.ogg', '.m4a']);

// Video codecs that browsers can play
const COMPATIBLE_VIDEO_CODECS = new Set(['h264', 'hevc', 'h265', 'vp8', 'vp9', 'av1']);
// Audio codecs that browsers can play
const COMPATIBLE_AUDIO_CODECS = new Set(['aac', 'mp3', 'opus', 'vorbis', 'flac']);
// Containers that browsers can play directly
const BROWSER_CONTAINERS = new Set(['.mp4', '.webm']);

interface MediaRow {
	id: number;
	original_path: string;
	title: string;
}

interface ProbeResult {
	video_codec: string | null;
	audio_codec: string | null;
	container: string;
}

type TranscodeAction = 'skip' | 'remux' | 'transcode';
type HwAccel = 'vaapi' | 'none';

function probeCodecs(filePath: string): ProbeResult {
	try {
		const result = execFileSync('ffprobe', [
			'-v', 'error', '-show_entries', 'stream=codec_name,codec_type',
			'-of', 'json', filePath
		], { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf-8' });
		const data = JSON.parse(result);
		const streams = data.streams || [];
		const videoStream = streams.find((s: { codec_type: string }) => s.codec_type === 'video');
		const audioStream = streams.find((s: { codec_type: string }) => s.codec_type === 'audio');
		return {
			video_codec: videoStream?.codec_name?.toLowerCase() || null,
			audio_codec: audioStream?.codec_name?.toLowerCase() || null,
			container: path.extname(filePath).toLowerCase()
		};
	} catch (e) {
		console.warn(`[transcoder] ffprobe failed for "${filePath}":`, (e as Error).message);
		return { video_codec: null, audio_codec: null, container: path.extname(filePath).toLowerCase() };
	}
}

function decideAction(probe: ProbeResult): TranscodeAction {
	const videoOk = !probe.video_codec || COMPATIBLE_VIDEO_CODECS.has(probe.video_codec);
	const audioOk = !probe.audio_codec || COMPATIBLE_AUDIO_CODECS.has(probe.audio_codec);

	if (videoOk && audioOk && BROWSER_CONTAINERS.has(probe.container)) {
		return 'skip';
	}
	if (videoOk && audioOk) {
		// Compatible codecs but wrong container (e.g. MKV with H.265+AAC) → remux
		return 'remux';
	}
	return 'transcode';
}

function detectHwAccel(): HwAccel {
	if (fs.existsSync('/dev/dri/renderD128')) {
		try {
			execFileSync('ffmpeg', [
				'-init_hw_device', 'vaapi=va:/dev/dri/renderD128',
				'-f', 'lavfi', '-i', 'nullsrc', '-t', '0.1',
				'-vf', 'format=nv12,hwupload', '-c:v', 'h264_vaapi',
				'-f', 'null', '-'
			], { stdio: 'pipe' });
			return 'vaapi';
		} catch {}
	}
	return 'none';
}

function getDuration(filePath: string): number | null {
	try {
		const result = execFileSync('ffprobe', [
			'-v', 'error', '-show_entries', 'format=duration',
			'-of', 'default=noprint_wrappers=1:nokey=1', filePath
		], { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf-8' });
		const duration = parseFloat(result.trim());
		return isNaN(duration) ? null : duration;
	} catch (e) {
		console.warn(`[transcoder] getDuration failed for "${filePath}":`, (e as Error).message);
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
	currentMediaId = mediaId;
	currentProcess = ffmpeg;
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

	ffmpeg.on('close', (code) => {
		if (currentMediaId === mediaId) {
			currentMediaId = null;
			currentProcess = null;
		}
		onClose(code);
	});
	ffmpeg.on('error', () => {
		if (currentMediaId === mediaId) {
			currentMediaId = null;
			currentProcess = null;
		}
		onClose(-1);
	});
}

function finishMedia(
	db: Database.Database,
	mediaId: number,
	outputPath: string,
	originalPath: string,
	mediaPath: string,
	originalsPath: string,
	thumbPath: string | null,
	duration: number | null,
	callback: () => void
) {
	const chapters = extractChapters(originalPath);
	if (chapters.length > 0) saveChapters(db, mediaId, chapters);

	// Move original to backup
	const relativePath = path.relative(mediaPath, originalPath);
	const backupPath = path.join(originalsPath, relativePath);
	fs.mkdirSync(path.dirname(backupPath), { recursive: true });
	fs.renameSync(originalPath, backupPath);

	const newHash = computeFileHash(outputPath);
	db.prepare(
		"UPDATE media SET transcode_status = 'ready', transcode_progress = 100, original_path = ?, thumbnail_path = ?, duration = ?, file_hash = ?, updated_at = datetime('now') WHERE id = ?"
	).run(outputPath, thumbPath, duration ? Math.round(duration) : null, newHash, mediaId);

	callback();
}

function isCancelled(db: Database.Database, mediaId: number): boolean {
	const row = db.prepare("SELECT transcode_status FROM media WHERE id = ?").get(mediaId) as { transcode_status: string } | undefined;
	return row?.transcode_status === 'skipped';
}

export function startTranscodeWorker(db: Database.Database, mediaPath: string, originalsPath: string) {
	const hwAccel = detectHwAccel();
	console.log(`[transcoder] ${hwAccel === 'vaapi' ? 'VAAPI hardware encoding enabled' : 'Using software encoding (libx264)'}`);

	const processNext = () => {
		const next = db.prepare(
			"SELECT id, original_path, title FROM media WHERE transcode_status = 'pending' ORDER BY created_at LIMIT 1"
		).get() as MediaRow | undefined;

		if (!next) {
			setTimeout(processNext, 10000);
			return;
		}

		db.prepare("UPDATE media SET transcode_status = 'processing', transcode_progress = 0 WHERE id = ?").run(next.id);

		const ext = path.extname(next.original_path).toLowerCase();
		const isAudio = AUDIO_ONLY.has(ext);
		const baseName = path.basename(next.original_path, ext);
		const fileDir = path.dirname(next.original_path);

		// === Audio handling ===
		if (isAudio) {
			if (BROWSER_COMPATIBLE_AUDIO.has(ext)) {
				db.prepare(
					"UPDATE media SET transcode_status = 'skipped', transcode_progress = 100, updated_at = datetime('now') WHERE id = ?"
				).run(next.id);
				console.log(`[transcoder] Skipped (compatible audio): "${next.title}"`);
				setTimeout(processNext, 1000);
			} else {
				const totalDuration = getDuration(next.original_path);
				const outputPath = path.join(fileDir, `${baseName}.aac`);
				const args = ['-i', next.original_path, '-c:a', 'aac', '-b:a', '192k', '-y', outputPath];
				runFfmpeg(args, db, next.id, totalDuration, (code) => {
					if (code === 0) {
						finishMedia(db, next.id, outputPath, next.original_path, mediaPath, originalsPath, null, totalDuration, () => {
							console.log(`[transcoder] Done (audio): "${next.title}"`);
							setTimeout(processNext, 1000);
						});
					} else if (!isCancelled(db, next.id)) {
						db.prepare("UPDATE media SET transcode_status = 'failed', updated_at = datetime('now') WHERE id = ?").run(next.id);
						console.error(`[transcoder] Failed (audio): "${next.title}"`);
						setTimeout(processNext, 5000);
					} else {
						console.log(`[transcoder] Cancelled (audio): "${next.title}"`);
						setTimeout(processNext, 1000);
					}
				});
			}
			return;
		}

		// === Video handling ===
		const probe = probeCodecs(next.original_path);
		const action = decideAction(probe);
		const totalDuration = getDuration(next.original_path);
		const thumbPath = path.join(fileDir, `${baseName}-thumb.jpg`);

		console.log(`[transcoder] "${next.title}" — ${probe.video_codec}/${probe.audio_codec} in ${probe.container} → ${action}`);

		if (action === 'skip') {
			// Already browser-compatible container + codecs
			generateThumbnail(next.original_path, thumbPath, totalDuration, () => {
				const chapters = extractChapters(next.original_path);
				if (chapters.length > 0) saveChapters(db, next.id, chapters);
				db.prepare(
					"UPDATE media SET transcode_status = 'skipped', transcode_progress = 100, thumbnail_path = ?, duration = ?, updated_at = datetime('now') WHERE id = ?"
				).run(thumbPath, totalDuration ? Math.round(totalDuration) : null, next.id);
				console.log(`[transcoder] Skipped (compatible): "${next.title}" [${chapters.length} chapters]`);
				setTimeout(processNext, 1000);
			});
			return;
		}

		if (action === 'remux') {
			// Compatible codecs, just need container change → fast copy
			const outputPath = path.join(fileDir, `${baseName}.mp4`);
			const args = ['-i', next.original_path, '-c', 'copy', '-movflags', '+faststart', '-y', outputPath];
			runFfmpeg(args, db, next.id, totalDuration, (code) => {
				if (code === 0) {
					generateThumbnail(next.original_path, thumbPath, totalDuration, () => {
						finishMedia(db, next.id, outputPath, next.original_path, mediaPath, originalsPath, thumbPath, totalDuration, () => {
							console.log(`[transcoder] Remuxed: "${next.title}"`);
							setTimeout(processNext, 1000);
						});
					});
				} else {
					// Remux failed, fall through to full transcode
					console.warn(`[transcoder] Remux failed for "${next.title}", falling back to transcode`);
					doFullTranscode(db, next, outputPath, thumbPath, totalDuration, mediaPath, originalsPath, hwAccel, () => setTimeout(processNext, 1000));
				}
			});
			return;
		}

		// action === 'transcode'
		const outputPath = path.join(fileDir, `${baseName}.mp4`);
		doFullTranscode(db, next, outputPath, thumbPath, totalDuration, mediaPath, originalsPath, hwAccel, () => setTimeout(processNext, 1000));
	};

	function doFullTranscode(
		db: Database.Database,
		next: MediaRow,
		outputPath: string,
		thumbPath: string,
		totalDuration: number | null,
		mediaPath: string,
		originalsPath: string,
		hwAccel: HwAccel,
		done: () => void
	) {
		const args = buildVideoArgs(next.original_path, outputPath, hwAccel);
		db.prepare("UPDATE media SET transcode_progress = 0 WHERE id = ?").run(next.id);

		runFfmpeg(args, db, next.id, totalDuration, (code) => {
			if (code === 0) {
				generateThumbnail(next.original_path, thumbPath, totalDuration, () => {
					finishMedia(db, next.id, outputPath, next.original_path, mediaPath, originalsPath, thumbPath, totalDuration, () => {
						console.log(`[transcoder] Transcoded: "${next.title}"`);
						done();
					});
				});
			} else if (hwAccel !== 'none') {
				console.warn(`[transcoder] VAAPI failed for "${next.title}", retrying with software`);
				const swArgs = buildVideoArgs(next.original_path, outputPath, 'none');
				db.prepare("UPDATE media SET transcode_progress = 0 WHERE id = ?").run(next.id);
				runFfmpeg(swArgs, db, next.id, totalDuration, (swCode) => {
					if (swCode === 0) {
						generateThumbnail(next.original_path, thumbPath, totalDuration, () => {
							finishMedia(db, next.id, outputPath, next.original_path, mediaPath, originalsPath, thumbPath, totalDuration, () => {
								console.log(`[transcoder] Transcoded (software fallback): "${next.title}"`);
								done();
							});
						});
					} else if (!isCancelled(db, next.id)) {
						db.prepare("UPDATE media SET transcode_status = 'failed', updated_at = datetime('now') WHERE id = ?").run(next.id);
						console.error(`[transcoder] Failed: "${next.title}"`);
						setTimeout(done, 4000);
					} else {
						console.log(`[transcoder] Cancelled: "${next.title}"`);
						setTimeout(done, 1000);
					}
				});
			} else if (!isCancelled(db, next.id)) {
				db.prepare("UPDATE media SET transcode_status = 'failed', updated_at = datetime('now') WHERE id = ?").run(next.id);
				console.error(`[transcoder] Failed: "${next.title}"`);
				setTimeout(done, 4000);
			} else {
				console.log(`[transcoder] Cancelled: "${next.title}"`);
				setTimeout(done, 1000);
			}
		});
	}

	setTimeout(processNext, 2000);
}

function generateThumbnail(inputPath: string, outputPath: string, duration: number | null, callback: () => void) {
	const seekTo = duration && duration > 0 ? Math.min(30, Math.floor(duration * 0.1)) : 3;
	const ffmpeg = spawn('ffmpeg', [
		'-ss', String(seekTo),
		'-i', inputPath,
		'-vframes', '1',
		'-vf', 'scale=480:-1',
		'-y', outputPath
	]);

	ffmpeg.on('close', () => callback());
	ffmpeg.on('error', () => callback());
}
