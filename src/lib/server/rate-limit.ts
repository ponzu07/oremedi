const attempts = new Map<string, { count: number; resetAt: number }>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const SWEEP_THRESHOLD = 256; // purge expired entries once the map grows past this

/** Drop expired buckets so the map cannot grow unbounded over time. */
function sweep(now: number): void {
	if (attempts.size < SWEEP_THRESHOLD) return;
	for (const [ip, entry] of attempts) {
		if (now >= entry.resetAt) attempts.delete(ip);
	}
}

export function checkRateLimit(ip: string): { allowed: boolean; retryAfterSeconds: number } {
	const now = Date.now();
	sweep(now);
	const entry = attempts.get(ip);

	if (entry && now < entry.resetAt) {
		if (entry.count >= MAX_ATTEMPTS) {
			return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
		}
	}

	return { allowed: true, retryAfterSeconds: 0 };
}

export function recordFailedAttempt(ip: string): void {
	const now = Date.now();
	const entry = attempts.get(ip);

	if (entry && now < entry.resetAt) {
		entry.count++;
	} else {
		attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
	}
}

export function clearAttempts(ip: string): void {
	attempts.delete(ip);
}

// Test-only helper to reset shared module state between cases.
export function _resetRateLimit(): void {
	attempts.clear();
}
