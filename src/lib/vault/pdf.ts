import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/** Cap the amount of text extraction a single large PDF can trigger. */
export const MAX_PDF_PAGES = 300;

// pdf.js is ~500 kB, and most vaults have no PDFs: load it on the first PDF import.
let pdfjs: Promise<typeof import('pdfjs-dist')> | null = null;

function loadPdfjs() {
	pdfjs ??= import('pdfjs-dist').then((module) => {
		module.GlobalWorkerOptions.workerSrc = workerUrl;
		return module;
	});
	return pdfjs;
}

/** Tidy pdf.js output: one space between words, at most one blank line between paragraphs. */
function normalise(raw: string): string {
	return raw
		.replace(/\r\n?/g, '\n')
		.split('\n')
		.map((line) => line.replace(/[ \t]+/g, ' ').trim())
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

/**
 * Extract the text layer of a PDF as markdown, one `## Page N` section per page.
 * Image-only scans have no text layer and come back as an empty string.
 */
export async function extractPdfText(file: File): Promise<string> {
	const { getDocument } = await loadPdfjs();

	const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
	const doc = await task.promise;
	try {
		const pages: string[] = [];
		const total = Math.min(doc.numPages, MAX_PDF_PAGES);

		for (let number = 1; number <= total; number++) {
			const page = await doc.getPage(number);
			try {
				const content = await page.getTextContent();
				const text = normalise(
					content.items
						.map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : ''))
						.join('')
				);
				if (text) pages.push(`## Page ${number}\n\n${text}`);
			} finally {
				page.cleanup();
			}
		}

		return pages.join('\n\n');
	} finally {
		await task.destroy();
	}
}
