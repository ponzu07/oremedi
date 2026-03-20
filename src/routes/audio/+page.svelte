<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type GroupBy = 'none' | 'speaker' | 'tag';
	let groupBy = $state<GroupBy>('none');

	// Reset groupBy when sub-category changes
	let prevSub = $state(data.currentSub);
	$effect(() => {
		if (data.currentSub !== prevSub) {
			groupBy = 'none';
			prevSub = data.currentSub;
		}
	});

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

	let voiceGroups = $derived(getGroups(data.voiceItems, groupBy));

	function formatDuration(seconds: number | null): string {
		if (!seconds) return '-';
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${String(s).padStart(2, '0')}`;
	}

	function buildUrl(params: Record<string, string | null>): string {
		const sp = new URLSearchParams();
		for (const [k, v] of Object.entries(params)) {
			if (v) sp.set(k, v);
		}
		const qs = sp.toString();
		return qs ? `/audio?${qs}` : '/audio';
	}

	let showMusic = $derived(!data.currentSub || data.currentSub === 'music');
	let showVoice = $derived(!data.currentSub || data.currentSub === 'voice');
	let totalCount = $derived(data.musicItems.length + data.voiceItems.length);
</script>

<div class="list-page">
	<header>
		<h1>Audio</h1>
		<nav><a href="/">Home</a></nav>
	</header>

	<!-- Sub-category chips -->
	<div class="sub-chips">
		<a href="/audio" class:active={!data.currentSub}>All</a>
		<a href="/audio?sub=music" class:active={data.currentSub === 'music'}>Music</a>
		<a href="/audio?sub=voice" class:active={data.currentSub === 'voice'}>Voice</a>
	</div>

	<!-- Tag filters (music sub) -->
	{#if data.currentSub === 'music' && data.musicTags.length > 0}
		<div class="filters">
			<a href={buildUrl({ sub: 'music' })} class:active={!data.currentTag}>All</a>
			{#each data.musicTags as tag}
				<a
					href={buildUrl({ sub: 'music', tag: tag.name })}
					class:active={data.currentTag === tag.name}
				>
					{tag.name}
				</a>
			{/each}
		</div>
	{/if}

	<!-- Tag filters (voice sub) -->
	{#if data.currentSub === 'voice' && data.voiceTags.length > 0}
		<div class="filters">
			<a href={buildUrl({ sub: 'voice' })} class:active={!data.currentTag}>All</a>
			{#each data.voiceTags as tag}
				<a
					href={buildUrl({ sub: 'voice', tag: tag.name })}
					class:active={data.currentTag === tag.name}
				>
					{tag.name}
				</a>
			{/each}
		</div>
	{/if}

	<!-- Group-by toggle (voice sub only) -->
	{#if data.currentSub === 'voice'}
		<div class="group-toggle">
			<span>Group by:</span>
			<button class:active={groupBy === 'none'} onclick={() => (groupBy = 'none')}>None</button>
			<button class:active={groupBy === 'speaker'} onclick={() => (groupBy = 'speaker')}>Speaker</button>
			<button class:active={groupBy === 'tag'} onclick={() => (groupBy = 'tag')}>Tag</button>
		</div>
	{/if}

	{#if totalCount === 0}
		<p class="empty">No audio found</p>
	{:else}
		<!-- Music section -->
		{#if showMusic && data.musicItems.length > 0}
			{#if !data.currentSub}
				<h3 class="section-title">Music</h3>
			{/if}
			<ul class="item-list">
				{#each data.musicItems as item}
					<li>
						<a href="/play/{item.id}" class="item-link">
							{#if item.thumbnail_path}
								<img src={`/api/media/${item.id}/thumbnail`} alt={item.title} class="thumb music-thumb" />
							{:else}
								<div class="music-icon">&#9835;</div>
							{/if}
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
		{/if}

		<!-- Voice section -->
		{#if showVoice && data.voiceItems.length > 0}
			{#if !data.currentSub}
				<h3 class="section-title">Voice</h3>
			{/if}
			{#each [...voiceGroups] as [groupName, items]}
				{#if groupBy !== 'none'}
					<h3 class="group-title">{groupName}</h3>
				{/if}
				<ul class="item-list">
					{#each items as item}
						<li>
							<a href="/play/{item.id}" class="item-link">
								{#if item.thumbnail_path}
									<img src={`/api/media/${item.id}/thumbnail`} alt={item.title} class="thumb voice-thumb" />
								{:else}
									<div class="speaker-icon">
										{(item.tags?.find((t: any) => t.category === 'speaker')?.name ?? '?')[0].toUpperCase()}
									</div>
								{/if}
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
		color: var(--color-accent);
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

	/* Filters (tag) */
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

	/* Group titles for voice grouping */
	.group-title {
		color: var(--color-text-muted);
		font-size: 1rem;
		margin: 1.5rem 0 0.5rem;
		border-bottom: 1px solid var(--color-border);
		padding-bottom: 0.25rem;
	}

	/* List view */
	.item-list {
		list-style: none;
		padding: 0;
	}

	.item-list li {
		border-bottom: 1px solid var(--color-surface-alt);
	}

	.item-link {
		display: flex;
		gap: 0.75rem;
		padding: 0.6rem 0;
		text-decoration: none;
		align-items: center;
		transition: transform 0.1s ease;
	}

	.item-link:active {
		transform: scale(0.98);
	}

	/* Thumbnails - 48x48 Spotify-style */
	.thumb {
		width: 48px;
		height: 48px;
		object-fit: cover;
		flex-shrink: 0;
	}

	.music-thumb {
		border-radius: var(--radius-sm);
	}

	.voice-thumb {
		border-radius: 50%;
	}

	/* Music placeholder: rounded square with note icon */
	.music-icon {
		width: 48px;
		height: 48px;
		border-radius: var(--radius-sm);
		background: var(--color-surface-alt);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.2rem;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	/* Voice placeholder: circle with first letter of speaker */
	.speaker-icon {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--color-surface-alt);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1rem;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.item-info {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}

	.item-title {
		color: var(--color-text);
		font-size: var(--font-size-base);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.item-link:hover .item-title {
		color: var(--color-accent);
	}

	.item-meta {
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
	}
</style>
