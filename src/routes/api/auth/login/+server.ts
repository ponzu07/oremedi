import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createToken } from '$lib/server/auth';
import { config } from '$lib/server/config';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { password } = await request.json();

	if (!password || !config.password) {
		return json({ error: 'Invalid request' }, { status: 400 });
	}

	if (password !== config.password) {
		return json({ error: 'Invalid password' }, { status: 401 });
	}

	const token = createToken(config.jwtSecret);
	const isProduction = process.env.NODE_ENV === 'production';
	cookies.set('auth_token', token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: isProduction,
		maxAge: 60 * 60 * 24 * 30
	});

	return json({ success: true });
};
