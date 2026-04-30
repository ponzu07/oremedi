import fs from 'fs';
import crypto from 'crypto';

const HASH_BYTES = 64 * 1024; // 先頭64KBでハッシュ（高速化）

export function computeFileHash(filePath: string): string | null {
	try {
		const fd = fs.openSync(filePath, 'r');
		const buf = Buffer.alloc(HASH_BYTES);
		const bytesRead = fs.readSync(fd, buf, 0, HASH_BYTES, 0);
		fs.closeSync(fd);
		return crypto.createHash('sha256').update(buf.subarray(0, bytesRead)).digest('hex');
	} catch {
		return null;
	}
}

export async function computeFileHashAsync(filePath: string): Promise<string | null> {
	let handle: fs.promises.FileHandle | null = null;

	try {
		handle = await fs.promises.open(filePath, 'r');
		const buf = Buffer.alloc(HASH_BYTES);
		const { bytesRead } = await handle.read(buf, 0, HASH_BYTES, 0);
		return crypto.createHash('sha256').update(buf.subarray(0, bytesRead)).digest('hex');
	} catch {
		return null;
	} finally {
		await handle?.close().catch(() => undefined);
	}
}
