<script lang="ts">
	import type { PageData } from './$types';
	import { toast } from '$lib/stores/toast.svelte';
	import { categoryLabels } from '$lib/constants';

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

	let filteredMedia = $derived(() => {
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

<div class="admin">
	<header>
		<h1>管理</h1>
	</header>

	<div class="media-path-label">{data.mediaPath}</div>

	<!-- Scan button -->
	<button class="scan-btn" onclick={scan} disabled={scanning}>
		<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M21.5 2v6h-6" /><path d="M2.5 22v-6h6" />
			<path d="M2.5 11.5a10 10 0 0 1 17.96-4.5" /><path d="M21.5 12.5a10 10 0 0 1-17.96 4.5" />
		</svg>
		{scanning ? 'スキャン中...' : 'フォルダスキャン'}
	</button>

	{#if scanResult}
		<div class="scan-result">
			スキャン完了: {scanResult.added}件追加 / {scanResult.skipped}件スキップ / {scanResult.total}件検出
		</div>
	{/if}

	<!-- Transcode queue -->
	{#if data.transcodeQueue.length > 0}
		<section class="tc-section">
			<h2 class="section-title">変換キュー</h2>
			{#each data.transcodeQueue as item}
				<div class="tc-item">
					<span class="tc-title">{item.title}</span>
					<span class="tc-status" class:processing={item.transcode_status === 'processing'}>
						{statusLabels[item.transcode_status] ?? item.transcode_status}
					</span>
				</div>
			{/each}
		</section>
	{/if}

	<!-- Search + Filter -->
	<div class="toolbar">
		<input
			class="search-input"
			type="search"
			placeholder="検索..."
			bind:value={searchQuery}
		/>
		<button class="add-btn" onclick={() => (showAddForm = !showAddForm)} aria-label="Add media">
			<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
				{#if showAddForm}
					<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
				{:else}
					<line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
				{/if}
			</svg>
		</button>
	</div>

	{#if showAddForm}
		<form class="add-form" onsubmit={(e) => { e.preventDefault(); addMedia(); }}>
			<input bind:value={newTitle} placeholder="タイトル" required />
			<select bind:value={newCategory}>
				<option value="movie">Movie</option>
				<option value="live_video">Live Video</option>
				<option value="voice">Voice</option>
				<option value="music">Music</option>
			</select>
			<input bind:value={newPath} placeholder="NASファイルパス" required />
			<button type="submit">追加</button>
		</form>
	{/if}

	<div class="filter-chips">
		<button class:active={filterCategory === 'all'} onclick={() => (filterCategory = 'all')}>All</button>
		<button class:active={filterCategory === 'movie'} onclick={() => (filterCategory = 'movie')}>Movie</button>
		<button class:active={filterCategory === 'live_video'} onclick={() => (filterCategory = 'live_video')}>Live</button>
		<button class:active={filterCategory === 'voice'} onclick={() => (filterCategory = 'voice')}>Voice</button>
		<button class:active={filterCategory === 'music'} onclick={() => (filterCategory = 'music')}>Music</button>
	</div>

	<!-- Media list -->
	<div class="media-count">{filteredMedia().length}件</div>

	<ul class="media-list">
		{#each filteredMedia() as item (item.id)}
			<li class="media-item">
				{#if editingId === item.id}
					<!-- Edit mode -->
					<div class="edit-card">
						<label>
							<span class="edit-label">タイトル</span>
							<input class="edit-input" bind:value={editTitle} />
						</label>
						<label>
							<span class="edit-label">カテゴリ</span>
							<select class="edit-select" bind:value={editCategory}>
								<option value="movie">Movie</option>
								<option value="live_video">Live Video</option>
								<option value="voice">Voice</option>
								<option value="music">Music</option>
							</select>
						</label>
						<div class="edit-actions">
							<button class="btn-cancel" onclick={() => (editingId = null)}>キャンセル</button>
							<button class="btn-save" onclick={() => saveEdit(item.id)}>保存</button>
						</div>
					</div>
				{:else}
					<!-- Normal mode -->
					<div class="media-row">
						{#if item.thumbnail_path}
							<img src={`/api/media/${item.id}/thumbnail`} alt="" class="media-thumb" />
						{:else}
							<div class="media-thumb-placeholder">
								{#if item.category === 'music'}&#9835;{:else if item.category === 'voice'}&#127897;{:else}&#9654;{/if}
							</div>
						{/if}
						<div class="media-info">
							<span class="media-title">{item.title}</span>
							<span class="media-meta">
								<span class="cat-badge">{categoryLabels[item.category] ?? item.category}</span>
								<span class="status-badge" class:status-ready={item.transcode_status === 'ready'} class:status-failed={item.transcode_status === 'failed'} class:status-pending={item.transcode_status === 'pending' || item.transcode_status === 'processing'}>
									{statusLabels[item.transcode_status] ?? item.transcode_status}
								</span>
							</span>
						</div>
						<div class="media-actions">
							{#if item.transcode_status === 'failed'}
								<button class="action-btn action-retranscode" onclick={() => retranscode(item.id)} aria-label="Retranscode" title="再変換">
									<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M21.5 2v6h-6" /><path d="M21.5 8a9 9 0 1 0-2.2 8.5" />
									</svg>
								</button>
							{/if}
							<button class="action-btn" onclick={() => startEdit(item)} aria-label="Edit">
								<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
									<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
								</svg>
							</button>
							<button class="action-btn action-delete" onclick={() => deleteMedia(item.id, item.title)} aria-label="Delete">
								<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="3 6 5 6 21 6" />
									<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
								</svg>
							</button>
						</div>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
</div>

<style>
	.admin {
		max-width: 960px;
		margin: 0 auto;
		padding: 1rem;
		padding-bottom: 80px;
	}

	header {
		margin-bottom: 1rem;
	}

	header h1 {
		font-size: var(--font-size-xl, 1.5rem);
		margin: 0;
	}

	.media-path-label {
		font-size: var(--font-size-sm, 0.875rem);
		color: var(--color-text-muted, #666);
		margin-bottom: 0.5rem;
		font-family: monospace;
	}

	/* Scan button */
	.scan-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem;
		background: var(--color-accent, #4a9eff);
		color: #fff;
		border: none;
		border-radius: var(--radius-md, 8px);
		font-size: var(--font-size-base, 1rem);
		font-weight: 600;
		cursor: pointer;
		margin-bottom: 1rem;
	}

	.scan-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.scan-result {
		padding: 0.75rem;
		background: var(--color-surface, #1a3a1a);
		border-radius: var(--radius-md, 8px);
		margin-bottom: 1rem;
		font-size: var(--font-size-sm, 0.875rem);
		color: var(--color-text-secondary, #aaa);
	}

	/* Transcode queue */
	.tc-section {
		margin-bottom: 1rem;
	}

	.section-title {
		font-size: var(--font-size-base, 1rem);
		color: var(--color-text-secondary, #aaa);
		margin: 0 0 0.5rem;
	}

	.tc-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0.75rem;
		background: var(--color-surface, #1a1a2a);
		border-radius: var(--radius-sm, 4px);
		margin-bottom: 0.25rem;
		font-size: var(--font-size-sm, 0.875rem);
	}

	.tc-title {
		color: var(--color-text, #fff);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.tc-status {
		flex-shrink: 0;
		margin-left: 0.5rem;
		color: var(--color-text-muted, #666);
	}

	.tc-status.processing {
		color: var(--color-accent, #4a9eff);
	}

	/* Toolbar */
	.toolbar {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.search-input {
		flex: 1;
		padding: 0.5rem 0.75rem;
		background: var(--color-surface, #1a1a1a);
		color: var(--color-text, #fff);
		border: 1px solid var(--color-border, #333);
		border-radius: var(--radius-md, 8px);
		font-size: var(--font-size-base, 1rem);
		outline: none;
	}

	.search-input:focus {
		border-color: var(--color-accent, #4a9eff);
	}

	.add-btn {
		width: 42px;
		height: 42px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-surface, #1a1a1a);
		border: 1px solid var(--color-border, #333);
		border-radius: var(--radius-md, 8px);
		color: var(--color-text, #fff);
		cursor: pointer;
		flex-shrink: 0;
		padding: 0;
	}

	/* Add form */
	.add-form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1rem;
		padding: 0.75rem;
		background: var(--color-surface, #1a1a1a);
		border-radius: var(--radius-md, 8px);
		border: 1px solid var(--color-border, #333);
	}

	.add-form input,
	.add-form select {
		padding: 0.5rem 0.75rem;
		background: var(--color-bg, #000);
		color: var(--color-text, #fff);
		border: 1px solid var(--color-border, #333);
		border-radius: var(--radius-sm, 4px);
		font-size: var(--font-size-base, 1rem);
	}

	.add-form button {
		padding: 0.6rem;
		background: var(--color-accent, #4a9eff);
		color: #fff;
		border: none;
		border-radius: var(--radius-sm, 4px);
		font-size: var(--font-size-base, 1rem);
		font-weight: 600;
		cursor: pointer;
	}

	/* Filter chips */
	.filter-chips {
		display: flex;
		gap: 0.4rem;
		margin-bottom: 0.75rem;
		overflow-x: auto;
	}

	.filter-chips button {
		padding: 0.3rem 0.75rem;
		background: var(--color-surface, #222);
		color: var(--color-text-muted, #888);
		border: none;
		border-radius: var(--radius-pill, 16px);
		font-size: var(--font-size-sm, 0.875rem);
		cursor: pointer;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.filter-chips button.active {
		background: var(--color-accent, #4a9eff);
		color: var(--color-text, #fff);
	}

	/* Media count */
	.media-count {
		font-size: var(--font-size-sm, 0.875rem);
		color: var(--color-text-muted, #666);
		margin-bottom: 0.5rem;
	}

	/* Media list */
	.media-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.media-item {
		border-bottom: 1px solid var(--color-surface-alt, #1a1a1a);
	}

	/* Normal row */
	.media-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0;
	}

	.media-thumb {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-sm, 4px);
		object-fit: cover;
		flex-shrink: 0;
	}

	.media-thumb-placeholder {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-sm, 4px);
		background: var(--color-surface-alt, #222);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1rem;
		color: var(--color-text-muted, #666);
		flex-shrink: 0;
	}

	.media-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.media-title {
		color: var(--color-text, #fff);
		font-size: var(--font-size-base, 1rem);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.media-meta {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		font-size: var(--font-size-xs, 0.75rem);
	}

	.cat-badge {
		color: var(--color-text-muted, #888);
	}

	.status-badge {
		color: var(--color-text-muted, #666);
	}

	.status-badge.status-ready {
		color: #4caf50;
	}

	.status-badge.status-failed {
		color: #f44336;
	}

	.status-badge.status-pending {
		color: var(--color-accent, #4a9eff);
	}

	.media-actions {
		display: flex;
		gap: 0.25rem;
		flex-shrink: 0;
	}

	.action-btn {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		color: var(--color-text-muted, #888);
		cursor: pointer;
		border-radius: var(--radius-sm, 4px);
		padding: 0;
	}

	.action-btn:active {
		background: var(--color-surface, #222);
	}

	.action-delete:active {
		color: #f44336;
	}

	.action-retranscode {
		color: var(--color-accent, #4a9eff);
	}

	/* Edit card */
	.edit-card {
		padding: 0.75rem;
		background: var(--color-surface, #1a1a1a);
		border-radius: var(--radius-md, 8px);
		margin: 0.5rem 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.edit-card label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.edit-label {
		font-size: var(--font-size-xs, 0.75rem);
		color: var(--color-text-muted, #888);
	}

	.edit-input,
	.edit-select {
		padding: 0.5rem 0.75rem;
		background: var(--color-bg, #000);
		color: var(--color-text, #fff);
		border: 1px solid var(--color-border, #333);
		border-radius: var(--radius-sm, 4px);
		font-size: var(--font-size-base, 1rem);
	}

	.edit-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}

	.btn-cancel {
		padding: 0.4rem 1rem;
		background: var(--color-surface-alt, #222);
		color: var(--color-text-muted, #888);
		border: none;
		border-radius: var(--radius-sm, 4px);
		cursor: pointer;
		font-size: var(--font-size-sm, 0.875rem);
	}

	.btn-save {
		padding: 0.4rem 1rem;
		background: var(--color-accent, #4a9eff);
		color: #fff;
		border: none;
		border-radius: var(--radius-sm, 4px);
		cursor: pointer;
		font-size: var(--font-size-sm, 0.875rem);
		font-weight: 600;
	}
</style>
