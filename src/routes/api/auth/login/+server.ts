import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { setAuthCookie } from '$lib/server/auth';
import { config } from '$lib/server/config';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { password } = await request.json();

	if (!password) {
		return json({ error: 'Invalid request' }, { status: 400 });
	}

	if (password !== config.password) {
		return json({ error: 'Invalid password' }, { status: 401 });
	}

	setAuthCookie(cookies);

	return json({ success: true });
};
