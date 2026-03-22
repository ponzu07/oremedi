<script lang="ts">
	import type { PageData } from './$types';
	import { playerStore } from '$lib/stores/player.svelte';
	import { addToQueue, buildQueueItem, formatDuration } from '$lib/utils';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import FilterPills from '$lib/components/FilterPills.svelte';
	import GroupToggle from '$lib/components/GroupToggle.svelte';
	import MediaListItem from '$lib/components/MediaListItem.svelte';

	let { data }: { data: PageData } = $props();

	type GroupBy = 'none' | 'speaker' | 'tag';
	let groupBy = $state<GroupBy>('none');

	function getGroups(items: any[], by: GroupBy): Map<string, any[]> {
		if (by === 'none') {
			return new Map([['All', items]]);
		}
		const groups = new Map<string, any[]>();
		for (const item of items) {
			let key: string;
			if (by === 'speaker') {
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
	const itemIndexMap = $derived(new Map(data.items.map((item, i) => [item, i])));

	function playVoice(index: number) {
		playerStore.playQueue(data.items.map(buildQueueItem), index);
	}

	const groupOptions = [
		{ value: 'none', label: 'None' },
		{ value: 'speaker', label: 'Speaker' },
		{ value: 'tag', label: 'Tag' }
	];
</script>

<div class="max-w-[960px] mx-auto p-4">
	<PageHeader title="Voice" />

	<FilterPills tags={data.tags} currentTag={data.currentTag} baseHref="/voice" />

	<GroupToggle options={groupOptions} current={groupBy} onChange={(v) => groupBy = v as GroupBy} />

	{#if data.items.length === 0}
		<p class="text-center text-base-content/50 py-12">No voice content found</p>
	{:else}
		{#each [...groups] as [groupName, items]}
			{#if groupBy !== 'none'}
				<h3 class="text-base-content/50 text-base mt-6 mb-2 pb-1 border-b border-base-300">{groupName}</h3>
			{/if}
			<ul class="list-none p-0">
				{#each items as item}
					<MediaListItem
						media={item}
						onPlay={() => playVoice(itemIndexMap.get(item)!)}
						onQueue={() => addToQueue(item)}
						metaText="{formatDuration(item.duration)}{item.tags?.length > 0 ? ` — ${(item.tags as { name: string; category: string }[]).map((t) => t.name).join(', ')}` : ''}"
						thumbnailShape="circle"
						placeholderText={(((item.tags as { name: string; category: string }[])?.find((t) => t.category === 'speaker')?.name ?? '?')[0]).toUpperCase()}
					/>
				{/each}
			</ul>
		{/each}
	{/if}
</div>
