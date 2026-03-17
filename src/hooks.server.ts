import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { verifyToken } from '$lib/server/auth';
import { config } from '$lib/server/config';

const PUBLIC_PATHS = ['/login', '/api/auth/login'];

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
		return resolve(event);
	}

	// Signed URL token for Chromecast
	const urlToken = event.url.searchParams.get('token');
	if (urlToken && pathname.startsWith('/api/media/')) {
		const payload = verifyToken(urlToken, config.jwtSecret);
		if (payload) {
			return resolve(event);
		}
	}

	// JWT cookie
	const token = event.cookies.get('auth_token');
	if (!token) {
		if (pathname.startsWith('/api/')) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		throw redirect(303, '/login');
	}

	const payload = verifyToken(token, config.jwtSecret);
	if (!payload) {
		event.cookies.delete('auth_token', { path: '/' });
		if (pathname.startsWith('/api/')) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		throw redirect(303, '/login');
	}

	return resolve(event);
};
