<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const categories = [
		{ key: 'movies', label: 'Movies', href: '/video?sub=movie', items: data.movies },
		{ key: 'liveVideos', label: 'Live Videos', href: '/video?sub=live', items: data.liveVideos },
		{ key: 'voices', label: 'Voice', href: '/audio?sub=voice', items: data.voices },
		{ key: 'music', label: 'Music', href: '/audio?sub=music', items: data.music }
	];
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
							<a href="/play/{item.id}">
								{#if item.thumbnail_path}
									<img src={`/api/media/${item.id}/thumbnail`} alt={item.title} class="thumb" />
								{:else}
									<div class="thumb-placeholder"></div>
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
		color: #4a9eff;
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
		font-size: 1.25rem;
	}

	.category-header a {
		color: #4a9eff;
		font-size: 0.875rem;
	}

	.empty {
		color: #666;
		font-size: 0.875rem;
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

	.preview-list a {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		text-decoration: none;
		width: 160px;
	}

	.thumb {
		width: 160px;
		height: 90px;
		object-fit: cover;
		border-radius: 6px;
		background: #1a1a1a;
	}

	.thumb-placeholder {
		width: 160px;
		height: 90px;
		background: #1a1a1a;
		border-radius: 6px;
	}

	.item-title {
		color: #ddd;
		font-size: 0.85rem;
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.preview-list a:hover .item-title {
		color: #fff;
	}
</style>
