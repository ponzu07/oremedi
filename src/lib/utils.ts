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

export async function logout() {
	await fetch('/api/auth/logout', { method: 'POST' });
	window.location.href = '/login';
}

export function formatDuration(seconds: number | null): string {
	if (!seconds || !isFinite(seconds)) return '-';
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
	return `${m}:${s.toString().padStart(2, '0')}`;
}

export function getGroups(
	items: any[],
	by: string,
	tagCategory?: string
): Map<string, any[]> {
	if (by === 'none') {
		return new Map([['All', items]]);
	}

	const groups = new Map<string, any[]>();
	for (const item of items) {
		let key: string;
		if (by === 'event') {
			key = item.meta?.event_name ?? 'Unknown Event';
		} else if (by === 'date') {
			key = item.meta?.date ?? item.created_at?.split('T')[0] ?? 'Unknown';
		} else {
			// Group by tag category (artist, speaker, custom, etc.)
			const category = tagCategory ?? by;
			const matchingTags = item.tags?.filter((t: any) => t.category === category) ?? [];
			key = matchingTags.map((t: any) => t.name).join(', ') || 'Unknown';
		}
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key)!.push(item);
	}
	return new Map([...groups.entries()].sort());
}
