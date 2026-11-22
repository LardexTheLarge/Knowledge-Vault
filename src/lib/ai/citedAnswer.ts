import { Schema } from 'firebase/ai';
import type { ChatTurn, Chunk, CitedAnswer, Claim } from '$lib/types';
import { createModel, sourceOf, type AiResponse } from './models';

const schema = Schema.object({
	properties: {
		answer: Schema.string(),
		claims: Schema.array({
			items: Schema.object({
				properties: {
					text: Schema.string(),
					chunkIds: Schema.array({ items: Schema.string() })
				}
			})
		})
	}
});

const SYSTEM = `You answer questions about a person's notes, using only the excerpts provided.
Rules:
- Cite evidence for every substantive claim with the excerpt ids in square brackets, e.g. "launch-plan#2".
- Only use ids that appear in the excerpts. Never invent an id.
- If the excerpts do not answer the question, say so plainly and suggest what is missing.
- Earlier turns of the conversation are context only: cite the excerpts, never the earlier answers.
- Be concise: 2–5 sentences, then the supporting claims.`;

export async function answerWithChunks(
	question: string,
	chunks: Chunk[],
	history: ChatTurn[] = []
): Promise<CitedAnswer> {
	const model = createModel({
		mode: 'ONLY_IN_CLOUD',
		systemInstruction: SYSTEM,
		schema,
		maxOutputTokens: 1200,
		temperature: 0.25
	});

	const sourceBlock = chunks.map((chunk) => `[${chunk.id}] (${chunk.notePath})\n${chunk.text}`).join('\n\n---\n\n');
	const conversation = history
		.slice(-6)
		.map(
			(turn) =>
				`${turn.role === 'user' ? 'Person' : 'You'}: ${turn.text.slice(0, 600)}`
		)
		.join('\n\n');
	const earlier = conversation ? `Earlier in this conversation:\n\n${conversation}\n\n` : '';
	const prompt = `Vault excerpts:\n\n${sourceBlock}\n\n${earlier}Question: ${question}\n\nAnswer using only these excerpts and cite excerpt ids.`;

	const result = await model.generateContent(prompt);
	const source = sourceOf(result.response as AiResponse, 'ONLY_IN_CLOUD');

	const { answer, claims } = parseAnswer(result.response.text(), chunks);
	if (!answer) {
		return {
			answer:
				'The model did not return a usable answer. Try rephrasing the question or selecting more notes.',
			claims: [],
			source
		};
	}

	return { answer, claims, source };
}

function parseAnswer(
	raw: string,
	chunks: Chunk[]
): { answer: string; claims: Claim[] } {
	const validIds = new Set(chunks.map((chunk) => chunk.id));
	let data: { answer?: unknown; claims?: unknown } | null = null;

	try {
		data = JSON.parse(raw);
	} catch {
		const start = raw.indexOf('{');
		const end = raw.lastIndexOf('}');
		if (start !== -1 && end > start) {
			try {
				data = JSON.parse(raw.slice(start, end + 1));
			} catch {
				data = null;
			}
		}
	}

	if (!data) return { answer: raw.trim(), claims: [] };

	const answer = typeof data.answer === 'string' ? data.answer.trim() : '';
	const claims: Claim[] = Array.isArray(data.claims)
		? data.claims
				.map((claim) => {
					const record = claim as Record<string, unknown>;
					const text = typeof record.text === 'string' ? record.text.trim() : '';
					const ids = Array.isArray(record.chunkIds)
						? (record.chunkIds as unknown[]).filter(
								(id): id is string => typeof id === 'string' && validIds.has(id)
							)
						: [];
					// Drop invented citations and claims that lost all their evidence.
					return text && ids.length > 0 ? { text, chunkIds: Array.from(new Set(ids)) } : null;
				})
				.filter((claim): claim is Claim => claim !== null)
		: [];

	return { answer, claims };
}
