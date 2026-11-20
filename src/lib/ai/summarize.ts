import type { Note, SummaryResult } from '$lib/types';
import { chunkNote } from '$lib/vault/chunker';
import { createModel, prepareDeviceModel, sourceOf, type AiResponse } from './models';

const SYSTEM = `You summarize personal notes faithfully.
Write 3–5 short sentences of plain prose. No preamble, no markdown headings, no invented facts.
If the note is mostly a list, summarize what the list is for.`;

export interface StreamCallbacks {
	onProgress?: (progress: number) => void;
	onToken?: (text: string) => void;
}

export async function summarizeNote(
	note: Note,
	callbacks: StreamCallbacks = {}
): Promise<SummaryResult> {
	const model = createModel({
		mode: 'ONLY_ON_DEVICE',
		systemInstruction: SYSTEM,
		maxOutputTokens: 480,
		temperature: 0.2
	});

	// On-device requires a user gesture (this runs from a click) before inference.
	await prepareDeviceModel(model, callbacks.onProgress);

	const chunks = chunkNote(note, 1600);
	let source = 'on-device' as SummaryResult['source'];

	if (chunks.length <= 1) {
		const prompt = `Note title: ${note.title}\n\n${chunks[0]?.text ?? note.content}\n\nSummarize this note.`;
		const stream = await model.generateContentStream(prompt);
		const text = await readStream(stream.stream, callbacks.onToken);
		return { text: clean(text), source, chunkCount: chunks.length, reduced: false };
	}

	// Long note: summarize each chunk on-device, then summarize the summaries.
	callbacks.onProgress?.(0.05);
	const partials: string[] = [];

	for (const [index, chunk] of chunks.entries()) {
		const result = await model.generateContent(
			`Part ${index + 1} of ${chunks.length} of the note "${note.title}".\n\n${chunk.text}\n\nSummarize this part in 2 sentences.`
		);
		source = sourceOf(result.response as AiResponse, 'ONLY_ON_DEVICE');
		partials.push(result.response.text().trim());
		callbacks.onProgress?.(0.05 + (0.75 * (index + 1)) / chunks.length);
	}

	const reducePrompt = `Partial summaries of "${note.title}":\n\n${partials
		.map((part, index) => `${index + 1}. ${part}`)
		.join('\n\n')}\n\nCombine these into one coherent 3–5 sentence summary.`;
	const stream = await model.generateContentStream(reducePrompt);
	const text = await readStream(stream.stream, callbacks.onToken);

	return { text: clean(text), source, chunkCount: chunks.length, reduced: true };
}

async function readStream(
	stream: AsyncIterable<{ text: () => string; inferenceSource?: string }>,
	onToken?: (text: string) => void
): Promise<string> {
	let text = '';
	for await (const chunk of stream) {
		text += chunk.text();
		onToken?.(text);
	}
	return text;
}

function clean(text: string): string {
	return text.trim().replace(/^```[a-z]*\n?/i, '').replace(/```$/,'').trim();
}
