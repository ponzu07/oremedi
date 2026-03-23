import { env } from '$env/dynamic/private';
import crypto from 'crypto';
import path from 'path';

const jwtSecret = env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!env.JWT_SECRET) {
	console.warn('[config] JWT_SECRET not set — using random secret (tokens will invalidate on restart)');
}

export const config = {
	password: env.PASSWORD ?? '',
	jwtSecret,
	databasePath: env.DATABASE_PATH ?? 'data/oremedi.db',
	mediaPath: env.MEDIA_PATH ?? '/media',
	originalsPath: env.ORIGINALS_PATH ?? '/media-originals'
};

export function assertSafePath(filePath: string): void {
	const resolved = path.resolve(filePath);
	const mediaDir = path.resolve(config.mediaPath);
	const originalsDir = path.resolve(config.originalsPath);
	if (!resolved.startsWith(mediaDir + path.sep) && !resolved.startsWith(originalsDir + path.sep) &&
		resolved !== mediaDir && resolved !== originalsDir) {
		throw new Error(`Path outside allowed directories: ${filePath}`);
	}
}
