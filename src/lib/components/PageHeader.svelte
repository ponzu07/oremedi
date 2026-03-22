<script lang="ts">
	import SettingsMenu from './SettingsMenu.svelte';
	import { ChevronLeft } from 'lucide-svelte';

	let {
		title,
		showSettings = true,
		backHref = '',
	}: {
		title: string;
		showSettings?: boolean;
		backHref?: string;
	} = $props();
</script>

<div class="navbar px-0 mb-4">
	<div class="flex-1 flex items-center gap-2">
		{#if backHref}
			<a href={backHref} class="btn btn-ghost btn-sm btn-circle">
				<ChevronLeft size={20} />
			</a>
		{/if}
		<h1 class="text-xl font-bold">{title}</h1>
	</div>
	<div class="flex-none">
		{#if showSettings}
			<SettingsMenu />
		{/if}
	</div>
</div>
