<script lang="ts">
	import { page } from '$app/state';
	import { Search, Play, Music, Mic, Download } from 'lucide-svelte';

	let { mediaCategory }: { mediaCategory?: string } = $props();

	const navItems = [
		{ href: '/search', label: 'Search', icon: Search },
		{ href: '/video', label: 'Video', icon: Play },
		{ href: '/music', label: 'Music', icon: Music },
		{ href: '/voice', label: 'Voice', icon: Mic },
		{ href: '/downloads', label: 'DL', icon: Download }
	];

	function isActive(href: string): boolean {
		const path = page.url.pathname;
		if (href === '/search') return path === '/search';

		if (path.startsWith('/play/') && mediaCategory) {
			if (href === '/video') return ['movie', 'live_video'].includes(mediaCategory);
			if (href === '/music') return mediaCategory === 'music';
			if (href === '/voice') return mediaCategory === 'voice';
		}

		if (href === '/downloads') {
			return path === '/downloads';
		}

		return path.startsWith(href);
	}
</script>

<div class="dock dock-sm z-[100]">
	{#each navItems as item}
		<a href={item.href} class:dock-active={isActive(item.href)}>
			<item.icon size={20} />
			<span class="dock-label">{item.label}</span>
		</a>
	{/each}
</div>
