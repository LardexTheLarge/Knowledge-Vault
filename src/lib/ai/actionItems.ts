import { Schema } from 'firebase/ai';
import type { ActionResult, ActionItem, Note } from '$lib/types';
import { createModel, prepareDeviceModel, sourceOf, type AiResponse } from './models';

const schema = Schema.object({
	properties: {
		items: Schema.array({
			items: Schema.object({
				properties: {
					task: Schema.string(),
					sourceLine: Schema.string(),
					owner: Schema.string(),
					due: Schema.string()
				},
				optionalProperties: ['owner', 'due']
			})
		})
	}
});

const SYSTEM = `You extract concrete action items from a personal note.
Only include real, actionable tasks. Copy the exact source line that implies each task.
Leave owner or due out when the note does not state them. Never invent details.`;

/** On-device context is small, so only the first ~8k characters are read. */
const MAX_INPUT = 8000;

export async function extractActionItems(note: Note): Promise<ActionResult> {
	const model = createModel({
		mode: 'ONLY_ON_DEVICE',
		systemInstruction: SYSTEM,
		schema,
		maxOutputTokens: 700,
		temperature: 0.1
	});

	await prepareDeviceModel(model);

	const input = note.content.slice(0, MAX_INPUT);
	const prompt = `Note title: ${note.title}\n\n${input}\n\nExtract the action items as JSON.`;

	const result = await model.generateContent(prompt);
	const source = sourceOf(result.response as AiResponse, 'ONLY_ON_DEVICE');
	const parsed = parseItems(result.response.text());

	return { items: parsed, source };
}

function asString(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function parseItems(raw: string): ActionItem[] {
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		const start = raw.indexOf('{');
		const end = raw.lastIndexOf('}');
		if (start === -1 || end <= start) return [];
		try {
			data = JSON.parse(raw.slice(start, end + 1));
		} catch {
			return [];
		}
	}

	const items = (data as { items?: unknown })?.items;
	if (!Array.isArray(items)) return [];

	const parsed: ActionItem[] = [];
	for (const item of items) {
		const record = item as Record<string, unknown>;
		const task = asString(record.task);
		if (!task) continue;
		parsed.push({
			task,
			sourceLine: asString(record.sourceLine) ?? task,
			owner: asString(record.owner),
			due: asString(record.due)
		});
	}

	return parsed.slice(0, 30);
}
