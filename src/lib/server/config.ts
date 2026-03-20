import { env } from '$env/dynamic/private';

export const config = {
	password: env.PASSWORD ?? '',
	jwtSecret: env.JWT_SECRET ?? '',
	databasePath: env.DATABASE_PATH ?? 'data/oremedi.db',
	mediaPath: env.MEDIA_PATH ?? '/media',
	convertedPath: env.CONVERTED_PATH ?? '/media-converted'
};
