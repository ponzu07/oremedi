import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { setAuthCookie } from '$lib/server/auth';
import { config } from '$lib/server/config';
import { checkRateLimit, recordFailedAttempt, clearAttempts } from '$lib/server/rate-limit';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	const ip = getClientAddress();
	const { allowed, retryAfterSeconds } = checkRateLimit(ip);

	if (!allowed) {
		return json(
			{ error: `試行回数が上限に達しました。${retryAfterSeconds}秒後に再試行してください` },
			{ status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
		);
	}

	const { password } = await request.json();

	if (!password) {
		return json({ error: 'Invalid request' }, { status: 400 });
	}

	if (password !== config.password) {
		recordFailedAttempt(ip);
		return json({ error: 'Invalid password' }, { status: 401 });
	}

	clearAttempts(ip);
	setAuthCookie(cookies);

	return json({ success: true });
};
