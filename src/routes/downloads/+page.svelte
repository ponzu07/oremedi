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
	import { categoryLabels } from '$lib/constants';
	import PageHeader from '$lib/components/PageHeader.svelte';

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
</script>

<div class="max-w-[960px] mx-auto p-4">
	<PageHeader title="Downloads" />

	<div class="mb-6">
		<progress
			class="progress progress-primary w-full"
			value={storage.quota > 0 ? (storage.usage / storage.quota) * 100 : 0}
			max="100"
		></progress>
		<p class="text-sm text-base-content/50 mt-1">
			{formatSize(storage.usage)} / {formatSize(storage.quota)} used
			{#if persistent}
				<span class="text-success">(persistent)</span>
			{:else}
				<span class="text-error">(not persistent - may be cleared by browser)</span>
			{/if}
		</p>
	</div>

	{#if downloads.length === 0}
		<p class="text-center text-base-content/50 py-12">No downloads yet. Download media from the player page.</p>
	{:else}
		<ul class="list-none p-0">
			{#each downloads as item}
				<li class="flex justify-between items-center py-3 border-b border-base-300">
					<div class="flex flex-col gap-1">
						<a href="/play/{item.id}" class="text-sm font-medium hover:text-primary">{item.title}</a>
						<span class="text-xs text-base-content/50">
							{categoryLabels[item.category] ?? item.category} — {formatSize(item.size)}
						</span>
						<span class="text-xs {item.status === 'downloaded' ? 'text-success' : item.status === 'needs-redownload' ? 'text-error' : 'text-base-content/50'}">
							{statusLabels[item.status]}
						</span>
					</div>
					<button class="btn btn-ghost btn-sm" onclick={() => handleRemove(item.id)}>Remove</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
