const read = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export function firebaseConfig() {
	return {
		apiKey: read(import.meta.env.VITE_FIREBASE_API_KEY),
		authDomain: read(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
		projectId: read(import.meta.env.VITE_FIREBASE_PROJECT_ID),
		storageBucket: read(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
		messagingSenderId: read(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
		appId: read(import.meta.env.VITE_FIREBASE_APP_ID),
		measurementId: read(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID)
	};
}

/** The three values the SDK cannot start without. */
export const REQUIRED_FIREBASE_VARS = [
	'VITE_FIREBASE_API_KEY',
	'VITE_FIREBASE_PROJECT_ID',
	'VITE_FIREBASE_APP_ID'
] as const;

export function isFirebaseConfigured(): boolean {
	const config = firebaseConfig();
	return Boolean(config.apiKey && config.projectId && config.appId);
}

export function missingFirebaseVars(): string[] {
	const config = firebaseConfig();
	const missing: string[] = [];
	if (!config.apiKey) missing.push('VITE_FIREBASE_API_KEY');
	if (!config.projectId) missing.push('VITE_FIREBASE_PROJECT_ID');
	if (!config.appId) missing.push('VITE_FIREBASE_APP_ID');
	return missing;
}

/**
 * A Firebase web API key is the `apiKey` of the Web app config: `AIza…`, 39
 * characters. Catches the usual paste mistakes before a cloud call does.
 */
export function apiKeyProblem(): string | null {
	const key = firebaseConfig().apiKey;
	if (!key) return null;
	if (/\s/.test(key)) {
		return 'The key contains whitespace. Keep it on one line as VITE_FIREBASE_API_KEY=AIza…';
	}
	if (!key.startsWith('AIza')) {
		return 'This does not look like a Firebase web API key — it starts with something other than "AIza". An App Check site key (6L…), an App Check debug token or an appId will be rejected with API_KEY_INVALID.';
	}
	if (key.length !== 39) {
		return `This key is ${key.length} characters; a Firebase web API key is 39. It was probably truncated on paste or has extra text on the line.`;
	}
	return null;
}

export function appCheckSiteKey(): string {
	return read(import.meta.env.VITE_APPCHECK_SITE_KEY);
}

/**
 * `true` means "generate a token and print it in the console"; any other value is
 * used as a literal debug token copied from the Firebase console.
 *
 * Values in `.env` are always strings, so `true` arrives as the string `"true"`.
 * `True`, `TRUE` and `1` are accepted too: otherwise the SDK treats the word
 * itself as a token, never prints a UUID, and every exchange fails with 403.
 */
export function appCheckDebugToken(): true | string | undefined {
	const raw = read(import.meta.env.VITE_APPCHECK_DEBUG_TOKEN);
	if (!raw) return undefined;
	return /^(true|1|yes)$/i.test(raw) ? true : raw;
}

/**
 * AI Logic enforces App Check. A reCAPTCHA Enterprise site key is the production
 * provider; on localhost Firebase also accepts the debug provider alone, so either
 * value is enough for App Check to be active.
 */
export function appCheckConfigured(): boolean {
	return appCheckSiteKey().length > 0 || appCheckDebugToken() !== undefined;
}

export function cloudModelName(): string {
	return read(import.meta.env.VITE_CLOUD_MODEL) || 'gemini-3.5-flash-lite';
}

export interface EnvVarInfo {
	name: string;
	label: string;
	required: boolean;
	where: string;
	present: boolean;
}

/**
 * Everything the app reads from `.env`. The in-app Setup panel renders this list,
 * so a missing key is always one click away from being explained.
 */
export function envStatus(): EnvVarInfo[] {
	const present = (name: keyof ImportMetaEnv) => read(import.meta.env[name]).length > 0;
	return [
		{
			name: 'VITE_FIREBASE_API_KEY',
			label: 'Web API key',
			required: true,
			where: 'Firebase console → Project settings → General → Your apps → Web app → apiKey',
			present: present('VITE_FIREBASE_API_KEY')
		},
		{
			name: 'VITE_FIREBASE_PROJECT_ID',
			label: 'Project ID',
			required: true,
			where: 'Firebase console → Project settings → General → projectId',
			present: present('VITE_FIREBASE_PROJECT_ID')
		},
		{
			name: 'VITE_FIREBASE_APP_ID',
			label: 'App ID',
			required: true,
			where: 'Firebase console → Project settings → General → Your apps → Web app → appId',
			present: present('VITE_FIREBASE_APP_ID')
		},
		{
			name: 'VITE_FIREBASE_AUTH_DOMAIN',
			label: 'Auth domain',
			required: false,
			where: 'Same Firebase config block → authDomain',
			present: present('VITE_FIREBASE_AUTH_DOMAIN')
		},
		{
			name: 'VITE_FIREBASE_STORAGE_BUCKET',
			label: 'Storage bucket',
			required: false,
			where: 'Same Firebase config block → storageBucket',
			present: present('VITE_FIREBASE_STORAGE_BUCKET')
		},
		{
			name: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
			label: 'Messaging sender ID',
			required: false,
			where: 'Same Firebase config block → messagingSenderId',
			present: present('VITE_FIREBASE_MESSAGING_SENDER_ID')
		},
		{
			name: 'VITE_FIREBASE_MEASUREMENT_ID',
			label: 'Analytics measurement ID',
			required: false,
			where: 'Same Firebase config block → measurementId',
			present: present('VITE_FIREBASE_MEASUREMENT_ID')
		},
		{
			name: 'VITE_APPCHECK_SITE_KEY',
			label: 'App Check reCAPTCHA Enterprise key',
			required: true,
			where: 'Firebase console → Security → App Check → Apps → your web app → reCAPTCHA Enterprise site key',
			present: present('VITE_APPCHECK_SITE_KEY')
		},
		{
			name: 'VITE_APPCHECK_DEBUG_TOKEN',
			label: 'App Check debug token (local dev only)',
			required: false,
			where: 'Set to `true` on localhost, then safelist the token Firebase prints in the console',
			present: present('VITE_APPCHECK_DEBUG_TOKEN')
		},
		{
			name: 'VITE_CLOUD_MODEL',
			label: 'Cloud model name override',
			required: false,
			where: 'Optional. Defaults to gemini-3.5-flash-lite',
			present: present('VITE_CLOUD_MODEL')
		}
	];
}
