<script lang="ts">
	import { page } from '$app/state';
	import BottomNav from '$lib/components/BottomNav.svelte';

	let { children } = $props();

	const hideNav = $derived(page.url.pathname === '/login');
	const mediaCategory = $derived(
		page.url.pathname.startsWith('/play/') ? (page.data as any)?.media?.category : undefined
	);
</script>

{@render children()}

{#if !hideNav}
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
