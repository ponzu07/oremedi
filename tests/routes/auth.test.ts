import { describe, it, expect } from 'vitest';
import { createToken, verifyToken } from '../../src/lib/server/auth';

describe('auth integration', () => {
	const SECRET = 'integration_test_secret';

	it('full login flow: token create -> token verify', () => {
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
