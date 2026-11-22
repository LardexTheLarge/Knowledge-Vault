<script lang="ts">
	import { onMount } from 'svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import NoteView from '$lib/components/NoteView.svelte';
	import StudioPanel from '$lib/components/StudioPanel.svelte';
	import ApprovalDialog from '$lib/components/ApprovalDialog.svelte';
	import SetupDialog from '$lib/components/SetupDialog.svelte';
	import { SAMPLE_VAULT } from '$lib/vault/sampleVault';
	import { getMeta, loadNotes, saveNote, saveNotes, setMeta } from '$lib/vault/db';
	import { FolderAccessError, readVaultFolder } from '$lib/vault/fsAccess';
	import { createIndex, searchNotes } from '$lib/search';
	import { renderMarkdown } from '$lib/vault/markdown';
	import { planCloudQuestion, PrivacyBlockedError, type CloudPlan } from '$lib/ai/router';
	import { summarizeNote } from '$lib/ai/summarize';
	import { extractActionItems } from '$lib/ai/actionItems';
	import { answerWithChunks } from '$lib/ai/citedAnswer';
	import { describeAiError, type FriendlyError } from '$lib/ai/errors';
	import { apiKeyProblem, appCheckConfigured, envStatus, isFirebaseConfigured } from '$lib/config';
	import type { Chunk, DeviceStatus, Note, ResultCard, Sensitivity } from '$lib/types';

	let notes = $state<Note[]>([]);
	let selectedId = $state<string | null>(null);
	let vaultLabel = $state('Sample vault');
	let query = $state('');
	let loading = $state(true);
	let picking = $state(false);

	let highlight = $state<{ start: number; end: number } | null>(null);

	let results = $state<ResultCard[]>([]);
	let busy = $state<null | 'summary' | 'actions' | 'answer'>(null);
	let liveText = $state('');
	let deviceProgress = $state<number | null>(null);
	let error = $state<FriendlyError | null>(null);
	let pending = $state<CloudPlan | null>(null);
	let setupOpen = $state(false);
	let device = $state<DeviceStatus>({ state: 'unknown' });

	const index = $derived(createIndex(notes));
	const hits = $derived.by(() => (query.trim() ? searchNotes(index, notes, query) : []));
	const visibleNotes = $derived(query.trim() ? hits.map((hit) => hit.note) : notes);
	const selectedNote = $derived(notes.find((note) => note.id === selectedId) ?? null);
	const html = $derived(selectedNote ? renderMarkdown(selectedNote.content, highlight) : '');
	const configured = $derived(isFirebaseConfigured());
	const appCheck = $derived(appCheckConfigured());

	const busyLabel = $derived(
		busy === 'summary'
			? 'Summarising on this device…'
			: busy === 'actions'
				? 'Extracting action items on this device…'
				: busy === 'answer'
					? 'Asking the cloud…'
					: null
	);

	const deviceLabel = $derived.by(() => {
		switch (device.state) {
			case 'available':
				return 'ready';
			case 'downloadable':
				return 'download';
			case 'downloading':
				return 'downloading';
			case 'unavailable':
				return 'unavailable';
			case 'unsupported-browser':
				return 'not in this browser';
			case 'checking':
				return 'checking…';
			default:
				return 'unchecked';
		}
	});

	onMount(async () => {
		try {
			const saved = await loadNotes();
			if (saved.length > 0) {
				notes = saved;
				vaultLabel =
					(await getMeta<string>('vaultLabel')) ??
					(saved[0]?.source === 'sample' ? 'Sample vault' : 'Saved vault');
			} else {
				notes = SAMPLE_VAULT.map((note) => ({ ...note }));
				await saveNotes(notes);
			}
		} catch {
			notes = SAMPLE_VAULT.map((note) => ({ ...note }));
		}

		selectedId = notes[0]?.id ?? null;
		loading = false;
		void refreshDeviceStatus();
	});

	// Scroll to a citation and clear the flash after a moment.
	$effect(() => {
		if (!highlight) return;
		const frame = requestAnimationFrame(() => {
			document
				.getElementById('cited-passage')
				?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		});
		const timer = setTimeout(() => (highlight = null), 7000);
		return () => {
			cancelAnimationFrame(frame);
			clearTimeout(timer);
		};
	});

	function selectNote(id: string) {
		selectedId = id;
		highlight = null;
	}

	function openCitation(chunks: Chunk[], chunkId: string) {
		const chunk = chunks.find((item) => item.id === chunkId);
		if (!chunk) return;
		selectedId = chunk.noteId;
		highlight = { start: chunk.start, end: chunk.end };
	}

	async function setSensitivity(sensitivity: Sensitivity) {
		if (!selectedNote) return;
		const updated: Note = { ...selectedNote, sensitivity };
		notes = notes.map((note) => (note.id === updated.id ? updated : note));
		try {
			await saveNote(updated);
		} catch {
			/* the label still applies for this session */
		}
	}

	async function useSampleVault() {
		notes = SAMPLE_VAULT.map((note) => ({ ...note }));
		vaultLabel = 'Sample vault';
		selectedId = notes[0]?.id ?? null;
		query = '';
		highlight = null;
		error = null;
		try {
			await saveNotes(notes);
			await setMeta('vaultLabel', 'Sample vault');
		} catch {
			/* in-memory vault is still usable */
		}
	}

	async function pickFolder() {
		picking = true;
		error = null;
		try {
			const loaded = await readVaultFolder();
			notes = loaded.notes;
			vaultLabel = loaded.name;
			selectedId = loaded.notes[0]?.id ?? null;
			query = '';
			highlight = null;
			await saveNotes(notes);
			await setMeta('vaultLabel', loaded.name);
		} catch (cause) {
			if (cause instanceof FolderAccessError) {
				error = {
					kind: 'unknown',
					title: 'Could not open that folder',
					detail: cause.message,
					hint: 'Folder access needs a real Chrome tab. The sample vault still works here.'
				};
			} else {
				error = describeAiError(cause);
			}
		} finally {
			picking = false;
		}
	}

	async function runSummary() {
		if (!selectedNote || busy) return;
		const note = selectedNote;
		error = null;
		busy = 'summary';
		liveText = '';
		deviceProgress = null;
		try {
			const summary = await summarizeNote(note, {
				onProgress: (progress) => (deviceProgress = progress),
				onToken: (text) => (liveText = text)
			});
			results = [
				{
					kind: 'summary',
					id: crypto.randomUUID(),
					noteId: note.id,
					noteTitle: note.title,
					text: summary.text,
					source: summary.source,
					chunkCount: summary.chunkCount,
					reduced: summary.reduced
				},
				...results
			];
			liveText = '';
			device = { state: 'available', detail: 'The on-device model answered.' };
		} catch (cause) {
			error = describeAiError(cause);
			liveText = '';
		} finally {
			busy = null;
			deviceProgress = null;
		}
	}

	async function runActionItems() {
		if (!selectedNote || busy) return;
		const note = selectedNote;
		error = null;
		busy = 'actions';
		try {
			const extracted = await extractActionItems(note);
			results = [
				{
					kind: 'actions',
					id: crypto.randomUUID(),
					noteId: note.id,
					noteTitle: note.title,
					items: extracted.items,
					source: extracted.source
				},
				...results
			];
			device = { state: 'available', detail: 'The on-device model answered.' };
		} catch (cause) {
			error = describeAiError(cause);
		} finally {
			busy = null;
		}
	}

	function previewAsk(question: string, noteIds: string[]) {
		error = null;
		const chosen = notes.filter((note) => noteIds.includes(note.id));
		if (chosen.length === 0) {
			error = {
				kind: 'unknown',
				title: 'No notes selected',
				detail: 'Choose at least one shareable note to ask across.',
				hint: 'Private notes cannot be sent to the cloud at all.'
			};
			return;
		}
		try {
			pending = planCloudQuestion(question, chosen);
		} catch (cause) {
			error = describeAiError(cause);
		}
	}

	function demoBlock() {
		error = null;
		try {
			planCloudQuestion('Summarise everything I know about this launch.', notes);
		} catch (cause) {
			error = describeAiError(cause);
		}
	}

	function blockedNote(note: Note) {
		error = describeAiError(new PrivacyBlockedError([note.title]));
	}

	async function approve() {
		if (!pending) return;
		const plan = pending;
		pending = null;
		busy = 'answer';
		error = null;
		try {
			const answer = await answerWithChunks(plan.question, plan.chunks);
			results = [
				{
					kind: 'answer',
					id: crypto.randomUUID(),
					question: plan.question,
					text: answer.answer,
					claims: answer.claims,
					source: answer.source,
					chunks: plan.chunks
				},
				...results
			];
		} catch (cause) {
			error = describeAiError(cause);
		} finally {
			busy = null;
		}
	}

	async function refreshDeviceStatus() {
		const api = (globalThis as { LanguageModel?: { availability?: () => Promise<string> } })
			.LanguageModel;
		if (!api?.availability) {
			device = {
				state: 'unsupported-browser',
				detail: 'The Chrome Prompt API is not exposed in this browser.'
			};
			return;
		}
		device = { state: 'checking' };
		try {
			const availability = await api.availability();
			device = {
				state: availability as DeviceStatus['state'],
				detail: `LanguageModel.availability() → ${availability}`
			};
		} catch (cause) {
			device = { state: 'unavailable', detail: String(cause) };
		}
	}

	async function deviceAction() {
		if (device.state === 'unsupported-browser' || device.state === 'checking') return;
		if (device.state === 'available') {
			void refreshDeviceStatus();
			return;
		}

		const api = (globalThis as {
			LanguageModel?: {
				create?: (options: {
					monitor?: (monitor: EventTarget) => void;
				}) => Promise<{ destroy?: () => void }>;
			};
		}).LanguageModel;
		if (!api?.create) {
			await refreshDeviceStatus();
			return;
		}

		device = { state: 'downloading', progress: 0 };
		try {
			const session = await api.create({
				monitor(monitor) {
					monitor.addEventListener('downloadprogress', (event) => {
						const progress = Number((event as ProgressEvent).loaded ?? 0);
						device = { state: 'downloading', progress };
					});
				}
			});
			session.destroy?.();
			device = { state: 'available', detail: 'Model downloaded and ready.' };
		} catch (cause) {
			device = { state: 'unavailable', detail: String(cause) };
		}
	}
