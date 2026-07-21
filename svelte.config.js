import adapter from '@sveltejs/adapter-node';

// Comma-separated origins allowed to submit forms/uploads. When unset the
// previous permissive behavior is kept (no cross-origin check) for backward
// compatibility; set TRUSTED_ORIGINS to enable SvelteKit's CSRF origin check
// and restrict to those origins (e.g. "https://oremedi.example.com").
const trustedOrigins = process.env.TRUSTED_ORIGINS
	?.split(',')
	.map((s) => s.trim())
	.filter(Boolean);

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		csrf: {
			trustedOrigins: trustedOrigins?.length ? trustedOrigins : ['*']
		}
	},
	vitePlugin: {
		dynamicCompileOptions: ({ filename }) =>
			filename.includes('node_modules') ? undefined : { runes: true }
	}
};

export default config;
