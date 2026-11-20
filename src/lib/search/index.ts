import MiniSearch from 'minisearch';
import type { Note } from '$lib/types';

export interface SearchHit {
	note: Note;
	score: number;
	terms: string[];
}

export function createIndex(notes: Note[]): MiniSearch<Note> {
	const index = new MiniSearch<Note>({
		idField: 'id',
		fields: ['title', 'path', 'content'],
		storeFields: ['title', 'path', 'sensitivity'],
		searchOptions: {
			boost: { title: 3, path: 1.5 },
			fuzzy: 0.2,
			prefix: true,
			combineWith: 'AND'
		}
	});
	index.addAll(notes);
	return index;
}

export function searchNotes(index: MiniSearch<Note>, notes: Note[], query: string): SearchHit[] {
	const trimmed = query.trim();
	if (!trimmed) return [];

	const byId = new Map(notes.map((note) => [note.id, note]));
	return index
		.search(trimmed)
		.map((result) => {
			const note = byId.get(String(result.id));
			return note ? { note, score: result.score, terms: result.terms } : null;
		})
		.filter((hit): hit is SearchHit => hit !== null);
}
