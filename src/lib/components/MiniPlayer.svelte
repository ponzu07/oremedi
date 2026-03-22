<script lang="ts">
	import { playerStore, isVideoCategory } from '$lib/stores/player.svelte';
	import { SkipBack, SkipForward, Play, Pause } from 'lucide-svelte';

	const ps = $derived(playerStore.state);
	const isVideo = $derived(isVideoCategory(ps.category));

	const progress = $derived(
		ps.duration > 0 ? (ps.currentTime / ps.duration) * 100 : 0
	);

	// Seekbar state
	let seekbar = $state<HTMLDivElement>(undefined as unknown as HTMLDivElement);
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
	<div class="mini-player" class:has-video={isVideo}>
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
			<!-- Left: thumbnail/video slot + title (link to full player) -->
			<a href="/play/{ps.mediaId}" class="mini-info-link">
				{#if isVideo}
					<!-- Blank slot: the global fixed <video> visually overlaps here -->
					<div class="mini-video-slot" aria-hidden="true"></div>
				{:else if ps.thumbnailPath}
					<img src={`/api/media/${ps.mediaId}/thumbnail`} alt={ps.title} class="mini-thumb" />
				{:else}
					<div class="mini-thumb-placeholder">&#9835;</div>
				{/if}
				<span class="mini-title">{ps.title}</span>
			</a>

			<!-- Center: prev / play-pause / next -->
			<div class="mini-controls">
				<button class="mini-btn" title="Previous" onclick={() => playerStore.previous()}>
					<SkipBack size={22} />
				</button>
				<button class="mini-btn" title={ps.isPlaying ? 'Pause' : 'Play'} onclick={() => playerStore.togglePlayPause()}>
					{#if ps.isPlaying}
						<Pause size={24} />
					{:else}
						<Play size={24} />
					{/if}
				</button>
				<button class="mini-btn" title="Next" onclick={() => playerStore.next()}>
					<SkipForward size={22} />
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
		border-top: 1px solid oklch(var(--b3));
		display: flex;
		flex-direction: column;
		z-index: 99;
	}

	.mini-player.has-video {
		height: 80px;
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
		background: oklch(var(--b3));
		position: relative;
	}

	.seekbar-fill {
		height: 100%;
		background: oklch(var(--p));
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
		border-radius: 0.5rem;
		object-fit: cover;
		flex-shrink: 0;
	}

	.mini-thumb-placeholder {
		width: 40px;
		height: 40px;
		border-radius: 0.5rem;
		background: oklch(var(--b3));
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.2rem;
		color: oklch(var(--bc) / 0.5);
		flex-shrink: 0;
	}

	.mini-video-slot {
		width: 120px;
		height: 68px;
		flex-shrink: 0;
		border-radius: 4px;
		background: transparent;
	}

	.mini-title {
		color: oklch(var(--bc));
		font-size: 1rem;
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
		color: oklch(var(--bc));
		cursor: pointer;
		border-radius: 50%;
		padding: 0;
	}

	.mini-btn:hover {
		background: oklch(var(--b3));
	}

	/* Right: speed button */
	.speed-btn {
		flex-shrink: 0;
		min-width: 3rem;
		height: 32px;
		background: none;
		border: 1px solid oklch(var(--b3));
		border-radius: 0.5rem;
		color: oklch(var(--bc));
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		padding: 0 0.375rem;
		touch-action: manipulation;
	}

	.speed-btn:hover {
		background: oklch(var(--b3));
	}
</style>
