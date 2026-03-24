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
	import { playerStore, isVideoCategory } from '$lib/stores/player.svelte';
	import { goto } from '$app/navigation';
	import { categoryLabels } from '$lib/constants';
	import PageHeader from '$lib/components/PageHeader.svelte';

	let downloads = $state<
		{ id: number; title: string; category: string; status: DownloadStatus; size: number; downloadedAt: string }[]
	>([]);
	let storage = $state({ usage: 0, quota: 0 });
	let persistent = $state(false);
	let isOffline = $state(!navigator.onLine);

	onMount(() => {
		listDownloads().then(d => downloads = d);
		getStorageEstimate().then(s => storage = s);
		requestPersistentStorage().then(p => persistent = p);

		const update = () => { isOffline = !navigator.onLine; };
		window.addEventListener('online', update);
		window.addEventListener('offline', update);
		return () => {
			window.removeEventListener('online', update);
			window.removeEventListener('offline', update);
		};
	});

	async function handleRemove(id: number) {
		if (!confirm('Remove this download?')) return;
		await removeDownload(id);
		downloads = await listDownloads();
		storage = await getStorageEstimate();
	}

	async function playOffline(item: { id: number; title: string; category: string }) {
		await playerStore.play(item.id, item.title, item.category, null);
		if (isVideoCategory(item.category)) {
			goto(`/play/${item.id}`);
		}
	}

	const statusLabels: Record<DownloadStatus, string> = {
		downloaded: 'Downloaded',
		'needs-redownload': 'Needs re-download'
	};
</script>

<div class="max-w-[960px] mx-auto p-4">
	<PageHeader title="Downloads" />

	{#if isOffline}
		<div class="bg-base-200 rounded-box px-3 py-2 mb-4 text-sm text-base-content/70">
			Offline mode
		</div>
	{/if}

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
					<div class="flex flex-col gap-1 flex-1 min-w-0">
						{#if isOffline}
							<button class="text-sm font-medium text-left hover:text-primary truncate" onclick={() => playOffline(item)}>
								{item.title}
							</button>
						{:else}
							<a href="/play/{item.id}" class="text-sm font-medium hover:text-primary truncate">{item.title}</a>
						{/if}
						<span class="text-xs text-base-content/50">
							{categoryLabels[item.category] ?? item.category} — {formatSize(item.size)}
						</span>
						<span class="text-xs {item.status === 'downloaded' ? 'text-success' : 'text-error'}">
							{statusLabels[item.status]}
						</span>
					</div>
					<div class="flex gap-1 ml-2 flex-shrink-0">
						{#if item.status === 'downloaded'}
							<button class="btn btn-ghost btn-sm" onclick={() => playOffline(item)} aria-label="Play">
								<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><polygon points="6,3 20,12 6,21" /></svg>
							</button>
						{/if}
						<button class="btn btn-ghost btn-sm" onclick={() => handleRemove(item.id)}>Remove</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>
