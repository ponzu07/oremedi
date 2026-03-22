<script lang="ts">
	import type { PageData } from './$types';
	import { toast } from '$lib/stores/toast.svelte';
	import { categoryLabels } from '$lib/constants';
	import { logout } from '$lib/utils';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { RefreshCw, Plus, X, Pencil, Trash2, RotateCcw, LogOut, Tag, ChevronDown, ChevronUp, Upload } from 'lucide-svelte';

	let { data }: { data: PageData } = $props();

	let scanResult = $state<{ added: number; moved: number; skipped: number; orphaned: number; total: number } | null>(null);
	let scanning = $state(false);
	let showUpload = $state(false);
	let editingId = $state<number | null>(null);

	interface UploadFile {
		file: File;
		status: 'pending' | 'uploading' | 'done' | 'error';
		progress: number;
	}
	let uploadFiles = $state<UploadFile[]>([]);
	let uploadCategory = $state('');
	let dragging = $state(false);
	let uploading = $state(false);
	let fileInput: HTMLInputElement | undefined = $state();

	let editTitle = $state('');
	let editCategory = $state('');
	let editTags = $state<{ name: string; category: string }[]>([]);
	let newTagName = $state('');
	let newTagCategory = $state<string>('custom');
	let showNewTagInput = $state(false);
	let newCategoryName = $state('');
	let showNewCategoryInput = $state(false);
	let thumbnailInput: HTMLInputElement | undefined = $state();
	let uploadingThumbnail = $state(false);

	let availableTags = $derived.by(() => {
		return data.allTags
			.filter(t => t.category === newTagCategory)
			.filter(t => !editTags.some(et => et.name === t.name && et.category === t.category));
	});

	interface TranscodeQueueItem {
		id: number;
		title: string;
		transcode_status: string;
		transcode_progress: number;
	}
	let transcodeQueue = $state<TranscodeQueueItem[]>(
		data.transcodeQueue.map(q => ({ id: q.id, title: q.title, transcode_status: q.transcode_status, transcode_progress: q.transcode_progress ?? 0 }))
	);
	let transcodePolling = $state(false);

	async function pollTranscodeStatus() {
		if (transcodePolling) return;
		transcodePolling = true;
		try {
			while (true) {
				const res = await fetch('/api/transcode/status');
				const data = await res.json();
				transcodeQueue = data.queue;
				if (data.queue.length === 0) break;
				await new Promise(r => setTimeout(r, 3000));
			}
		} finally {
			transcodePolling = false;
		}
	}

	$effect(() => {
		if (transcodeQueue.length > 0 && !transcodePolling) {
			pollTranscodeStatus();
		}
	});

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

	const MEDIA_ACCEPT = '.mp4,.mkv,.avi,.wmv,.flv,.mov,.webm,.mp3,.flac,.aac,.ogg,.wav,.m4a,.wma';

	function addFiles(files: FileList | File[]) {
		const newFiles = Array.from(files)
			.filter(f => !uploadFiles.some(uf => uf.file.name === f.name && uf.file.size === f.size))
			.map(f => ({ file: f, status: 'pending' as const, progress: 0 }));
		uploadFiles = [...uploadFiles, ...newFiles];
		if (!showUpload) showUpload = true;
	}

	function removeFile(index: number) {
		uploadFiles = uploadFiles.filter((_, i) => i !== index);
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
		return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
	}

	async function uploadAll() {
		if (uploadFiles.length === 0) return;
		uploading = true;

		for (let i = 0; i < uploadFiles.length; i++) {
			if (uploadFiles[i].status !== 'pending') continue;
			uploadFiles[i].status = 'uploading';

			const formData = new FormData();
			formData.append('files', uploadFiles[i].file);
			if (uploadCategory) formData.append('category', uploadCategory);

			try {
				const xhr = new XMLHttpRequest();
				await new Promise<void>((resolve, reject) => {
					xhr.upload.onprogress = (e) => {
						if (e.lengthComputable) {
							uploadFiles[i].progress = Math.round((e.loaded / e.total) * 100);
						}
					};
					xhr.onload = () => {
						if (xhr.status >= 200 && xhr.status < 300) {
							uploadFiles[i].status = 'done';
							uploadFiles[i].progress = 100;
							resolve();
						} else {
							reject(new Error(`HTTP ${xhr.status}`));
						}
					};
					xhr.onerror = () => reject(new Error('Network error'));
					xhr.open('POST', '/api/media/upload');
					xhr.send(formData);
				});
			} catch {
				uploadFiles[i].status = 'error';
			}
		}

		uploading = false;
		const doneCount = uploadFiles.filter(f => f.status === 'done').length;
		if (doneCount > 0) {
			toast.show(`${doneCount}件アップロードしました`);
			uploadFiles = uploadFiles.filter(f => f.status !== 'done');
			if (uploadFiles.length === 0) showUpload = false;
			location.reload();
		}
	}

	async function uploadThumbnail(id: number, file: File) {
		uploadingThumbnail = true;
		const formData = new FormData();
		formData.append('thumbnail', file);
		try {
			const res = await fetch(`/api/media/${id}/thumbnail`, { method: 'POST', body: formData });
			if (res.ok) {
				toast.show('サムネイルを更新しました');
				location.reload();
			} else {
				toast.show('サムネイル更新に失敗しました');
			}
		} finally {
			uploadingThumbnail = false;
		}
	}

	function startEdit(item: any) {
		editingId = item.id;
		editTitle = item.title;
		editCategory = item.category;
		editTags = item.tags ? [...item.tags] : [];
	}

	function addExistingTag(tag: { name: string; category: string }) {
		if (editTags.some(t => t.name === tag.name && t.category === tag.category)) return;
		editTags = [...editTags, { name: tag.name, category: tag.category }];
	}

	function addNewTag() {
		const name = newTagName.trim();
		if (!name) return;
		if (editTags.some(t => t.name === name && t.category === newTagCategory)) return;
		editTags = [...editTags, { name, category: newTagCategory }];
		newTagName = '';
		showNewTagInput = false;
	}

	async function saveEdit(id: number) {
		await fetch(`/api/media/${id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				title: editTitle,
				category: editCategory,
				tags: editTags
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


	let showTagManager = $state(false);
	let editingTagId = $state<number | null>(null);
	let editTagName = $state('');
	let editTagCategory = $state('');
	let renamingCategory = $state<string | null>(null);
	let renameCategoryValue = $state('');

	let tagsByCategory = $derived.by(() => {
		const map = new Map<string, { id: number; name: string; category: string }[]>();
		for (const tag of data.allTags) {
			if (!map.has(tag.category)) map.set(tag.category, []);
			map.get(tag.category)!.push(tag);
		}
		return map;
	});

	function startEditTag(tag: { id: number; name: string; category: string }) {
		editingTagId = tag.id;
		editTagName = tag.name;
		editTagCategory = tag.category;
	}

	async function saveTag(id: number) {
		await fetch(`/api/tags/${id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: editTagName, category: editTagCategory })
		});
		editingTagId = null;
		toast.show('タグを更新しました');
		location.reload();
	}

	async function deleteTag(id: number, name: string) {
		if (!confirm(`タグ「${name}」を削除しますか？関連するメディアからも外れます。`)) return;
		await fetch(`/api/tags/${id}`, { method: 'DELETE' });
		toast.show('タグを削除しました');
		location.reload();
	}

	async function renameCategory(oldName: string) {
		const newName = renameCategoryValue.trim();
		if (!newName || newName === oldName) { renamingCategory = null; return; }
		await fetch('/api/tags', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ oldCategory: oldName, newCategory: newName })
		});
		renamingCategory = null;
		toast.show(`カテゴリ「${oldName}」を「${newName}」に変更しました`);
		location.reload();
	}

	async function deleteCategory(name: string) {
		const count = tagsByCategory.get(name)?.length ?? 0;
		if (!confirm(`カテゴリ「${name}」と所属する${count}件のタグを全て削除しますか？`)) return;
		await fetch('/api/tags', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ category: name })
		});
		toast.show(`カテゴリ「${name}」を削除しました`);
		location.reload();
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
			<div>
				<p>スキャン完了: {scanResult.total}件検出</p>
				<p class="text-xs mt-1">
					{scanResult.added}件追加 / {scanResult.moved}件移動検出 / {scanResult.skipped}件スキップ
					{#if scanResult.orphaned > 0}
						/ <span class="text-warning">{scanResult.orphaned}件ファイル不明</span>
					{/if}
				</p>
			</div>
		</div>
	{/if}

	{#if transcodeQueue.length > 0}
		<section class="mb-4">
			<h2 class="text-sm text-base-content/70 mb-2">変換キュー ({transcodeQueue.length}件)</h2>
			{#each transcodeQueue as item (item.id)}
				<div class="bg-base-200 rounded-box px-3 py-2 mb-1">
					<div class="flex items-center justify-between mb-1">
						<span class="text-sm truncate flex-1">{item.title}</span>
						<span class="text-xs ml-2 {item.transcode_status === 'processing' ? 'text-primary' : 'text-base-content/50'}">
							{#if item.transcode_status === 'processing'}
								{item.transcode_progress}%
							{:else}
								{statusLabels[item.transcode_status] ?? item.transcode_status}
							{/if}
						</span>
					</div>
					{#if item.transcode_status === 'processing'}
						<progress class="progress progress-primary w-full h-1.5" value={item.transcode_progress} max="100"></progress>
					{/if}
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
		<button class="btn btn-ghost btn-square" onclick={() => (showUpload = !showUpload)} aria-label="Upload media">
			{#if showUpload}
				<X size={22} />
			{:else}
				<Upload size={22} />
			{/if}
		</button>
	</div>

	{#if showUpload}
		<div class="bg-base-200 rounded-box p-4 mb-4 flex flex-col gap-3">
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="border-2 border-dashed rounded-box p-8 text-center cursor-pointer transition-colors {dragging ? 'border-primary bg-primary/10' : 'border-base-300 hover:border-primary/50'}"
				ondragover={(e) => { e.preventDefault(); dragging = true; }}
				ondragleave={() => (dragging = false)}
				ondrop={(e) => { e.preventDefault(); dragging = false; if (e.dataTransfer?.files) addFiles(e.dataTransfer.files); }}
				onclick={() => fileInput?.click()}
				role="button"
				tabindex="0"
				onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInput?.click(); }}
			>
				<Upload size={32} class="mx-auto mb-2 text-base-content/30" />
				<p class="text-sm text-base-content/50">ファイルをドラッグ&ドロップ、またはクリックして選択</p>
				<p class="text-xs text-base-content/30 mt-1">動画: mp4, mkv, avi, mov... / 音声: mp3, flac, aac, ogg...</p>
			</div>
			<input
				bind:this={fileInput}
				type="file"
				accept={MEDIA_ACCEPT}
				multiple
				class="hidden"
				onchange={(e) => { const t = e.target as HTMLInputElement; if (t.files) addFiles(t.files); t.value = ''; }}
			/>

			{#if uploadFiles.length > 0}
				<div class="flex gap-2 items-center">
					<select class="select select-sm flex-1" bind:value={uploadCategory}>
						<option value="">カテゴリ自動判定</option>
						<option value="movie">Movie</option>
						<option value="live_video">Live Video</option>
						<option value="voice">Voice</option>
						<option value="music">Music</option>
					</select>
					<button class="btn btn-primary btn-sm" onclick={uploadAll} disabled={uploading}>
						{uploading ? 'アップロード中...' : `${uploadFiles.filter(f => f.status === 'pending').length}件アップロード`}
					</button>
				</div>

				<ul class="list-none p-0 max-h-60 overflow-y-auto">
					{#each uploadFiles as uf, i}
						<li class="flex items-center gap-2 py-1.5 border-b border-base-300 last:border-b-0">
							<div class="flex-1 min-w-0">
								<p class="text-sm truncate">{uf.file.name}</p>
								<p class="text-xs text-base-content/50">{formatFileSize(uf.file.size)}</p>
								{#if uf.status === 'uploading'}
									<progress class="progress progress-primary w-full h-1" value={uf.progress} max="100"></progress>
								{/if}
							</div>
							{#if uf.status === 'done'}
								<span class="text-success text-xs">完了</span>
							{:else if uf.status === 'error'}
								<span class="text-error text-xs">失敗</span>
							{:else if uf.status === 'uploading'}
								<span class="text-primary text-xs">{uf.progress}%</span>
							{:else}
								<button class="btn btn-ghost btn-xs" onclick={() => removeFile(i)}>
									<X size={14} />
								</button>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
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
						<div class="flex gap-3 items-start">
							{#if item.thumbnail_path}
								<img src={`/api/media/${item.id}/thumbnail`} alt="" class="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
							{:else}
								<div class="w-20 h-20 rounded-lg bg-base-300 flex items-center justify-center text-base-content/30 flex-shrink-0 text-2xl">
									{#if item.category === 'music'}&#9835;{:else if item.category === 'voice'}&#127897;{:else}&#9654;{/if}
								</div>
							{/if}
							<div class="flex flex-col gap-1">
								<button
									type="button"
									class="btn btn-sm btn-ghost"
									disabled={uploadingThumbnail}
									onclick={() => thumbnailInput?.click()}
								>
									{uploadingThumbnail ? 'アップロード中...' : 'サムネイル変更'}
								</button>
								<input
									bind:this={thumbnailInput}
									type="file"
									accept="image/*"
									class="hidden"
									onchange={(e) => {
										const t = e.target as HTMLInputElement;
										if (t.files?.[0]) uploadThumbnail(item.id, t.files[0]);
										t.value = '';
									}}
								/>
							</div>
						</div>
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
						<div class="flex flex-col gap-1">
							<span class="text-xs text-base-content/50">タグ</span>
							<div class="flex flex-wrap gap-1 min-h-[32px]">
								{#each editTags as tag, i}
									<span class="badge badge-sm gap-1 {tag.category === 'artist' ? 'badge-primary' : tag.category === 'speaker' ? 'badge-secondary' : tag.category === 'genre' ? 'badge-accent' : 'badge-ghost'}">
										{tag.name}
										<button type="button" class="cursor-pointer" onclick={() => { editTags = editTags.filter((_, idx) => idx !== i); }}>✕</button>
									</span>
								{/each}
							</div>
							<div class="flex gap-1">
								<select class="select select-sm flex-1" bind:value={newTagCategory}>
									{#each data.tagCategories as cat}
										<option value={cat}>{cat}</option>
									{/each}
								</select>
								{#if showNewCategoryInput}
									<input
										class="input input-sm w-28"
										placeholder="カテゴリ名"
										bind:value={newCategoryName}
										onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const name = newCategoryName.trim(); if (name && !data.tagCategories.includes(name)) { data.tagCategories = [...data.tagCategories, name]; } newTagCategory = name || newTagCategory; newCategoryName = ''; showNewCategoryInput = false; } }}
									/>
								{:else}
									<button type="button" class="btn btn-sm btn-ghost" onclick={() => (showNewCategoryInput = true)} title="カテゴリ追加">+</button>
								{/if}
							</div>
							{#if availableTags.length > 0}
								<div class="flex flex-wrap gap-1">
									{#each availableTags as tag}
										<button type="button" class="badge badge-sm badge-outline cursor-pointer hover:badge-primary" onclick={() => addExistingTag(tag)}>+ {tag.name}</button>
									{/each}
								</div>
							{/if}
							{#if showNewTagInput}
								<div class="flex gap-1">
									<input
										class="input input-sm flex-1"
										placeholder="新しいタグ名"
										bind:value={newTagName}
										onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNewTag(); } }}
									/>
									<button type="button" class="btn btn-sm btn-primary" onclick={addNewTag}>作成</button>
									<button type="button" class="btn btn-sm btn-ghost" onclick={() => { showNewTagInput = false; newTagName = ''; }}>✕</button>
								</div>
							{:else}
								<button type="button" class="btn btn-sm btn-ghost btn-block" onclick={() => (showNewTagInput = true)}>+ 新しいタグを作成</button>
							{/if}
						</div>
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
							{#if item.tags?.length > 0}
								<div class="flex flex-wrap gap-0.5 mt-0.5">
									{#each item.tags as tag}
										<span class="badge badge-xs {tag.category === 'artist' ? 'badge-primary' : tag.category === 'speaker' ? 'badge-secondary' : tag.category === 'genre' ? 'badge-accent' : 'badge-ghost'}">{tag.name}</span>
									{/each}
								</div>
							{/if}
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

	<button class="btn btn-ghost w-full justify-between mb-2" onclick={() => (showTagManager = !showTagManager)}>
		<span class="flex items-center gap-2"><Tag size={18} /> タグ管理</span>
		{#if showTagManager}<ChevronUp size={18} />{:else}<ChevronDown size={18} />{/if}
	</button>

	{#if showTagManager}
		<div class="bg-base-200 rounded-box p-4 mb-4">
			{#if tagsByCategory.size === 0}
				<p class="text-sm text-base-content/50 text-center py-4">タグがありません</p>
			{:else}
				{#each [...tagsByCategory] as [categoryName, tags]}
					<div class="mb-4 last:mb-0">
						<div class="flex items-center gap-2 mb-2 pb-1 border-b border-base-300">
							{#if renamingCategory === categoryName}
								<input
									class="input input-sm flex-1"
									bind:value={renameCategoryValue}
									onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); renameCategory(categoryName); } }}
								/>
								<button class="btn btn-sm btn-primary" onclick={() => renameCategory(categoryName)}>保存</button>
								<button class="btn btn-sm btn-ghost" onclick={() => (renamingCategory = null)}>✕</button>
							{:else}
								<span class="text-sm font-bold flex-1">{categoryName}</span>
								<span class="text-xs text-base-content/50">{tags.length}件</span>
								<button class="btn btn-ghost btn-xs" onclick={() => { renamingCategory = categoryName; renameCategoryValue = categoryName; }} title="リネーム">
									<Pencil size={14} />
								</button>
								<button class="btn btn-ghost btn-xs hover:text-error" onclick={() => deleteCategory(categoryName)} title="削除">
									<Trash2 size={14} />
								</button>
							{/if}
						</div>
						<ul class="list-none p-0">
							{#each tags as tag}
								<li class="flex items-center gap-2 py-1 pl-2">
									{#if editingTagId === tag.id}
										<input class="input input-sm flex-1" bind:value={editTagName} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveTag(tag.id); } }} />
										<select class="select select-sm w-24" bind:value={editTagCategory}>
											{#each data.tagCategories as cat}
												<option value={cat}>{cat}</option>
											{/each}
										</select>
										<button class="btn btn-sm btn-primary" onclick={() => saveTag(tag.id)}>保存</button>
										<button class="btn btn-sm btn-ghost" onclick={() => (editingTagId = null)}>✕</button>
									{:else}
										<span class="text-sm flex-1">{tag.name}</span>
										<button class="btn btn-ghost btn-xs" onclick={() => startEditTag(tag)}>
											<Pencil size={14} />
										</button>
										<button class="btn btn-ghost btn-xs hover:text-error" onclick={() => deleteTag(tag.id, tag.name)}>
											<Trash2 size={14} />
										</button>
									{/if}
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			{/if}
		</div>
	{/if}

	<button class="btn btn-error btn-outline w-full" onclick={logout}>
		<LogOut size={18} />
		Logout
	</button>
</div>
