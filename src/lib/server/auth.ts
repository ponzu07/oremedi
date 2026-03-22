import jwt from 'jsonwebtoken';

export function createToken(secret: string, expiresIn: string = '30d'): string {
	return jwt.sign({ authenticated: true }, secret, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string, secret: string): { authenticated: boolean } | null {
	try {
		return jwt.verify(token, secret) as { authenticated: boolean };
	} catch {
		return null;
	}
}
