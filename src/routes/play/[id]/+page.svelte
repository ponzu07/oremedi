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

	const categoryLabels: Record<string, string> = {
		movie: 'Movie',
		live_video: 'Live Video',
		voice: 'Voice',
		music: 'Music'
	};

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
</script>

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
		{#if isVideo}
			<!-- svelte-ignore a11y_media_has_caption -->
			<video controls autoplay preload="metadata" src={mediaUrl}>
				Your browser does not support the video tag.
			</video>
		{:else}
			<div class="audio-container">
				<div class="audio-art">
					{#if media.thumbnail_path}
						<img src={`/api/media/${media.id}/thumbnail`} alt={media.title} />
					{:else}
						<div class="placeholder-art">&#9835;</div>
					{/if}
				</div>
				<div class="audio-controls">
					<button class="play-pause-btn" onclick={() => playerStore.togglePlayPause()}>
						{#if playerStore.state.isPlaying}
							<svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
								<rect x="6" y="4" width="4" height="16" />
								<rect x="14" y="4" width="4" height="16" />
							</svg>
						{:else}
							<svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
								<polygon points="5,3 19,12 5,21" />
							</svg>
						{/if}
					</button>
				</div>
			</div>
		{/if}
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

<style>
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
		color: var(--color-accent, #5b9df5);
		cursor: pointer;
		font-size: 0.9rem;
		padding: 0;
	}

	.player-container {
		margin-bottom: 1.5rem;
	}

	video {
		width: 100%;
		max-height: 70vh;
		background: #000;
		border-radius: 8px;
	}

	.audio-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.audio-art {
		width: 300px;
		height: 300px;
		border-radius: 8px;
		overflow: hidden;
		background: #1a1a1a;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.audio-art img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.placeholder-art {
		font-size: 5rem;
		color: #444;
	}

	.audio-controls {
		display: flex;
		justify-content: center;
		padding: 1rem 0;
	}

	.play-pause-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 64px;
		height: 64px;
		background: var(--color-accent, #5b9df5);
		border: none;
		border-radius: 50%;
		color: var(--color-text, #fff);
		cursor: pointer;
	}

	.media-info h1 {
		margin: 0 0 0.5rem;
		font-size: 1.5rem;
	}

	.category {
		color: #888;
		font-size: 0.875rem;
	}

	.tags {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-top: 0.75rem;
	}

	.tag {
		padding: 0.25rem 0.75rem;
		background: #222;
		border-radius: 100px;
		font-size: 0.8rem;
		color: #aaa;
	}

	.metadata {
		margin-top: 1rem;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.25rem 1rem;
	}

	.metadata dt {
		color: #888;
		font-size: 0.875rem;
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
		background: #333;
		color: #fff;
		text-decoration: none;
		border-radius: 4px;
	}

	.btn:hover {
		background: #444;
	}

	button.btn {
		padding: 0.5rem 1.5rem;
		background: #333;
		color: #fff;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 1rem;
	}

	.offline-badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		background: #2a2a1a;
		color: #aa8;
		border-radius: 4px;
		font-size: 0.8rem;
		margin-top: 0.75rem;
	}

	.downloaded-badge {
		color: #4a4;
		font-size: 0.875rem;
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
		background: #222;
		border-radius: 3px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: #4a9eff;
		transition: width 0.2s;
	}
</style>
