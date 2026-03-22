<script lang="ts">
	import type { PageData } from './$types';
	import { playerStore } from '$lib/stores/player.svelte';
	import { addToQueue, buildQueueItem, formatDuration } from '$lib/utils';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import FilterPills from '$lib/components/FilterPills.svelte';
	import MediaListItem from '$lib/components/MediaListItem.svelte';

	let { data }: { data: PageData } = $props();

	function playMusic(index: number) {
		playerStore.playQueue(data.items.map(buildQueueItem), index);
	}
</script>

<div class="max-w-[960px] mx-auto p-4">
	<PageHeader title="Music" />

	<FilterPills tags={data.tags} currentTag={data.currentTag} baseHref="/music" />

	{#if data.items.length === 0}
		<p class="text-center text-base-content/50 py-12">No music found</p>
	{:else}
		<ul class="list-none p-0">
			{#each data.items as item, i}
				<MediaListItem
					media={item}
					onPlay={() => playMusic(i)}
					onQueue={() => addToQueue(item)}
					metaText="{formatDuration(item.duration)}{item.tags?.length > 0 ? ` — ${item.tags.map((t) => t.name).join(', ')}` : ''}"
					placeholderText="&#9835;"
				/>
			{/each}
		</ul>
	{/if}
</div>
