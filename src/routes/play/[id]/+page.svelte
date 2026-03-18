<script lang="ts">
	import type { PageData } from './$types';
	import CastButton from '$lib/components/CastButton.svelte';

	let { data }: { data: PageData } = $props();
	const media = data.media;

	const isVideo = ['movie', 'live_video'].includes(media.category as string);
	const streamUrl = `/api/media/${media.id}/stream`;
	const downloadUrl = `/api/media/${media.id}/download`;

	const categoryLabels: Record<string, string> = {
		movie: 'Movie',
		live_video: 'Live Video',
		voice: 'Voice',
		music: 'Music'
	};
</script>

<div class="player-page">
	<nav>
		<a href="/">Home</a>
	</nav>

	<div class="player-container">
		{#if isVideo}
			<!-- svelte-ignore a11y_media_has_caption -->
			<video controls autoplay preload="metadata" src={streamUrl}>
				Your browser does not support the video tag.
			</video>
		{:else}
			<div class="audio-container">
				<div class="audio-art">
					{#if media.thumbnail_path}
						<img src={`/api/media/${media.id}/thumbnail`} alt={media.title} />
					{:else}
						<div class="placeholder-art">&#9835;</div>
					{/if}
				</div>
				<audio controls autoplay preload="metadata" src={streamUrl}>
					Your browser does not support the audio tag.
				</audio>
			</div>
		{/if}
	</div>

	<div class="media-info">
		<h1>{media.title}</h1>
		<span class="category">{categoryLabels[media.category as string] ?? media.category}</span>

		{#if media.tags && (media.tags as any[]).length > 0}
			<div class="tags">
				{#each media.tags as tag}
					<span class="tag">{tag.name}</span>
				{/each}
			</div>
		{/if}

		{#if media.metadata && (media.metadata as any[]).length > 0}
			<dl class="metadata">
				{#each media.metadata as meta}
					<dt>{meta.key}</dt>
					<dd>{meta.value}</dd>
				{/each}
			</dl>
		{/if}

		<div class="actions">
			<CastButton mediaId={media.id as number} title={media.title as string} {isVideo} />
			<a href={downloadUrl} class="btn" download>Download</a>
		</div>
	</div>
</div>

<style>
	.player-page {
		max-width: 960px;
		margin: 0 auto;
		padding: 1rem;
	}

	nav {
		margin-bottom: 1rem;
	}

	nav a {
		color: #4a9eff;
	}

	.player-container {
		margin-bottom: 1.5rem;
	}

	video {
		width: 100%;
		max-height: 70vh;
		background: #000;
		border-radius: 8px;
	}

	.audio-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.audio-art {
		width: 300px;
		height: 300px;
		border-radius: 8px;
		overflow: hidden;
		background: #1a1a1a;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.audio-art img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.placeholder-art {
		font-size: 5rem;
		color: #444;
	}

	audio {
		width: 100%;
		max-width: 500px;
	}

	.media-info h1 {
		margin: 0 0 0.5rem;
		font-size: 1.5rem;
	}

	.category {
		color: #888;
		font-size: 0.875rem;
	}

	.tags {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-top: 0.75rem;
	}

	.tag {
		padding: 0.25rem 0.75rem;
		background: #222;
		border-radius: 100px;
		font-size: 0.8rem;
		color: #aaa;
	}

	.metadata {
		margin-top: 1rem;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.25rem 1rem;
	}

	.metadata dt {
		color: #888;
		font-size: 0.875rem;
	}

	.metadata dd {
		margin: 0;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-top: 1.5rem;
	}

	.btn {
		display: inline-block;
		padding: 0.5rem 1.5rem;
		background: #333;
		color: #fff;
		text-decoration: none;
		border-radius: 4px;
	}

	.btn:hover {
		background: #444;
	}
</style>
