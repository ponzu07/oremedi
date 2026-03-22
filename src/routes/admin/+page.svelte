<script lang="ts">
	import type { PageData } from './$types';
	import { toast } from '$lib/stores/toast.svelte';
	import { categoryLabels } from '$lib/constants';
	import { logout } from '$lib/utils';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { RefreshCw, Plus, X, Pencil, Trash2, RotateCcw, LogOut } from 'lucide-svelte';

	let { data }: { data: PageData } = $props();

	let scanResult = $state<{ added: number; skipped: number; total: number } | null>(null);
	let scanning = $state(false);
	let showAddForm = $state(false);
	let editingId = $state<number | null>(null);

	let newTitle = $state('');
	let newCategory = $state('movie');
	let newPath = $state('');

	let editTitle = $state('');
	let editCategory = $state('');

	let filterCategory = $state<string>('all');
	let searchQuery = $state('');

	let filteredMedia = $derived.by(() => {
		let items = data.media;
		if (filterCategory !== 'all') {
			items = items.filter((m) => m.category === filterCategory);
		}
		if (searchQuery.trim()) {
			const q = searchQuery.trim().toLowerCase();
			items = items.filter((m) => m.title.toLowerCase().includes(q));
		}
		return items;
	});

	async function scan() {
		scanning = true;
		scanResult = null;
		const res = await fetch('/api/scan', { method: 'POST' });
		scanResult = await res.json();
		scanning = false;
		if (scanResult && scanResult.added > 0) {
			toast.show(`${scanResult.added}件追加しました`);
			location.reload();
		}
	}

	async function addMedia() {
		const res = await fetch('/api/media', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				title: newTitle,
				category: newCategory,
				original_path: newPath
			})
		});
		if (res.ok) {
			showAddForm = false;
			newTitle = '';
			newCategory = 'movie';
			newPath = '';
			toast.show('メディアを追加しました');
			location.reload();
		}
	}

	function startEdit(item: any) {
		editingId = item.id;
		editTitle = item.title;
		editCategory = item.category;
	}

	async function saveEdit(id: number) {
		await fetch(`/api/media/${id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				title: editTitle,
				category: editCategory
			})
		});
		editingId = null;
		toast.show('保存しました');
		location.reload();
	}

	async function deleteMedia(id: number, title: string) {
		if (!confirm(`「${title}」を削除しますか？`)) return;
		await fetch(`/api/media/${id}`, { method: 'DELETE' });
		toast.show('削除しました');
		location.reload();
	}

	async function retranscode(id: number) {
		const res = await fetch(`/api/media/${id}/retranscode`, { method: 'POST' });
		if (res.ok) {
			toast.show('再変換キューに追加しました');
			location.reload();
		}
	}


	const statusLabels: Record<string, string> = {
		pending: '待機中',
		processing: '変換中',
		ready: '変換済',
		failed: '失敗',
		skipped: '変換不要'
	};
</script>

<div class="max-w-[960px] mx-auto p-4 pb-20">
	<PageHeader title="管理" backHref="/" showSettings={false} />

	<p class="text-xs text-base-content/50 font-mono mb-2">{data.mediaPath}</p>

	<button class="btn btn-primary w-full mb-4" onclick={scan} disabled={scanning}>
		<RefreshCw size={20} class={scanning ? 'animate-spin' : ''} />
		{scanning ? 'スキャン中...' : 'フォルダスキャン'}
	</button>

	{#if scanResult}
		<div class="alert alert-success mb-4">
			スキャン完了: {scanResult.added}件追加 / {scanResult.skipped}件スキップ / {scanResult.total}件検出
		</div>
	{/if}

	{#if data.transcodeQueue.length > 0}
		<section class="mb-4">
			<h2 class="text-sm text-base-content/70 mb-2">変換キュー</h2>
			{#each data.transcodeQueue as item}
				<div class="alert alert-info mb-1 py-2">
					<span class="text-sm truncate">{item.title}</span>
					<span class="text-xs" class:text-primary={item.transcode_status === 'processing'}>
						{statusLabels[item.transcode_status] ?? item.transcode_status}
					</span>
				</div>
			{/each}
		</section>
	{/if}

	<div class="flex gap-2 mb-3">
		<input
			class="input flex-1"
			type="search"
			placeholder="検索..."
			bind:value={searchQuery}
		/>
		<button class="btn btn-ghost btn-square" onclick={() => (showAddForm = !showAddForm)} aria-label="Add media">
			{#if showAddForm}
				<X size={22} />
			{:else}
				<Plus size={22} />
			{/if}
		</button>
	</div>

	{#if showAddForm}
		<form class="bg-base-200 rounded-box p-4 mb-4 flex flex-col gap-2" onsubmit={(e) => { e.preventDefault(); addMedia(); }}>
			<input class="input w-full" bind:value={newTitle} placeholder="タイトル" required />
			<select class="select w-full" bind:value={newCategory}>
				<option value="movie">Movie</option>
				<option value="live_video">Live Video</option>
				<option value="voice">Voice</option>
				<option value="music">Music</option>
			</select>
			<input class="input w-full" bind:value={newPath} placeholder="NASファイルパス" required />
			<button class="btn btn-primary" type="submit">追加</button>
		</form>
	{/if}

	<div class="flex gap-2 mb-3 overflow-x-auto">
		{#each [['all','All'],['movie','Movie'],['live_video','Live'],['voice','Voice'],['music','Music']] as [val, label]}
			<button
				class="badge badge-lg cursor-pointer select-none min-h-[36px] {filterCategory === val ? 'badge-primary' : 'badge-ghost'}"
				onclick={() => (filterCategory = val)}
			>
				{label}
			</button>
		{/each}
	</div>

	<p class="text-xs text-base-content/50 mb-2">{filteredMedia.length}件</p>

	<ul class="list-none p-0">
		{#each filteredMedia as item (item.id)}
			<li class="border-b border-base-300">
				{#if editingId === item.id}
					<div class="bg-base-200 rounded-box p-4 my-2 flex flex-col gap-2">
						<label class="flex flex-col gap-1">
							<span class="text-xs text-base-content/50">タイトル</span>
							<input class="input w-full" bind:value={editTitle} />
						</label>
						<label class="flex flex-col gap-1">
							<span class="text-xs text-base-content/50">カテゴリ</span>
							<select class="select w-full" bind:value={editCategory}>
								<option value="movie">Movie</option>
								<option value="live_video">Live Video</option>
								<option value="voice">Voice</option>
								<option value="music">Music</option>
							</select>
						</label>
						<div class="flex gap-2 justify-end">
							<button class="btn btn-ghost btn-sm" onclick={() => (editingId = null)}>キャンセル</button>
							<button class="btn btn-primary btn-sm" onclick={() => saveEdit(item.id)}>保存</button>
						</div>
					</div>
				{:else}
					<div class="flex items-center gap-3 py-2">
						{#if item.thumbnail_path}
							<img src={`/api/media/${item.id}/thumbnail`} alt="" class="w-11 h-11 rounded-lg object-cover flex-shrink-0" />
						{:else}
							<div class="w-11 h-11 rounded-lg bg-base-300 flex items-center justify-center text-base-content/50 flex-shrink-0">
								{#if item.category === 'music'}&#9835;{:else if item.category === 'voice'}&#127897;{:else}&#9654;{/if}
							</div>
						{/if}
						<div class="flex-1 min-w-0 flex flex-col gap-0.5">
							<span class="text-sm truncate">{item.title}</span>
							<div class="flex gap-2 items-center text-xs">
								<span class="text-base-content/50">{categoryLabels[item.category] ?? item.category}</span>
								<span class="{item.transcode_status === 'ready' ? 'text-success' : item.transcode_status === 'failed' ? 'text-error' : item.transcode_status === 'pending' || item.transcode_status === 'processing' ? 'text-primary' : 'text-base-content/50'}">
									{statusLabels[item.transcode_status] ?? item.transcode_status}
								</span>
							</div>
						</div>
						<div class="flex gap-1 flex-shrink-0">
							{#if item.transcode_status === 'failed'}
								<button class="btn btn-ghost btn-sm btn-circle text-primary" onclick={() => retranscode(item.id)} title="再変換">
									<RotateCcw size={18} />
								</button>
							{/if}
							<button class="btn btn-ghost btn-sm btn-circle" onclick={() => startEdit(item)}>
								<Pencil size={18} />
							</button>
							<button class="btn btn-ghost btn-sm btn-circle hover:text-error" onclick={() => deleteMedia(item.id, item.title)}>
								<Trash2 size={18} />
							</button>
						</div>
					</div>
				{/if}
			</li>
		{/each}
	</ul>

	<div class="divider mt-8"></div>
	<button class="btn btn-error btn-outline w-full" onclick={logout}>
		<LogOut size={18} />
		Logout
	</button>
</div>
