<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<div class="login-container">
	<h1>OreMedi</h1>
	<form method="POST" use:enhance>
		<input
			type="password"
			name="password"
			placeholder="Password"
			autocomplete="current-password"
			required
		/>
		{#if form?.error}
			<p class="error">{form.error}</p>
		{/if}
		<button type="submit">Login</button>
	</form>
</div>

<style>
	.login-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		gap: 1rem;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
		max-width: 320px;
	}

	input {
		padding: 0.75rem;
		border: 1px solid #333;
		border-radius: 4px;
		font-size: 1rem;
		background: #1a1a1a;
		color: #fff;
	}

	button {
		padding: 0.75rem;
		background: #4a9eff;
		color: #fff;
		border: none;
		border-radius: 4px;
		font-size: 1rem;
		cursor: pointer;
	}

	.error {
		color: #ff4a4a;
		font-size: 0.875rem;
		margin: 0;
	}
</style>
