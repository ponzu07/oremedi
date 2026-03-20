import { describe, it, expect } from 'vitest';
import { createToken, verifyToken } from '../../src/lib/server/auth';

const TEST_SECRET = 'test_jwt_secret';

describe('auth', () => {
	it('creates and verifies JWT token', () => {
		const token = createToken(TEST_SECRET);
		const payload = verifyToken(token, TEST_SECRET);
		expect(payload).toBeTruthy();
		expect(payload!.authenticated).toBe(true);
	});

	it('rejects invalid JWT token', () => {
		const payload = verifyToken('invalid.token.here', TEST_SECRET);
		expect(payload).toBeNull();
	});

	it('creates signed media URL token with short expiry', () => {
		const token = createToken(TEST_SECRET, '4h');
		const payload = verifyToken(token, TEST_SECRET);
		expect(payload).toBeTruthy();
	});
});
