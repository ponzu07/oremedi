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

	function getActiveElement(): HTMLAudioElement | HTMLVideoElement | null {
		return isVideoCategory(state.category) ? videoElement : audioElement;
	}

	function bindAudio(el: HTMLAudioElement) {
		audioElement = el;
		el.addEventListener('timeupdate', () => {
			if (!isVideoCategory(state.category)) {
				state.currentTime = el.currentTime;
			}
		});
		el.addEventListener('durationchange', () => {
			if (!isVideoCategory(state.category)) {
				state.duration = el.duration;
			}
		});
		el.addEventListener('play', () => {
			if (!isVideoCategory(state.category)) {
				state.isPlaying = true;
			}
		});
		el.addEventListener('pause', () => {
			if (!isVideoCategory(state.category)) {
				state.isPlaying = false;
			}
		});
		el.addEventListener('ended', () => {
			if (!isVideoCategory(state.category)) {
				next();
			}
		});
	}

	function bindVideo(el: HTMLVideoElement) {
		videoElement = el;
		videoReady = true;
		if (videoBindResolve) {
			videoBindResolve();
			videoBindResolve = null;
		}
		el.addEventListener('timeupdate', () => {
			if (isVideoCategory(state.category)) {
				state.currentTime = el.currentTime;
			}
		});
		el.addEventListener('durationchange', () => {
			if (isVideoCategory(state.category)) {
				state.duration = el.duration;
			}
		});
		el.addEventListener('play', () => {
			if (isVideoCategory(state.category)) {
				state.isPlaying = true;
			}
		});
		el.addEventListener('pause', () => {
			if (isVideoCategory(state.category)) {
				state.isPlaying = false;
			}
		});
		el.addEventListener('ended', () => {
			if (isVideoCategory(state.category)) {
				next();
			}
		});
	}

	/**
	 * Internal: load and play a track from a QueueItem
	 */
	async function loadAndPlay(item: QueueItem) {
		let url = `/api/media/${item.mediaId}/stream`;
		let offline = false;

		// Use offline content if available (saves bandwidth even when online)
		try {
			const downloaded = await getDownloadedMedia(item.mediaId);
			if (downloaded) {
				url = URL.createObjectURL(downloaded.blob);
				offline = true;
			}
		} catch {
			// IndexedDB unavailable, fall through to streaming
		}

		state.mediaId = item.mediaId;
		state.title = item.title;
		state.category = item.category;
		state.thumbnailPath = item.thumbnailPath;
		state.mediaUrl = url;
		state.isOffline = offline;
		state.currentTime = 0;
		state.duration = 0;

		const isVideo = isVideoCategory(item.category);

		if (isVideo) {
			// Stop audio if it was playing
			if (audioElement && !audioElement.paused) {
				audioElement.pause();
				audioElement.src = '';
			}
			// Wait for video element to be bound (child onMount runs before layout onMount)
			if (!videoReady) {
				await new Promise<void>(resolve => { videoBindResolve = resolve; });
			}
			if (videoElement) {
				videoElement.poster = item.thumbnailPath
					? `/api/media/${item.mediaId}/thumbnail`
					: '';
				videoElement.src = url;
				videoElement.playbackRate = state.playbackRate;
				try {
					await videoElement.play();
				} catch (e) {
					console.warn('Video playback failed:', e);
				}
			}
		} else {
			// Stop video if it was playing
			if (videoElement && !videoElement.paused) {
				videoElement.pause();
				videoElement.src = '';
			}
			if (audioElement) {
				audioElement.src = url;
				audioElement.playbackRate = state.playbackRate;
				try {
					await audioElement.play();
				} catch (e) {
					console.warn('Audio playback failed:', e);
				}
			}
		}
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
		setVolume
	};
}

export const playerStore = createPlayerStore();
