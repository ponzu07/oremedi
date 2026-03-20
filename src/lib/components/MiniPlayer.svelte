<script lang="ts">
	import { playerStore } from '$lib/stores/player.svelte';

	const state = $derived(playerStore.state);

	function formatTime(seconds: number): string {
		if (!seconds || !isFinite(seconds)) return '0:00';
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m}:${String(s).padStart(2, '0')}`;
	}

	const progress = $derived(
		state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0
	);
</script>

{#if state.mediaId}
	<div class="mini-player">
		<div class="progress-track">
			<div class="progress-fill" style="width: {progress}%"></div>
		</div>
		<a href="/play/{state.mediaId}" class="mini-player-content">
			{#if state.thumbnailPath}
				<img src={`/api/media/${state.mediaId}/thumbnail`} alt={state.title} class="mini-thumb" />
			{:else}
				<div class="mini-thumb-placeholder">&#9835;</div>
			{/if}
			<div class="mini-info">
				<span class="mini-title">{state.title}</span>
				<span class="mini-time">{formatTime(state.currentTime)} / {formatTime(state.duration)}</span>
			</div>
		</a>
		<div class="mini-controls">
			<button class="mini-btn" onclick={() => playerStore.togglePlayPause()}>
				{#if state.isPlaying}
					<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
						<rect x="6" y="4" width="4" height="16" />
						<rect x="14" y="4" width="4" height="16" />
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
						<polygon points="5,3 19,12 5,21" />
					</svg>
				{/if}
			</button>
			<button class="mini-btn" title="Stop" onclick={() => playerStore.stop()}>
				<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</div>
	</div>
{/if}

<style>
	.mini-player {
		position: fixed;
		bottom: calc(52px + env(safe-area-inset-bottom, 0px));
		left: 0;
		right: 0;
		height: 56px;
		background: rgba(26, 26, 26, 0.95);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-top: 1px solid var(--color-border);
		display: flex;
		align-items: center;
		z-index: 99;
		overflow: hidden;
	}

	.progress-track {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: var(--color-border);
	}

	.progress-fill {
		height: 100%;
		background: var(--color-accent);
		transition: width 0.3s linear;
	}

	.mini-player-content {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0 0.75rem;
		text-decoration: none;
		min-width: 0;
	}

	.mini-thumb {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-sm);
		object-fit: cover;
		flex-shrink: 0;
	}

	.mini-thumb-placeholder {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-sm);
		background: #2a2a3a;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.2rem;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.mini-info {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}

	.mini-title {
		color: var(--color-text);
		font-size: var(--font-size-base);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.mini-time {
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
	}

	.mini-controls {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding-right: 0.75rem;
	}

	.mini-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		background: none;
		border: none;
		color: var(--color-text);
		cursor: pointer;
		border-radius: 50%;
	}

	.mini-btn:hover {
		background: var(--color-border);
	}
</style>
