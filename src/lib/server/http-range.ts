export function parseRangeHeader(range: string, fileSize: number): { start: number; end: number } | null {
	const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
	if (!match) return null;

	const rawStart = match[1];
	const rawEnd = match[2];
	if (!rawStart && !rawEnd) return null;

	if (!rawStart) {
		const suffixLength = Number(rawEnd);
		if (!Number.isInteger(suffixLength) || suffixLength < 0) return null;
		return {
			start: Math.max(fileSize - suffixLength, 0),
			end: fileSize - 1
		};
	}

	const start = Number(rawStart);
	if (!Number.isInteger(start) || start < 0 || start >= fileSize) return null;

	const parsedEnd = rawEnd ? Number(rawEnd) : fileSize - 1;
	if (!Number.isInteger(parsedEnd) || parsedEnd < start) return null;

	return {
		start,
		end: Math.min(parsedEnd, fileSize - 1)
	};
}
