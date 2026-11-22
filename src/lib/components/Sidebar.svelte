<script lang="ts">
	import type { Note } from '$lib/types';

	interface Props {
		notes: Note[];
		totalNotes: number;
		query: string;
		vaultLabel: string;
		selectedId: string | null;
		picking: boolean;
		onQuery: (value: string) => void;
		onSelect: (id: string) => void;
		onPickFolder: () => void;
		onUseSample: () => void;
		onOpenSetup: () => void;
		setupWarning: boolean;
	}

	let {
		notes,
		totalNotes,
		query,
		vaultLabel,
		selectedId,
		picking,
		onQuery,
		onSelect,
		onPickFolder,
		onUseSample,
		onOpenSetup,
		setupWarning
	}: Props = $props();
</script>

<aside class="sidebar">
	<div class="flex-none border-b border-base-300 p-3">
		<div class="mb-2.5 flex items-center gap-2 text-xs font-medium">
			<span class="size-1.5 shrink-0 rounded-full bg-secondary"></span>
			<span class="truncate">{vaultLabel}</span>
		</div>
		<div class="grid grid-cols-2 gap-2">
			<button class="btn btn-sm btn-outline" onclick={onPickFolder} disabled={picking}>
				{picking ? 'Reading…' : 'Open folder'}
			</button>
			<button class="btn btn-sm btn-ghost" onclick={onUseSample} disabled={picking}>
				Sample vault
			</button>
		</div>
	</div>

	<div class="px-3 py-3">
		<label class="input input-sm w-full">
			<svg
				viewBox="0 0 24 24"
				width="14"
				height="14"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"
				focusable="false"
				class="opacity-50"
			>
				<circle cx="11" cy="11" r="7" />
				<path d="M16.5 16.5L21 21" stroke-linecap="round" />
			</svg>
			<input
				type="search"
				placeholder="Search notes…"
				value={query}
				oninput={(event) => onQuery(event.currentTarget.value)}
				aria-label="Search notes"
			/>
			{#if query}
				<button
					type="button"
					class="btn btn-xs btn-circle btn-ghost -mr-1.5"
					onclick={() => onQuery('')}
					aria-label="Clear search">✕</button
				>
			{/if}
		</label>
	</div>

	<div class="flex-none px-4 pb-2 text-[11px] text-base-content/45">
		{#if query}
			{notes.length} of {totalNotes} notes · local index
		{:else}
			{totalNotes} notes · nothing leaves this device
		{/if}
	</div>

	<nav class="min-h-0 flex-1 overflow-y-auto px-2 pb-3" aria-label="Notes">
		<ul class="menu menu-sm w-full p-0">
			{#each notes as note (note.id)}
				<li>
					<button
						class="flex-col items-stretch gap-1 {note.id === selectedId ? 'menu-active' : ''}"
						onclick={() => onSelect(note.id)}
						title={note.path}
					>
						<span class="flex items-center justify-between gap-2">
							<span class="truncate text-[13px] font-medium">{note.title}</span>
							<span
								class="badge badge-xs shrink-0 {note.sensitivity === 'private'
									? 'badge-warning'
									: 'badge-success'}"
							>
								{note.sensitivity === 'private' ? 'Private' : 'Shareable'}
							</span>
						</span>
						<span class="truncate text-[11px] opacity-55">{note.path}</span>
					</button>
				</li>
			{:else}
				<li class="px-1 py-4 text-center text-xs leading-relaxed opacity-50">
					{#if query}
						No note matches “{query}”. Search runs entirely in this tab — try a shorter word.
					{:else}
						This vault is empty. Open a folder of notes or PDFs, or load the sample vault.
					{/if}
				</li>
			{/each}
		</ul>
	</nav>

	<div class="flex-none border-t border-base-300 p-3">
		<p class="mb-2 text-[11px] leading-relaxed text-base-content/45">
			Nothing leaves this device until you approve it.
		</p>
		<button
			class="btn btn-sm btn-block {setupWarning ? 'btn-outline btn-warning' : 'btn-ghost'}"
			onclick={onOpenSetup}
		>
			Setup &amp; API keys
		</button>
	</div>
</aside>
