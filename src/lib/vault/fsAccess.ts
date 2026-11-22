import type { Note, Sensitivity } from '$lib/types';
import { parseFrontmatter } from './markdown';
import { extractPdfText } from './pdf';

const TEXT_EXTENSIONS = /\.(md|markdown|mdx|txt)$/i;
const PDF_EXTENSIONS = /\.pdf$/i;
const NOTE_EXTENSIONS = /\.(md|markdown|mdx|txt|pdf)$/i;
const MAX_FILES = 600;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_PDF_BYTES = 30 * 1024 * 1024;

export class FolderAccessError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'FolderAccessError';
	}
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

async function walk(
	directory: FileSystemDirectoryHandle,
	prefix = '',
	collected: { path: string; file: FileSystemFileHandle }[] = []
): Promise<{ path: string; file: FileSystemFileHandle }[]> {
	for await (const [name, handle] of directory.entries()) {
		if (name.startsWith('.') || name === 'node_modules') continue;

		if (handle.kind === 'directory') {
			await walk(handle as FileSystemDirectoryHandle, `${prefix}${name}/`, collected);
			continue;
		}

		if (!TEXT_EXTENSIONS.test(name) && !PDF_EXTENSIONS.test(name)) continue;
		collected.push({ path: `${prefix}${name}`, file: handle as FileSystemFileHandle });
		if (collected.length >= MAX_FILES) break;
	}
	return collected;
}

export function supportsFolderAccess(): boolean {
	return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

export async function readVaultFolder(): Promise<{ notes: Note[]; name: string }> {
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
			throw new FolderAccessError('Folder picker cancelled.');
		}
		throw new FolderAccessError(
			'Chrome blocked the folder picker. Open the app in its own tab (not an embedded preview) and try again.'
		);
	}

	const files = await walk(directory);
	const notes: Note[] = [];
	let skippedPdfs = 0;

	for (const entry of files) {
		const file = await entry.file.getFile();

		if (PDF_EXTENSIONS.test(entry.path)) {
			if (file.size > MAX_PDF_BYTES) {
				skippedPdfs += 1;
				continue;
			}

			let text = '';
			try {
				text = await extractPdfText(file);
			} catch {
				// Encrypted, damaged, or not really a PDF.
				skippedPdfs += 1;
				continue;
			}
			if (!text) {
				// A scan without a text layer: nothing to index or summarise.
				skippedPdfs += 1;
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

		if (file.size > MAX_BYTES) continue;

		const raw = await file.text();
		const { data, body } = parseFrontmatter(raw);
		notes.push({
			id: entry.path,
			path: entry.path,
			title: titleFor(entry.path, body, data.title),
			content: body,
			sensitivity: sensitivityFor(data.sensitivity),
			source: 'folder',
			updatedAt: file.lastModified
		});
	}

	if (notes.length === 0) {
		throw new FolderAccessError(
			skippedPdfs > 0
				? 'Those PDFs had no selectable text (scanned pages need OCR first), and the folder had no .md or .txt notes either.'
				: 'No .md, .txt or .pdf files were found in that folder. Pick a folder that contains notes or PDFs.'
		);
	}

	notes.sort((a, b) => a.path.localeCompare(b.path));
	return { notes, name: directory.name };
}
