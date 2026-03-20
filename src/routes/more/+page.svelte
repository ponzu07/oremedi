<script lang="ts">
	function logout() {
		document.cookie = 'token=; Max-Age=0; path=/';
		window.location.href = '/login';
	}
</script>

<div class="more-page">
	<header>
		<h1>More</h1>
	</header>

	<nav class="menu">
		<a href="/admin" class="menu-item">
			<div class="menu-icon">
				<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="3" />
					<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
				</svg>
			</div>
			<div class="menu-text">
				<span class="menu-label">Admin</span>
				<span class="menu-desc">メディア管理・スキャン・トランスコード</span>
			</div>
			<svg class="chevron" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="9 18 15 12 9 6" />
			</svg>
		</a>

		<a href="/downloads" class="menu-item">
			<div class="menu-icon">
				<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<polyline points="7 10 12 15 17 10" />
					<line x1="12" y1="15" x2="12" y2="3" />
				</svg>
			</div>
			<div class="menu-text">
				<span class="menu-label">Downloads</span>
				<span class="menu-desc">オフライン保存の管理</span>
			</div>
			<svg class="chevron" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="9 18 15 12 9 6" />
			</svg>
		</a>

		<button class="menu-item logout" onclick={logout}>
			<div class="menu-icon">
				<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
					<polyline points="16 17 21 12 16 7" />
					<line x1="21" y1="12" x2="9" y2="12" />
				</svg>
			</div>
			<div class="menu-text">
				<span class="menu-label">Logout</span>
				<span class="menu-desc">ログアウトする</span>
			</div>
		</button>
	</nav>
</div>

<style>
	.more-page {
		max-width: 600px;
		margin: 0 auto;
		padding: 1rem;
		padding-bottom: calc(var(--bottom-offset, 60px) + 1rem);
	}

	header {
		margin-bottom: 1.5rem;
	}

	header h1 {
		font-size: var(--font-size-lg, 1.25rem);
		margin: 0;
	}

	.menu {
		display: flex;
		flex-direction: column;
		gap: 1px;
		background: var(--color-border, #222);
		border-radius: var(--radius-md, 8px);
		overflow: hidden;
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.85rem 1rem;
		background: var(--color-surface, #111);
		color: var(--color-text, #fff);
		text-decoration: none;
		border: none;
		cursor: pointer;
		width: 100%;
		font: inherit;
		text-align: left;
	}

	.menu-item:active {
		background: var(--color-surface-alt, #1a1a1a);
	}

	.menu-icon {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		color: var(--color-text-secondary, #aaa);
	}

	.menu-text {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}

	.menu-label {
		font-weight: 600;
		font-size: var(--font-size-base, 0.875rem);
	}

	.menu-desc {
		font-size: var(--font-size-sm, 0.75rem);
		color: var(--color-text-muted, #666);
	}

	.chevron {
		color: var(--color-text-muted, #666);
		flex-shrink: 0;
	}

	.logout {
		color: #ef4444;
	}

	.logout .menu-icon {
		color: #ef4444;
	}

	.logout .menu-desc {
		color: #ef444480;
	}
</style>
