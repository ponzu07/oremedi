<script lang="ts">
	let { mediaId, title, isVideo = true }: { mediaId: number; title: string; isVideo?: boolean } = $props();

	let castAvailable = $state(false);
	let casting = $state(false);

	// Initialize Cast SDK
	$effect(() => {
		if (typeof window === 'undefined') return;

		const initCast = () => {
			const cast = (window as any).cast;
			const chrome = (window as any).chrome;
			if (!cast || !chrome?.cast) return;

			cast.framework.CastContext.getInstance().setOptions({
				receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
				autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
			});

			castAvailable = true;
		};

		// Load Cast SDK script if not already loaded
		if (!(window as any).__castSDKLoaded) {
			const script = document.createElement('script');
			script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
			script.onload = () => {
				(window as any).__castSDKLoaded = true;
				(window as any).__onGCastApiAvailable = (isAvailable: boolean) => {
					if (isAvailable) initCast();
				};
			};
			document.head.appendChild(script);
		} else {
			initCast();
		}
	});

	async function startCast() {
		try {
			const cast = (window as any).cast;
			const chrome = (window as any).chrome;
			const context = cast.framework.CastContext.getInstance();

			await context.requestSession();
			const session = context.getCurrentSession();
			if (!session) return;

			// Get signed URL for Chromecast
			const res = await fetch(`/api/media/${mediaId}/cast-url`);
			const { url } = await res.json();

			const contentType = isVideo ? 'video/mp4' : 'audio/aac';
			const mediaInfo = new chrome.cast.media.MediaInfo(url, contentType);
			mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata();
			mediaInfo.metadata.title = title;

			const request = new chrome.cast.media.LoadRequest(mediaInfo);
			await session.loadMedia(request);
			casting = true;
		} catch (err) {
			console.error('Cast error:', err);
		}
	}

	function stopCast() {
		const cast = (window as any).cast;
		const session = cast.framework.CastContext.getInstance().getCurrentSession();
		if (session) {
			session.endSession(true);
		}
		casting = false;
	}
</script>

{#if castAvailable}
	<button class="cast-btn" onclick={casting ? stopCast : startCast} title={casting ? 'Stop casting' : 'Cast'}>
		<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
			{#if casting}
				<path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
			{:else}
				<path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm18-7H3c-1.1 0-2 .9-2 2v3h2V9h18v14h-7v2h7c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zM1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11z"/>
			{/if}
		</svg>
	</button>
{/if}

<style>
	.cast-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		background: transparent;
		border: none;
		color: oklch(var(--bc) / 0.5);
		cursor: pointer;
		border-radius: 4px;
	}

	.cast-btn:hover {
		color: oklch(var(--bc));
		background: oklch(var(--b3));
	}
</style>
