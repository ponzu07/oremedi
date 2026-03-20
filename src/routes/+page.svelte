<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const categories = [
		{ key: 'movies', label: 'Movies', href: '/video?sub=movie', items: data.movies, type: 'video' as const },
		{ key: 'liveVideos', label: 'Live Videos', href: '/video?sub=live', items: data.liveVideos, type: 'video' as const },
		{ key: 'voices', label: 'Voice', href: '/audio?sub=voice', items: data.voices, type: 'audio' as const },
		{ key: 'music', label: 'Music', href: '/audio?sub=music', items: data.music, type: 'audio' as const }
	];

	const placeholderIcons: Record<string, string> = {
		movies: '\u25B6',
		liveVideos: '\uD83C\uDFA5',
		voices: '\uD83C\uDF99',
		music: '\u266B'
	};

	const placeholderGradients: Record<string, string> = {
		movies: 'linear-gradient(135deg, #1a1a2e, #16213e)',
		liveVideos: 'linear-gradient(135deg, #1a2e1a, #162e3e)',
		voices: 'linear-gradient(135deg, #2e1a2e, #3e1628)',
		music: 'linear-gradient(135deg, #2e2a1a, #3e2816)'
	};
</script>

<div class="home">
	<header>
		<h1>OreMedi</h1>
		<nav>
			<a href="/downloads">Downloads</a>
			<a href="/admin">Admin</a>
		</nav>
	</header>

	{#each categories as cat}
		<section class="category-section">
			<div class="category-header">
				<h2>{cat.label}</h2>
				<a href={cat.href}>View all</a>
			</div>
			{#if cat.items.length === 0}
				<p class="empty">No content yet</p>
			{:else}
				<ul class="preview-list">
					{#each cat.items as item}
						<li>
							<a href="/play/{item.id}" class="card" class:video={cat.type === 'video'} class:audio={cat.type === 'audio'}>
								{#if item.thumbnail_path}
									<img src={`/api/media/${item.id}/thumbnail`} alt={item.title} class="thumb" class:thumb-video={cat.type === 'video'} class:thumb-audio={cat.type === 'audio'} />
								{:else}
									<div class="thumb-placeholder" class:thumb-video={cat.type === 'video'} class:thumb-audio={cat.type === 'audio'} style="background: {placeholderGradients[cat.key]}">
										<span class="placeholder-icon">{placeholderIcons[cat.key]}</span>
									</div>
								{/if}
								<span class="item-title">{item.title}</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/each}
</div>

<style>
	.home {
		max-width: 960px;
		margin: 0 auto;
		padding: 1rem;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
	}

	header nav {
		display: flex;
		gap: 1rem;
	}

	header a {
		color: var(--color-accent);
	}

	.category-section {
		margin-bottom: 2rem;
	}

	.category-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 0.75rem;
	}

	.category-header h2 {
		margin: 0;
		font-size: var(--font-size-lg);
	}

	.category-header a {
		color: var(--color-accent);
		font-size: var(--font-size-base);
	}

	.empty {
		color: var(--color-text-muted);
		font-size: var(--font-size-base);
	}

	.preview-list {
		list-style: none;
		padding: 0;
		display: flex;
		gap: 1rem;
		overflow-x: auto;
	}

	.preview-list li {
		flex-shrink: 0;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		text-decoration: none;
		transition: transform 0.1s ease;
	}

	.card:active {
		transform: scale(0.97);
	}

	.card.video {
		width: 160px;
	}

	.card.audio {
		width: 120px;
	}

	/* Video thumbnails: 16:9 horizontal */
	.thumb-video {
		width: 160px;
		height: 90px;
		border-radius: var(--radius-md);
	}

	/* Audio thumbnails: 1:1 square */
	.thumb-audio {
		width: 120px;
		height: 120px;
		border-radius: var(--radius-md);
	}

	.thumb {
		object-fit: cover;
		background: var(--color-surface-alt);
	}

	.thumb-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.placeholder-icon {
		font-size: 1.5rem;
		color: var(--color-text-muted);
		opacity: 0.7;
	}

	.item-title {
		color: var(--color-text-secondary);
		font-size: var(--font-size-sm);
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card:hover .item-title {
		color: var(--color-text);
	}
</style>
