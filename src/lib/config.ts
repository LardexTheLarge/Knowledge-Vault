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

export function appCheckSiteKey(): string {
	return read(import.meta.env.VITE_APPCHECK_SITE_KEY);
}

export function appCheckDebugToken(): string {
	return read(import.meta.env.VITE_APPCHECK_DEBUG_TOKEN);
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
