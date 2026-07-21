import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import { createDatabase } from '../../src/lib/server/db';
import { saveChapters, getChapters, isValidChapterArray } from '../../src/lib/server/chapters';

const TEST_DB_PATH = '/tmp/oremedi-chapters-test.db';

describe('chapters', () => {
	let db: ReturnType<typeof createDatabase>;

	beforeEach(() => {
		if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
		db = createDatabase(TEST_DB_PATH);
		db.prepare('INSERT INTO media (title, category, original_path) VALUES (?, ?, ?)')
			.run('M', 'movie', '/media/m.mp4');
	});

	afterEach(() => {
		db.close();
		if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
	});

	it('validates chapter arrays', () => {
		expect(isValidChapterArray([{ start_time: 0, end_time: 10, title: 'A' }])).toBe(true);
		expect(isValidChapterArray([])).toBe(true);
		expect(isValidChapterArray({})).toBe(false);
		expect(isValidChapterArray(null)).toBe(false);
		expect(isValidChapterArray([{ start_time: '0', end_time: 10, title: 'A' }])).toBe(false);
		expect(isValidChapterArray([{ start_time: 0, title: 'A' }])).toBe(false);
	});

	it('saves and retrieves chapters ordered by start_time', () => {
		saveChapters(db, 1, [
			{ start_time: 30, end_time: 60, title: 'Second' },
			{ start_time: 0, end_time: 30, title: 'First' }
		]);
		const rows = getChapters(db, 1);
		expect(rows.map((c) => c.title)).toEqual(['First', 'Second']);
	});

	it('replaces chapters atomically (empty array clears them)', () => {
		saveChapters(db, 1, [{ start_time: 0, end_time: 10, title: 'A' }]);
		expect(getChapters(db, 1)).toHaveLength(1);
		saveChapters(db, 1, []);
		expect(getChapters(db, 1)).toHaveLength(0);
	});
});
