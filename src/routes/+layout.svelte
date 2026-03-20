<script lang="ts">
	import { page } from '$app/state';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import MiniPlayer from '$lib/components/MiniPlayer.svelte';
	import { playerStore } from '$lib/stores/player.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	const hideNav = $derived(page.url.pathname === '/login');
	const mediaCategory = $derived(
		page.url.pathname.startsWith('/play/') ? (page.data as any)?.media?.category : undefined
	);
	const hasPlayer = $derived(playerStore.state.mediaId !== null);

	let audioEl: HTMLAudioElement;

	onMount(() => {
		playerStore.bindAudio(audioEl);
	});

	$effect(() => {
		if (typeof document !== 'undefined') {
			document.documentElement.style.setProperty(
				'--bottom-offset',
				hasPlayer ? '116px' : '60px'
			);
		}
	});
</script>

<audio bind:this={audioEl} hidden></audio>

{@render children()}

{#if !hideNav}
	<MiniPlayer />
	<BottomNav {mediaCategory} />
{/if}

<style>
	:global(body) {
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: var(--color-bg);
		color: var(--color-text);
		padding-bottom: var(--bottom-offset);
	}
</style>