</script>

<svelte:head>
	<title>Knowledge Vault — private by default</title>
</svelte:head>

<div class="app">
	<header class="topbar">
		<div class="flex items-center gap-3">
			<span
				class="grid size-8 place-items-center rounded-lg border border-secondary/30 bg-secondary/10 text-[11px] font-semibold text-secondary"
			>
				KV
			</span>
			<div class="leading-tight">
				<div class="text-sm font-semibold tracking-tight">Knowledge Vault</div>
				<div class="text-[10px] uppercase tracking-[0.16em] text-base-content/40">
					Private by default
				</div>
			</div>
		</div>

		<div class="flex items-center gap-2">
			<button
				class="btn btn-xs gap-2 font-normal {device.state === 'available'
					? 'btn-outline btn-success'
					: device.state === 'downloadable' || device.state === 'unavailable'
						? 'btn-outline btn-warning'
						: 'btn-ghost'}"
				onclick={deviceAction}
				title={device.detail ?? 'Check the on-device model'}
			>
				<span class="size-1.5 rounded-full bg-current"></span>
				On-device: {deviceLabel}
			</button>
			<button
				class="btn btn-xs gap-2 font-normal {configured
					? 'btn-outline btn-success'
					: 'btn-outline btn-warning'}"
				onclick={() => (setupOpen = true)}
			>
				<span class="size-1.5 rounded-full bg-current"></span>
				{configured ? (appCheck ? 'Firebase connected' : 'App Check not set up') : 'Keys needed'}
			</button>
		</div>
	</header>

	<div class="workspace">
		<Sidebar
			notes={visibleNotes}
			totalNotes={notes.length}
			{query}
			{vaultLabel}
			{selectedId}
			{picking}
			onQuery={(value) => (query = value)}
			onSelect={selectNote}
			onPickFolder={pickFolder}
			onUseSample={useSampleVault}
			onOpenSetup={() => (setupOpen = true)}
			setupWarning={!configured || !appCheck}
		/>

		{#if loading}
			<section class="reader">
				<div class="reader-empty">
					<div>
						<h2>Opening the vault…</h2>
						<p>Reading notes from this device.</p>
					</div>
				</div>
			</section>
		{:else}
			<NoteView
				note={selectedNote}
				{html}
				busy={busy !== null}
				onSetSensitivity={setSensitivity}
				onSummarize={runSummary}
				onActionItems={runActionItems}
			/>
		{/if}

		<StudioPanel
			{notes}
			{results}
			{busyLabel}
			{liveText}
			{deviceProgress}
			{error}
			onAsk={previewAsk}
			onDemoBlock={demoBlock}
			onBlockedNote={blockedNote}
			onCitation={openCitation}
			onDismissError={() => (error = null)}
			onOpenSetup={() => (setupOpen = true)}
			onClear={() => (results = [])}
		/>
	</div>
</div>

{#if pending}
	<ApprovalDialog
		payload={pending.payload}
		question={pending.question}
		onApprove={approve}
		onCancel={() => (pending = null)}
	/>
{/if}

{#if setupOpen}
	<SetupDialog
		vars={envStatus()}
		{configured}
		{appCheck}
		keyProblem={apiKeyProblem()}
		onClose={() => (setupOpen = false)}
	/>
{/if}