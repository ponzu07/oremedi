<script lang="ts">
	import { Plus } from 'lucide-svelte';
	import { playerStore } from '$lib/stores/player.svelte';

	let {
		media,
		onPlay,
		onQueue,
		metaText = '',
	}: {
		media: { id: number; title: string; thumbnail_path?: string | null };
		onPlay: () => void;
		onQueue: () => void;
		metaText?: string;
	} = $props();

	let isPlaying = $derived(playerStore.state.mediaId === media.id);
</script>

<div class="relative">
	<button class="card bg-base-200 cursor-pointer text-left w-full" class:ring-2={isPlaying} class:ring-primary={isPlaying} onclick={onPlay}>
		<figure class="aspect-video rounded-t-box overflow-hidden bg-base-300">
			{#if media.thumbnail_path}
				<img src={`/api/media/${media.id}/thumbnail`} alt={media.title} class="w-full h-full object-cover" />
			{:else}
				<div class="w-full h-full flex items-center justify-center text-2xl text-base-content/30">&#9658;</div>
			{/if}
		</figure>
		<div class="p-2">
			<p class="text-sm truncate" class:text-primary={isPlaying}>{media.title}</p>
			{#if metaText}
				<p class="text-xs text-base-content/50">{metaText}</p>
			{/if}
		</div>
	</button>
	<button
		class="btn btn-circle btn-xs absolute top-1 right-1 bg-black/60 border-none text-white hover:bg-primary"
		onclick={(e) => { e.stopPropagation(); onQueue(); }}
		aria-label="Add to queue"
	>
		<Plus size={14} />
	</button>
</div>
