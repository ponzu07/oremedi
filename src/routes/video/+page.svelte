<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { playerStore } from '$lib/stores/player.svelte';
	import { addToQueue } from '$lib/utils';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import FilterPills from '$lib/components/FilterPills.svelte';
	import GroupToggle from '$lib/components/GroupToggle.svelte';
	import MediaCard from '$lib/components/MediaCard.svelte';
	import { Plus } from 'lucide-svelte';

	let { data }: { data: PageData } = $props();

	type GroupBy = 'none' | 'artist' | 'event' | 'date';
	let groupBy = $state<GroupBy>('none');

	// Reset groupBy when sub-category changes
	let prevSub = data.currentSub;
	$effect(() => {
		if (data.currentSub !== prevSub) {
			prevSub = data.currentSub;
			groupBy = 'none';
		}
	});

	function getGroups(items: any[], by: GroupBy): Map<string, any[]> {
		if (by === 'none') {
			return new Map([['All', items]]);
		}

		const groups = new Map<string, any[]>();
		for (const item of items) {
			let key: string;
			if (by === 'artist') {
				const artistTags = item.tags?.filter((t: any) => t.category === 'artist') ?? [];
				key = artistTags.map((t: any) => t.name).join(', ') || 'Unknown';
			} else if (by === 'event') {
				key = item.meta?.event_name ?? 'Unknown Event';
			} else {
				key = item.meta?.date ?? item.created_at?.split('T')[0] ?? 'Unknown';
			}

			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(item);
		}
		return new Map([...groups.entries()].sort());
	}

	let liveGroups = $derived(getGroups(data.liveItems, groupBy));

	let showLive = $derived(!data.currentSub || data.currentSub === 'live');
	let showMovies = $derived(!data.currentSub || data.currentSub === 'movie');
	let totalCount = $derived(data.movies.length + data.liveItems.length);

	function playMovie(movie: any) {
		playerStore.play(movie.id, movie.title, movie.category, movie.thumbnail_path ?? null);
		goto(`/play/${movie.id}`);
	}

	function playLive(item: any) {
		playerStore.play(item.id, item.title, item.category, item.thumbnail_path ?? null);
		goto(`/play/${item.id}`);
	}
</script>

<div class="max-w-[960px] mx-auto p-4">
	<PageHeader title="Video" />

	<!-- Sub-category tabs -->
	<div role="tablist" class="tabs tabs-border mb-4">
		<a role="tab" class="tab" class:tab-active={!data.currentSub} href="/video">All</a>
		<a role="tab" class="tab" class:tab-active={data.currentSub === 'movie'} href="/video?sub=movie">Movies</a>
		<a role="tab" class="tab" class:tab-active={data.currentSub === 'live'} href="/video?sub=live">Live</a>
	</div>

	<!-- Genre filters (movie sub only) -->
	{#if showMovies && data.genres.length > 0 && data.currentSub === 'movie'}
		<FilterPills tags={data.genres.map(g => ({name: g}))} currentTag={data.currentGenre} baseHref="/video?sub=movie" />
	{/if}

	<!-- Tag filters (live sub only) -->
	{#if showLive && data.tags.length > 0 && data.currentSub === 'live'}
		<FilterPills tags={data.tags} currentTag={data.currentTag} baseHref="/video?sub=live" />
	{/if}

	<!-- Group-by toggle (live sub only) -->
	{#if data.currentSub === 'live'}
		<GroupToggle options={[
			{value: 'none', label: 'None'},
			{value: 'artist', label: 'Artist'},
			{value: 'event', label: 'Event'},
			{value: 'date', label: 'Date'}
		]} current={groupBy} onChange={(v) => groupBy = v as GroupBy} />
	{/if}

	{#if totalCount === 0}
		<p class="text-center text-base-content/50 py-12">No videos found</p>
	{:else}
		<!-- Movies section -->
		{#if showMovies && data.movies.length > 0}
			{#if !data.currentSub}
				<h3 class="text-base-content/70 text-lg mt-6 mb-3 pb-1 border-b border-base-300">Movies</h3>
			{/if}
			<div class="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
				{#each data.movies as movie}
					<MediaCard
						media={movie}
						onPlay={() => playMovie(movie)}
						onQueue={() => addToQueue(movie)}
						metaText={movie.genre_value ?? ''}
					/>
				{/each}
			</div>
		{/if}

		<!-- Live section -->
		{#if showLive && data.liveItems.length > 0}
			{#if !data.currentSub}
				<h3 class="text-base-content/70 text-lg mt-6 mb-3 pb-1 border-b border-base-300">Live</h3>
				<!-- All mode: show live in grid view -->
				<div class="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
					{#each data.liveItems as item}
						<MediaCard
							media={item}
							onPlay={() => playLive(item)}
							onQueue={() => addToQueue(item)}
							metaText={item.meta?.event_name ?? ''}
						/>
					{/each}
				</div>
			{:else}
				<!-- Live sub: show in list view with grouping -->
				{#each [...liveGroups] as [groupName, items]}
					{#if groupBy !== 'none'}
						<h3 class="text-base-content/70 text-lg mt-6 mb-3 pb-1 border-b border-base-300">{groupName}</h3>
					{/if}
					<ul class="list-none p-0">
						{#each items as item}
							<li class="flex items-center border-b border-base-300" class:bg-base-200={playerStore.state.mediaId === item.id} class:border-l-4={playerStore.state.mediaId === item.id} class:border-l-primary={playerStore.state.mediaId === item.id}>
								<button class="flex items-center gap-4 flex-1 min-w-0 py-3 px-1 text-left cursor-pointer bg-transparent border-none active:scale-[0.98] transition-transform" onclick={() => playLive(item)}>
									{#if item.thumbnail_path}
										<img src={`/api/media/${item.id}/thumbnail`} alt={item.title} class="w-[120px] h-[68px] object-cover rounded-lg bg-base-300 flex-shrink-0" />
									{:else}
										<div class="w-[120px] h-[68px] bg-base-300 rounded-lg flex-shrink-0"></div>
									{/if}
									<div class="flex flex-col gap-1">
										<span class="text-sm" class:text-primary={playerStore.state.mediaId === item.id}>{item.title}</span>
										{#if item.meta?.event_name}
											<span class="text-xs text-base-content/50">{item.meta.event_name}</span>
										{/if}
										{#if item.tags?.length > 0}
											<div class="flex gap-1 flex-wrap">
												{#each item.tags as tag}
													<span class="badge badge-outline badge-xs">{tag.name}</span>
												{/each}
											</div>
										{/if}
									</div>
								</button>
								<button class="btn btn-ghost btn-sm btn-circle flex-shrink-0" onclick={() => addToQueue(item)} aria-label="Add to queue">
									<Plus size={18} />
								</button>
							</li>
						{/each}
					</ul>
				{/each}
			{/if}
		{/if}
	{/if}
</div>
