import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	checkRateLimit,
	recordFailedAttempt,
	clearAttempts,
	_resetRateLimit
} from '../../src/lib/server/rate-limit';

describe('rate-limit', () => {
	beforeEach(() => {
		_resetRateLimit();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('allows attempts under the limit', () => {
		const ip = '1.2.3.4';
		for (let i = 0; i < 4; i++) {
			expect(checkRateLimit(ip).allowed).toBe(true);
			recordFailedAttempt(ip);
		}
		expect(checkRateLimit(ip).allowed).toBe(true);
	});

	it('blocks after 5 failed attempts within the window', () => {
		const ip = '1.2.3.4';
		for (let i = 0; i < 5; i++) recordFailedAttempt(ip);
		const res = checkRateLimit(ip);
		expect(res.allowed).toBe(false);
		expect(res.retryAfterSeconds).toBeGreaterThan(0);
	});

	it('resets after the 15 minute window elapses', () => {
		const ip = '1.2.3.4';
		for (let i = 0; i < 5; i++) recordFailedAttempt(ip);
		expect(checkRateLimit(ip).allowed).toBe(false);

		vi.advanceTimersByTime(15 * 60 * 1000 + 1);
		expect(checkRateLimit(ip).allowed).toBe(true);
	});

	it('clearAttempts unblocks an ip immediately', () => {
		const ip = '9.9.9.9';
		for (let i = 0; i < 5; i++) recordFailedAttempt(ip);
		expect(checkRateLimit(ip).allowed).toBe(false);
		clearAttempts(ip);
		expect(checkRateLimit(ip).allowed).toBe(true);
	});

	it('tracks ips independently', () => {
		for (let i = 0; i < 5; i++) recordFailedAttempt('a');
		expect(checkRateLimit('a').allowed).toBe(false);
		expect(checkRateLimit('b').allowed).toBe(true);
	});
});
