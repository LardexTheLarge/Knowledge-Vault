<script lang="ts">
	import type { ChatMessage, Chunk, Note } from '$lib/types';
	import ChatThread from './ChatThread.svelte';

	interface Props {
		notes: Note[];
		messages: ChatMessage[];
		busyLabel: string | null;
		liveText: string;
		deviceProgress: number | null;
		onAsk: (question: string, noteIds: string[]) => void;
		onBlockedNote: (note: Note) => void;
		onCitation: (chunks: Chunk[], chunkId: string) => void;
		onDemoBlock: () => void;
		onClear: () => void;
	}

	let {
		notes,
		messages,
		busyLabel,
		liveText,
		deviceProgress,
		onAsk,
		onBlockedNote,
		onCitation,
		onDemoBlock,
		onClear
	}: Props = $props();

	let sourcesOpen = $state(true);
	let question = $state('');
	let selected = $state<Set<string>>(new Set());
	let lastSignature = '';

	// Every shareable file starts selected; toggling a label re-syncs the picker.
	$effect(() => {
		const signature = notes.map((note) => `${note.id}:${note.sensitivity}`).join('|');
		if (signature === lastSignature) return;
		lastSignature = signature;
		selected = new Set(
			notes.filter((note) => note.sensitivity === 'shareable').map((note) => note.id)
		);
	});

	const shareable = $derived(notes.filter((note) => note.sensitivity === 'shareable'));
	const canSubmit = $derived(question.trim().length > 3 && selected.size > 0 && busyLabel === null);

	function toggle(note: Note) {
		if (note.sensitivity === 'private') {
			onBlockedNote(note);
			return;
		}
		const next = new Set(selected);
		if (next.has(note.id)) next.delete(note.id);
		else next.add(note.id);
		selected = next;
	}

	function toggleAll() {
		selected =
			selected.size === shareable.length ? new Set() : new Set(shareable.map((note) => note.id));
	}

	function send() {
		if (!canSubmit) return;
		const value = question.trim();
		question = '';
		onAsk(value, Array.from(selected));
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		send();
	}

	function keydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			send();
		}
	}
</script>

<section class="vault-ask" aria-label="Ask the vault">
	<header class="vault-head">
		<div class="min-w-0">
			<h1>Ask the vault</h1>
			<p>One conversation across the files you choose. Every answer cites the excerpts it used.</p>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<button
				class="btn btn-sm btn-outline gap-2"
				onclick={() => (sourcesOpen = !sourcesOpen)}
				aria-expanded={sourcesOpen}
			>
				Sources
				<span class="badge badge-sm badge-primary">{selected.size}</span>
			</button>
			<button class="btn btn-sm btn-ghost" onclick={onClear} disabled={messages.length === 0}>
				New chat
			</button>
		</div>
	</header>

	{#if sourcesOpen}
		<div class="vault-sources">
			<div class="sources-head">
				<span>Files in this conversation</span>
				<div class="flex items-center gap-3">
					{#if shareable.length > 0}
						<button type="button" class="src-link" onclick={toggleAll}>
							{selected.size === shareable.length ? 'Clear all' : 'All shareable'}
						</button>
					{/if}
					<button type="button" class="src-link danger-link" onclick={onDemoBlock}>
						Test the guardrail
					</button>
				</div>
			</div>

			<div class="source-chips">
				{#each notes as note (note.id)}
					<button
						type="button"
						class="chip"
						class:is-selected={selected.has(note.id)}
						class:is-locked={note.sensitivity === 'private'}
						onclick={() => toggle(note)}
						title={note.sensitivity === 'private'
							? 'Private — the Privacy Router blocks cloud requests for this file'
							: note.path}
					>
						<span
							class="badge badge-xs shrink-0 {note.sensitivity === 'private'
								? 'badge-warning'
								: 'badge-success'}"
						>
							{note.sensitivity === 'private' ? 'Private' : 'Shareable'}
						</span>
						<span class="max-w-[11rem] truncate">{note.title}</span>
					</button>
				{:else}
					<span class="sources-hint">No files in the vault yet. Open a folder first.</span>
				{/each}
			</div>

			<p class="sources-hint">
				{#if shareable.length === 0}
					Every file is marked Private. Change a file to Shareable on the single-file page to
					include it here.
				{:else}
					Private files are locked out of cloud requests — click one to see the guardrail. You
					approve the exact payload before each question is sent.
				{/if}
			</p>
		</div>
	{/if}

	<ChatThread
		{messages}
		{busyLabel}
		{liveText}
		{deviceProgress}
		{onCitation}
		emptyTitle="Ask across your vault"
		emptyText="Pick the shareable files above, then ask a question. Follow-ups keep the whole conversation as context, and every answer links back to the file it came from."
	/>

	<form class="chat-composer vault-composer" onsubmit={submit}>
		<textarea
			class="textarea w-full text-sm leading-relaxed"
			bind:value={question}
			rows="2"
			placeholder={selected.size > 0
				? 'What did we decide about pricing, and why?'
				: 'Select at least one shareable file…'}
			disabled={busyLabel !== null}
			aria-label="Question about the selected files"
			onkeydown={keydown}
		></textarea>
		<div class="composer-row">
			<span class="composer-hint">
				{selected.size} file{selected.size === 1 ? '' : 's'} in context · the cloud only sees
				these, after you approve
			</span>
			<button class="btn btn-sm btn-primary" type="submit" disabled={!canSubmit}>
				Preview &amp; send
			</button>
		</div>
	</form>
</section>
