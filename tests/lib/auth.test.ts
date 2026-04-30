import { describe, it, expect } from 'vitest';
import { createMediaAccessToken, createToken, isMediaAccessToken, verifyToken } from '../../src/lib/server/auth';

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

	it('scopes media access tokens to a single media id', () => {
		const token = createMediaAccessToken(TEST_SECRET, 42, '12h');
		const payload = verifyToken(token, TEST_SECRET);

		expect(payload).toBeTruthy();
		expect(isMediaAccessToken(payload, 42)).toBe(true);
		expect(isMediaAccessToken(payload, 7)).toBe(false);
	});

	it('rejects invalid media ids for media access tokens', () => {
		expect(() => createMediaAccessToken(TEST_SECRET, 0)).toThrow('mediaId must be a positive integer');
		expect(() => createMediaAccessToken(TEST_SECRET, -1)).toThrow('mediaId must be a positive integer');
	});

	it('propagates invalid expiry errors for media access tokens', () => {
		expect(() => createMediaAccessToken(TEST_SECRET, 42, 'not-a-duration')).toThrow();
	});
});
