import { json } from '@sveltejs/kit';
import crypto from 'crypto';
import type { RequestHandler } from './$types';
import { setAuthCookie } from '$lib/server/auth';
import { config } from '$lib/server/config';
import { checkRateLimit, recordFailedAttempt, clearAttempts } from '$lib/server/rate-limit';

const MAX_BODY_BYTES = 4096;

/** Constant-time string comparison that does not leak length via timing. */
function timingSafeEqual(a: string, b: string): boolean {
	const ah = crypto.createHash('sha256').update(a).digest();
	const bh = crypto.createHash('sha256').update(b).digest();
	return crypto.timingSafeEqual(ah, bh);
}

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	const ip = getClientAddress();
	const { allowed, retryAfterSeconds } = checkRateLimit(ip);

	if (!allowed) {
		return json(
			{ error: `試行回数が上限に達しました。${retryAfterSeconds}秒後に再試行してください` },
			{ status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
		);
	}

	// Reject oversized bodies on this unauthenticated endpoint so it can't be
	// used for memory-exhaustion (the global BODY_SIZE_LIMIT stays large for
	// legitimate media uploads).
	const contentLength = Number(request.headers.get('content-length') ?? 0);
	if (contentLength > MAX_BODY_BYTES) {
		return json({ error: 'Request too large' }, { status: 413 });
	}

	let body: { password?: string };
	try { body = await request.json(); } catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}
	const { password } = body;

	if (!password || typeof password !== 'string') {
		return json({ error: 'Invalid request' }, { status: 400 });
	}

	// Reject login entirely when no password is configured, rather than allowing
	// an empty/default credential.
	if (!config.password || !timingSafeEqual(password, config.password)) {
		recordFailedAttempt(ip);
		return json({ error: 'Invalid password' }, { status: 401 });
	}

	clearAttempts(ip);
	setAuthCookie(cookies);

	return json({ success: true });
};
