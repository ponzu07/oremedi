import { describe, it, expect } from 'vitest';
import bcrypt from 'bcrypt';
import { verifyPassword, createToken, verifyToken } from '../../src/lib/server/auth';

const TEST_PASSWORD = 'test_password_123';
const TEST_SECRET = 'test_jwt_secret';

describe('auth', () => {
	it('verifies correct password', async () => {
		const hash = await bcrypt.hash(TEST_PASSWORD, 10);
		const result = await verifyPassword(TEST_PASSWORD, hash);
		expect(result).toBe(true);
	});

	it('rejects wrong password', async () => {
		const hash = await bcrypt.hash(TEST_PASSWORD, 10);
		const result = await verifyPassword('wrong_password', hash);
		expect(result).toBe(false);
	});

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
