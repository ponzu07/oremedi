<script lang="ts">
	import { page } from '$app/state';

	let { mediaCategory }: { mediaCategory?: string } = $props();

	const navItems = [
		{ href: '/', label: 'Home', icon: 'home' },
		{ href: '/video', label: 'Video', icon: 'video' },
		{ href: '/audio', label: 'Audio', icon: 'audio' }
	];

	function isActive(href: string): boolean {
		const path = page.url.pathname;
		if (href === '/') return path === '/';

		if (path.startsWith('/play/') && mediaCategory) {
			if (href === '/video') return ['movie', 'live_video'].includes(mediaCategory);
			if (href === '/audio') return ['music', 'voice'].includes(mediaCategory);
		}

		return path.startsWith(href);
	}
</script>

<nav class="bottom-nav">
	{#each navItems as item}
		<a href={item.href} class:active={isActive(item.href)}>
			<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				{#if item.icon === 'home'}
					<path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
				{:else if item.icon === 'video'}
					<rect x="2" y="4" width="20" height="16" rx="2" />
					<polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" />
				{:else if item.icon === 'audio'}
					<path d="M9 18V5l12-2v13" />
					<circle cx="6" cy="18" r="3" />
					<circle cx="18" cy="16" r="3" />
				{/if}
			</svg>
			<span class="label">{item.label}</span>
		</a>
	{/each}
</nav>

<style>
	.bottom-nav {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		justify-content: space-around;
		background: rgba(17, 17, 17, 0.85);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-top: 1px solid var(--color-border);
		padding: 0.4rem 0;
		padding-bottom: calc(0.4rem + env(safe-area-inset-bottom, 0px));
		z-index: 100;
	}

	a {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
		text-decoration: none;
		color: var(--color-text-muted);
		font-size: 0.65rem;
		padding: 0.2rem 0.75rem;
		transition: color 0.15s;
	}

	a.active {
		color: var(--color-accent);
	}

	.label {
		font-size: 0.65rem;
	}
</style>
