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
});
