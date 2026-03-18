<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatDuration(seconds: number | null): string {
		if (!seconds) return '-';
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${String(s).padStart(2, '0')}`;
	}
</script>

<div class="list-page">
	<header>
		<h1>Music</h1>
		<nav><a href="/">Home</a></nav>
	</header>

	{#if data.tags.length > 0}
		<div class="filters">
			<a href="/music" class:active={!data.currentTag}>All</a>
			{#each data.tags as tag}
				<a href="/music?tag={encodeURIComponent(tag.name)}" class:active={data.currentTag === tag.name}>
					{tag.name}
				</a>
			{/each}
		</div>
	{/if}

	{#if data.items.length === 0}
		<p class="empty">No music found</p>
	{:else}
		<ul class="item-list">
			{#each data.items as item}
				<li>
					<a href="/play/{item.id}" class="item-link">
						<div class="music-icon">&#9835;</div>
						<div class="item-info">
							<span class="item-title">{item.title}</span>
							<span class="item-meta">
								{formatDuration(item.duration)}
								{#if item.tags?.length > 0}
									 — {item.tags.map((t: any) => t.name).join(', ')}
								{/if}
							</span>
						</div>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.list-page {
		max-width: 960px;
		margin: 0 auto;
		padding: 1rem;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	header a {
		color: #4a9eff;
	}

	.filters {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-bottom: 1rem;
	}

	.filters a {
		padding: 0.3rem 0.75rem;
		background: #222;
		color: #aaa;
		text-decoration: none;
		border-radius: 100px;
		font-size: 0.8rem;
	}

	.filters a.active {
		background: #4a9eff;
		color: #fff;
	}

	.empty {
		color: #666;
		text-align: center;
		padding: 3rem;
	}

	.item-list {
		list-style: none;
		padding: 0;
	}

	.item-list li {
		border-bottom: 1px solid #1a1a1a;
	}

	.item-link {
		display: flex;
		gap: 0.75rem;
		padding: 0.6rem 0;
		text-decoration: none;
		align-items: center;
	}

	.music-icon {
		width: 40px;
		height: 40px;
		border-radius: 8px;
		background: #2a2a3a;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.2rem;
		color: #888;
		flex-shrink: 0;
	}

	.item-info {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.item-title {
		color: #fff;
		font-size: 0.9rem;
	}

	.item-link:hover .item-title {
		color: #4a9eff;
	}

	.item-meta {
		color: #888;
		font-size: 0.75rem;
	}
</style>
