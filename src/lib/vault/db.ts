import { openDB, type IDBPDatabase } from 'idb';
import type { Note, Sensitivity } from '$lib/types';

const DB_NAME = 'knowledge-vault';
const DB_VERSION = 1;
const TAGS_PREFIX = 'sensitivity:';

let database: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
	database ??= openDB(DB_NAME, DB_VERSION, {
		upgrade(instance) {
			if (!instance.objectStoreNames.contains('notes')) {
				instance.createObjectStore('notes', { keyPath: 'id' });
			}
			if (!instance.objectStoreNames.contains('meta')) {
				instance.createObjectStore('meta');
			}
		}
	});
	return database;
}

/**
 * Rebuild a note as a plain object before it is stored.
 *
 * Svelte's `$state` hands out deep proxies, and IndexedDB's structured clone
 * cannot copy a proxy: `put()` throws `DataCloneError: #<Object> could not be
 * cloned`. Copying field by field keeps every write cloneable no matter what
 * the caller passes in.
 */
function toRow(note: Note): Note {
	const row: Note = {
		id: String(note.id),
		path: note.path,
		title: note.title,
		content: note.content,
		sensitivity: note.sensitivity === 'shareable' ? 'shareable' : 'private',
		source: note.source === 'sample' ? 'sample' : 'folder'
	};
	if (typeof note.updatedAt === 'number' && Number.isFinite(note.updatedAt)) {
		row.updatedAt = note.updatedAt;
	}
	return row;
}

export async function saveNotes(notes: Note[]): Promise<void> {
	const instance = await db();
	const rows = notes.map(toRow);
	const tx = instance.transaction('notes', 'readwrite');
	await tx.store.clear();
	await Promise.all(rows.map((row) => tx.store.put(row)));
	await tx.done;
}

export async function saveNote(note: Note): Promise<void> {
	const instance = await db();
	await instance.put('notes', toRow(note));
}

export async function loadNotes(): Promise<Note[]> {
	const instance = await db();
	return (await instance.getAll('notes')) as Note[];
}

export async function clearNotes(): Promise<void> {
	const instance = await db();
	await instance.clear('notes');
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
	const instance = await db();
	return (await instance.get('meta', key)) as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
	const instance = await db();
	await instance.put('meta', value, key);
}

export type SensitivityMap = Record<string, Sensitivity>;

/**
 * The Private/Shareable label the user gave each file, remembered per vault so
 * that opening another folder and coming back does not reset the labels.
 * Keyed by the note's vault-relative path.
 */
export async function loadSensitivity(vaultKey: string): Promise<SensitivityMap> {
	const stored = await getMeta<SensitivityMap>(`${TAGS_PREFIX}${vaultKey}`);
	const tags: SensitivityMap = {};
	if (!stored || typeof stored !== 'object') return tags;
	for (const [path, value] of Object.entries(stored)) {
		if (value === 'private' || value === 'shareable') tags[path] = value;
	}
	return tags;
}

export async function saveSensitivity(vaultKey: string, tags: SensitivityMap): Promise<void> {
	const clean: SensitivityMap = {};
	for (const [path, value] of Object.entries(tags)) {
		if (value === 'private' || value === 'shareable') clean[path] = value;
	}
	await setMeta(`${TAGS_PREFIX}${vaultKey}`, clean);
}
