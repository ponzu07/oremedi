const DB_NAME = 'oremedi-downloads';
const DB_VERSION = 1;
const STORE_NAME = 'media';

interface DownloadedMedia {
	id: number;
	title: string;
	category: string;
	blob: Blob;
	mimeType: string;
	downloadedAt: string;
	size: number;
}

export type DownloadStatus = 'available' | 'downloading' | 'downloaded' | 'needs-redownload';

interface DownloadEntry {
	id: number;
	title: string;
	category: string;
	status: DownloadStatus;
	size: number;
	downloadedAt: string;
}

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: 'id' });
			}
		};

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

export async function requestPersistentStorage(): Promise<boolean> {
	if (navigator.storage && navigator.storage.persist) {
		return navigator.storage.persist();
	}
	return false;
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number }> {
	if (navigator.storage && navigator.storage.estimate) {
		const estimate = await navigator.storage.estimate();
		return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
	}
	return { usage: 0, quota: 0 };
}

export async function downloadMedia(
	mediaId: number,
	title: string,
	category: string,
	onProgress?: (loaded: number, total: number) => void
): Promise<void> {
	const response = await fetch(`/api/media/${mediaId}/download`);
	if (!response.ok) throw new Error('Download failed');

	const contentLength = Number(response.headers.get('content-length'));
	const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
	const reader = response.body?.getReader();

	if (!reader) throw new Error('No response body');

	const chunks: BlobPart[] = [];
	let loaded = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		loaded += value.length;
		onProgress?.(loaded, contentLength);
	}

	const blob = new Blob(chunks, { type: contentType });

	const db = await openDB();
	const tx = db.transaction(STORE_NAME, 'readwrite');
	const store = tx.objectStore(STORE_NAME);

	const entry: DownloadedMedia = {
		id: mediaId,
		title,
		category,
		blob,
		mimeType: contentType,
		downloadedAt: new Date().toISOString(),
		size: blob.size
	};

	store.put(entry);
	await new Promise<void>((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function getDownloadedMedia(mediaId: number): Promise<DownloadedMedia | null> {
	const db = await openDB();
	const tx = db.transaction(STORE_NAME, 'readonly');
	const store = tx.objectStore(STORE_NAME);

	return new Promise((resolve, reject) => {
		const request = store.get(mediaId);
		request.onsuccess = () => resolve(request.result ?? null);
		request.onerror = () => reject(request.error);
	});
}

export async function getDownloadedMediaUrl(mediaId: number): Promise<string | null> {
	const media = await getDownloadedMedia(mediaId);
	if (!media) return null;
	return URL.createObjectURL(media.blob);
}

export async function listDownloads(): Promise<DownloadEntry[]> {
	const db = await openDB();
	const tx = db.transaction(STORE_NAME, 'readonly');
	const store = tx.objectStore(STORE_NAME);

	return new Promise((resolve, reject) => {
		const request = store.getAll();
		request.onsuccess = () => {
			const entries: DownloadEntry[] = (request.result as DownloadedMedia[]).map((item) => ({
				id: item.id,
				title: item.title,
				category: item.category,
				status: item.blob.size > 0 ? 'downloaded' : 'needs-redownload',
				size: item.size,
				downloadedAt: item.downloadedAt
			}));
			resolve(entries);
		};
		request.onerror = () => reject(request.error);
	});
}

export async function removeDownload(mediaId: number): Promise<void> {
	const db = await openDB();
	const tx = db.transaction(STORE_NAME, 'readwrite');
	const store = tx.objectStore(STORE_NAME);
	store.delete(mediaId);
	await new Promise<void>((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export function formatSize(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
