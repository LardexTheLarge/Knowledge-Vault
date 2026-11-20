<script lang="ts">
	import type { CloudPayload } from '$lib/types';
	import { payloadSummary } from '$lib/ai/router';

	interface Props {
		payload: CloudPayload;
		question: string;
		onApprove: () => void;
		onCancel: () => void;
	}

	let { payload, question, onApprove, onCancel }: Props = $props();
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && onCancel()} />

<div class="modal modal-open">
	<div
		class="modal-box max-w-2xl"
		role="dialog"
		aria-modal="true"
		aria-label="What leaves your device"
	>
		<span class="badge badge-sm badge-outline badge-primary">
			Cloud request · requires your approval
		</span>
		<h3 class="mt-3 text-lg font-semibold">What leaves your device</h3>
		<p class="mt-1 text-sm leading-relaxed text-base-content/65">
			This is the exact payload for “{question}”. Nothing is sent until you press approve.
		</p>

		<div class="mt-4 flex flex-wrap gap-2">
			<span class="badge badge-sm badge-ghost">{payloadSummary(payload)}</span>
			<span class="badge badge-sm badge-outline badge-success">No private notes</span>
		</div>

		<ul class="mt-4 flex flex-col divide-y divide-base-300 rounded-lg border border-base-300">
			{#each payload.notes as note (note.id)}
				<li class="flex items-center justify-between gap-3 px-3 py-2">
					<span class="truncate text-sm">{note.title}</span>
					<span class="truncate font-mono text-[11px] text-base-content/45">{note.path}</span>
				</li>
			{/each}
		</ul>

		<details class="collapse collapse-arrow mt-4 border border-base-300 bg-base-200">
			<summary class="collapse-title flex items-center justify-between gap-2 text-xs font-medium">
				<span>Exact text being sent</span>
				<span class="badge badge-xs badge-ghost">
					{payload.characters.toLocaleString()} chars
				</span>
			</summary>
			<div class="collapse-content flex flex-col gap-2">
				{#each payload.preview as chunk (chunk.id)}
					<div class="rounded-md border border-base-300 bg-base-100 p-2">
						<div class="mb-1 font-mono text-[11px] text-base-content/50">
							[{chunk.id}] · {chunk.noteTitle}
						</div>
						<div
							class="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-base-content/75"
						>
							{chunk.text}
						</div>
					</div>
				{/each}
			</div>
		</details>

		<div class="modal-action items-end justify-between gap-4">
			<p class="max-w-[18rem] text-[11px] leading-relaxed text-base-content/45">
				Sent to the Gemini Developer API through Firebase AI Logic. On-device summaries never appear
				here.
			</p>
			<div class="flex gap-2">
				<button class="btn btn-sm btn-ghost" onclick={onCancel}>Cancel</button>
				<button class="btn btn-sm btn-primary" onclick={onApprove}>Approve &amp; send</button>
			</div>
		</div>
	</div>
	<button class="modal-backdrop" aria-label="Cancel" onclick={onCancel}>close</button>
</div>
