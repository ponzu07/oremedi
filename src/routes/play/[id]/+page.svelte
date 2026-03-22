<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import CastButton from '$lib/components/CastButton.svelte';
	import { playerStore, type QueueItem, isVideoCategory } from '$lib/stores/player.svelte';
	import {
		downloadMedia,
		getDownloadedMedia,
		formatSize
	} from '$lib/download-manager';
	import { categoryLabels } from '$lib/constants';

	let { data }: { data: PageData } = $props();
	const media = data.media;

	const isVideo = ['movie', 'live_video'].includes(media.category);

	let isDownloaded = $state(false);
	let downloading = $state(false);
	let downloadProgress = $state(0);

	// Audio player states
	let showQueue = $state(false);
	let isSeeking = $state(false);
	let seekValue = $state(0);

	// Video UI states (overlay, seekbar drag, resume — all local to this page)
	let videoSeeking = $state(false);
	let videoSeekValue = $state(0);
	let controlsVisible = $state(true);
	let hideTimer: ReturnType<typeof setTimeout> | null = null;
	let showMetadata = $state(false);
	let resumeTime = $state<number | null>(null);
	let resumeSaveInterval: ReturnType<typeof setInterval> | null = null;
	let isPip = $state(false);

	// Sync seekValue from store when not seeking (audio)
	$effect(() => {
		if (!isSeeking) {
			seekValue = playerStore.state.currentTime;
		}
	});

	// Video: sync videoSeekValue from store when not seeking
	$effect(() => {
		if (!videoSeeking) {
			videoSeekValue = playerStore.state.currentTime;
		}
	});

	// React to store isPlaying changes for video resume/controls
	$effect(() => {
		if (!isVideo) return;
		const playing = playerStore.state.isPlaying;
		if (playing) {
			startResumeInterval();
			scheduleHideControls();
		} else {
			stopResumeInterval();
			saveResumePosition();
			showControls();
		}
	});

	// Check resume time validity when duration changes
	$effect(() => {
		if (!isVideo) return;
		const dur = playerStore.state.duration;
		if (resumeTime && dur > 0 && resumeTime >= dur * 0.95) {
			resumeTime = null;
		}
	});

	function getResumeKey(id: number) {
		return `oremedi-resume-${id}`;
	}

	function saveResumePosition() {
		if (!isVideo) return;
		const time = playerStore.state.currentTime;
		if (time > 10) {
			localStorage.setItem(getResumeKey(media.id), JSON.stringify({ time, updatedAt: Date.now() }));
		}
	}

	function startResumeInterval() {
		if (resumeSaveInterval) clearInterval(resumeSaveInterval);
		resumeSaveInterval = setInterval(saveResumePosition, 30000);
	}

	function stopResumeInterval() {
		if (resumeSaveInterval) {
			clearInterval(resumeSaveInterval);
			resumeSaveInterval = null;
		}
	}

	onMount(async () => {
		if (isVideo) {
			playerStore.setFullPlayer(true);

			// If this media is already playing (came from video page), don't restart
			if (playerStore.state.mediaId !== (media.id)) {
				await playerStore.play(
					media.id,
					media.title,
					media.category,
					media.thumbnail_path
				);
			}

			// Check for resume position
			const saved = localStorage.getItem(getResumeKey(media.id));
			if (saved) {
				try {
					const { time } = JSON.parse(saved);
					if (time > 10) {
						resumeTime = time;
					}
				} catch {}
			}

			window.addEventListener('beforeunload', saveResumePosition);
		} else {
			// Audio: Build queue from all siblings in the same category
			const siblings = data.siblingMedia ?? [];
			if (siblings.length > 1) {
				const queue: QueueItem[] = siblings.map(s => ({
					mediaId: s.id,
					title: s.title,
					category: s.category,
					thumbnailPath: s.thumbnail_path ?? null
				}));
				const startIndex = siblings.findIndex(s => s.id === media.id);
				await playerStore.playQueue(queue, Math.max(0, startIndex));
			} else {
				await playerStore.play(
					media.id,
					media.title,
					media.category,
					media.thumbnail_path
				);
			}
		}

		// Check if already downloaded
		const existing = await getDownloadedMedia(media.id);
		if (existing) {
			isDownloaded = true;
		}
	});

	onDestroy(() => {
		if (isVideo) {
			playerStore.setFullPlayer(false);
			saveResumePosition();
			window.removeEventListener('beforeunload', saveResumePosition);
		}
		stopResumeInterval();
		if (hideTimer) clearTimeout(hideTimer);
	});

	function showControls() {
		controlsVisible = true;
		if (hideTimer) clearTimeout(hideTimer);
	}

	function scheduleHideControls() {
		if (hideTimer) clearTimeout(hideTimer);
		if (!playerStore.state.isPlaying) return;
		hideTimer = setTimeout(() => {
			if (playerStore.state.isPlaying && !videoSeeking) {
				controlsVisible = false;
			}
		}, 3000);
	}

	function onOverlayInteraction() {
		showControls();
		scheduleHideControls();
	}

	function onOverlayClick() {
		if (controlsVisible) {
			playerStore.togglePlayPause();
		} else {
			showControls();
			scheduleHideControls();
		}
	}

	async function togglePip() {
		const el = playerStore.getVideoElement();
		if (!el) return;
		try {
			if (document.pictureInPictureElement) {
				await document.exitPictureInPicture();
				isPip = false;
			} else {
				await el.requestPictureInPicture();
				isPip = true;
			}
		} catch (e) {
			console.warn('PiP failed:', e);
		}
	}

	function toggleFullscreen() {
		const el = playerStore.getVideoElement();
		if (!el) return;
		if (document.fullscreenElement) {
			document.exitFullscreen();
		} else {
			el.requestFullscreen();
		}
	}

	function handleResume() {
		if (resumeTime) {
			playerStore.seek(resumeTime);
			resumeTime = null;
			if (!playerStore.state.isPlaying) {
				playerStore.togglePlayPause();
			}
		}
	}

	function dismissResume() {
		resumeTime = null;
	}

	function goBack() {
		if (document.referrer && new URL(document.referrer).origin === location.origin) {
			history.back();
		} else {
			goto(isVideo ? '/video' : media.category === 'voice' ? '/voice' : '/music');
		}
	}

	async function handleDownload() {
		downloading = true;
		downloadProgress = 0;
		try {
			await downloadMedia(
				media.id,
				media.title,
				media.category,
				(loaded, total) => {
					downloadProgress = total > 0 ? (loaded / total) * 100 : 0;
				}
			);
			isDownloaded = true;
		} catch (err) {
			console.error('Download failed:', err);
			alert('Download failed');
		}
		downloading = false;
	}

	function formatTime(seconds: number): string {
		if (!seconds || !isFinite(seconds)) return '0:00';
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = Math.floor(seconds % 60);
		if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	let tagsText = $derived(
		(() => {
			const parts: string[] = [];
			const cat = categoryLabels[media.category] ?? (media.category);
			if (cat) parts.push(cat);
			if (media.tags && (media.tags as any[]).length > 0) {
				parts.push(...(media.tags as any[]).map((t: any) => t.name));
			}
			return parts.join(' · ');
		})()
	);

	let pipSupported = $derived(document.pictureInPictureEnabled);
	let fullscreenSupported = $derived(document.fullscreenEnabled);
</script>

{#if isVideo}
<!-- Video overlay controls (sits on top of the global <video> from layout) -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="vp-overlay-container" onpointermove={onOverlayInteraction}>
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="vp-overlay"
		class:vp-overlay-visible={controlsVisible}
		onclick={onOverlayClick}
	>
		<!-- Top bar -->
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="vp-top-bar" onclick={(e) => e.stopPropagation()}>
			<button class="vp-btn" onclick={goBack} aria-label="Back">
				<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M19 12H5M12 19l-7-7 7-7" />
				</svg>
			</button>
			<span class="vp-title">{playerStore.state.title || media.title}</span>
		</div>

		<!-- Center play/pause -->
		<div class="vp-center">
			<button class="vp-center-btn" onclick={(e) => { e.stopPropagation(); playerStore.togglePlayPause(); }} aria-label={playerStore.state.isPlaying ? 'Pause' : 'Play'}>
				{#if playerStore.state.isPlaying}
					<svg viewBox="0 0 24 24" width="36" height="36" fill="white">
						<rect x="6" y="4" width="4" height="16" rx="1" />
						<rect x="14" y="4" width="4" height="16" rx="1" />
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" width="36" height="36" fill="white">
						<polygon points="6,3 20,12 6,21" />
					</svg>
				{/if}
			</button>
		</div>

		<!-- Bottom bar -->
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="vp-bottom-bar" onclick={(e) => e.stopPropagation()}>
			<!-- Seekbar -->
			<div class="vp-seek-row">
				<span class="vp-time">{formatTime(videoSeeking ? videoSeekValue : playerStore.state.currentTime)}</span>
				<input
					type="range"
					class="vp-seek-bar"
					min="0"
					max={playerStore.state.duration || 0}
					value={videoSeeking ? videoSeekValue : playerStore.state.currentTime}
					step="0.1"
					oninput={(e) => {
						videoSeeking = true;
						videoSeekValue = parseFloat((e.target as HTMLInputElement).value);
						showControls();
					}}
					onchange={(e) => {
						const val = parseFloat((e.target as HTMLInputElement).value);
						playerStore.seek(val);
						videoSeeking = false;
						scheduleHideControls();
					}}
				/>
				<span class="vp-time">{formatTime(playerStore.state.duration)}</span>
			</div>

			<!-- Controls row -->
			<div class="vp-controls-row">
				<button class="vp-btn" class:vp-active={playerStore.state.shuffle} onclick={() => playerStore.toggleShuffle()} aria-label="Shuffle">
					<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="16 3 21 3 21 8" />
						<line x1="4" y1="20" x2="21" y2="3" />
						<polyline points="21 16 21 21 16 21" />
						<line x1="15" y1="15" x2="21" y2="21" />
						<line x1="4" y1="4" x2="9" y2="9" />
					</svg>
				</button>

				<button class="vp-btn vp-rate-btn" onclick={() => playerStore.cyclePlaybackRate()}>
					{playerStore.state.playbackRate.toFixed(playerStore.state.playbackRate % 1 === 0 ? 1 : 2)}x
				</button>

				<button class="vp-btn" onclick={() => playerStore.skipBackward(10)} aria-label="10 seconds back">
					<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
						<path d="M1 4v6h6" />
						<path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
					</svg>
					<span class="vp-skip-label">10</span>
				</button>

				<button class="vp-btn" onclick={() => playerStore.skipForward(10)} aria-label="10 seconds forward">
					<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
						<path d="M23 4v6h-6" />
						<path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
					</svg>
					<span class="vp-skip-label">10</span>
				</button>

				<button class="vp-btn" onclick={() => playerStore.previous()} aria-label="Previous">
					<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
						<rect x="4" y="6" width="2.5" height="12" rx="0.5" />
						<polygon points="19,6 9,12 19,18" />
					</svg>
				</button>

				<button class="vp-btn" onclick={() => playerStore.next()} aria-label="Next">
					<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
						<polygon points="5,6 15,12 5,18" />
						<rect x="17.5" y="6" width="2.5" height="12" rx="0.5" />
					</svg>
				</button>

				{#if pipSupported}
					<button class="vp-btn" class:vp-active={isPip} onclick={togglePip} aria-label="Picture in Picture">
						<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<rect x="2" y="3" width="20" height="14" rx="2" />
							<rect x="12" y="9" width="8" height="6" rx="1" fill="currentColor" opacity="0.4" />
						</svg>
					</button>
				{/if}

				<CastButton mediaId={media.id} title={media.title} {isVideo} />

				<div class="vp-volume-group">
					<button class="vp-btn" onclick={() => playerStore.toggleMute()} aria-label={playerStore.state.muted ? 'Unmute' : 'Mute'}>
						{#if playerStore.state.muted || playerStore.state.volume === 0}
							<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
								<line x1="23" y1="9" x2="17" y2="15" />
								<line x1="17" y1="9" x2="23" y2="15" />
							</svg>
						{:else if playerStore.state.volume < 0.5}
							<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
								<path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
							</svg>
						{:else}
							<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
								<path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
								<path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
							</svg>
						{/if}
					</button>
					<input
						type="range"
						class="vp-volume-slider"
						min="0"
						max="1"
						step="0.05"
						value={playerStore.state.muted ? 0 : playerStore.state.volume}
						oninput={(e) => {
							const vol = parseFloat((e.target as HTMLInputElement).value);
							playerStore.setVolume(vol);
							showControls();
						}}
						onchange={() => scheduleHideControls()}
					/>
				</div>

				{#if downloading}
					<span class="vp-dl-pct">{Math.round(downloadProgress)}%</span>
				{:else if !isDownloaded}
					<button class="vp-btn" onclick={handleDownload} aria-label="Save Offline">
						<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
							<polyline points="7 10 12 15 17 10" />
							<line x1="12" y1="15" x2="12" y2="3" />
						</svg>
					</button>
				{/if}

				{#if fullscreenSupported}
					<button class="vp-btn" onclick={toggleFullscreen} aria-label="Fullscreen">
						<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="15 3 21 3 21 9" />
							<polyline points="9 21 3 21 3 15" />
							<line x1="21" y1="3" x2="14" y2="10" />
							<line x1="3" y1="21" x2="10" y2="14" />
						</svg>
					</button>
				{/if}

				<button class="vp-btn vp-repeat-btn" class:vp-active={playerStore.state.repeatMode !== 'off'} onclick={() => playerStore.setRepeatMode()} aria-label="Repeat">
					<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="17 1 21 5 17 9" />
						<path d="M3 11V9a4 4 0 0 1 4-4h14" />
						<polyline points="7 23 3 19 7 15" />
						<path d="M21 13v2a4 4 0 0 1-4 4H3" />
					</svg>
					{#if playerStore.state.repeatMode === 'one'}
						<span class="vp-repeat-badge">1</span>
					{/if}
				</button>
			</div>
		</div>
	</div>

	<!-- Resume overlay -->
	{#if resumeTime}
		<div class="vp-resume">
			<button class="vp-resume-btn" onclick={handleResume}>
				続きから再生 ({formatTime(resumeTime)})
			</button>
			<button class="vp-resume-dismiss" onclick={dismissResume} aria-label="Dismiss">
				<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</div>
	{/if}
</div>

<!-- Media info (below the fixed video area, pushed down) -->
<div class="vp-info-page">
	<div class="vp-info">
		<h1 class="vp-info-title">{media.title}</h1>
		<div class="vp-info-subtitle">{tagsText}</div>

		{#if playerStore.state.isOffline}
			<div class="vp-offline-badge">Offline playback</div>
		{/if}

		{#if media.metadata && (media.metadata as any[]).length > 0}
			<details class="vp-details" bind:open={showMetadata}>
				<summary>詳細情報</summary>
				<dl class="vp-meta-grid">
					{#each media.metadata as meta}
						<dt>{meta.key}</dt>
						<dd>{meta.value}</dd>
					{/each}
				</dl>
			</details>
		{/if}

		<div class="vp-actions">
			{#if downloading}
				<div class="download-progress">
					<div class="progress-bar">
						<div class="progress-fill" style="width: {downloadProgress}%"></div>
					</div>
					<span>{Math.round(downloadProgress)}%</span>
				</div>
			{:else if isDownloaded}
				<span class="downloaded-badge">Downloaded</span>
			{:else}
				<button class="vp-action-btn" onclick={handleDownload}>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
						<polyline points="7 10 12 15 17 10" />
						<line x1="12" y1="15" x2="12" y2="3" />
					</svg>
					Save Offline
				</button>
			{/if}
		</div>
	</div>

	<!-- Queue -->
	{#if playerStore.state.queue.length > 1}
		<div class="vp-queue">
			<h3 class="vp-queue-title">Queue</h3>
			<div class="vp-queue-list">
				{#each playerStore.state.queue as item, i}
					<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
					<div
						role="button"
						tabindex="0"
						class="vp-queue-item"
						class:vp-queue-current={i === playerStore.state.currentIndex}
						onclick={() => playerStore.playFromQueue(i)}
					>
						<div class="vp-queue-thumb">
							{#if item.thumbnailPath}
								<img src={`/api/media/${item.mediaId}/thumbnail`} alt={item.title} />
							{:else}
								<div class="vp-queue-thumb-placeholder">
									{#if isVideoCategory(item.category)}
										<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5">
											<rect x="2" y="4" width="20" height="16" rx="2" />
											<polygon points="10,8 16,12 10,16" fill="currentColor" opacity="0.5" />
										</svg>
									{:else}
										<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5">
											<path d="M9 18V5l12-2v13" />
											<circle cx="6" cy="18" r="3" />
											<circle cx="18" cy="16" r="3" />
										</svg>
									{/if}
								</div>
							{/if}
						</div>
						<span class="vp-queue-item-title">{item.title}</span>
						<button
							class="vp-queue-remove"
							onclick={(e) => { e.stopPropagation(); playerStore.removeFromQueue(i); }}
							aria-label="Remove from queue"
						>
							<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
								<line x1="18" y1="6" x2="6" y2="18" />
								<line x1="6" y1="6" x2="18" y2="18" />
							</svg>
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
{:else}
<!-- Audio: Apple Music-style full player -->
<div class="amp">
	<!-- Header bar -->
	<header class="amp-header">
		<button class="amp-header-btn" onclick={goBack} aria-label="Back">
			<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="6 9 12 15 18 9" />
			</svg>
		</button>
		<span class="amp-header-title">Now Playing</span>
		<button class="amp-header-btn" onclick={() => showQueue = !showQueue} aria-label="Queue" class:amp-active={showQueue}>
			<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<line x1="8" y1="6" x2="21" y2="6" />
				<line x1="8" y1="12" x2="21" y2="12" />
				<line x1="8" y1="18" x2="21" y2="18" />
				<line x1="3" y1="6" x2="3.01" y2="6" />
				<line x1="3" y1="12" x2="3.01" y2="12" />
				<line x1="3" y1="18" x2="3.01" y2="18" />
			</svg>
		</button>
	</header>

	<!-- Main content area -->
	<div class="amp-body">
		{#if !showQueue}
		<!-- Artwork view -->
		<div class="amp-artwork-wrap">
			<div class="amp-artwork" class:amp-artwork-playing={playerStore.state.isPlaying}>
				{#if media.thumbnail_path}
					<img src={`/api/media/${media.id}/thumbnail`} alt={media.title} />
				{:else}
					<div class="amp-placeholder">
						<svg viewBox="0 0 24 24" width="80" height="80" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M9 18V5l12-2v13" />
							<circle cx="6" cy="18" r="3" />
							<circle cx="18" cy="16" r="3" />
						</svg>
					</div>
				{/if}
			</div>
		</div>

		<!-- Song info -->
		<div class="amp-info">
			<div class="amp-title">{playerStore.state.title || media.title}</div>
			<div class="amp-subtitle">{tagsText}</div>
		</div>

		<!-- Seekbar -->
		<div class="amp-seek">
			<input
				type="range"
				class="amp-seek-bar"
				min="0"
				max={playerStore.state.duration || 0}
				value={isSeeking ? seekValue : playerStore.state.currentTime}
				step="0.1"
				oninput={(e) => {
					isSeeking = true;
					seekValue = parseFloat((e.target as HTMLInputElement).value);
				}}
				onchange={(e) => {
					const val = parseFloat((e.target as HTMLInputElement).value);
					playerStore.seek(val);
					isSeeking = false;
				}}
			/>
			<div class="amp-seek-labels">
				<span>{formatTime(isSeeking ? seekValue : playerStore.state.currentTime)}</span>
				<span>-{formatTime(Math.max(0, (playerStore.state.duration || 0) - (isSeeking ? seekValue : playerStore.state.currentTime)))}</span>
			</div>
		</div>

		<!-- Main controls row -->
		<div class="amp-controls">
			<button class="amp-ctrl-btn amp-ctrl-sm" onclick={() => playerStore.toggleShuffle()} class:amp-active={playerStore.state.shuffle} aria-label="Shuffle">
				<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="16 3 21 3 21 8" />
					<line x1="4" y1="20" x2="21" y2="3" />
					<polyline points="21 16 21 21 16 21" />
					<line x1="15" y1="15" x2="21" y2="21" />
					<line x1="4" y1="4" x2="9" y2="9" />
				</svg>
			</button>

			<button class="amp-ctrl-btn amp-ctrl-md" onclick={() => playerStore.previous()} aria-label="Previous">
				<svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
					<rect x="3" y="5" width="3" height="14" rx="0.5" />
					<polygon points="21,5 10,12 21,19" />
				</svg>
			</button>

			<button class="amp-ctrl-btn amp-ctrl-skip" onclick={() => playerStore.skipBackward(15)} aria-label="15 seconds back">
				<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
					<path d="M1 4v6h6" />
					<path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
				</svg>
				<span class="amp-skip-text">15</span>
			</button>

			<button class="amp-ctrl-btn amp-ctrl-play" onclick={() => playerStore.togglePlayPause()} aria-label={playerStore.state.isPlaying ? 'Pause' : 'Play'}>
				{#if playerStore.state.isPlaying}
					<svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
						<rect x="6" y="4" width="4" height="16" rx="1" />
						<rect x="14" y="4" width="4" height="16" rx="1" />
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
						<polygon points="6,3 20,12 6,21" />
					</svg>
				{/if}
			</button>

			<button class="amp-ctrl-btn amp-ctrl-skip" onclick={() => playerStore.skipForward(30)} aria-label="30 seconds forward">
				<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
					<path d="M23 4v6h-6" />
					<path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
				</svg>
				<span class="amp-skip-text">30</span>
			</button>

			<button class="amp-ctrl-btn amp-ctrl-md" onclick={() => playerStore.next()} aria-label="Next">
				<svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
					<polygon points="3,5 14,12 3,19" />
					<rect x="18" y="5" width="3" height="14" rx="0.5" />
				</svg>
			</button>

			<button class="amp-ctrl-btn amp-ctrl-sm amp-repeat-btn" onclick={() => playerStore.setRepeatMode()} class:amp-active={playerStore.state.repeatMode !== 'off'} aria-label="Repeat">
				<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="17 1 21 5 17 9" />
					<path d="M3 11V9a4 4 0 0 1 4-4h14" />
					<polyline points="7 23 3 19 7 15" />
					<path d="M21 13v2a4 4 0 0 1-4 4H3" />
				</svg>
				{#if playerStore.state.repeatMode === 'one'}
					<span class="amp-repeat-badge">1</span>
				{/if}
			</button>
		</div>

		<!-- Sub controls row -->
		<div class="amp-sub-controls">
			<button class="amp-sub-btn" onclick={() => playerStore.cyclePlaybackRate()}>
				{playerStore.state.playbackRate.toFixed(playerStore.state.playbackRate % 1 === 0 ? 1 : 2)}x
			</button>
			<CastButton mediaId={media.id} title={media.title} {isVideo} />
			{#if downloading}
				<div class="download-progress">
					<div class="progress-bar">
						<div class="progress-fill" style="width: {downloadProgress}%"></div>
					</div>
					<span class="amp-dl-pct">{Math.round(downloadProgress)}%</span>
				</div>
			{:else if isDownloaded}
				<span class="downloaded-badge">Downloaded</span>
			{:else}
				<button class="amp-sub-btn" onclick={handleDownload} aria-label="Save Offline">
					<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
						<polyline points="7 10 12 15 17 10" />
						<line x1="12" y1="15" x2="12" y2="3" />
					</svg>
				</button>
			{/if}
		</div>

		{:else}
		<!-- Queue view -->
		<div class="amp-queue">
			<h3 class="amp-queue-title">Queue</h3>
			{#if playerStore.state.queue.length === 0}
				<p class="amp-queue-empty">Queue is empty</p>
			{:else}
				<div class="amp-queue-list">
					{#each playerStore.state.queue as item, i}
						<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_no_static_element_interactions -->
						<div
							role="button"
							tabindex="0"
							class="amp-queue-item"
							class:amp-queue-current={i === playerStore.state.currentIndex}
							onclick={() => playerStore.playFromQueue(i)}
						>
							<div class="amp-queue-thumb">
								{#if item.thumbnailPath}
									<img src={`/api/media/${item.mediaId}/thumbnail`} alt={item.title} />
								{:else}
									<div class="amp-queue-thumb-placeholder">
										<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5">
											<path d="M9 18V5l12-2v13" />
											<circle cx="6" cy="18" r="3" />
											<circle cx="18" cy="16" r="3" />
										</svg>
									</div>
								{/if}
							</div>
							<span class="amp-queue-item-title">{item.title}</span>
							<button
								class="amp-queue-remove"
								onclick={(e) => { e.stopPropagation(); playerStore.removeFromQueue(i); }}
								aria-label="Remove from queue"
							>
								<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
									<line x1="18" y1="6" x2="6" y2="18" />
									<line x1="6" y1="6" x2="18" y2="18" />
								</svg>
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>
		{/if}
	</div>
</div>
{/if}

<style>
	/* === Video player overlay === */
	.vp-overlay-container {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 56.25vw; /* 16:9, matches gvw-full */
		max-height: 60vh;
		z-index: 51;
	}

	.vp-info-page {
		padding-top: min(56.25vw, 60vh); /* matches fixed video area height */
		max-width: 960px;
		margin: 0 auto;
	}

	/* Overlay */
	.vp-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.3s ease;
		z-index: 2;
	}

	.vp-overlay-visible {
		opacity: 1;
		pointer-events: auto;
	}

	/* Top bar */
	.vp-top-bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: linear-gradient(to bottom, rgba(0,0,0,0.6), transparent);
	}

	.vp-title {
		color: white;
		font-size: 0.9rem;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
	}

	/* Center button */
	.vp-center {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1;
		pointer-events: none;
	}

	.vp-center-btn {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: rgba(0,0,0,0.5);
		border: none;
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: auto;
	}

	.vp-center-btn:active {
		background: rgba(0,0,0,0.7);
	}

	/* Bottom bar */
	.vp-bottom-bar {
		padding: 0.5rem 1rem 0.75rem;
		background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	/* Seek row */
	.vp-seek-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.vp-time {
		color: white;
		font-size: 0.7rem;
		font-variant-numeric: tabular-nums;
		min-width: 3em;
	}

	.vp-time:last-child {
		text-align: right;
	}

	.vp-seek-bar {
		-webkit-appearance: none;
		appearance: none;
		flex: 1;
		height: 4px;
		background: rgba(255,255,255,0.3);
		border-radius: 2px;
		outline: none;
		cursor: pointer;
	}

	.vp-seek-bar::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 14px;
		height: 14px;
		background: white;
		border-radius: 50%;
		cursor: pointer;
		border: none;
	}

	.vp-seek-bar::-moz-range-thumb {
		width: 14px;
		height: 14px;
		background: white;
		border-radius: 50%;
		cursor: pointer;
		border: none;
	}

	/* Controls row */
	.vp-controls-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.vp-btn {
		background: none;
		border: none;
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 4px;
		position: relative;
	}

	.vp-btn:active {
		opacity: 0.6;
	}

	.vp-btn.vp-active {
		color: var(--color-primary);
	}

	.vp-rate-btn {
		font-size: 0.8rem;
		font-weight: 700;
		min-width: 3em;
	}

	.vp-skip-label {
		position: absolute;
		font-size: 0.5rem;
		font-weight: 700;
		color: currentColor;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -38%);
	}

	.vp-volume-group {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.vp-volume-slider {
		-webkit-appearance: none;
		appearance: none;
		width: 60px;
		height: 4px;
		background: rgba(255, 255, 255, 0.3);
		border-radius: 2px;
		outline: none;
		cursor: pointer;
	}

	.vp-volume-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 12px;
		height: 12px;
		background: white;
		border-radius: 50%;
		cursor: pointer;
		border: none;
	}

	.vp-volume-slider::-moz-range-thumb {
		width: 12px;
		height: 12px;
		background: white;
		border-radius: 50%;
		cursor: pointer;
		border: none;
	}

	.vp-repeat-btn {
		position: relative;
	}

	.vp-repeat-badge {
		position: absolute;
		top: -2px;
		right: -2px;
		font-size: 0.5rem;
		font-weight: 700;
		color: var(--color-primary);
		line-height: 1;
	}

	.vp-dl-pct {
		color: rgba(255,255,255,0.7);
		font-size: 0.75rem;
	}

	/* Resume overlay */
	.vp-resume {
		position: absolute;
		bottom: 80px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 0.5rem;
		z-index: 3;
		animation: fadeIn 0.3s ease-out;
	}

	.vp-resume-btn {
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: 9999px;
		padding: 0.5rem 1.25rem;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
	}

	.vp-resume-btn:active {
		opacity: 0.8;
	}

	.vp-resume-dismiss {
		background: rgba(0,0,0,0.5);
		border: none;
		border-radius: 50%;
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		cursor: pointer;
	}

	/* Info below video */
	.vp-info {
		padding: 1rem;
	}

	.vp-info-title {
		font-size: 1.25rem;
		font-weight: 700;
		margin: 0 0 0.25rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.vp-info-subtitle {
		color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
		font-size: 0.875rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.vp-offline-badge {
		display: inline-block;
		padding: 0.2rem 0.6rem;
		background: var(--color-base-200);
		color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
		border-radius: 0.5rem;
		font-size: 0.875rem;
		margin-top: 0.5rem;
	}

	.vp-details {
		margin-top: 0.75rem;
	}

	.vp-details summary {
		color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
		font-size: 0.875rem;
		cursor: pointer;
		user-select: none;
	}

	.vp-meta-grid {
		margin: 0.5rem 0 0;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.25rem 1rem;
		font-size: 0.875rem;
	}

	.vp-meta-grid dt {
		color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
	}

	.vp-meta-grid dd {
		margin: 0;
	}

	.vp-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.vp-action-btn {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.5rem 1rem;
		background: var(--color-base-200);
		color: var(--color-base-content);
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		font-size: 0.875rem;
	}

	.vp-action-btn:active {
		background: var(--color-base-300);
	}

	/* Video queue */
	.vp-queue {
		padding: 0.75rem 1rem 2rem;
		border-top: 1px solid var(--color-base-300);
	}

	.vp-queue-title {
		font-size: 1rem;
		font-weight: 700;
		margin: 0 0 0.5rem;
		color: var(--color-base-content);
	}

	.vp-queue-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.vp-queue-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem;
		border-radius: 0.5rem;
		background: none;
		border: none;
		border-left: 3px solid transparent;
		color: var(--color-base-content);
		text-align: left;
		cursor: pointer;
		width: 100%;
		font-size: 1rem;
	}

	.vp-queue-item:active {
		background: var(--color-base-200);
	}

	.vp-queue-current {
		border-left-color: var(--color-primary);
		background: var(--color-base-200);
	}

	.vp-queue-thumb {
		width: 56px;
		height: 32px;
		border-radius: 4px;
		overflow: hidden;
		background: var(--color-base-300);
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.vp-queue-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.vp-queue-thumb-placeholder {
		color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
		opacity: 0.5;
	}

	.vp-queue-item-title {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.vp-queue-remove {
		background: none;
		border: none;
		color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
		cursor: pointer;
		padding: 4px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.5rem;
	}

	.vp-queue-remove:active {
		opacity: 0.6;
	}

	.downloaded-badge {
		color: var(--color-primary);
		font-size: 1rem;
	}

	.download-progress {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		max-width: 200px;
	}

	.progress-bar {
		flex: 1;
		height: 6px;
		background: var(--color-base-200);
		border-radius: 0.5rem;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--color-primary);
		transition: width 0.2s;
	}

	/* === Audio: Apple Music-style full player === */
	.amp {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
		max-width: 428px;
		margin: 0 auto;
		padding: 0 1rem;
		background: var(--color-base-100);
	}

	/* Header */
	.amp-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 0;
		flex-shrink: 0;
	}

	.amp-header-btn {
		background: none;
		border: none;
		color: var(--color-base-content);
		cursor: pointer;
		padding: 4px;
		border-radius: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.amp-header-btn:active {
		opacity: 0.6;
	}

	.amp-header-btn.amp-active {
		color: var(--color-primary);
	}

	.amp-header-title {
		font-size: 0.875rem;
		color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 600;
	}

	/* Body */
	.amp-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 1.25rem;
		padding-bottom: 2rem;
	}

	/* Artwork */
	.amp-artwork-wrap {
		display: flex;
		justify-content: center;
	}

	.amp-artwork {
		width: 85vw;
		max-width: 380px;
		aspect-ratio: 1;
		border-radius: 16px;
		overflow: hidden;
		background: var(--color-base-300);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
		transition: box-shadow 0.6s ease;
	}

	.amp-artwork-playing {
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.35);
		animation: artwork-pulse 3s ease-in-out infinite;
	}

	@keyframes artwork-pulse {
		0%, 100% { box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25); }
		50% { box-shadow: 0 12px 50px rgba(0, 0, 0, 0.4); }
	}

	.amp-artwork img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.amp-placeholder {
		color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
		opacity: 0.5;
	}

	/* Song info */
	.amp-info {
		text-align: center;
		padding: 0 0.5rem;
	}

	.amp-title {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--color-base-content);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.amp-subtitle {
		font-size: 0.875rem;
		color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
		margin-top: 0.2rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Seekbar */
	.amp-seek {
		padding: 0 0.25rem;
	}

	.amp-seek-bar {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 4px;
		background: var(--color-base-300);
		border-radius: 2px;
		outline: none;
		cursor: pointer;
	}

	.amp-seek-bar::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 14px;
		height: 14px;
		background: var(--color-base-content);
		border-radius: 50%;
		cursor: pointer;
		border: none;
	}

	.amp-seek-bar::-moz-range-thumb {
		width: 14px;
		height: 14px;
		background: var(--color-base-content);
		border-radius: 50%;
		cursor: pointer;
		border: none;
	}

	.amp-seek-bar::-webkit-slider-runnable-track {
		height: 4px;
		border-radius: 2px;
	}

	.amp-seek-labels {
		display: flex;
		justify-content: space-between;
		margin-top: 0.35rem;
		font-size: 0.7rem;
		color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
		font-variant-numeric: tabular-nums;
	}

	/* Main controls */
	.amp-controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	.amp-ctrl-btn {
		background: none;
		border: none;
		color: var(--color-base-content);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		position: relative;
	}

	.amp-ctrl-btn:active {
		opacity: 0.6;
	}

	.amp-ctrl-sm {
		width: 36px;
		height: 36px;
	}

	.amp-ctrl-md {
		width: 44px;
		height: 44px;
	}

	.amp-ctrl-skip {
		width: 44px;
		height: 44px;
		position: relative;
	}

	.amp-skip-text {
		position: absolute;
		font-size: 0.55rem;
		font-weight: 700;
		color: currentColor;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -38%);
	}

	.amp-ctrl-play {
		width: 64px;
		height: 64px;
		background: var(--color-primary);
		border-radius: 50%;
		flex-shrink: 0;
	}

	.amp-ctrl-btn.amp-active {
		color: var(--color-primary);
	}

	.amp-repeat-btn {
		position: relative;
	}

	.amp-repeat-badge {
		position: absolute;
		top: 2px;
		right: 2px;
		font-size: 0.5rem;
		font-weight: 700;
		color: var(--color-primary);
		line-height: 1;
	}

	/* Sub controls */
	.amp-sub-controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.5rem;
	}

	.amp-sub-btn {
		background: none;
		border: none;
		color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 600;
		padding: 0.25rem 0.5rem;
		border-radius: 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.amp-sub-btn:active {
		opacity: 0.6;
	}

	.amp-dl-pct {
		font-size: 0.875rem;
		color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
	}

	/* Queue view */
	.amp-queue {
		flex: 1;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.amp-queue-title {
		font-size: 1.1rem;
		font-weight: 700;
		margin: 0 0 0.75rem;
		color: var(--color-base-content);
	}

	.amp-queue-empty {
		color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
		text-align: center;
		padding: 2rem 0;
	}

	.amp-queue-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.amp-queue-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem;
		border-radius: 0.5rem;
		background: none;
		border: none;
		border-left: 3px solid transparent;
		color: var(--color-base-content);
		text-align: left;
		cursor: pointer;
		width: 100%;
		font-size: 1rem;
	}

	.amp-queue-item:active {
		background: var(--color-base-200);
	}

	.amp-queue-current {
		border-left-color: var(--color-primary);
		background: var(--color-base-200);
	}

	.amp-queue-thumb {
		width: 40px;
		height: 40px;
		border-radius: 4px;
		overflow: hidden;
		background: var(--color-base-300);
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.amp-queue-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.amp-queue-thumb-placeholder {
		color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
		opacity: 0.5;
	}

	.amp-queue-item-title {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.amp-queue-remove {
		background: none;
		border: none;
		color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
		cursor: pointer;
		padding: 4px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.5rem;
	}

	.amp-queue-remove:active {
		opacity: 0.6;
	}
</style>
