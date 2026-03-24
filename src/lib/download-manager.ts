const DB_NAME = 'oremedi-downloads';
const DB_VERSION = 2;
const META_STORE = 'media';
const CHUNK_STORE = 'chunks';
const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB per chunk

interface DownloadMeta {
	id: number;
	title: string;
	category: string;
	contentType: string;
	totalSize: number;
	chunkCount: number;
	downloadedAt: string;
}

export type DownloadStatus = 'downloaded' | 'needs-redownload';

export interface DownloadEntry {
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
			if (!db.objectStoreNames.contains(META_STORE)) {
				db.createObjectStore(META_STORE, { keyPath: 'id' });
			}
			if (!db.objectStoreNames.contains(CHUNK_STORE)) {
				db.createObjectStore(CHUNK_STORE);
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

function putChunk(db: IDBDatabase, key: string, data: Blob): Promise<void> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(CHUNK_STORE, 'readwrite');
		tx.objectStore(CHUNK_STORE).put(data, key);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
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

	const db = await openDB();

	// Stream to IndexedDB in chunks — no large buffer accumulation
	let loaded = 0;
	let chunkIndex = 0;
	let pending: BlobPart[] = [];
	let pendingSize = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		pending.push(value);
		pendingSize += value.length;
		loaded += value.length;
		onProgress?.(loaded, contentLength);

		// Flush when accumulated enough
		if (pendingSize >= CHUNK_SIZE) {
			const blob = new Blob(pending, { type: 'application/octet-stream' });
			await putChunk(db, `${mediaId}_${chunkIndex}`, blob);
			pending = [];
			pendingSize = 0;
			chunkIndex++;
		}
	}

	// Write remaining
	if (pendingSize > 0) {
		const blob = new Blob(pending, { type: 'application/octet-stream' });
		await putChunk(db, `${mediaId}_${chunkIndex}`, blob);
		chunkIndex++;
	}
	pending = []; // free memory

	// Write metadata
	const meta: DownloadMeta = {
		id: mediaId,
		title,
		category,
		contentType,
		totalSize: loaded,
		chunkCount: chunkIndex,
		downloadedAt: new Date().toISOString()
	};

	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(META_STORE, 'readwrite');
		tx.objectStore(META_STORE).put(meta);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function getDownloadedMedia(mediaId: number): Promise<{ blob: Blob } | null> {
	const db = await openDB();

	const meta = await new Promise<DownloadMeta | undefined>((resolve, reject) => {
		const tx = db.transaction(META_STORE, 'readonly');
		const req = tx.objectStore(META_STORE).get(mediaId);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});

	if (!meta) return null;

	// v1 compatibility: if meta has a blob field directly, use it
	if ('blob' in meta && (meta as unknown as { blob: Blob }).blob instanceof Blob) {
		return { blob: (meta as unknown as { blob: Blob }).blob };
	}

	if (!meta.chunkCount) return null;

	// Reassemble chunks
	const chunks: Blob[] = [];
	for (let i = 0; i < meta.chunkCount; i++) {
		const chunk = await new Promise<Blob | undefined>((resolve, reject) => {
			const tx = db.transaction(CHUNK_STORE, 'readonly');
			const req = tx.objectStore(CHUNK_STORE).get(`${mediaId}_${i}`);
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
		if (!chunk) return null;
		chunks.push(chunk instanceof Blob ? chunk : new Blob([chunk]));
	}

	return { blob: new Blob(chunks, { type: meta.contentType }) };
}

export async function listDownloads(): Promise<DownloadEntry[]> {
	const db = await openDB();
	const tx = db.transaction(META_STORE, 'readonly');
	const store = tx.objectStore(META_STORE);

	return new Promise((resolve, reject) => {
		const request = store.getAll();
		request.onsuccess = () => {
			const entries: DownloadEntry[] = (request.result as (DownloadMeta & { size?: number; blob?: Blob })[]).map((item) => {
				const size = item.totalSize ?? item.size ?? (item.blob instanceof Blob ? item.blob.size : 0);
				return {
					id: item.id,
					title: item.title,
					category: item.category,
					status: size > 0 ? 'downloaded' : 'needs-redownload',
					size,
					downloadedAt: item.downloadedAt
				};
			});
			resolve(entries);
		};
		request.onerror = () => reject(request.error);
	});
}

export async function removeDownload(mediaId: number): Promise<void> {
	const db = await openDB();

	const meta = await new Promise<DownloadMeta | undefined>((resolve, reject) => {
		const tx = db.transaction(META_STORE, 'readonly');
		const req = tx.objectStore(META_STORE).get(mediaId);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});

	if (meta?.chunkCount) {
		for (let i = 0; i < meta.chunkCount; i++) {
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction(CHUNK_STORE, 'readwrite');
				tx.objectStore(CHUNK_STORE).delete(`${mediaId}_${i}`);
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			});
		}
	}

	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(META_STORE, 'readwrite');
		tx.objectStore(META_STORE).delete(mediaId);
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
