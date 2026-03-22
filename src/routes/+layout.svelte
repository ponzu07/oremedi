<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import MiniPlayer from '$lib/components/MiniPlayer.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import { playerStore, isVideoCategory } from '$lib/stores/player.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	const hideNav = $derived(page.url.pathname === '/login');
	const mediaCategory = $derived(
		page.url.pathname.startsWith('/play/') ? (page.data as any)?.media?.category : undefined
	);
	const hasPlayer = $derived(playerStore.state.mediaId !== null);
	const isCurrentVideo = $derived(
		hasPlayer && isVideoCategory(playerStore.state.category)
	);
	const isFullPlayer = $derived(playerStore.state.isFullPlayer);

	let audioEl: HTMLAudioElement;
	let videoEl: HTMLVideoElement;

	onMount(() => {
		playerStore.bindAudio(audioEl);
		playerStore.bindVideo(videoEl);
	});

	$effect(() => {
		let offset = '56px';
		if (hasPlayer) {
			offset = isCurrentVideo ? '128px' : '116px';
		}
		document.documentElement.style.setProperty('--bottom-offset', offset);
	});
</script>

<audio bind:this={audioEl} hidden></audio>

<!-- svelte-ignore a11y_media_has_caption -->
<div
	class="gvw"
	class:gvw-full={isCurrentVideo && isFullPlayer}
	class:gvw-mini={isCurrentVideo && !isFullPlayer}
	class:gvw-hidden={!isCurrentVideo}
>
	<video bind:this={videoEl} preload="metadata"></video>
</div>

{@render children()}

{#if !hideNav}
	<MiniPlayer />
	<BottomNav {mediaCategory} />
{/if}
<Toast />

<style>
	:global(body) {
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		padding-bottom: var(--bottom-offset);
	}

	/* Global video wrapper states */
	.gvw-hidden {
		display: none;
	}

	.gvw-full {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 56.25vw; /* 16:9 */
		max-height: 60vh;
		z-index: 50;
		background: #000;
	}

	.gvw-full video {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.gvw-mini {
		position: fixed;
		bottom: calc(3.5rem + 64px); /* dock-sm + mini-player */
		left: 8px;
		width: 120px;
		height: 68px;
		z-index: 100;
		border-radius: 4px;
		overflow: hidden;
		background: #000;
	}

	.gvw-mini video {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
