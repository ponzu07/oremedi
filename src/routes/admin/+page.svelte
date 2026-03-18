<script lang="ts">
	import type { PageData } from './$types';

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

	async function scan() {
		scanning = true;
		scanResult = null;
		const res = await fetch('/api/scan', { method: 'POST' });
		scanResult = await res.json();
		scanning = false;
		if (scanResult && scanResult.added > 0) {
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
		location.reload();
	}

	async function deleteMedia(id: number) {
		if (!confirm('Delete this media?')) return;
		await fetch(`/api/media/${id}`, { method: 'DELETE' });
		location.reload();
	}

	const categoryLabels: Record<string, string> = {
		movie: 'Movie',
		live_video: 'Live Video',
		voice: 'Voice',
		music: 'Music'
	};
</script>

<div class="admin">
	<header>
		<h1>Admin</h1>
		<nav>
			<a href="/">Home</a>
		</nav>
	</header>

	<section class="actions">
		<button onclick={scan} disabled={scanning}>
			{scanning ? 'Scanning...' : 'Scan Folders'}
		</button>
		<button onclick={() => (showAddForm = !showAddForm)}>
			{showAddForm ? 'Cancel' : 'Add Media'}
		</button>
	</section>

	{#if scanResult}
		<div class="scan-result">
			Scan complete: {scanResult.added} added, {scanResult.skipped} skipped, {scanResult.total} total files
		</div>
	{/if}

	{#if showAddForm}
		<form class="add-form" onsubmit={(e) => { e.preventDefault(); addMedia(); }}>
			<input bind:value={newTitle} placeholder="Title" required />
			<select bind:value={newCategory}>
				<option value="movie">Movie</option>
				<option value="live_video">Live Video</option>
				<option value="voice">Voice</option>
				<option value="music">Music</option>
			</select>
			<input bind:value={newPath} placeholder="File path on NAS" required />
			<button type="submit">Add</button>
		</form>
	{/if}

	{#if data.transcodeQueue.length > 0}
		<section>
			<h2>Transcode Queue</h2>
			<ul class="queue">
				{#each data.transcodeQueue as item}
					<li>{item.title} — {item.transcode_status}</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section>
		<h2>All Media ({data.media.length})</h2>
		<table>
			<thead>
				<tr>
					<th>Title</th>
					<th>Category</th>
					<th>Status</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each data.media as item}
					<tr>
						{#if editingId === item.id}
							<td><input bind:value={editTitle} /></td>
							<td>
								<select bind:value={editCategory}>
									<option value="movie">Movie</option>
									<option value="live_video">Live Video</option>
									<option value="voice">Voice</option>
									<option value="music">Music</option>
								</select>
							</td>
							<td>{item.transcode_status}</td>
							<td>
								<button onclick={() => saveEdit(item.id)}>Save</button>
								<button onclick={() => (editingId = null)}>Cancel</button>
							</td>
						{:else}
							<td>{item.title}</td>
							<td>{categoryLabels[item.category] ?? item.category}</td>
							<td>{item.transcode_status}</td>
							<td>
								<button onclick={() => startEdit(item)}>Edit</button>
								<button onclick={() => deleteMedia(item.id)}>Delete</button>
							</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
</div>

<style>
	.admin {
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

	.actions {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	button {
		padding: 0.5rem 1rem;
		background: #333;
		color: #fff;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	button:hover {
		background: #444;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.scan-result {
		padding: 0.75rem;
		background: #1a3a1a;
		border-radius: 4px;
		margin-bottom: 1rem;
	}

	.add-form {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}

	.add-form input,
	.add-form select {
		padding: 0.5rem;
		background: #1a1a1a;
		color: #fff;
		border: 1px solid #333;
		border-radius: 4px;
	}

	.add-form input {
		flex: 1;
		min-width: 150px;
	}

	.queue {
		list-style: none;
		padding: 0;
	}

	.queue li {
		padding: 0.5rem;
		background: #1a1a2a;
		margin-bottom: 0.25rem;
		border-radius: 4px;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th,
	td {
		text-align: left;
		padding: 0.5rem;
		border-bottom: 1px solid #222;
	}

	th {
		color: #888;
		font-size: 0.875rem;
	}

	td input,
	td select {
		padding: 0.25rem;
		background: #1a1a1a;
		color: #fff;
		border: 1px solid #333;
		border-radius: 4px;
	}
</style>
