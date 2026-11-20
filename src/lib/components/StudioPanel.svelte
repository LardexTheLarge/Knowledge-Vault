<script lang="ts">
	import type { Chunk, Note, ResultCard } from '$lib/types';
	import type { FriendlyError } from '$lib/ai/errors';
	import ModeBadge from './ModeBadge.svelte';

	interface Props {
		notes: Note[];
		results: ResultCard[];
		busyLabel: string | null;
		liveText: string;
		deviceProgress: number | null;
		error: FriendlyError | null;
		onAsk: (question: string, noteIds: string[]) => void;
		onDemoBlock: () => void;
		onBlockedNote: (note: Note) => void;
		onCitation: (chunks: Chunk[], chunkId: string) => void;
		onDismissError: () => void;
		onOpenSetup: () => void;
		onClear: () => void;
	}

	let {
		notes,
		results,
		busyLabel,
		liveText,
		deviceProgress,
		error,
		onAsk,
		onDemoBlock,
		onBlockedNote,
		onCitation,
		onDismissError,
		onOpenSetup,
		onClear
	}: Props = $props();

	let question = $state('');
	let selected = $state<Set<string>>(new Set());
	let checked = $state<Record<string, boolean>>({});
	let lastSignature = '';

	// Every shareable note starts selected; toggling a label re-syncs the picker.
	$effect(() => {
		const signature = notes.map((note) => `${note.id}:${note.sensitivity}`).join('|');
		if (signature === lastSignature) return;
		lastSignature = signature;
		selected = new Set(
			notes.filter((note) => note.sensitivity === 'shareable').map((note) => note.id)
		);
	});

	const canSubmit = $derived(question.trim().length > 3 && selected.size > 0 && !busyLabel);
	const shareableCount = $derived(notes.filter((note) => note.sensitivity === 'shareable').length);

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
		const shareable = notes.filter((note) => note.sensitivity === 'shareable');
		selected =
			selected.size === shareable.length ? new Set() : new Set(shareable.map((note) => note.id));
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!canSubmit) return;
		onAsk(question.trim(), Array.from(selected));
	}

	function toggleTask(cardId: string, index: number) {
		const key = `${cardId}:${index}`;
		checked = { ...checked, [key]: !checked[key] };
	}
</script>

