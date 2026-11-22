export type Sensitivity = 'private' | 'shareable';

export type InferenceSource = 'on-device' | 'in-cloud';

export interface Note {
	/** Stable id: the vault-relative path (also used as the IndexedDB key). */
	id: string;
	/** Vault-relative path, e.g. `projects/launch-plan.md`. */
	path: string;
	title: string;
	/** Markdown body with any frontmatter already stripped. */
	content: string;
	sensitivity: Sensitivity;
	source: 'sample' | 'folder';
	updatedAt?: number;
}

export interface Chunk {
	/** Citation id in the form `note-name#3`. */
	id: string;
	noteId: string;
	notePath: string;
	noteTitle: string;
	index: number;
	text: string;
	/** Character offsets into the note body, used for in-document highlighting. */
	start: number;
	end: number;
}

export interface CloudPayload {
	notes: { id: string; title: string; path: string }[];
	chunkCount: number;
	characters: number;
	preview: { id: string; noteTitle: string; text: string }[];
}

export interface Claim {
	text: string;
	chunkIds: string[];
}

export interface CitedAnswer {
	answer: string;
	claims: Claim[];
	source: InferenceSource;
}

export interface ActionItem {
	task: string;
	owner?: string;
	due?: string;
	sourceLine: string;
}

export interface SummaryResult {
	text: string;
	source: InferenceSource;
	chunkCount: number;
	reduced: boolean;
}

export interface ActionResult {
	items: ActionItem[];
	source: InferenceSource;
}

export type ResultCard =
	| {
			kind: 'summary';
			id: string;
			noteId: string;
			noteTitle: string;
			text: string;
			source: InferenceSource;
			chunkCount: number;
			reduced: boolean;
	  }
	| {
			kind: 'actions';
			id: string;
			noteId: string;
			noteTitle: string;
			items: ActionItem[];
			source: InferenceSource;
	  }
	| {
			kind: 'answer';
			id: string;
			question: string;
			text: string;
			claims: Claim[];
			source: InferenceSource;
			chunks: Chunk[];
	  };

export interface ChatTurn {
	role: 'user' | 'assistant';
	text: string;
}

/** One turn in a chat transcript: a question, an answer, a summary or action items. */
export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant';
	kind: 'question' | 'answer' | 'summary' | 'actions';
	text: string;
	source?: InferenceSource;
	claims?: Claim[];
	chunks?: Chunk[];
	items?: ActionItem[];
	noteTitle?: string;
	chunkCount?: number;
	reduced?: boolean;
}

export interface DeviceStatus {
	state: 'unknown' | 'checking' | 'unavailable' | 'downloadable' | 'downloading' | 'available' | 'unsupported-browser';
	progress?: number;
	detail?: string;
}
