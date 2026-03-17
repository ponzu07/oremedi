import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyPassword, createToken } from '$lib/server/auth';
import { config } from '$lib/server/config';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { password } = await request.json();

	if (!password || !config.passwordHash) {
		return json({ error: 'Invalid request' }, { status: 400 });
	}

	const valid = await verifyPassword(password, config.passwordHash);
	if (!valid) {
		return json({ error: 'Invalid password' }, { status: 401 });
	}

	const token = createToken(config.jwtSecret);
	cookies.set('auth_token', token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: true,
		maxAge: 60 * 60 * 24 * 30
	});

	return json({ success: true });
};
