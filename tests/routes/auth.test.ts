import { describe, it, expect } from 'vitest';
import bcrypt from 'bcrypt';
import { verifyPassword, createToken, verifyToken } from '../../src/lib/server/auth';

describe('auth integration', () => {
	const SECRET = 'integration_test_secret';

	it('full login flow: password verify -> token create -> token verify', async () => {
		const password = 'my_secure_password';
		const hash = await bcrypt.hash(password, 10);

		const isValid = await verifyPassword(password, hash);
		expect(isValid).toBe(true);

		const token = createToken(SECRET);
		expect(token).toBeTruthy();

		const payload = verifyToken(token, SECRET);
		expect(payload).toBeTruthy();
		expect(payload!.authenticated).toBe(true);
	});

	it('signed URL token with short expiry', () => {
		const token = createToken(SECRET, '4h');
		const payload = verifyToken(token, SECRET);
		expect(payload).toBeTruthy();
		expect(payload!.authenticated).toBe(true);
	});
});
