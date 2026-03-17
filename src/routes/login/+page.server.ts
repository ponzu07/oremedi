import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { verifyPassword, createToken } from '$lib/server/auth';
import { config } from '$lib/server/config';

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const password = data.get('password') as string;

		if (!password) {
			return fail(400, { error: 'Password is required' });
		}

		const valid = await verifyPassword(password, config.passwordHash);
		if (!valid) {
			return fail(401, { error: 'Invalid password' });
		}

		const token = createToken(config.jwtSecret);
		cookies.set('auth_token', token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: true,
			maxAge: 60 * 60 * 24 * 30
		});

		throw redirect(303, '/');
	}
};
