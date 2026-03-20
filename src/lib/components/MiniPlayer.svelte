<script lang="ts">
	import { playerStore } from '$lib/stores/player.svelte';

	const ps = $derived(playerStore.state);

	const progress = $derived(
		ps.duration > 0 ? (ps.currentTime / ps.duration) * 100 : 0
	);

	// Seekbar state
	let seekbar: HTMLDivElement;
	let isSeeking = $state(false);

	function handleSeekStart(e: PointerEvent) {
		isSeeking = true;
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
		updateSeek(e);
	}

	function handleSeekMove(e: PointerEvent) {
		if (!isSeeking) return;
		updateSeek(e);
	}

	function handleSeekEnd(e: PointerEvent) {
		if (!isSeeking) return;
		isSeeking = false;
		updateSeek(e);
	}

	function updateSeek(e: PointerEvent) {
		const rect = seekbar.getBoundingClientRect();
		const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		playerStore.seek(ratio * ps.duration);
	}

	// Speed button long press
	let speedTimer: ReturnType<typeof setTimeout> | null = null;

	function handleSpeedDown() {
		speedTimer = setTimeout(() => {
			playerStore.setPlaybackRate(1.0);
			speedTimer = null;
		}, 500);
	}

	function handleSpeedUp() {
		if (speedTimer) {
			clearTimeout(speedTimer);
			speedTimer = null;
			playerStore.cyclePlaybackRate();
		}
	}

	const speedLabel = $derived(
		ps.playbackRate % 1 === 0
			? `${ps.playbackRate.toFixed(1)}x`
			: `${ps.playbackRate % 1 === 0.5 ? ps.playbackRate.toFixed(1) : ps.playbackRate.toFixed(2).replace(/0$/, '')}x`
	);
</script>

{#if ps.mediaId}
	<div class="mini-player">
		<!-- Seekbar -->
		<div
			class="seekbar-area"
			bind:this={seekbar}
			onpointerdown={handleSeekStart}
			onpointermove={handleSeekMove}
			onpointerup={handleSeekEnd}
			role="slider"
			aria-label="Seek"
			aria-valuenow={ps.currentTime}
			aria-valuemin={0}
			aria-valuemax={ps.duration}
			tabindex="0"
		>
			<div class="seekbar-track">
				<div class="seekbar-fill" style="width: {progress}%"></div>
			</div>
		</div>

		<!-- Control row -->
		<div class="control-row">
			<!-- Left: thumbnail + title (link to full player) -->
			<a href="/play/{ps.mediaId}" class="mini-info-link">
				{#if ps.thumbnailPath}
					<img src={`/api/media/${ps.mediaId}/thumbnail`} alt={ps.title} class="mini-thumb" />
				{:else}
					<div class="mini-thumb-placeholder">&#9835;</div>
				{/if}
				<span class="mini-title">{ps.title}</span>
			</a>

			<!-- Center: prev / play-pause / next -->
			<div class="mini-controls">
				<button class="mini-btn" title="Previous" onclick={() => playerStore.previous()}>
					<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
						<rect x="4" y="6" width="2.5" height="12" rx="0.5" />
						<polygon points="19,6 9,12 19,18" />
					</svg>
				</button>
				<button class="mini-btn" title={ps.isPlaying ? 'Pause' : 'Play'} onclick={() => playerStore.togglePlayPause()}>
					{#if ps.isPlaying}
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
				<button class="mini-btn" title="Next" onclick={() => playerStore.next()}>
					<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
						<polygon points="5,6 15,12 5,18" />
						<rect x="17.5" y="6" width="2.5" height="12" rx="0.5" />
					</svg>
				</button>
			</div>

			<!-- Right: speed button -->
			<button
				class="speed-btn"
				title="Playback speed"
				onpointerdown={handleSpeedDown}
				onpointerup={handleSpeedUp}
				onpointercancel={handleSpeedUp}
			>
				{speedLabel}
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
		height: 64px;
		background: rgba(26, 26, 26, 0.95);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-top: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		z-index: 99;
	}

	/* Seekbar */
	.seekbar-area {
		width: 100%;
		height: 12px;
		display: flex;
		align-items: center;
		cursor: pointer;
		touch-action: none;
		padding: 4px 0;
		box-sizing: border-box;
	}

	.seekbar-track {
		width: 100%;
		height: 4px;
		background: var(--color-border);
		position: relative;
	}

	.seekbar-fill {
		height: 100%;
		background: var(--color-accent);
		transition: width 0.1s linear;
	}

	/* Control row */
	.control-row {
		flex: 1;
		display: flex;
		align-items: center;
		padding: 0 0.5rem;
		min-width: 0;
	}

	/* Left: info link */
	.mini-info-link {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		min-width: 0;
		overflow: hidden;
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

	.mini-title {
		color: var(--color-text);
		font-size: var(--font-size-base);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Center: controls */
	.mini-controls {
		display: flex;
		align-items: center;
		gap: 0.125rem;
		flex-shrink: 0;
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
		padding: 0;
	}

	.mini-btn:hover {
		background: var(--color-border);
	}

	/* Right: speed button */
	.speed-btn {
		flex-shrink: 0;
		min-width: 3rem;
		height: 32px;
		background: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		color: var(--color-text);
		font-size: var(--font-size-sm);
		font-weight: 600;
		cursor: pointer;
		padding: 0 0.375rem;
		touch-action: manipulation;
	}

	.speed-btn:hover {
		background: var(--color-border);
	}
</style>
