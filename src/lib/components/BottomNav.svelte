<script lang="ts">
	import { page } from '$app/state';
	import { Home, Play, Music, Mic, Download } from 'lucide-svelte';

	let { mediaCategory }: { mediaCategory?: string } = $props();

	const navItems = [
		{ href: '/', label: 'Home', icon: Home },
		{ href: '/video', label: 'Video', icon: Play },
		{ href: '/music', label: 'Music', icon: Music },
		{ href: '/voice', label: 'Voice', icon: Mic },
		{ href: '/downloads', label: 'DL', icon: Download }
	];

	function isActive(href: string): boolean {
		const path = page.url.pathname;
		if (href === '/') return path === '/';

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

<div class="btm-nav btm-nav-sm z-[100]" style="padding-bottom: env(safe-area-inset-bottom, 0px);">
	{#each navItems as item}
		<a href={item.href} class:active={isActive(item.href)}>
			<item.icon size={20} />
			<span class="btm-nav-label text-xs">{item.label}</span>
		</a>
	{/each}
</div>
