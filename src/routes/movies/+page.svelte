<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="list-page">
	<header>
		<h1>Movies</h1>
		<nav><a href="/">Home</a></nav>
	</header>

	{#if data.genres.length > 0}
		<div class="filters">
			<a href="/movies" class:active={!data.currentGenre}>All</a>
			{#each data.genres as genre}
				<a href="/movies?genre={encodeURIComponent(genre)}" class:active={data.currentGenre === genre}>
					{genre}
				</a>
			{/each}
		</div>
	{/if}

	{#if data.movies.length === 0}
		<p class="empty">No movies found</p>
	{:else}
		<table>
			<thead>
				<tr>
					<th>Title</th>
					<th>Genre</th>
					<th>Status</th>
				</tr>
			</thead>
			<tbody>
				{#each data.movies as movie}
					<tr>
						<td><a href="/play/{movie.id}">{movie.title}</a></td>
						<td class="meta">{movie.genre_value ?? '-'}</td>
						<td class="meta">{movie.transcode_status}</td>
					</tr>
				{/each}
			</tbody>
		</table>
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
		color: #4a9eff;
	}

	.filters {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}

	.filters a {
		padding: 0.3rem 0.75rem;
		background: #222;
		color: #aaa;
		text-decoration: none;
		border-radius: 100px;
		font-size: 0.8rem;
	}

	.filters a.active {
		background: #4a9eff;
		color: #fff;
	}

	.empty {
		color: #666;
		text-align: center;
		padding: 3rem;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th,
	td {
		text-align: left;
		padding: 0.6rem;
		border-bottom: 1px solid #222;
	}

	th {
		color: #888;
		font-size: 0.875rem;
	}

	td a {
		color: #fff;
		text-decoration: none;
	}

	td a:hover {
		color: #4a9eff;
	}

	.meta {
		color: #888;
		font-size: 0.875rem;
	}
</style>
