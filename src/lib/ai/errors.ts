import { AiSetupError } from './firebase';
import { PrivacyBlockedError } from './router';

export interface FriendlyError {
	title: string;
	detail: string;
	hint: string;
	kind: 'setup' | 'privacy' | 'device' | 'app-check' | 'quota' | 'network' | 'unknown';
}

export function describeAiError(error: unknown): FriendlyError {
	if (error instanceof AiSetupError) {
		return {
			kind: 'setup',
			title: 'Firebase AI Logic is not configured',
			detail: error.message,
			hint: 'Open Setup & API keys and add the missing values to .env, then restart the dev server.'
		};
	}

	if (error instanceof PrivacyBlockedError) {
		return {
			kind: 'privacy',
			title: 'Blocked by the Privacy Router',
			detail: `${error.notes.join(', ')} ${error.notes.length === 1 ? 'is' : 'are'} marked Private, so ${
				error.notes.length === 1 ? 'it was' : 'they were'
			} not sent anywhere.`,
			hint: 'Change a note to Shareable if you want to include it in a cloud request.'
		};
	}

	const message = error instanceof Error ? error.message : String(error);
	const lower = message.toLowerCase();

	if (lower.includes('app check') || lower.includes('appcheck') || lower.includes('app-check')) {
		return {
			kind: 'app-check',
			title: 'App Check rejected the request',
			detail: message,
			hint: 'App Check is enforced for AI Logic. Set VITE_APPCHECK_SITE_KEY, and on localhost set VITE_APPCHECK_DEBUG_TOKEN=true then safelist the debug token in the Firebase console.'
		};
	}

	if (
		lower.includes('on-device') ||
		lower.includes('on device') ||
		lower.includes('prompt api') ||
		lower.includes('not available') ||
		lower.includes('unavailable') ||
		lower.includes('not supported')
	) {
		return {
			kind: 'device',
			title: 'The on-device model is unavailable',
			detail: message,
			hint: 'Private notes never fall back to the cloud. Use Chrome 139+ on desktop, enable the Prompt API flag at chrome://flags, and download the model from the status chip in the header.'
		};
	}

	if (lower.includes('quota') || lower.includes('429') || lower.includes('rate limit')) {
		return {
			kind: 'quota',
			title: 'Cloud quota reached',
			detail: message,
			hint: 'Wait a moment or check Firebase AI Logic usage and quotas in the Firebase console.'
		};
	}

	if (lower.includes('fetch') || lower.includes('network') || lower.includes('offline')) {
		return {
			kind: 'network',
			title: 'The cloud call could not reach Firebase',
			detail: message,
			hint: 'Cloud features need a connection. Local search and on-device features keep working offline.'
		};
	}

	return {
		kind: 'unknown',
		title: 'Something went wrong',
		detail: message,
		hint: 'Check the browser console for the full error, and confirm your Firebase project has AI Logic enabled.'
	};
}
