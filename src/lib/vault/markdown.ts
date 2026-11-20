export interface Frontmatter {
	data: Record<string, string>;
	body: string;
}

/** Minimal YAML frontmatter reader for `title:` and `sensitivity:` keys. */
export function parseFrontmatter(raw: string): Frontmatter {
	const text = raw.replace(/\r\n/g, '\n');
	if (!text.startsWith('---\n')) return { data: {}, body: text };

	const end = text.indexOf('\n---', 4);
	if (end === -1) return { data: {}, body: text };

	const block = text.slice(4, end);
	const body = text.slice(end + 4).replace(/^\n+/, '');
	const data: Record<string, string> = {};

	for (const line of block.split('\n')) {
		const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
		if (!match) continue;
		data[match[1]] = match[2].replace(/^["']|["']$/g, '').trim();
	}

	return { data, body };
}

export interface Block {
	text: string;
	start: number;
	end: number;
}

/** Split on blank lines while keeping exact character offsets. */
export function splitBlocks(source: string): Block[] {
	const blocks: Block[] = [];
	const separator = /\n{2,}/g;
	let cursor = 0;
	let match: RegExpExecArray | null;

	while ((match = separator.exec(source))) {
		blocks.push({ text: source.slice(cursor, match.index), start: cursor, end: match.index });
		cursor = match.index + match[0].length;
	}
	blocks.push({ text: source.slice(cursor), start: cursor, end: source.length });

	return blocks.filter((block) => block.text.trim().length > 0);
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function inline(value: string): string {
	let html = escapeHtml(value);
	html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
	html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	html = html.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
	html = html.replace(
		/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
		'<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>'
	);
	return html;
}

function renderBlock(block: Block): string {
	const text = block.text.trim();

	const heading = text.match(/^(#{1,6})\s+(.*)$/);
	if (heading && !text.includes('\n')) {
		const level = heading[1].length + 1; // the page already owns <h1>
		return `<h${level}>${inline(heading[2])}</h${level}>`;
	}

	if (/^>\s?/m.test(text) && text.split('\n').every((line) => /^>\s?/.test(line.trim()))) {
		const quote = text
			.split('\n')
			.map((line) => line.replace(/^>\s?/, ''))
			.join('\n');
		return `<blockquote>${inline(quote).replace(/\n/g, '<br />')}</blockquote>`;
	}

	const lines = text.split('\n');
	if (lines.every((line) => /^\s*([-*]|\d+\.)\s+/.test(line))) {
		const items = lines
			.map((line) => {
				const content = line.replace(/^\s*([-*]|\d+\.)\s+/, '');
				const checkbox = content.match(/^\[( |x|X)\]\s+(.*)$/);
				if (checkbox) {
					const checked = checkbox[1].toLowerCase() === 'x';
					return `<li class="task"><span class="task-box" data-checked="${checked}">${
						checked ? '✓' : ''
					}</span><span>${inline(checkbox[2])}</span></li>`;
				}
				return `<li>${inline(content)}</li>`;
			})
			.join('');
		return `<ul>${items}</ul>`;
	}

	if (/^(---|\*\*\*|___)$/.test(text)) return '<hr />';

	return `<p>${inline(text).replace(/\n/g, '<br />')}</p>`;
}

export interface Highlight {
	start: number;
	end: number;
}

/**
 * Render markdown to HTML. Every block that overlaps `highlight` is wrapped in a
 * marked section so a citation can scroll to and flash the exact passage.
 */
export function renderMarkdown(source: string, highlight?: Highlight | null): string {
	const blocks = splitBlocks(source);

	return blocks
		.map((block) => {
			const active =
				highlight != null && block.end > highlight.start && block.start < highlight.end;
			const className = active ? 'doc-block is-cited' : 'doc-block';
			const id = active ? ' id="cited-passage"' : '';
			return `<section class="${className}"${id}>${renderBlock(block)}</section>`;
		})
		.join('\n');
}

export function excerpt(text: string, term: string, radius = 110): string {
	const clean = text.replace(/\s+/g, ' ').trim();
	if (!term) return clean.slice(0, radius * 2) + (clean.length > radius * 2 ? '…' : '');

	const at = clean.toLowerCase().indexOf(term.toLowerCase());
	if (at === -1) return clean.slice(0, radius * 2) + (clean.length > radius * 2 ? '…' : '');

	const start = Math.max(0, at - radius);
	const end = Math.min(clean.length, at + term.length + radius);
	return `${start > 0 ? '…' : ''}${clean.slice(start, end)}${end < clean.length ? '…' : ''}`;
}
