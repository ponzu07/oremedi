import { getDownloadedMedia } from '$lib/download-manager';

export interface QueueItem {
	mediaId: number;
	title: string;
	category: string;
	thumbnailPath: string | null;
}

export function isVideoCategory(category: string): boolean {
	return category === 'movie' || category === 'live_video';
}

interface PlayerState {
	mediaId: number | null;
	title: string;
	category: string;
	thumbnailPath: string | null;
	isPlaying: boolean;
	isBuffering: boolean;
	error: string | null;
	currentTime: number;
	duration: number;
	mediaUrl: string;
	isOffline: boolean;
	queue: QueueItem[];
	currentIndex: number;
	repeatMode: 'off' | 'all' | 'one';
	shuffle: boolean;
	shuffleOrder: number[];
	playbackRate: number;
	isFullPlayer: boolean;
	muted: boolean;
	volume: number;
}

function createPlayerStore() {
	let state = $state<PlayerState>({
		mediaId: null,
		title: '',
		category: '',
		thumbnailPath: null,
		isPlaying: false,
		isBuffering: false,
		error: null,
		currentTime: 0,
		duration: 0,
		mediaUrl: '',
		isOffline: false,
		queue: [],
		currentIndex: -1,
		repeatMode: 'off',
		shuffle: false,
		shuffleOrder: [],
		playbackRate: 1.0,
		isFullPlayer: false,
		muted: false,
		volume: 1.0
	});

	let audioElement: HTMLAudioElement | null = null;
	let videoElement: HTMLVideoElement | null = null;
	let videoBindResolve: (() => void) | null = null;
	let videoReady = false;
	let currentBlobUrl: string | null = null;

	function getActiveElement(): HTMLAudioElement | HTMLVideoElement | null {
		return isVideoCategory(state.category) ? videoElement : audioElement;
	}

	function bindMediaEvents(el: HTMLAudioElement | HTMLVideoElement, isVideo: boolean) {
		const guard = () => isVideo === isVideoCategory(state.category);

		el.addEventListener('timeupdate', () => {
			if (guard()) state.currentTime = el.currentTime;
		});
		el.addEventListener('durationchange', () => {
			if (guard()) state.duration = el.duration;
		});
		el.addEventListener('play', () => {
			if (guard()) {
				state.isPlaying = true;
				state.error = null;
			}
		});
		el.addEventListener('pause', () => {
			if (guard()) state.isPlaying = false;
		});
		el.addEventListener('ended', () => {
			if (guard()) next();
		});
		el.addEventListener('waiting', () => {
			if (guard()) state.isBuffering = true;
		});
		el.addEventListener('playing', () => {
			if (guard()) {
				state.isBuffering = false;
				state.error = null;
			}
		});
		el.addEventListener('canplay', () => {
			if (guard()) state.isBuffering = false;
		});
		el.addEventListener('error', () => {
			if (!guard()) return;
			const err = el.error;
			let msg = '再生エラーが発生しました';
			if (err) {
				switch (err.code) {
					case MediaError.MEDIA_ERR_ABORTED: msg = '再生が中断されました'; break;
					case MediaError.MEDIA_ERR_NETWORK: msg = 'ネットワークエラー'; break;
					case MediaError.MEDIA_ERR_DECODE: msg = 'デコードエラー'; break;
					case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: msg = '非対応の形式です'; break;
				}
			}
			state.error = msg;
			state.isPlaying = false;
			state.isBuffering = false;
			handlePlaybackError();
		});
		el.addEventListener('stalled', () => {
			if (!guard()) return;
			state.isBuffering = true;
			// stalled状態が長く続いたらエラーとして扱う
			setTimeout(() => {
				if (guard() && el.readyState < 3 && !el.paused) {
					state.error = 'バッファリングがタイムアウトしました';
					handlePlaybackError();
				}
			}, 15000);
		});
	}

	function bindAudio(el: HTMLAudioElement) {
		audioElement = el;
		bindMediaEvents(el, false);
	}

	function bindVideo(el: HTMLVideoElement) {
		videoElement = el;
		videoReady = true;
		if (videoBindResolve) {
			videoBindResolve();
			videoBindResolve = null;
		}
		bindMediaEvents(el, true);
	}

	let retryCount = 0;
	const MAX_RETRIES = 2;

	function revokePreviousBlobUrl() {
		if (currentBlobUrl) {
			URL.revokeObjectURL(currentBlobUrl);
			currentBlobUrl = null;
		}
	}

	/**
	 * Internal: load and play a track from a QueueItem
	 * forceStream: trueならキャッシュを無視してストリーミング
	 */
	async function loadAndPlay(item: QueueItem, forceStream = false) {
		revokePreviousBlobUrl();

		let url = `/api/media/${item.mediaId}/stream`;
		let offline = false;

		if (!forceStream) {
			try {
				const downloaded = await getDownloadedMedia(item.mediaId);
				if (downloaded) {
					const blobUrl = URL.createObjectURL(downloaded.blob);
					currentBlobUrl = blobUrl;
					url = blobUrl;
					offline = true;
				}
			} catch {
				// IndexedDB unavailable, fall through to streaming
			}
		}

		state.mediaId = item.mediaId;
		state.title = item.title;
		state.category = item.category;
		state.thumbnailPath = item.thumbnailPath;
		state.mediaUrl = url;
		state.isOffline = offline;
		state.isBuffering = true;
		state.error = null;
		state.currentTime = 0;
		state.duration = 0;

		const isVideo = isVideoCategory(item.category);

		if (isVideo) {
			if (audioElement && !audioElement.paused) {
				audioElement.pause();
				audioElement.src = '';
			}
			if (!videoReady) {
				const timeoutMs = 5000;
				await Promise.race([
					new Promise<void>(resolve => { videoBindResolve = resolve; }),
					new Promise<void>((_, reject) =>
						setTimeout(() => reject(new Error('Video element bind timeout')), timeoutMs)
					)
				]).catch(() => {
					state.error = '動画プレーヤーの初期化に失敗しました';
					state.isBuffering = false;
					return;
				});
			}
			if (videoElement) {
				videoElement.poster = item.thumbnailPath
					? `/api/media/${item.mediaId}/thumbnail`
					: '';
				videoElement.src = url;
				videoElement.playbackRate = state.playbackRate;
				try {
					await videoElement.play();
					retryCount = 0;
				} catch (e) {
					console.warn('Video playback failed:', e);
					state.isPlaying = false;
					state.isBuffering = false;
					if (!state.error) {
						state.error = '動画の再生に失敗しました';
					}
					handlePlaybackError();
				}
			}
		} else {
			if (videoElement && !videoElement.paused) {
				videoElement.pause();
				videoElement.src = '';
			}
			if (audioElement) {
				audioElement.src = url;
				audioElement.playbackRate = state.playbackRate;
				try {
					await audioElement.play();
					retryCount = 0;
				} catch (e) {
					console.warn('Audio playback failed:', e);
					state.isPlaying = false;
					state.isBuffering = false;
					if (!state.error) {
						state.error = '音声の再生に失敗しました';
					}
					handlePlaybackError();
				}
			}
		}
	}

	/**
	 * エラー時の自動リカバリ:
	 * 1. キャッシュ再生中 → ストリーミングにフォールバック
	 * 2. ストリーミング中 → リトライ (最大2回)
	 * 3. リトライ上限 → エラー表示のまま停止 (ユーザーがタップでリトライ)
	 */
	function handlePlaybackError() {
		if (state.mediaId === null || state.currentIndex < 0) return;
		const item = state.queue[state.currentIndex];
		if (!item) return;

		if (state.isOffline) {
			// キャッシュ再生で失敗 → ストリーミングにフォールバック
			state.error = 'キャッシュ再生に失敗。ストリーミングで再試行中…';
			retryCount = 0;
			setTimeout(() => loadAndPlay(item, true), 500);
		} else if (retryCount < MAX_RETRIES) {
			retryCount++;
			state.error = `再生エラー。リトライ中… (${retryCount}/${MAX_RETRIES})`;
			setTimeout(() => loadAndPlay(item, true), 1000 * retryCount);
		}
		// リトライ上限超え → state.errorが残り、UIがリトライボタンを表示
	}

	function retryPlayback() {
		if (state.currentIndex < 0 || !state.queue[state.currentIndex]) return;
		retryCount = 0;
		state.error = null;
		loadAndPlay(state.queue[state.currentIndex]);
	}

	/**
	 * Generate a Fisher-Yates shuffle order with currentIndex at position 0
	 */
	function generateShuffleOrder(length: number, currentIdx: number): number[] {
		const order = Array.from({ length }, (_, i) => i);
		// Put current track at position 0
		if (currentIdx >= 0 && currentIdx < length) {
			[order[0], order[currentIdx]] = [order[currentIdx], order[0]];
		}
		// Fisher-Yates shuffle the rest (from index 1)
		for (let i = length - 1; i > 1; i--) {
			const j = 1 + Math.floor(Math.random() * i);
			[order[i], order[j]] = [order[j], order[i]];
		}
		return order;
	}

	/**
	 * Get the position of currentIndex within shuffleOrder
	 */
	function getShufflePosition(): number {
		return state.shuffleOrder.indexOf(state.currentIndex);
	}

	async function play(
		mediaId: number,
		title: string,
		category: string,
		thumbnailPath: string | null
	) {
		const item: QueueItem = { mediaId, title, category, thumbnailPath };
		state.queue = [item];
		state.currentIndex = 0;
		if (state.shuffle) {
			state.shuffleOrder = [0];
		}
		await loadAndPlay(item);
	}

	async function playQueue(items: QueueItem[], startIndex: number) {
		state.queue = [...items];
		state.currentIndex = startIndex;
		if (state.shuffle) {
			state.shuffleOrder = generateShuffleOrder(items.length, startIndex);
		}
		await loadAndPlay(items[startIndex]);
	}

	async function next() {
		if (state.queue.length === 0 || state.currentIndex < 0) {
			state.isPlaying = false;
			return;
		}

		// Repeat one: replay current track
		if (state.repeatMode === 'one') {
			await loadAndPlay(state.queue[state.currentIndex]);
			return;
		}

		let nextIndex: number;

		if (state.shuffle) {
			const pos = getShufflePosition();
			if (pos < state.shuffleOrder.length - 1) {
				nextIndex = state.shuffleOrder[pos + 1];
			} else if (state.repeatMode === 'all') {
				// Re-shuffle and wrap
				state.shuffleOrder = generateShuffleOrder(state.queue.length, state.currentIndex);
				nextIndex = state.shuffleOrder[0];
			} else {
				state.isPlaying = false;
				return;
			}
		} else {
			if (state.currentIndex < state.queue.length - 1) {
				nextIndex = state.currentIndex + 1;
			} else if (state.repeatMode === 'all') {
				nextIndex = 0;
			} else {
				state.isPlaying = false;
				return;
			}
		}

		state.currentIndex = nextIndex;
		await loadAndPlay(state.queue[nextIndex]);
	}

	async function previous() {
		if (state.queue.length === 0 || state.currentIndex < 0) return;

		// If more than 3 seconds in, seek to beginning
		if (state.currentTime > 3) {
			const el = getActiveElement();
			if (el) {
				el.currentTime = 0;
			}
			return;
		}

		let prevIndex: number;

		if (state.shuffle) {
			const pos = getShufflePosition();
			if (pos > 0) {
				prevIndex = state.shuffleOrder[pos - 1];
			} else {
				// At beginning of shuffle order, stay on current
				prevIndex = state.currentIndex;
			}
		} else {
			if (state.currentIndex > 0) {
				prevIndex = state.currentIndex - 1;
			} else {
				prevIndex = state.currentIndex;
			}
		}

		state.currentIndex = prevIndex;
		await loadAndPlay(state.queue[prevIndex]);
	}

	function skipForward(seconds: number = 30) {
		const el = getActiveElement();
		if (el) {
			el.currentTime = Math.min(el.currentTime + seconds, el.duration);
		}
	}

	function skipBackward(seconds: number = 15) {
		const el = getActiveElement();
		if (el) {
			el.currentTime = Math.max(el.currentTime - seconds, 0);
		}
	}

	function setRepeatMode() {
		if (state.repeatMode === 'off') {
			state.repeatMode = 'all';
		} else if (state.repeatMode === 'all') {
			state.repeatMode = 'one';
		} else {
			state.repeatMode = 'off';
		}
	}

	function toggleShuffle() {
		state.shuffle = !state.shuffle;
		if (state.shuffle && state.queue.length > 0 && state.currentIndex >= 0) {
			state.shuffleOrder = generateShuffleOrder(state.queue.length, state.currentIndex);
		} else {
			state.shuffleOrder = [];
		}
	}

	function setPlaybackRate(rate: number) {
		state.playbackRate = rate;
		if (audioElement) {
			audioElement.playbackRate = rate;
		}
		if (videoElement) {
			videoElement.playbackRate = rate;
		}
	}

	function cyclePlaybackRate() {
		const rates = [1.0, 1.25, 1.5, 2.0, 0.75];
		const currentIdx = rates.indexOf(state.playbackRate);
		const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % rates.length;
		setPlaybackRate(rates[nextIdx]);
	}

	function addToQueue(item: QueueItem) {
		state.queue = [...state.queue, item];
		if (state.shuffle) {
			state.shuffleOrder = [...state.shuffleOrder, state.queue.length - 1];
		}
	}

	function removeFromQueue(index: number) {
		if (index < 0 || index >= state.queue.length) return;

		state.queue = state.queue.filter((_, i) => i !== index);

		// Update shuffleOrder: remove the index and adjust remaining indices
		if (state.shuffle) {
			state.shuffleOrder = state.shuffleOrder
				.filter((i) => i !== index)
				.map((i) => (i > index ? i - 1 : i));
		}

		// Adjust currentIndex
		if (state.queue.length === 0) {
			state.currentIndex = -1;
		} else if (index < state.currentIndex) {
			state.currentIndex--;
		} else if (index === state.currentIndex) {
			// Current track removed; play next or stay at same index
			if (state.currentIndex >= state.queue.length) {
				state.currentIndex = 0;
			}
		}
	}

	async function playFromQueue(index: number) {
		if (index < 0 || index >= state.queue.length) return;
		state.currentIndex = index;
		await loadAndPlay(state.queue[index]);
	}

	function togglePlayPause() {
		const el = getActiveElement();
		if (!el) return;
		if (el.paused) {
			el.play();
		} else {
			el.pause();
		}
	}

	function seek(time: number) {
		const el = getActiveElement();
		if (el) {
			el.currentTime = time;
		}
	}

	function setFullPlayer(value: boolean) {
		state.isFullPlayer = value;
	}

	function toggleMute() {
		state.muted = !state.muted;
		if (audioElement) audioElement.muted = state.muted;
		if (videoElement) videoElement.muted = state.muted;
	}

	function setVolume(vol: number) {
		state.volume = Math.max(0, Math.min(1, vol));
		if (audioElement) audioElement.volume = state.volume;
		if (videoElement) videoElement.volume = state.volume;
		if (state.volume > 0 && state.muted) {
			state.muted = false;
			if (audioElement) audioElement.muted = false;
			if (videoElement) videoElement.muted = false;
		}
	}

	function getVideoElement(): HTMLVideoElement | null {
		return videoElement;
	}

	return {
		get state() {
			return state;
		},
		bindAudio,
		bindVideo,
		play,
		playQueue,
		next,
		previous,
		skipForward,
		skipBackward,
		setRepeatMode,
		toggleShuffle,
		setPlaybackRate,
		cyclePlaybackRate,
		addToQueue,
		removeFromQueue,
		playFromQueue,
		togglePlayPause,
		seek,
		setFullPlayer,
		getVideoElement,
		toggleMute,
		setVolume,
		retryPlayback
	};
}

export const playerStore = createPlayerStore();
