<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type GroupBy = 'none' | 'artist' | 'event' | 'date';
	let groupBy = $state<GroupBy>('none');

	function getGroups(items: any[], groupBy: GroupBy): Map<string, any[]> {
		if (groupBy === 'none') {
			return new Map([['All', items]]);
		}

		const groups = new Map<string, any[]>();
		for (const item of items) {
			let key: string;
			if (groupBy === 'artist') {
				const artistTags = item.tags?.filter((t: any) => t.category === 'artist') ?? [];
				key = artistTags.map((t: any) => t.name).join(', ') || 'Unknown';
			} else if (groupBy === 'event') {
				key = item.meta?.event_name ?? 'Unknown Event';
			} else {
				key = item.meta?.date ?? item.created_at?.split('T')[0] ?? 'Unknown';
			}

			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(item);
		}
		return new Map([...groups.entries()].sort());
	}

	let groups = $derived(getGroups(data.items, groupBy));
</script>

<div class="list-page">
	<header>
		<h1>Live Videos</h1>
		<nav><a href="/">Home</a></nav>
	</header>

	<div class="controls">
		{#if data.tags.length > 0}
			<div class="filters">
				<a href="/live" class:active={!data.currentTag}>All</a>
				{#each data.tags as tag}
					<a href="/live?tag={encodeURIComponent(tag.name)}" class:active={data.currentTag === tag.name}>
						{tag.name}
					</a>
				{/each}
			</div>
		{/if}

		<div class="group-toggle">
			<span>Group by:</span>
			<button class:active={groupBy === 'none'} onclick={() => (groupBy = 'none')}>None</button>
			<button class:active={groupBy === 'artist'} onclick={() => (groupBy = 'artist')}>Artist</button>
			<button class:active={groupBy === 'event'} onclick={() => (groupBy = 'event')}>Event</button>
			<button class:active={groupBy === 'date'} onclick={() => (groupBy = 'date')}>Date</button>
		</div>
	</div>

	{#if data.items.length === 0}
		<p class="empty">No live videos found</p>
	{:else}
		{#each [...groups] as [groupName, items]}
			{#if groupBy !== 'none'}
				<h3 class="group-title">{groupName}</h3>
			{/if}
			<ul class="item-list">
				{#each items as item}
					<li>
						<a href="/play/{item.id}" class="item-link">
							{#if item.thumbnail_path}
								<img src={`/api/media/${item.id}/thumbnail`} alt={item.title} class="thumb" />
							{:else}
								<div class="thumb-placeholder"></div>
							{/if}
							<div class="item-info">
								<span class="item-title">{item.title}</span>
								{#if item.meta?.event_name}
									<span class="item-meta">{item.meta.event_name}</span>
								{/if}
								{#if item.tags?.length > 0}
									<div class="item-tags">
										{#each item.tags as tag}
											<span class="tag">{tag.name}</span>
										{/each}
									</div>
								{/if}
							</div>
						</a>
					</li>
				{/each}
			</ul>
		{/each}
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

	.controls {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.filters {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
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

	.group-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		color: #888;
	}

	.group-toggle button {
		padding: 0.25rem 0.6rem;
		background: #222;
		color: #aaa;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.8rem;
	}

	.group-toggle button.active {
		background: #4a9eff;
		color: #fff;
	}

	.empty {
		color: #666;
		text-align: center;
		padding: 3rem;
	}

	.group-title {
		color: #888;
		font-size: 1rem;
		margin: 1.5rem 0 0.5rem;
		border-bottom: 1px solid #222;
		padding-bottom: 0.25rem;
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
		gap: 1rem;
		padding: 0.75rem 0;
		text-decoration: none;
		align-items: center;
	}

	.thumb {
		width: 120px;
		height: 68px;
		object-fit: cover;
		border-radius: 4px;
		background: #1a1a1a;
		flex-shrink: 0;
	}

	.thumb-placeholder {
		width: 120px;
		height: 68px;
		background: #1a1a1a;
		border-radius: 4px;
		flex-shrink: 0;
	}

	.item-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.item-title {
		color: #fff;
		font-size: 0.95rem;
	}

	.item-link:hover .item-title {
		color: #4a9eff;
	}

	.item-meta {
		color: #888;
		font-size: 0.8rem;
	}

	.item-tags {
		display: flex;
		gap: 0.3rem;
		flex-wrap: wrap;
	}

	.tag {
		padding: 0.15rem 0.5rem;
		background: #222;
		border-radius: 100px;
		font-size: 0.7rem;
		color: #aaa;
	}
</style>
