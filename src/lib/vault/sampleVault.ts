import type { Note, Sensitivity } from '$lib/types';
import { parseFrontmatter } from './markdown';

const modules = import.meta.glob('/sample-vault/**/*.md', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>;

function cleanSensitivity(value: string | undefined): Sensitivity {
	return value?.toLowerCase() === 'shareable' ? 'shareable' : 'private';
}

function titleFor(path: string, body: string, explicit?: string): string {
	if (explicit) return explicit;
	const heading = body.match(/^#\s+(.+)$/m);
	if (heading) return heading[1].trim();
	const file = path.split('/').pop() ?? path;
	return file.replace(/\.(md|markdown|txt)$/i, '').replace(/[-_]/g, ' ');
}

export const SAMPLE_VAULT: Note[] = Object.entries(modules)
	.map(([absolutePath, raw]) => {
		const path = absolutePath.replace(/^\/sample-vault\//, '');
		const { data, body } = parseFrontmatter(raw);
		return {
			id: path,
			path,
			title: titleFor(path, body, data.title),
			content: body,
			sensitivity: cleanSensitivity(data.sensitivity),
			source: 'sample' as const
		};
	})
	.sort((a, b) => a.path.localeCompare(b.path));
