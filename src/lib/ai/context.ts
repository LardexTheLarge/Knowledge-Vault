import type { Chunk } from '$lib/types';

export const MAX_CLOUD_CHUNKS = 24;
export const MAX_CLOUD_CHARACTERS = 18000;

export { chunkVault } from '$lib/vault/chunker';

export function buildSourcePrompt(chunks: Chunk[]): string {
	return chunks
		.map(
			(chunk) =>
				`[${chunk.id}] (${chunk.notePath})\n${chunk.text}`
		)
		.join('\n\n---\n\n');
}
