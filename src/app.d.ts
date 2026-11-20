/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_FIREBASE_API_KEY?: string;
	readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
	readonly VITE_FIREBASE_PROJECT_ID?: string;
	readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
	readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
	readonly VITE_FIREBASE_APP_ID?: string;
	readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
	readonly VITE_APPCHECK_SITE_KEY?: string;
	readonly VITE_APPCHECK_DEBUG_TOKEN?: string;
	readonly VITE_CLOUD_MODEL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

interface Window {
	showDirectoryPicker?: (options?: {
		mode?: 'read' | 'readwrite';
		id?: string;
		startIn?: string;
	}) => Promise<FileSystemDirectoryHandle>;
}

declare namespace App {
	// interface Locals {}
}
