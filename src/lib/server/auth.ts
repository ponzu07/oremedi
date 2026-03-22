import jwt from 'jsonwebtoken';
import type { Cookies } from '@sveltejs/kit';
import { config } from '$lib/server/config';

export function createToken(secret: string, expiresIn: string = '30d'): string {
	return jwt.sign({ authenticated: true }, secret, { expiresIn } as jwt.SignOptions);
}

export function setAuthCookie(cookies: Cookies): void {
	const token = createToken(config.jwtSecret);
	cookies.set('auth_token', token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: false,
		maxAge: 60 * 60 * 24 * 30
	});
}

export function verifyToken(token: string, secret: string): { authenticated: boolean } | null {
	try {
		return jwt.verify(token, secret) as { authenticated: boolean };
	} catch {
		return null;
	}
}
