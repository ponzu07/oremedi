<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<div class="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
	<h1 class="text-3xl font-bold">OreMedi</h1>
	<form method="POST" use:enhance class="flex flex-col gap-3 w-full max-w-xs">
		<input
			type="password"
			name="password"
			placeholder="Password"
			autocomplete="current-password"
			required
			class="input input-bordered w-full"
		/>
		{#if form?.error}
			<div class="alert alert-error text-sm py-2">
				{form.error}
			</div>
		{/if}
		<button type="submit" class="btn btn-primary w-full">Login</button>
	</form>
</div>
