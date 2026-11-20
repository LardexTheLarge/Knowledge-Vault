import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAI, GoogleAIBackend, type AI } from 'firebase/ai';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import {
	appCheckDebugToken,
	appCheckSiteKey,
	firebaseConfig,
	isFirebaseConfigured,
	missingFirebaseVars
} from '$lib/config';

export class AiSetupError extends Error {
	missing: string[];

	constructor(missing: string[]) {
		super(
			missing.length > 0
				? `Firebase AI Logic is not configured yet. Add ${missing.join(', ')} to .env and restart the dev server.`
				: 'Firebase AI Logic is not configured yet.'
		);
		this.name = 'AiSetupError';
		this.missing = missing;
	}
}

let cachedApp: FirebaseApp | null = null;
let cachedAI: AI | null = null;
let appCheckReady = false;

function ensureAppCheck(app: FirebaseApp): void {
	if (appCheckReady) return;
	const siteKey = appCheckSiteKey();
	if (!siteKey) return;

	const debug = appCheckDebugToken();
	if (debug) {
		// The debug provider must be enabled before App Check is initialized.
		(self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN =
			debug === 'true' ? true : debug;
	}

	initializeAppCheck(app, {
		provider: new ReCaptchaEnterpriseProvider(siteKey),
		isTokenAutoRefreshEnabled: true
	});
	appCheckReady = true;
}

export function getFirebaseApp(): FirebaseApp {
	if (cachedApp) return cachedApp;
	if (!isFirebaseConfigured()) throw new AiSetupError(missingFirebaseVars());

	const existing = getApps()[0];
	cachedApp = existing ?? initializeApp(firebaseConfig());
	ensureAppCheck(cachedApp);
	return cachedApp;
}

export function getFirebaseAI(): AI {
	if (cachedAI) return cachedAI;
	cachedAI = getAI(getFirebaseApp(), { backend: new GoogleAIBackend() });
	return cachedAI;
}

export function appCheckConfigured(): boolean {
	return appCheckSiteKey().length > 0;
}
