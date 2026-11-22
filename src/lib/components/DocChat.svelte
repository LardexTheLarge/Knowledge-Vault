<script lang="ts">
	import type { ChatMessage, Chunk, Note } from '$lib/types';
	import ChatThread from './ChatThread.svelte';

	interface Props {
		note: Note | null;
		messages: ChatMessage[];
		busyLabel: string | null;
		liveText: string;
		deviceProgress: number | null;
		onAsk: (question: string) => void;
		onOpenSetup: () => void;
		onCitation: (chunks: Chunk[], chunkId: string) => void;
	}

	let {
		note,
		messages,
		busyLabel,
		liveText,
		deviceProgress,
		onAsk,
		onOpenSetup,
		onCitation
	}: Props = $props();

	let question = $state('');

	const canSubmit = $derived(question.trim().length > 3 && note !== null && busyLabel === null);

	function send() {
		if (!canSubmit) return;
		const value = question.trim();
		question = '';
		onAsk(value);
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

<section class="chat" aria-label="Chat about this file">
	<header class="chat-head">
		<div class="min-w-0">
			<h2>Ask this file</h2>
			<p class="truncate">{note ? note.title : 'No file selected'}</p>
		</div>
		<button class="btn btn-xs btn-ghost" onclick={onOpenSetup}>Keys</button>
	</header>

	{#if note}
		<div class="chat-mode">
			<span
				class="badge badge-xs shrink-0 {note.sensitivity === 'private'
					? 'badge-warning'
					: 'badge-success'}"
			>
				{note.sensitivity === 'private' ? 'Private' : 'Shareable'}
			</span>
			<span>
				{note.sensitivity === 'private'
					? 'Answered on this device. Private files never go to the cloud.'
					: 'You approve the exact cloud payload before a question is sent.'}
			</span>
		</div>
	{/if}

	<ChatThread
		{messages}
		{busyLabel}
		{liveText}
		{deviceProgress}
		{onCitation}
		emptyTitle={note ? `Ask about “${note.title}”` : 'Pick a file'}
		emptyText={note
			? 'Follow-up questions keep the earlier turns for context. The chat starts fresh when you open another file.'
			: 'Choose a file in the list to start a single-file conversation.'}
	/>

	<form class="chat-composer" onsubmit={submit}>
		<textarea
			class="textarea w-full text-sm leading-relaxed"
			bind:value={question}
			rows="2"
			placeholder={note ? 'What does this file say about…?' : 'Select a file first'}
			disabled={!note || busyLabel !== null}
			aria-label="Question about this file"
			onkeydown={keydown}
		></textarea>
		<div class="composer-row">
			<span class="composer-hint">Enter sends · Shift+Enter adds a line</span>
			<button class="btn btn-sm btn-primary" type="submit" disabled={!canSubmit}>Send</button>
		</div>
	</form>
</section>
