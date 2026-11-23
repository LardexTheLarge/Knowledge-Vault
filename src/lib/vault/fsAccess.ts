import type { Note, Sensitivity } from '$lib/types';
import { parseFrontmatter } from './markdown';
import { extractPdfText } from './pdf';

const TEXT_EXTENSIONS = /\.(md|markdown|mdx|txt)$/i;
const PDF_EXTENSIONS = /\.pdf$/i;
const NOTE_EXTENSIONS = /\.(md|markdown|mdx|txt|pdf)$/i;
const MAX_FILES = 600;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_PDF_BYTES = 30 * 1024 * 1024;
const MAX_DEPTH = 12;

/**
 * Folders that only ever contain installed packages and build output. Walking
 * into them is what made a project folder (a Python or Node repo) take forever
 * or stop at the file limit before reaching the notes.
 */
const SKIP_DIRECTORIES = new Set([
	'node_modules',
	'__pycache__',
	'site-packages',
	'bower_components',
	'venv',
	'coverage',
	'dist',
	'build',
	'target',
	'.git',
	'.next',
	'.svelte-kit'
]);

export class FolderAccessError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'FolderAccessError';
	}
}

/** Closing the picker is a choice, not a failure worth a dialog. */
export class FolderPickerCancelled extends FolderAccessError {
	constructor() {
		super('Folder picker cancelled.');
		this.name = 'FolderPickerCancelled';
	}
}

export interface VaultFolder {
	notes: Note[];
	name: string;
	/** Things that were skipped, phrased for the person who picked the folder. */
	warnings: string[];
}

