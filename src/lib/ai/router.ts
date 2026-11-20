import type { CloudPayload, Note } from '$lib/types';
import { buildSourcePrompt, chunkVault, MAX_CLOUD_CHUNKS, MAX_CLOUD_CHARACTERS } from './context';

export class PrivacyBlockedError extends Error {
	notes: string[];

	constructor(notes: string[]) {
		super(`Blocked: ${notes.join(', ')} marked Private`);
		this.name = 'PrivacyBlockedError';
		this.notes = notes;
	}
}

export interface CloudPlan {
	question: string;
	notes: Note[];
	payload: CloudPayload;
	chunks: ReturnType<typeof chunkVault>;
	sourceBlock: string;
}

export function privateNotesIn(notes: Note[]): Note[] {
	return notes.filter((note) => note.sensitivity === 'private');
}

/** A request must be explicitly limited to shareable notes. */
export function assertShareable(notes: Note[]): void {
	const blocked = privateNotesIn(notes);
	if (blocked.length > 0) throw new PrivacyBlockedError(blocked.map((note) => note.title));
}

/**
 * Work out exactly what a cloud request would send *before* it is sent, so the
 * approval panel can show the real payload and the request can reuse it verbatim.
 */
export function planCloudQuestion(question: string, notes: Note[]): CloudPlan {
	assertShareable(notes);

	const chunks = chunkVault(notes, 1400).slice(0, MAX_CLOUD_CHUNKS);
	let characters = 0;
	const kept = [];

	for (const chunk of chunks) {
		if (characters + chunk.text.length > MAX_CLOUD_CHARACTERS && kept.length > 0) break;
		characters += chunk.text.length;
		kept.push(chunk);
	}

	const payload: CloudPayload = {
		notes: notes.map((note) => ({ id: note.id, title: note.title, path: note.path })),
		chunkCount: kept.length,
		characters,
		preview: kept.map((chunk) => ({
			id: chunk.id,
			noteTitle: chunk.noteTitle,
			text: chunk.text
		}))
	};

	return {
		question,
		notes,
		payload,
		chunks: kept,
		sourceBlock: buildSourcePrompt(kept)
	};
}

export function payloadSummary(payload: CloudPayload): string {
	return `${payload.notes.length} note${payload.notes.length === 1 ? '' : 's'} · ${
		payload.chunkCount
	} chunk${payload.chunkCount === 1 ? '' : 's'} · ${payload.characters.toLocaleString()} characters`;
}
