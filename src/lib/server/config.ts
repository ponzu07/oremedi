import { env } from '$env/dynamic/private';

export const config = {
	passwordHash: env.PASSWORD_HASH ?? '',
	jwtSecret: env.JWT_SECRET ?? '',
	databasePath: env.DATABASE_PATH ?? 'data/oremedi.db',
	mediaPath: env.MEDIA_PATH ?? '/media',
	convertedPath: env.CONVERTED_PATH ?? '/media-converted'
};