function titleFor(path: string, body: string, explicit?: string): string {
	if (explicit) return explicit;
	const heading = body.match(/^#\s+(.+)$/m);
	if (heading) return heading[1].trim();
	const file = path.split('/').pop() ?? path;
	return file.replace(NOTE_EXTENSIONS, '').replace(/[-_]/g, ' ');
}

function sensitivityFor(value: string | undefined): Sensitivity {
	// Private by default: a vault note is never shareable unless it says so.
	return value?.toLowerCase() === 'shareable' ? 'shareable' : 'private';
}

interface WalkState {
	entries: { path: string; file: FileSystemFileHandle }[];
	unreadable: number;
	capped: boolean;
}

async function walk(
	directory: FileSystemDirectoryHandle,
	prefix: string,
	depth: number,
	state: WalkState
): Promise<void> {
	if (state.capped || depth > MAX_DEPTH) return;

	try {
		for await (const [name, handle] of directory.entries()) {
			if (state.capped) return;
			if (name.startsWith('.') || SKIP_DIRECTORIES.has(name.toLowerCase())) continue;

			if (handle.kind === 'directory') {
				await walk(handle as FileSystemDirectoryHandle, `${prefix}${name}/`, depth + 1, state);
				continue;
			}

			if (!TEXT_EXTENSIONS.test(name) && !PDF_EXTENSIONS.test(name)) continue;
			state.entries.push({ path: `${prefix}${name}`, file: handle as FileSystemFileHandle });
			if (state.entries.length >= MAX_FILES) {
				state.capped = true;
				return;
			}
		}
	} catch {
		// A folder that vanishes, is locked, or refuses permission mid-walk must
		// not abort the whole import: count it and keep the notes found so far.
		state.unreadable += 1;
	}
}

export function supportsFolderAccess(): boolean {
	return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

export async function readVaultFolder(): Promise<VaultFolder> {
	if (!supportsFolderAccess()) {
		throw new FolderAccessError(
			'This browser cannot open local folders. Use Chrome on desktop, or load the sample vault instead.'
		);
	}

	let directory: FileSystemDirectoryHandle;
	try {
		directory = await window.showDirectoryPicker!({ mode: 'read', id: 'knowledge-vault' });
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			throw new FolderPickerCancelled();
		}
		if (
			error instanceof DOMException &&
			(error.name === 'SecurityError' || error.name === 'NotAllowedError')
		) {
			throw new FolderAccessError(
				'Chrome only opens folders from a normal, top-level tab. Open the app at http://localhost:3000 in its own window (not an embedded preview or iframe) and try again.'
			);
		}
		throw new FolderAccessError(
			'Chrome blocked the folder picker. Open the app in its own tab (not an embedded preview) and try again.'
		);
	}

	const state: WalkState = { entries: [], unreadable: 0, capped: false };
	await walk(directory, '', 0, state);

	const notes: Note[] = [];
	const skipped = {
		unreadable: state.unreadable,
		oversizedText: 0,
		oversizedPdf: 0,
		empty: 0,
		binary: 0,
		pdfText: 0
	};

	for (const entry of state.entries) {
		let file: File;
		try {
			file = await entry.file.getFile();
		} catch {
			// Deleted, moved, or locked by another program.
			skipped.unreadable += 1;
			continue;
		}

		if (PDF_EXTENSIONS.test(entry.path)) {
			if (file.size > MAX_PDF_BYTES) {
				skipped.oversizedPdf += 1;
				continue;
			}

			let text = '';
			try {
				text = await extractPdfText(file);
			} catch {
				// Encrypted, damaged, or not really a PDF.
				skipped.pdfText += 1;
				continue;
			}
			if (!text) {
				// A scan without a text layer: nothing to index or summarise.
				skipped.pdfText += 1;
				continue;
			}

			notes.push({
				id: entry.path,
				path: entry.path,
				title: titleFor(entry.path, text),
				content: text,
				// PDFs have no frontmatter, so they start private like any other import.
				sensitivity: 'private',
				source: 'folder',
				updatedAt: file.lastModified
			});
			continue;
		}

		if (file.size > MAX_BYTES) {
			skipped.oversizedText += 1;
			continue;
		}

		let raw = '';
		try {
			raw = await file.text();
		} catch {
			skipped.unreadable += 1;
			continue;
		}

		// A .txt that is really a binary blob (an image renamed, a database file).
		if (raw.includes('\u0000')) {
			skipped.binary += 1;
			continue;
		}

		const { data, body } = parseFrontmatter(raw);
		const content = body.replace(/^\uFEFF/, '');
		if (!content.trim()) {
			skipped.empty += 1;
			continue;
		}

		notes.push({
			id: entry.path,
			path: entry.path,
			title: titleFor(entry.path, content, data.title),
			content,
			sensitivity: sensitivityFor(data.sensitivity),
			source: 'folder',
			updatedAt: file.lastModified
		});
	}

	const warnings: string[] = [];
	const totalSkipped =
		skipped.unreadable +
		skipped.oversizedText +
		skipped.oversizedPdf +
		skipped.empty +
		skipped.binary +
		skipped.pdfText;

	if (state.capped) {
		warnings.push(
			`This folder has more than ${MAX_FILES} notes, so only the first ${MAX_FILES} were read.`
		);
	}
	if (skipped.unreadable > 0) {
		warnings.push(
			`${skipped.unreadable} file${skipped.unreadable === 1 ? '' : 's'} could not be read (locked, moved or permission denied).`
		);
	}
	if (skipped.oversizedText > 0 || skipped.oversizedPdf > 0) {
		const parts = [
			skipped.oversizedText > 0 ? `${skipped.oversizedText} over 2 MB` : '',
			skipped.oversizedPdf > 0 ? `${skipped.oversizedPdf} PDF${skipped.oversizedPdf === 1 ? '' : 's'} over 30 MB` : ''
		].filter(Boolean);
		warnings.push(`Skipped ${parts.join(' and ')}.`);
	}
	if (skipped.binary > 0) {
		warnings.push(
			`${skipped.binary} file${skipped.binary === 1 ? ' looked' : 's looked'} like binary data, not text.`
		);
	}
	if (skipped.empty > 0) {
		warnings.push(
			`${skipped.empty} file${skipped.empty === 1 ? ' was' : 's were'} empty and added nothing to the vault.`
		);
	}
	if (skipped.pdfText > 0) {
		warnings.push(
			`${skipped.pdfText} PDF${skipped.pdfText === 1 ? '' : 's'} had no selectable text (scanned pages need OCR first) or could not be opened.`
		);
	}

	if (notes.length === 0) {
		throw new FolderAccessError(
			totalSkipped > 0
				? `Nothing in that folder could be read. ${warnings.join(' ')}`
				: 'No .md, .txt or .pdf files were found in that folder. Pick a folder that contains notes or PDFs.'
		);
	}

	notes.sort((a, b) => a.path.localeCompare(b.path));
	return { notes, name: directory.name, warnings };
}
