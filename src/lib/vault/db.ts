import { openDB, type IDBPDatabase } from 'idb';
import type { Note } from '$lib/types';

const DB_NAME = 'knowledge-vault';
const DB_VERSION = 1;

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

export async function saveNotes(notes: Note[]): Promise<void> {
	const instance = await db();
	const tx = instance.transaction('notes', 'readwrite');
	await tx.store.clear();
	await Promise.all(notes.map((note) => tx.store.put(note)));
	await tx.done;
}

export async function saveNote(note: Note): Promise<void> {
	const instance = await db();
	await instance.put('notes', note);
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
