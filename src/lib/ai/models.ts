import { getGenerativeModel, InferenceMode } from 'firebase/ai';
import { cloudModelName } from '$lib/config';
import type { InferenceSource } from '$lib/types';
import { getFirebaseAI } from './firebase';

export type AiMode = 'ONLY_ON_DEVICE' | 'ONLY_IN_CLOUD';

export interface ModelOptions {
	mode: AiMode;
	systemInstruction?: string;
	/** JSON schema built with `Schema.*`; enables structured output on both paths. */
	schema?: unknown;
	maxOutputTokens?: number;
	temperature?: number;
}

/**
 * Build a GenerativeModel for one inference mode.
 * Must be called from a user interaction: the on-device Prompt API requires it.
 */
export function createModel(options: ModelOptions) {
	const ai = getFirebaseAI();

	const generationConfig: Record<string, unknown> = {
		temperature: options.temperature ?? 0.3,
		maxOutputTokens: options.maxOutputTokens ?? 1024
	};
	if (options.schema) {
		generationConfig.responseMimeType = 'application/json';
		generationConfig.responseSchema = options.schema;
	}

	const inCloudParams: Record<string, unknown> = {
		model: cloudModelName(),
		generationConfig
	};
	if (options.systemInstruction) {
		inCloudParams.systemInstruction = options.systemInstruction;
	}

	const onDeviceParams: Record<string, unknown> = {
		createOptions: {
			expectedInputs: [{ type: 'text', languages: ['en'] }],
			expectedOutputs: [{ type: 'text', languages: ['en'] }],
			...(options.systemInstruction
				? {
						initialPrompts: [
							{
								role: 'system',
								content: [{ type: 'text', value: options.systemInstruction }]
							}
						]
					}
				: {})
		}
	};
	if (options.schema) {
		onDeviceParams.promptOptions = { responseConstraint: options.schema };
	}

	return getGenerativeModel(ai, {
		mode: options.mode === 'ONLY_ON_DEVICE' ? InferenceMode.ONLY_ON_DEVICE : InferenceMode.ONLY_IN_CLOUD,
		inCloudParams,
		onDeviceParams
	} as never) as unknown as {
		initializeDeviceModel?: (onProgress?: (progress: number) => void) => Promise<void>;
		generateContent: (prompt: unknown) => Promise<{ response: AiResponse }>;
		generateContentStream: (prompt: unknown) => Promise<{ stream: AsyncIterable<{ text: () => string; inferenceSource?: string }> }>;
	};
}

export interface AiResponse {
	text(): string;
	inferenceSource?: string;
}

/** The SDK reports the backend it actually used (`ON_DEVICE` / `IN_CLOUD`). */
export function sourceOf(response: { inferenceSource?: string } | undefined, fallback: AiMode): InferenceSource {
	const raw = String(response?.inferenceSource ?? '').toUpperCase();
	if (raw.includes('ON_DEVICE')) return 'on-device';
	if (raw.includes('IN_CLOUD')) return 'in-cloud';
	return fallback === 'ONLY_ON_DEVICE' ? 'on-device' : 'in-cloud';
}

/** Start (or wait for) the Gemini Nano download. Requires user activation. */
export async function prepareDeviceModel(
	model: ReturnType<typeof createModel>,
	onProgress?: (progress: number) => void
): Promise<void> {
	if (typeof model.initializeDeviceModel !== 'function') {
		throw new Error(
			'This version of the Firebase SDK cannot run on-device inference. Upgrade firebase to v12.5.0 or newer.'
		);
	}
	await model.initializeDeviceModel(onProgress);
}
