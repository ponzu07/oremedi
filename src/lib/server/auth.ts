import jwt from 'jsonwebtoken';
import type { Cookies } from '@sveltejs/kit';
import { config } from '$lib/server/config';

export interface AuthTokenPayload {
	authenticated: boolean;
	scope?: 'media-access';
	mediaId?: number;
}

export function createToken(
	secret: string,
	expiresIn: string = '30d',
	payload: Omit<Partial<AuthTokenPayload>, 'authenticated'> = {}
): string {
	return jwt.sign({ authenticated: true, ...payload }, secret, { expiresIn } as jwt.SignOptions);
}

export function createMediaAccessToken(secret: string, mediaId: number, expiresIn: string = '12h'): string {
	if (!Number.isInteger(mediaId) || mediaId <= 0) {
		throw new Error('mediaId must be a positive integer');
	}

	return createToken(secret, expiresIn, { scope: 'media-access', mediaId });
}

export function setAuthCookie(cookies: Cookies): void {
	const token = createToken(config.jwtSecret);
	cookies.set('auth_token', token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: 60 * 60 * 24 * 30
	});
}

export function verifyToken(token: string, secret: string): AuthTokenPayload | null {
	try {
		return jwt.verify(token, secret) as AuthTokenPayload;
	} catch {
		return null;
	}
}

export function isMediaAccessToken(payload: AuthTokenPayload | null, mediaId: number): boolean {
	return payload?.authenticated === true
		&& payload.scope === 'media-access'
		&& payload.mediaId === mediaId;
}
