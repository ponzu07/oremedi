<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import CastButton from '$lib/components/CastButton.svelte';
	import { playerStore } from '$lib/stores/player.svelte';
	import {
		downloadMedia,
		getDownloadedMediaUrl,
		getDownloadedMedia,
		formatSize
	} from '$lib/download-manager';

	let { data }: { data: PageData } = $props();
	const media = data.media;

	const isVideo = ['movie', 'live_video'].includes(media.category as string);
	const onlineStreamUrl = `/api/media/${media.id}/stream`;

	let mediaUrl = $state(onlineStreamUrl);
	let isOffline = $state(false);
	let isDownloaded = $state(false);
	let downloading = $state(false);
	let downloadProgress = $state(0);

	// Audio player states
	let showQueue = $state(false);
	let isSeeking = $state(false);
	let seekValue = $state(0);

	const categoryLabels: Record<string, string> = {
		movie: 'Movie',
		live_video: 'Live Video',
		voice: 'Voice',
		music: 'Music'
	};

	// Sync seekValue from store when not seeking
	$effect(() => {
		if (!isSeeking) {
			seekValue = playerStore.state.currentTime;
		}
	});

	onMount(async () => {
		if (!isVideo) {
			await playerStore.play(
				media.id as number,
				media.title as string,
				media.category as string,
				media.thumbnail_path as string | null
			);
		}

		// Check if already downloaded
		const existing = await getDownloadedMedia(media.id as number);
		if (existing) {
			isDownloaded = true;
		}

		// If offline, use downloaded version (video only)
		if (isVideo) {
			if (!navigator.onLine && existing) {
				const url = await getDownloadedMediaUrl(media.id as number);
				if (url) {
					mediaUrl = url;
					isOffline = true;
				}
			}
		}
	});

	function goBack() {
		if (document.referrer && new URL(document.referrer).origin === location.origin) {
			history.back();
		} else {
			goto(isVideo ? '/video' : '/audio');
		}
	}

	async function handleDownload() {
		downloading = true;
		downloadProgress = 0;
		try {
			await downloadMedia(
				media.id as number,
				media.title as string,
				media.category as string,
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
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	let tagsText = $derived(
		(() => {
			const parts: string[] = [];
			const cat = categoryLabels[media.category as string] ?? (media.category as string);
			if (cat) parts.push(cat);
			if (media.tags && (media.tags as any[]).length > 0) {
				parts.push(...(media.tags as any[]).map((t: any) => t.name));
			}
			return parts.join(' · ');
		})()
	);
</script>

{#if isVideo}
<div class="player-page">
	<nav>
		<button class="back-btn" onclick={goBack}>
			<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M19 12H5M12 19l-7-7 7-7" />
			</svg>
			Back
		</button>
	</nav>

	<div class="player-container">
		<!-- svelte-ignore a11y_media_has_caption -->
		<video controls autoplay preload="metadata" src={mediaUrl}>
			Your browser does not support the video tag.
		</video>
	</div>

	<div class="media-info">
		<h1>{media.title}</h1>
		<span class="category">{categoryLabels[media.category as string] ?? media.category}</span>

		{#if media.tags && (media.tags as any[]).length > 0}
			<div class="tags">
				{#each media.tags as tag}
					<span class="tag">{tag.name}</span>
				{/each}
			</div>
		{/if}

		{#if media.metadata && (media.metadata as any[]).length > 0}
			<dl class="metadata">
				{#each media.metadata as meta}
					<dt>{meta.key}</dt>
					<dd>{meta.value}</dd>
				{/each}
			</dl>
		{/if}

		{#if isOffline}
			<div class="offline-badge">Offline playback</div>
		{/if}

		<div class="actions">
			<CastButton mediaId={media.id as number} title={media.title as string} {isVideo} />
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
				<button class="btn" onclick={handleDownload}>Save Offline</button>
			{/if}
		</div>
	</div>
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
			<CastButton mediaId={media.id as number} title={media.title as string} {isVideo} />
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
	/* === Video page styles (unchanged) === */
	.player-page {
		max-width: 960px;
		margin: 0 auto;
		padding: 1rem;
	}

	nav {
		margin-bottom: 1rem;
	}

	.back-btn {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		background: none;
		border: none;
		color: var(--color-accent);
		cursor: pointer;
		font-size: var(--font-size-base);
		padding: 0;
	}

	.player-container {
		margin-bottom: 1.5rem;
	}

	video {
		width: 100%;
		max-height: 70vh;
		background: var(--color-bg);
		border-radius: var(--radius-md);
	}

	.media-info h1 {
		margin: 0 0 0.5rem;
		font-size: 1.5rem;
	}

	.category {
		color: var(--color-text-muted);
		font-size: var(--font-size-base);
	}

	.tags {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-top: 0.75rem;
	}

	.tag {
		padding: 0.25rem 0.75rem;
		background: var(--color-surface);
		border-radius: var(--radius-pill);
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
	}

	.metadata {
		margin-top: 1rem;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.25rem 1rem;
	}

	.metadata dt {
		color: var(--color-text-muted);
		font-size: var(--font-size-base);
	}

	.metadata dd {
		margin: 0;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-top: 1.5rem;
	}

	.btn {
		display: inline-block;
		padding: 0.5rem 1.5rem;
		background: var(--color-surface);
		color: var(--color-text);
		text-decoration: none;
		border-radius: var(--radius-sm);
	}

	.btn:hover {
		background: var(--color-surface-alt);
	}

	button.btn {
		padding: 0.5rem 1.5rem;
		background: var(--color-surface);
		color: var(--color-text);
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 1rem;
	}

	.offline-badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		background: var(--color-surface);
		color: var(--color-text-muted);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-sm);
		margin-top: 0.75rem;
	}

	.downloaded-badge {
		color: var(--color-accent);
		font-size: var(--font-size-base);
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
		background: var(--color-surface);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--color-accent);
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
		background: var(--color-bg);
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
		color: var(--color-text);
		cursor: pointer;
		padding: 4px;
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.amp-header-btn:active {
		opacity: 0.6;
	}

	.amp-header-btn.amp-active {
		color: var(--color-accent);
	}

	.amp-header-title {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
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
		background: var(--color-surface-alt);
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
		color: var(--color-text-muted);
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
		color: var(--color-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.amp-subtitle {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
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
		background: var(--color-surface-alt);
		border-radius: 2px;
		outline: none;
		cursor: pointer;
	}

	.amp-seek-bar::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 14px;
		height: 14px;
		background: var(--color-text);
		border-radius: 50%;
		cursor: pointer;
		border: none;
	}

	.amp-seek-bar::-moz-range-thumb {
		width: 14px;
		height: 14px;
		background: var(--color-text);
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
		color: var(--color-text-muted);
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
		color: var(--color-text);
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
		background: var(--color-accent);
		border-radius: 50%;
		flex-shrink: 0;
	}

	.amp-ctrl-btn.amp-active {
		color: var(--color-accent);
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
		color: var(--color-accent);
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
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: var(--font-size-sm);
		font-weight: 600;
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.amp-sub-btn:active {
		opacity: 0.6;
	}

	.amp-dl-pct {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
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
		color: var(--color-text);
	}

	.amp-queue-empty {
		color: var(--color-text-muted);
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
		border-radius: var(--radius-sm);
		background: none;
		border: none;
		border-left: 3px solid transparent;
		color: var(--color-text);
		text-align: left;
		cursor: pointer;
		width: 100%;
		font-size: var(--font-size-base);
	}

	.amp-queue-item:active {
		background: var(--color-surface);
	}

	.amp-queue-current {
		border-left-color: var(--color-accent);
		background: var(--color-surface);
	}

	.amp-queue-thumb {
		width: 40px;
		height: 40px;
		border-radius: 4px;
		overflow: hidden;
		background: var(--color-surface-alt);
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
		color: var(--color-text-muted);
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
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 4px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
	}

	.amp-queue-remove:active {
		opacity: 0.6;
	}
</style>
