import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { setAuthCookie } from '$lib/server/auth';
import { config } from '$lib/server/config';

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const password = data.get('password');

		if (!password) {
			return fail(400, { error: 'Password is required' });
		}

		if (password !== config.password) {
			return fail(401, { error: 'Invalid password' });
		}

		setAuthCookie(cookies);

		throw redirect(303, '/');
	}
};
