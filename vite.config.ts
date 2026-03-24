import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		tailwindcss(),
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
				navigateFallback: '/downloads',
				navigateFallbackDenylist: [/^\/api\//, /^\/login/],
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
