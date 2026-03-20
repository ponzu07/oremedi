import { getDownloadedMedia, getDownloadedMediaUrl } from '$lib/download-manager';

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
		isOffline: false
	});

	let audioElement: HTMLAudioElement | null = null;

	function bindAudio(el: HTMLAudioElement) {
		audioElement = el;
		el.addEventListener('timeupdate', () => {
			state.currentTime = el.currentTime;
		});
		el.addEventListener('durationchange', () => {
			state.duration = el.duration;
		});
		el.addEventListener('play', () => {
			state.isPlaying = true;
		});
		el.addEventListener('pause', () => {
			state.isPlaying = false;
		});
		el.addEventListener('ended', () => {
			state.isPlaying = false;
		});
	}

	async function play(
		mediaId: number,
		title: string,
		category: string,
		thumbnailPath: string | null
	) {
		let url = `/api/media/${mediaId}/stream`;
		let offline = false;

		if (typeof window !== 'undefined' && !navigator.onLine) {
			const downloaded = await getDownloadedMedia(mediaId);
			if (downloaded) {
				const offlineUrl = await getDownloadedMediaUrl(mediaId);
				if (offlineUrl) {
					url = offlineUrl;
					offline = true;
				}
			}
		}

		state.mediaId = mediaId;
		state.title = title;
		state.category = category;
		state.thumbnailPath = thumbnailPath;
		state.mediaUrl = url;
		state.isOffline = offline;
		state.currentTime = 0;
		state.duration = 0;

		if (audioElement) {
			audioElement.src = url;
			await audioElement.play();
		}
	}

	function togglePlayPause() {
		if (!audioElement) return;
		if (audioElement.paused) {
			audioElement.play();
		} else {
			audioElement.pause();
		}
	}

	function stop() {
		if (audioElement) {
			audioElement.pause();
			audioElement.src = '';
		}
		state.mediaId = null;
		state.title = '';
		state.category = '';
		state.thumbnailPath = null;
		state.isPlaying = false;
		state.currentTime = 0;
		state.duration = 0;
		state.mediaUrl = '';
		state.isOffline = false;
	}

	function seek(time: number) {
		if (audioElement) {
			audioElement.currentTime = time;
		}
	}

	return {
		get state() {
			return state;
		},
		bindAudio,
		play,
		togglePlayPause,
		stop,
		seek
	};
}

export const playerStore = createPlayerStore();
