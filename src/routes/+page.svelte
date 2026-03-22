<script lang="ts">
	import type { PageData } from './$types';
	import PageHeader from '$lib/components/PageHeader.svelte';

	let { data }: { data: PageData } = $props();

	const categories = $derived([
		{ key: 'movies', label: 'Movies', href: '/video?sub=movie', items: data.movies, type: 'video' as const },
		{ key: 'liveVideos', label: 'Live Videos', href: '/video?sub=live', items: data.liveVideos, type: 'video' as const },
		{ key: 'music', label: 'Music', href: '/music', items: data.music, type: 'audio' as const },
		{ key: 'voices', label: 'Voice', href: '/voice', items: data.voices, type: 'audio' as const }
	]);

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

<div class="max-w-[960px] mx-auto p-4">
	<PageHeader title="OreMedi" />

	{#each categories as cat}
		<section class="mb-8">
			<div class="flex justify-between items-baseline mb-3">
				<h2 class="text-lg font-bold">{cat.label}</h2>
				<a href={cat.href} class="text-sm text-primary">View all</a>
			</div>
			{#if cat.items.length === 0}
				<p class="text-base-content/50 text-sm">No content yet</p>
			{:else}
				<div class="flex gap-4 overflow-x-auto pb-2">
					{#each cat.items as item}
						<a
							href="/play/{item.id}"
							class="flex-shrink-0 flex flex-col gap-2 active:scale-[0.97] transition-transform"
							class:w-40={cat.type === 'video'}
							class:w-[120px]={cat.type === 'audio'}
						>
							{#if item.thumbnail_path}
								<img
									src={`/api/media/${item.id}/thumbnail`}
									alt={item.title}
									class="object-cover bg-base-300 rounded-lg"
									class:w-40={cat.type === 'video'}
									class:h-[90px]={cat.type === 'video'}
									class:w-[120px]={cat.type === 'audio'}
									class:h-[120px]={cat.type === 'audio'}
								/>
							{:else}
								<div
									class="flex items-center justify-center rounded-lg"
									class:w-40={cat.type === 'video'}
									class:h-[90px]={cat.type === 'video'}
									class:w-[120px]={cat.type === 'audio'}
									class:h-[120px]={cat.type === 'audio'}
									style="background: {placeholderGradients[cat.key]}"
								>
									<span class="text-2xl text-base-content/30">{placeholderIcons[cat.key]}</span>
								</div>
							{/if}
							<span class="text-xs text-base-content/70 truncate hover:text-base-content">{item.title}</span>
						</a>
					{/each}
				</div>
			{/if}
		</section>
	{/each}
</div>
