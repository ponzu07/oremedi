import { playerStore, type QueueItem } from '$lib/stores/player.svelte';
import { toast } from '$lib/stores/toast.svelte';

export function buildQueueItem(item: {
	id: number;
	title: string;
	category: string;
	thumbnail_path?: string | null;
}): QueueItem {
	return {
		mediaId: item.id,
		title: item.title,
		category: item.category,
		thumbnailPath: item.thumbnail_path ?? null
	};
}

export function addToQueue(item: {
	id: number;
	title: string;
	category: string;
	thumbnail_path?: string | null;
}) {
	playerStore.addToQueue(buildQueueItem(item));
	toast.show(`"${item.title}" をキューに追加`);
}

export function logout() {
	document.cookie = 'auth_token=; Max-Age=0; path=/';
	window.location.href = '/login';
}

export function formatDuration(seconds: number | null): string {
	if (!seconds) return '-';
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${String(s).padStart(2, '0')}`;
}
