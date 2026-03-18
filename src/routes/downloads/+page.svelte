<script lang="ts">
	import { onMount } from 'svelte';
	import {
		listDownloads,
		removeDownload,
		getStorageEstimate,
		requestPersistentStorage,
		formatSize,
		type DownloadStatus
	} from '$lib/download-manager';

	let downloads = $state<
		{ id: number; title: string; category: string; status: DownloadStatus; size: number; downloadedAt: string }[]
	>([]);
	let storage = $state({ usage: 0, quota: 0 });
	let persistent = $state(false);

	onMount(async () => {
		downloads = await listDownloads();
		storage = await getStorageEstimate();
		persistent = await requestPersistentStorage();
	});

	async function handleRemove(id: number) {
		if (!confirm('Remove this download?')) return;
		await removeDownload(id);
		downloads = await listDownloads();
		storage = await getStorageEstimate();
	}

	const statusLabels: Record<DownloadStatus, string> = {
		available: 'Not downloaded',
		downloading: 'Downloading...',
		downloaded: 'Downloaded',
		'needs-redownload': 'Needs re-download'
	};

	const categoryLabels: Record<string, string> = {
		movie: 'Movie',
		live_video: 'Live Video',
		voice: 'Voice',
		music: 'Music'
	};
</script>

<div class="downloads-page">
	<header>
		<h1>Downloads</h1>
		<nav><a href="/">Home</a></nav>
	</header>

	<div class="storage-info">
		<div class="storage-bar">
			<div class="storage-used" style="width: {storage.quota > 0 ? (storage.usage / storage.quota) * 100 : 0}%"></div>
		</div>
		<p>
			{formatSize(storage.usage)} / {formatSize(storage.quota)} used
			{#if persistent}
				<span class="persistent">(persistent)</span>
			{:else}
				<span class="not-persistent">(not persistent - may be cleared by browser)</span>
			{/if}
		</p>
	</div>

	{#if downloads.length === 0}
		<p class="empty">No downloads yet. Download media from the player page.</p>
	{:else}
		<ul class="download-list">
			{#each downloads as item}
				<li>
					<div class="item-info">
						<a href="/play/{item.id}" class="item-title">{item.title}</a>
						<span class="item-meta">
							{categoryLabels[item.category] ?? item.category} — {formatSize(item.size)}
						</span>
						<span class="status status-{item.status}">{statusLabels[item.status]}</span>
					</div>
					<button onclick={() => handleRemove(item.id)}>Remove</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.downloads-page {
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
		color: #4a9eff;
	}

	.storage-info {
		margin-bottom: 1.5rem;
	}

	.storage-bar {
		height: 8px;
		background: #222;
		border-radius: 4px;
		overflow: hidden;
		margin-bottom: 0.5rem;
	}

	.storage-used {
		height: 100%;
		background: #4a9eff;
		transition: width 0.3s;
	}

	.storage-info p {
		font-size: 0.875rem;
		color: #888;
		margin: 0;
	}

	.persistent {
		color: #4a4;
	}

	.not-persistent {
		color: #a44;
	}

	.empty {
		color: #666;
		text-align: center;
		padding: 3rem;
	}

	.download-list {
		list-style: none;
		padding: 0;
	}

	.download-list li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem;
		border-bottom: 1px solid #222;
	}

	.item-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.item-title {
		color: #fff;
		text-decoration: none;
		font-weight: 500;
	}

	.item-title:hover {
		color: #4a9eff;
	}

	.item-meta {
		font-size: 0.8rem;
		color: #888;
	}

	.status {
		font-size: 0.75rem;
	}

	.status-downloaded {
		color: #4a4;
	}

	.status-needs-redownload {
		color: #a44;
	}

	button {
		padding: 0.4rem 0.75rem;
		background: #333;
		color: #fff;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.8rem;
	}

	button:hover {
		background: #444;
	}
</style>
