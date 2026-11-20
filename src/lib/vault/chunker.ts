import type { Chunk, Note } from '$lib/types';
import { splitBlocks } from './markdown';

const DEFAULT_TARGET = 1600;

function chunkBaseName(path: string): string {
	const file = path.split('/').pop() ?? path;
	return file.replace(/\.(md|markdown|mdx|txt)$/i, '');
}

function makeChunk(
	note: Note,
	base: string,
	index: number,
	part: { text: string; start: number; end: number }
): Chunk {
	return {
		id: `${base}#${index}`,
		noteId: note.id,
		notePath: note.path,
		noteTitle: note.title,
		index,
		text: part.text.trim(),
		start: part.start,
		end: part.end
	};
}

/**
 * Chunk a note into ~1.5k character pieces. On-device inference has a small
 * context window, so long notes are split and later map-reduced.
 */
export function chunkNote(note: Note, target = DEFAULT_TARGET): Chunk[] {
	const base = chunkBaseName(note.path);
	const blocks = splitBlocks(note.content);
	const chunks: Chunk[] = [];
	let current: { text: string; start: number; end: number } | null = null;

	const flush = () => {
		if (!current) return;
		chunks.push(makeChunk(note, base, chunks.length, current));
		current = null;
	};

	for (const block of blocks) {
		if (block.text.length > target) {
			flush();
			for (let offset = 0; offset < block.text.length; offset += target) {
				const slice = block.text.slice(offset, offset + target);
				chunks.push(
					makeChunk(note, base, chunks.length, {
						text: slice,
						start: block.start + offset,
						end: block.start + offset + slice.length
					})
				);
			}
			continue;
		}

		if (!current) {
			current = { text: block.text, start: block.start, end: block.end };
		} else if (current.text.length + block.text.length + 2 <= target) {
			current.text += `\n\n${block.text}`;
			current.end = block.end;
		} else {
			flush();
			current = { text: block.text, start: block.start, end: block.end };
		}
	}

	flush();
	return chunks;
}

/** Chunk many notes, keeping citation ids unique across the vault. */
export function chunkVault(notes: Note[], target = 1400): Chunk[] {
	const seen = new Map<string, number>();
	const all: Chunk[] = [];

	for (const note of notes) {
		for (const chunk of chunkNote(note, target)) {
			const count = seen.get(chunk.id) ?? 0;
			seen.set(chunk.id, count + 1);
			all.push(count === 0 ? chunk : { ...chunk, id: `${chunk.id}-${count + 1}` });
		}
	}

	return all;
}

export function totalCharacters(chunks: Chunk[]): number {
	return chunks.reduce((sum, chunk) => sum + chunk.text.length, 0);
}
