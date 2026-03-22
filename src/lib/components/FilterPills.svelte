<script lang="ts">
	let {
		tags,
		currentTag,
		baseHref,
	}: {
		tags: { name: string; category?: string }[];
		currentTag: string | null;
		baseHref: string;
	} = $props();

	function tagHref(tagName: string): string {
		const separator = baseHref.includes('?') ? '&' : '?';
		return `${baseHref}${separator}tag=${encodeURIComponent(tagName)}`;
	}
</script>

{#if tags.length > 0}
	<div class="flex flex-wrap gap-2 mb-4">
		<a
			href={baseHref}
			class="badge badge-lg cursor-pointer select-none min-h-[44px] {!currentTag ? 'badge-primary' : 'badge-ghost'}"
		>
			All
		</a>
		{#each tags as tag}
			<a
				href={tagHref(tag.name)}
				class="badge badge-lg cursor-pointer select-none min-h-[44px] {currentTag === tag.name ? 'badge-primary' : 'badge-ghost'}"
			>
				{tag.name}
			</a>
		{/each}
	</div>
{/if}
