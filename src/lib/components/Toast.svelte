<script lang="ts">
	import { toast } from '$lib/stores/toast.svelte';
</script>

{#if toast.visible}
	<div class="toast">{toast.message}</div>
{/if}

<style>
	.toast {
		position: fixed;
		bottom: calc(80px + env(safe-area-inset-bottom, 0px));
		left: 50%;
		transform: translateX(-50%);
		background: rgba(0, 0, 0, 0.85);
		color: white;
		padding: 0.5rem 1.25rem;
		border-radius: 999px;
		font-size: 0.85rem;
		z-index: 200;
		pointer-events: none;
		animation: toast-in 0.2s ease-out;
		white-space: nowrap;
	}

	@keyframes toast-in {
		from { opacity: 0; transform: translateX(-50%) translateY(8px); }
		to { opacity: 1; transform: translateX(-50%) translateY(0); }
	}
</style>
