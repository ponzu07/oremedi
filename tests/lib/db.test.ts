import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import { createDatabase } from '../../src/lib/server/db';

const TEST_DB_PATH = '/tmp/oremedi-test.db';

describe('database', () => {
	beforeEach(() => {
		if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
	});

	afterEach(() => {
		if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
	});

	it('creates database with media table', () => {
		const db = createDatabase(TEST_DB_PATH);
		const tables = db.prepare(
			"SELECT name FROM sqlite_master WHERE type='table' AND name='media'"
		).all();
		expect(tables).toHaveLength(1);
		db.close();
	});

	it('creates database with tags table', () => {
		const db = createDatabase(TEST_DB_PATH);
		const tables = db.prepare(
			"SELECT name FROM sqlite_master WHERE type='table' AND name='tags'"
		).all();
		expect(tables).toHaveLength(1);
		db.close();
	});

	it('creates database with media_tags table', () => {
		const db = createDatabase(TEST_DB_PATH);
		const tables = db.prepare(
			"SELECT name FROM sqlite_master WHERE type='table' AND name='media_tags'"
		).all();
		expect(tables).toHaveLength(1);
		db.close();
	});

	it('creates database with media_metadata table', () => {
		const db = createDatabase(TEST_DB_PATH);
		const tables = db.prepare(
			"SELECT name FROM sqlite_master WHERE type='table' AND name='media_metadata'"
		).all();
		expect(tables).toHaveLength(1);
		db.close();
	});

	it('creates indexes for common media lookups', () => {
		const db = createDatabase(TEST_DB_PATH);
		const indexes = db.prepare(`
			SELECT name FROM sqlite_master
			WHERE type = 'index' AND name IN (
				'idx_media_category_created_at',
				'idx_media_category_title',
				'idx_media_metadata_media_key',
				'idx_media_metadata_key_value_media',
				'idx_media_tags_tag_media',
				'idx_media_file_hash',
				'idx_tags_category_name'
			)
		`).all() as { name: string }[];

		expect(new Set(indexes.map((index) => index.name))).toEqual(new Set([
			'idx_media_category_created_at',
			'idx_media_category_title',
			'idx_media_file_hash',
			'idx_media_metadata_media_key',
			'idx_media_metadata_key_value_media',
			'idx_media_tags_tag_media',
			'idx_tags_category_name'
		]));
		db.close();
	});
});
