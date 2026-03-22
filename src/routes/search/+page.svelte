<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { playerStore } from '$lib/stores/player.svelte';
	import { addToQueue, buildQueueItem, formatDuration } from '$lib/utils';
	import { categoryLabels } from '$lib/constants';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import MediaListItem from '$lib/components/MediaListItem.svelte';
	import { Search } from 'lucide-svelte';

	let { data }: { data: PageData } = $props();

	let searchInput = $state(data.query);

	function doSearch() {
		const q = searchInput.trim();
		if (q) {
			goto(`/search?q=${encodeURIComponent(q)}`, { invalidateAll: true });
		}
	}

	function playMedia(index: number) {
		playerStore.playQueue(data.results.map(buildQueueItem), index);
	}
</script>

<div class="max-w-[960px] mx-auto p-4">
	<PageHeader title="Search" />

	<form class="flex gap-2 mb-4" onsubmit={(e) => { e.preventDefault(); doSearch(); }}>
		<input
			class="input flex-1"
			type="search"
			placeholder="タイトル・タグで検索..."
			bind:value={searchInput}
			autofocus
		/>
		<button class="btn btn-primary btn-square" type="submit">
			<Search size={20} />
		</button>
	</form>

	{#if data.query && data.results.length === 0}
		<p class="text-center text-base-content/50 py-12">「{data.query}」に一致するメディアが見つかりません</p>
	{:else if data.results.length > 0}
		<p class="text-xs text-base-content/50 mb-2">{data.results.length}件の結果</p>
		<ul class="list-none p-0">
			{#each data.results as item, i}
				<MediaListItem
					media={item}
					onPlay={() => playMedia(i)}
					onQueue={() => addToQueue(item)}
					metaText="{categoryLabels[item.category] ?? item.category} — {formatDuration(item.duration)}{item.tags?.length > 0 ? ` — ${item.tags.map((t: { name: string }) => t.name).join(', ')}` : ''}"
				/>
			{/each}
		</ul>
	{:else if !data.query}
		<p class="text-center text-base-content/50 py-12">検索ワードを入力してください</p>
	{/if}
</div>
