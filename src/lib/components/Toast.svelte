<script lang="ts">
	import { toast } from '$lib/stores/toast.svelte';
</script>

{#if toast.visible}
	<div class="toast toast-bottom toast-center z-[200] pb-20" role="status" aria-live="polite">
		<div class="alert bg-base-200 shadow-lg">
			<span class="text-sm">{toast.message}</span>
		</div>
	</div>
{/if}
