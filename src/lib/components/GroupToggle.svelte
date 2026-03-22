<script lang="ts">
	let {
		options,
		current,
		onChange,
	}: {
		options: { value: string; label: string }[];
		current: string;
		onChange: (value: string) => void;
	} = $props();
</script>

<div class="flex items-center gap-2 mb-4">
	<span class="text-sm text-base-content/50">Group by:</span>
	<div class="join">
		{#each options as opt}
			<button
				class="join-item btn btn-sm {current === opt.value ? 'btn-primary' : 'btn-ghost'}"
				onclick={() => onChange(opt.value)}
			>
				{opt.label}
			</button>
		{/each}
	</div>
</div>
