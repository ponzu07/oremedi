import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			manifest: {
				name: 'OreMedi',
				short_name: 'OreMedi',
				description: 'Personal Media Player',
				theme_color: '#0a0a0a',
				background_color: '#0a0a0a',
				display: 'standalone',
				icons: [
					{
						src: '/icon-192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: '/icon-512.png',
						sizes: '512x512',
						type: 'image/png'
					}
				]
			},
			workbox: {
				// Don't cache API responses or media streams in service worker
				navigateFallback: '/',
				navigateFallbackDenylist: [/^\/api\//],
				runtimeCaching: [
					{
						urlPattern: /^\/api\/media\/\d+\/thumbnail/,
						handler: 'CacheFirst',
						options: {
							cacheName: 'thumbnails',
							expiration: { maxEntries: 200, maxAgeSeconds: 86400 }
						}
					}
				]
			}
		})
	],
	test: {
		include: ['tests/**/*.test.ts']
	}
});