<section class="studio" aria-label="Ask the vault">
	<header class="studio-head">
		<div>
			<h2>Ask the vault</h2>
			<p>Cross-document answers with citations, computed in the cloud.</p>
		</div>
		<button class="btn btn-ghost sm" onclick={onOpenSetup}>Keys</button>
	</header>

	<form class="ask" onsubmit={submit}>
		<textarea
			bind:value={question}
			rows="3"
			placeholder="What did we decide about pricing, and why?"
			aria-label="Question"
		></textarea>

		<div class="picker">
			<div class="picker-head">
				<span>Send these notes</span>
				{#if shareableCount > 0}
					<button type="button" class="link" onclick={toggleAll}>All shareable</button>
				{/if}
			</div>
			<div class="chips">
				{#each notes as note (note.id)}
					<button
						type="button"
						class="chip"
						class:selected={selected.has(note.id)}
						class:locked={note.sensitivity === 'private'}
						onclick={() => toggle(note)}
						title={note.sensitivity === 'private'
							? 'Private — the Privacy Router blocks cloud requests for this note'
							: note.path}
					>
						{#if note.sensitivity === 'private'}
							<span class="chip-tag">Private</span>
						{/if}
						{note.title}
					</button>
				{/each}
			</div>
		</div>

		<div class="ask-actions">
			<span class="ask-note">You approve the exact payload before anything is sent.</span>
			<button class="btn btn-cloud" type="submit" disabled={!canSubmit}>Preview &amp; send</button>
		</div>

		<button type="button" class="link danger-link" onclick={onDemoBlock}>
			Try sending a private note — see the guardrail
		</button>
	</form>

	<div class="results">
		{#if error}
			<div class="alert">
				<div class="alert-head">
					<span class="alert-title">{error.title}</span>
					<button class="link" onclick={onDismissError}>Dismiss</button>
				</div>
				<p class="alert-detail">{error.detail}</p>
				<p class="alert-hint">{error.hint}</p>
				{#if error.kind === 'setup' || error.kind === 'app-check'}
					<div class="alert-actions">
						<button class="btn btn-ghost sm" onclick={onOpenSetup}>Open setup</button>
					</div>
				{/if}
			</div>
		{/if}

		{#if busyLabel}
			<div class="working">
				<div class="working-head">
					<span class="spinner"></span>
					{busyLabel}
				</div>
				{#if deviceProgress !== null}
					<div class="progress">
						<span style={`width:${Math.round(deviceProgress * 100)}%`}></span>
					</div>
					<p class="working-meta">
						Preparing the on-device model — {Math.round(deviceProgress * 100)}%. The first download
						can take several minutes.
					</p>
				{/if}
				{#if liveText}
					<p class="live-text">{liveText}</p>
				{/if}
			</div>
		{/if}

		<div class="results-head">
			<h3>Results</h3>
			{#if results.length > 0}
				<button class="link" onclick={onClear}>Clear</button>
			{/if}
		</div>

		{#if results.length === 0 && !busyLabel}
			<p class="results-empty">
				No answers yet. Summaries and action items run on-device; the question box above runs in the
				cloud after you approve the payload.
			</p>
		{/if}

		{#each results as card (card.id)}
			{#if card.kind === 'summary'}
				<article class="result-card">
					<div class="result-head">
						<span class="result-kind">Summary</span>
						<ModeBadge source={card.source} />
					</div>
					<h4 class="result-title">{card.noteTitle}</h4>
					<p class="result-body">{card.text}</p>
					{#if card.reduced}
						<p class="working-meta">
							Long note: summarised in {card.chunkCount} chunks, then combined. On-device context is
							small, so it is done in passes.
						</p>
					{/if}
				</article>
			{:else if card.kind === 'actions'}
				<article class="result-card actions">
					<div class="result-head">
						<span class="result-kind">Action items</span>
						<ModeBadge source={card.source} />
					</div>
					<h4 class="result-title">{card.noteTitle}</h4>
					{#if card.items.length === 0}
						<p class="result-body">No concrete action items were found in this note.</p>
					{:else}
						<ul class="checklist">
							{#each card.items as item, index (index)}
								{@const done = checked[`${card.id}:${index}`] ?? false}
								<li>
									<button type="button" onclick={() => toggleTask(card.id, index)}>
										<span class="tick" class:on={done}>{done ? '✓' : ''}</span>
										<span>
											<span class="task-text" class:done>{item.task}</span>
											{#if item.owner || item.due}
												<span class="task-meta">
													{#if item.owner}<span>{item.owner}</span>{/if}
													{#if item.due}<span>{item.due}</span>{/if}
												</span>
											{/if}
											{#if item.sourceLine}
												<span class="task-source">{item.sourceLine}</span>
											{/if}
										</span>
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</article>
			{:else}
				<article class="result-card answer">
					<div class="result-head">
						<span class="result-kind">Cited answer</span>
						<ModeBadge source={card.source} />
					</div>
					<h4 class="result-question">{card.question}</h4>
					<p class="result-body">{card.text}</p>
					{#if card.claims.length > 0}
						<ul class="claims">
							{#each card.claims as claim, index (index)}
								<li>
									<span>{claim.text}</span>
									<span class="cite-row">
										{#each claim.chunkIds as chunkId (chunkId)}
											<button class="cite" onclick={() => onCitation(card.chunks, chunkId)}>
												[{chunkId}]
											</button>
										{/each}
									</span>
								</li>
							{/each}
						</ul>
					{/if}
				</article>
			{/if}
		{/each}
	</div>
</section>
