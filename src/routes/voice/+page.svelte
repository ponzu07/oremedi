<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type GroupBy = 'none' | 'speaker' | 'tag';
	let groupBy = $state<GroupBy>('none');

	function getGroups(items: any[], groupBy: GroupBy): Map<string, any[]> {
		if (groupBy === 'none') {
			return new Map([['All', items]]);
		}

		const groups = new Map<string, any[]>();
		for (const item of items) {
			let key: string;
			if (groupBy === 'speaker') {
				const speakerTags = item.tags?.filter((t: any) => t.category === 'speaker') ?? [];
				key = speakerTags.map((t: any) => t.name).join(', ') || 'Unknown';
			} else {
				const customTags = item.tags?.filter((t: any) => t.category === 'custom') ?? [];
				key = customTags.map((t: any) => t.name).join(', ') || 'Untagged';
			}

			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(item);
		}
		return new Map([...groups.entries()].sort());
	}

	let groups = $derived(getGroups(data.items, groupBy));

	function formatDuration(seconds: number | null): string {
		if (!seconds) return '-';
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${String(s).padStart(2, '0')}`;
	}
</script>

<div class="list-page">
	<header>
		<h1>Voice</h1>
		<nav><a href="/">Home</a></nav>
	</header>

	<div class="controls">
		{#if data.tags.length > 0}
			<div class="filters">
				<a href="/voice" class:active={!data.currentTag}>All</a>
				{#each data.tags as tag}
					<a href="/voice?tag={encodeURIComponent(tag.name)}" class:active={data.currentTag === tag.name}>
						{tag.name}
					</a>
				{/each}
			</div>
		{/if}

		<div class="group-toggle">
			<span>Group by:</span>
			<button class:active={groupBy === 'none'} onclick={() => (groupBy = 'none')}>None</button>
			<button class:active={groupBy === 'speaker'} onclick={() => (groupBy = 'speaker')}>Speaker</button>
			<button class:active={groupBy === 'tag'} onclick={() => (groupBy = 'tag')}>Tag</button>
		</div>
	</div>

	{#if data.items.length === 0}
		<p class="empty">No voice content found</p>
	{:else}
		{#each [...groups] as [groupName, items]}
			{#if groupBy !== 'none'}
				<h3 class="group-title">{groupName}</h3>
			{/if}
			<ul class="item-list">
				{#each items as item}
					<li>
						<a href="/play/{item.id}" class="item-link">
							<div class="speaker-icon">
								{(item.tags?.find((t: any) => t.category === 'speaker')?.name ?? '?')[0].toUpperCase()}
							</div>
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
		gap: 0.75rem;
		padding: 0.6rem 0;
		text-decoration: none;
		align-items: center;
	}

	.speaker-icon {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: #2a2a3a;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1rem;
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
