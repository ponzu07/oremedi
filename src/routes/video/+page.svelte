<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { playerStore } from '$lib/stores/player.svelte';
	import { addToQueue } from '$lib/utils';

	let { data }: { data: PageData } = $props();

	type GroupBy = 'none' | 'artist' | 'event' | 'date';
	let groupBy = $state<GroupBy>('none');

	// Reset groupBy when sub-category changes
	let prevSub = $state('');
	$effect(() => {
		const currentSub = data.currentSub;
		if (currentSub !== prevSub) {
			if (prevSub !== '') groupBy = 'none';
			prevSub = currentSub ?? '';
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

	function buildUrl(params: Record<string, string | null>): string {
		const sp = new URLSearchParams();
		for (const [k, v] of Object.entries(params)) {
			if (v) sp.set(k, v);
		}
		const qs = sp.toString();
		return qs ? `/video?${qs}` : '/video';
	}

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

<div class="list-page">
	<header>
		<h1>Video</h1>
	</header>

	<!-- Sub-category chips -->
	<div class="sub-chips">
		<a href="/video" class:active={!data.currentSub}>All</a>
		<a href="/video?sub=movie" class:active={data.currentSub === 'movie'}>Movies</a>
		<a href="/video?sub=live" class:active={data.currentSub === 'live'}>Live</a>
	</div>

	<!-- Genre filters (movie sub or all with movies) -->
	{#if showMovies && data.genres.length > 0 && data.currentSub === 'movie'}
		<div class="filters">
			<a href={buildUrl({ sub: 'movie' })} class:active={!data.currentGenre}>All</a>
			{#each data.genres as genre}
				<a
					href={buildUrl({ sub: 'movie', genre })}
					class:active={data.currentGenre === genre}
				>
					{genre}
				</a>
			{/each}
		</div>
	{/if}

	<!-- Tag filters (live sub only) -->
	{#if showLive && data.tags.length > 0 && data.currentSub === 'live'}
		<div class="filters">
			<a href={buildUrl({ sub: 'live' })} class:active={!data.currentTag}>All</a>
			{#each data.tags as tag}
				<a
					href={buildUrl({ sub: 'live', tag: tag.name })}
					class:active={data.currentTag === tag.name}
				>
					{tag.name}
				</a>
			{/each}
		</div>
	{/if}

	<!-- Group-by toggle (live sub only) -->
	{#if data.currentSub === 'live'}
		<div class="group-toggle">
			<span>Group by:</span>
			<button class:active={groupBy === 'none'} onclick={() => (groupBy = 'none')}>None</button>
			<button class:active={groupBy === 'artist'} onclick={() => (groupBy = 'artist')}>Artist</button>
			<button class:active={groupBy === 'event'} onclick={() => (groupBy = 'event')}>Event</button>
			<button class:active={groupBy === 'date'} onclick={() => (groupBy = 'date')}>Date</button>
		</div>
	{/if}

	{#if totalCount === 0}
		<p class="empty">No videos found</p>
	{:else}
		<!-- Movies section -->
		{#if showMovies && data.movies.length > 0}
			{#if !data.currentSub}
				<h3 class="section-title">Movies</h3>
			{/if}
			<div class="media-grid">
				{#each data.movies as movie, i}
					<div class="media-card-wrap" class:playing={playerStore.state.mediaId === movie.id}>
						<button class="media-card" onclick={() => playMovie(movie)}>
							<div class="thumb-wrap">
								{#if movie.thumbnail_path}
									<img src={`/api/media/${movie.id}/thumbnail`} alt={movie.title} />
								{:else}
									<div class="thumb-placeholder">&#9658;</div>
								{/if}
							</div>
							<div class="media-info">
								<span class="media-title">{movie.title}</span>
								<span class="media-meta">{movie.genre_value ?? '-'}</span>
							</div>
						</button>
						<button class="queue-add-btn" onclick={() => addToQueue(movie)} aria-label="Add to queue">+</button>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Live section -->
		{#if showLive && data.liveItems.length > 0}
			{#if !data.currentSub}
				<h3 class="section-title">Live</h3>
				<!-- All mode: show live in grid view -->
				<div class="media-grid">
					{#each data.liveItems as item}
						<div class="media-card-wrap" class:playing={playerStore.state.mediaId === item.id}>
							<button class="media-card" onclick={() => playLive(item)}>
								<div class="thumb-wrap">
									{#if item.thumbnail_path}
										<img src={`/api/media/${item.id}/thumbnail`} alt={item.title} />
									{:else}
										<div class="thumb-placeholder">&#9658;</div>
									{/if}
								</div>
								<div class="media-info">
									<span class="media-title">{item.title}</span>
									{#if item.meta?.event_name}
										<span class="media-meta">{item.meta.event_name}</span>
									{/if}
								</div>
							</button>
							<button class="queue-add-btn" onclick={() => addToQueue(item)} aria-label="Add to queue">+</button>
						</div>
					{/each}
				</div>
			{:else}
				<!-- Live sub: show in list view with grouping -->
				{#each [...liveGroups] as [groupName, items]}
					{#if groupBy !== 'none'}
						<h3 class="group-title">{groupName}</h3>
					{/if}
					<ul class="item-list">
						{#each items as item}
							<li class="item-row" class:playing={playerStore.state.mediaId === item.id}>
								<button class="item-link" onclick={() => playLive(item)}>
									{#if item.thumbnail_path}
										<img src={`/api/media/${item.id}/thumbnail`} alt={item.title} class="thumb" />
									{:else}
										<div class="thumb-placeholder-sm"></div>
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
								</button>
								<button class="queue-add-btn-list" onclick={() => addToQueue(item)} aria-label="Add to queue">
									<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
								</button>
							</li>
						{/each}
					</ul>
				{/each}
			{/if}
		{/if}
	{/if}
</div>

<style>
	.list-page {
		max-width: 960px;
		margin: 0 auto;
		padding: 1rem;
	}

	header {
		margin-bottom: 1.5rem;
	}

	/* Sub-category chips */
	.sub-chips {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.sub-chips a {
		padding: 0.4rem 1rem;
		background: var(--color-surface);
		color: var(--color-text-secondary);
		text-decoration: none;
		border-radius: var(--radius-pill);
		font-size: var(--font-size-sm);
		font-weight: 500;
	}

	.sub-chips a.active {
		background: var(--color-accent);
		color: var(--color-text);
	}

	/* Filters (genre / tag) */
	.filters {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}

	.filters a {
		padding: 0.3rem 0.75rem;
		background: var(--color-surface);
		color: var(--color-text-muted);
		text-decoration: none;
		border-radius: var(--radius-pill);
		font-size: var(--font-size-sm);
	}

	.filters a.active {
		background: var(--color-accent);
		color: var(--color-text);
	}

	/* Group-by toggle */
	.group-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		margin-bottom: 1rem;
	}

	.group-toggle button {
		padding: 0.25rem 0.6rem;
		background: var(--color-surface);
		color: var(--color-text-muted);
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: var(--font-size-sm);
	}

	.group-toggle button.active {
		background: var(--color-accent);
		color: var(--color-text);
	}

	.empty {
		color: var(--color-text-muted);
		text-align: center;
		padding: 3rem;
	}

	/* Section titles for "All" mode */
	.section-title {
		color: var(--color-text-secondary);
		font-size: var(--font-size-lg);
		margin: 1.5rem 0 0.75rem;
		padding-bottom: 0.25rem;
		border-bottom: 1px solid var(--color-border);
	}

	.section-title:first-of-type {
		margin-top: 0.5rem;
	}

	/* Grid view (movies, all-mode live) */
	.media-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 1rem;
	}

	.media-card-wrap {
		position: relative;
	}

	.media-card {
		text-decoration: none;
		color: inherit;
		transition: transform 0.1s ease;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		text-align: left;
		width: 100%;
	}

	.media-card:active {
		transform: scale(0.97);
	}

	.queue-add-btn {
		position: absolute;
		top: 4px;
		right: 4px;
		width: 28px;
		height: 28px;
		background: rgba(0, 0, 0, 0.6);
		color: white;
		border: none;
		border-radius: 50%;
		cursor: pointer;
		font-size: 1.1rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		z-index: 1;
	}

	.queue-add-btn:active {
		background: var(--color-accent);
	}

	.thumb-wrap {
		aspect-ratio: 16 / 9;
		border-radius: var(--radius-md);
		overflow: hidden;
		background: var(--color-surface-alt);
	}

	.thumb-wrap img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.thumb-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2rem;
		color: var(--color-text-muted);
	}

	.media-info {
		padding: 0.4rem 0;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.media-title {
		color: var(--color-text);
		font-size: 0.85rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.media-card:hover .media-title {
		color: var(--color-accent);
	}

	.media-meta {
		color: var(--color-text-muted);
		font-size: 0.75rem;
	}

	/* List view (live sub) */
	.group-title {
		color: var(--color-text-muted);
		font-size: 1rem;
		margin: 1.5rem 0 0.5rem;
		border-bottom: 1px solid var(--color-border);
		padding-bottom: 0.25rem;
	}

	.item-list {
		list-style: none;
		padding: 0;
	}

	.item-list li {
		border-bottom: 1px solid var(--color-surface-alt);
	}

	.item-row {
		display: flex;
		align-items: center;
	}

	.item-row.playing {
		background: var(--color-surface);
		border-left: 3px solid var(--color-accent);
	}

	.item-link {
		display: flex;
		gap: 1rem;
		padding: 0.75rem 0;
		text-decoration: none;
		align-items: center;
		transition: transform 0.1s ease;
		background: none;
		border: none;
		cursor: pointer;
		flex: 1;
		min-width: 0;
		color: inherit;
	}

	.item-link:active {
		transform: scale(0.98);
	}

	.queue-add-btn-list {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 8px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
	}

	.queue-add-btn-list:active {
		color: var(--color-accent);
	}

	.thumb {
		width: 120px;
		height: 68px;
		object-fit: cover;
		border-radius: var(--radius-sm);
		background: var(--color-surface-alt);
		flex-shrink: 0;
	}

	.thumb-placeholder-sm {
		width: 120px;
		height: 68px;
		background: var(--color-surface-alt);
		border-radius: var(--radius-sm);
		flex-shrink: 0;
	}

	.item-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.item-title {
		color: var(--color-text);
		font-size: 0.95rem;
	}

	.item-link:hover .item-title {
		color: var(--color-accent);
	}

	.item-meta {
		color: var(--color-text-muted);
		font-size: 0.8rem;
	}

	.item-tags {
		display: flex;
		gap: 0.3rem;
		flex-wrap: wrap;
	}

	.tag {
		padding: 0.15rem 0.5rem;
		background: var(--color-surface);
		border-radius: var(--radius-pill);
		font-size: 0.7rem;
		color: var(--color-text-muted);
	}

	.playing .media-title,
	.playing .item-title {
		color: var(--color-accent);
	}
</style>
