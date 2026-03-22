<script lang="ts">
	import { Settings, LogOut } from 'lucide-svelte';
</script>

<div class="dropdown dropdown-end">
	<div tabindex="0" role="button" class="btn btn-ghost btn-sm btn-circle">
		<Settings size={20} />
	</div>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<ul tabindex="0" class="dropdown-content menu bg-base-200 rounded-box z-10 w-44 p-2 shadow-lg">
		<li><a href="/admin">Admin</a></li>
		<li>
			<button onclick={() => {
				document.cookie = 'auth_token=; Max-Age=0; path=/';
				window.location.href = '/login';
			}}>
				<LogOut size={16} />
				Logout
			</button>
		</li>
	</ul>
</div>
