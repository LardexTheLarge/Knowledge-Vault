<script lang="ts">
	import type { Note, Sensitivity } from '$lib/types';

	interface Props {
		note: Note | null;
		html: string;
		busy: boolean;
		onSetSensitivity: (sensitivity: Sensitivity) => void;
		onSummarize: () => void;
		onActionItems: () => void;
	}

	let { note, html, busy, onSetSensitivity, onSummarize, onActionItems }: Props = $props();
</script>

<section class="reader" aria-label="Note">
	{#if note}
		<div class="reader-inner">
			<header class="border-b border-base-300 pb-5">
				<p class="text-[11px] uppercase tracking-[0.12em] text-base-content/40">{note.path}</p>
				<h1 class="mt-1 text-2xl font-semibold tracking-tight">{note.title}</h1>

				<div class="reader-tools">
					<div class="join">
						<button
							class="join-item btn btn-sm {note.sensitivity === 'private'
								? 'btn-warning'
								: 'btn-ghost'}"
							onclick={() => onSetSensitivity('private')}
						>
							Private
						</button>
						<button
							class="join-item btn btn-sm {note.sensitivity === 'shareable'
								? 'btn-success'
								: 'btn-ghost'}"
							onclick={() => onSetSensitivity('shareable')}
						>
							Shareable
						</button>
					</div>

					<span class="flex-1"></span>

					<button class="btn btn-sm btn-outline gap-2" onclick={onSummarize} disabled={busy}>
						Summarize
						<span class="badge badge-xs badge-info">on-device</span>
					</button>
					<button class="btn btn-sm btn-outline gap-2" onclick={onActionItems} disabled={busy}>
						Action items
						<span class="badge badge-xs badge-info">on-device</span>
					</button>
				</div>

				<div
					class="mt-4 flex items-start gap-2 rounded-lg border border-base-300 bg-base-200/60 px-3 py-2 text-xs leading-relaxed text-base-content/65"
				>
					{#if note.sensitivity === 'private'}
						<span class="badge badge-xs badge-warning mt-0.5">Private</span>
						<span>
							AI runs on this machine only. If the on-device model is unavailable, the app stops
							instead of falling back to the cloud.
						</span>
					{:else}
						<span class="badge badge-xs badge-success mt-0.5">Shareable</span>
						<span>
							This note may be included in a cloud request — you will see the exact text and approve
							it first.
						</span>
					{/if}
				</div>
			</header>

			<article class="doc mt-6">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- renderMarkdown escapes all input -->
				{@html html}
			</article>
		</div>
	{:else}
		<div class="reader-empty">
			<div>
				<h2>Pick a note</h2>
				<p>Select a note on the left, or open a folder of markdown files.</p>
			</div>
		</div>
	{/if}
</section>
