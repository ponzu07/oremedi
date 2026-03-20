import jwt from 'jsonwebtoken';

interface TokenPayload {
	authenticated: boolean;
	iat: number;
	exp: number;
}

export function createToken(secret: string, expiresIn: string = '30d'): string {
	return jwt.sign({ authenticated: true }, secret, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string, secret: string): TokenPayload | null {
	try {
		return jwt.verify(token, secret) as TokenPayload;
	} catch {
		return null;
	}
}
