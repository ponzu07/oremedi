import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const sub = url.searchParams.get('sub');
	if (sub === 'voice') {
		const tag = url.searchParams.get('tag');
		redirect(308, tag ? `/voice?tag=${encodeURIComponent(tag)}` : '/voice');
	}
	const tag = url.searchParams.get('tag');
	redirect(308, tag ? `/music?tag=${encodeURIComponent(tag)}` : '/music');
};
