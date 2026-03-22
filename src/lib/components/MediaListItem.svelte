<script lang="ts">
	import { Plus } from 'lucide-svelte';
	import { playerStore } from '$lib/stores/player.svelte';

	let {
		media,
		onPlay,
		onQueue,
		metaText = '',
		thumbnailShape = 'square',
		placeholderText = '?',
	}: {
		media: { id: number; title: string; thumbnail_path?: string | null };
		onPlay: () => void;
		onQueue: () => void;
		metaText?: string;
		thumbnailShape?: 'square' | 'circle';
		placeholderText?: string;
	} = $props();

	let isPlaying = $derived(playerStore.state.mediaId === media.id);
	const thumbClass = thumbnailShape === 'circle' ? 'rounded-full' : 'rounded-lg';
</script>

<li class="flex items-center border-b border-base-300" class:bg-base-200={isPlaying} class:border-l-4={isPlaying} class:border-l-primary={isPlaying}>
	<button class="flex items-center gap-3 flex-1 min-w-0 py-2 px-1 text-left cursor-pointer bg-transparent border-none active:scale-[0.98] transition-transform" onclick={onPlay}>
		{#if media.thumbnail_path}
			<img src={`/api/media/${media.id}/thumbnail`} alt={media.title} class="w-12 h-12 object-cover flex-shrink-0 {thumbClass}" />
		{:else}
			<div class="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-base-300 text-base-content/50 {thumbClass}">
				{placeholderText}
			</div>
		{/if}
		<div class="flex flex-col gap-0.5 min-w-0">
			<span class="text-sm truncate" class:text-primary={isPlaying}>{media.title}</span>
			{#if metaText}
				<span class="text-xs text-base-content/50">{metaText}</span>
			{/if}
		</div>
	</button>
	<button
		class="btn btn-ghost btn-sm btn-circle flex-shrink-0"
		onclick={onQueue}
		aria-label="Add to queue"
	>
		<Plus size={18} />
	</button>
</li>
