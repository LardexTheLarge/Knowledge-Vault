<script lang="ts">
	import type { ChatMessage, Chunk } from '$lib/types';
	import ModeBadge from './ModeBadge.svelte';

	interface Props {
		messages: ChatMessage[];
		busyLabel?: string | null;
		liveText?: string;
		deviceProgress?: number | null;
		emptyTitle: string;
		emptyText: string;
		onCitation?: (chunks: Chunk[], chunkId: string) => void;
	}

	let {
		messages,
		busyLabel = null,
		liveText = '',
		deviceProgress = null,
		emptyTitle,
		emptyText,
		onCitation
	}: Props = $props();

	let threadEl = $state<HTMLDivElement | null>(null);
	let lastSignature = '';
	let checked = $state<Record<string, boolean>>({});

	// Keep the newest turn in view, including while an on-device answer streams in.
	$effect(() => {
		const signature = `${messages.length}|${liveText.length}`;
		if (signature === lastSignature) return;
		lastSignature = signature;
		const element = threadEl;
		if (!element) return;
		requestAnimationFrame(() => {
			element.scrollTop = element.scrollHeight;
		});
	});

	function labelFor(message: ChatMessage): string {
		if (message.kind === 'summary') return 'Summary';
		if (message.kind === 'actions') return 'Action items';
		return 'Answer';
	}

	function toggleTask(messageId: string, index: number) {
		const key = `${messageId}:${index}`;
		checked = { ...checked, [key]: !checked[key] };
	}
</script>

<div class="chat-thread" bind:this={threadEl}>
	{#if messages.length === 0}
		<div class="chat-empty">
			<p class="chat-empty-title">{emptyTitle}</p>
			<p class="chat-empty-text">{emptyText}</p>
		</div>
	{/if}

	{#each messages as message (message.id)}
		{#if message.role === 'user'}
			<div class="bubble is-user">{message.text}</div>
		{:else}
			<article class="bubble is-ai">
				<div class="bubble-head">
					<span class="bubble-tag">{labelFor(message)}</span>
					{#if message.source}
						<ModeBadge source={message.source} />
					{/if}
				</div>

				{#if message.noteTitle}
					<h4 class="bubble-title">{message.noteTitle}</h4>
				{/if}

				{#if message.text}
					<p class="bubble-text">{message.text}</p>
				{/if}

				{#if message.reduced}
					<p class="bubble-meta">
						Long file: summarised in {message.chunkCount} chunks, then combined. On-device context
						is small, so it is done in passes.
					</p>
				{/if}

				{#if message.items}
					{#if message.items.length === 0}
						<p class="bubble-text">No concrete action items were found in this file.</p>
					{:else}
						<ul class="bubble-list">
							{#each message.items as item, index (index)}
								{@const done = checked[`${message.id}:${index}`] ?? false}
								<li>
									<label class="task-row">
										<input
											type="checkbox"
											class="checkbox checkbox-xs mt-0.5"
											checked={done}
											onchange={() => toggleTask(message.id, index)}
										/>
										<span class="flex flex-col gap-0.5">
											<span class="task-text" class:is-done={done}>{item.task}</span>
											{#if item.owner || item.due}
												<span class="bubble-meta flex gap-2">
													{#if item.owner}<span>{item.owner}</span>{/if}
													{#if item.due}<span>{item.due}</span>{/if}
												</span>
											{/if}
											{#if item.sourceLine}
												<span class="bubble-source">{item.sourceLine}</span>
											{/if}
										</span>
									</label>
								</li>
							{/each}
						</ul>
					{/if}
				{/if}

				{#if message.claims && message.claims.length > 0}
					<ul class="bubble-list">
						{#each message.claims as claim, index (index)}
							<li class="claim">
								<span>{claim.text}</span>
								<span class="flex flex-wrap gap-1">
									{#each claim.chunkIds as chunkId (chunkId)}
										<button
											type="button"
											class="citation"
											onclick={() => onCitation?.(message.chunks ?? [], chunkId)}
										>
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

	{#if busyLabel}
		<div class="working">
			<div class="flex items-center gap-2 text-xs">
				<span class="loading loading-spinner loading-xs"></span>
				{busyLabel}
			</div>
			{#if deviceProgress !== null}
				<progress
					class="progress progress-primary w-full"
					value={Math.round(deviceProgress * 100)}
					max="100"
				></progress>
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
</div>
