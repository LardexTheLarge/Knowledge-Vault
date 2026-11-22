import type { ChatTurn, InferenceSource, Note } from '$lib/types';
import { chunkNote } from '$lib/vault/chunker';
import { createModel, prepareDeviceModel } from './models';

const SYSTEM = `You answer questions about one personal note, using only that note's text.
Be concise and concrete. If the note does not contain the answer, say so plainly.
Never invent facts, names, dates or links, and never guess beyond the note.`;

/** The on-device context window is small, so only the most relevant parts are sent. */
const MAX_CONTEXT = 6000;

export interface DeviceAnswerCallbacks {
	onProgress?: (progress: number) => void;
	onToken?: (text: string) => void;
}

export interface DeviceAnswer {
	text: string;
	source: InferenceSource;
}

/**
 * Answer a question about a private note with the on-device model. Delta (the
 * point of the privacy router) is that this path can never reach the cloud.
 */
export async function answerOnDevice(
	question: string,
	note: Note,
	history: ChatTurn[] = [],
	callbacks: DeviceAnswerCallbacks = {}
): Promise<DeviceAnswer> {
	const model = createModel({
		mode: 'ONLY_ON_DEVICE',
		systemInstruction: SYSTEM,
		maxOutputTokens: 700,
		temperature: 0.2
	});

	// The Prompt API needs user activation, so this is called from a click.
	await prepareDeviceModel(model, callbacks.onProgress);

	const context = relevantContext(note, question);
	const conversation = history
		.slice(-4)
		.map((turn) => `${turn.role === 'user' ? 'Person' : 'You'}: ${turn.text.slice(0, 400)}`)
		.join('\n\n');
	const earlier = conversation ? `Earlier in this conversation:\n\n${conversation}\n\n` : '';

	const stream = await model.generateContentStream(
		`Note: ${note.title}\n\n${context}\n\n${earlier}Question: ${question}\n\nAnswer using only this note.`
	);

	let text = '';
	for await (const chunk of stream.stream) {
		text += chunk.text();
		callbacks.onToken?.(text);
	}

	return { text: text.trim(), source: 'on-device' };
}

/** Whole note when it fits; otherwise the chunks that share the most words with the question. */
function relevantContext(note: Note, question: string): string {
	if (note.content.length <= MAX_CONTEXT) return note.content;

	const chunks = chunkNote(note, 1400);
	const terms = question.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
	const scored = chunks
		.map((chunk) => {
			const text = chunk.text.toLowerCase();
			const score = terms.reduce((sum, term) => sum + (text.includes(term) ? 1 : 0), 0);
			return { chunk, score };
		})
		.sort((a, b) => b.score - a.score);

	const parts: string[] = [];
	let used = 0;
	for (const { chunk } of scored) {
		if (parts.length > 0 && used + chunk.text.length > MAX_CONTEXT) continue;
		parts.push(chunk.text);
		used += chunk.text.length;
		if (used >= MAX_CONTEXT * 0.9) break;
	}

	return parts.length > 0 ? parts.join('\n\n---\n\n') : note.content.slice(0, MAX_CONTEXT);
}
