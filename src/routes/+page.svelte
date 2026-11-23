<script lang="ts">
	import { onMount } from 'svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import NoteView from '$lib/components/NoteView.svelte';
	import DocChat from '$lib/components/DocChat.svelte';
	import AskVault from '$lib/components/AskVault.svelte';
	import ApprovalDialog from '$lib/components/ApprovalDialog.svelte';
	import SetupDialog from '$lib/components/SetupDialog.svelte';
	import { SAMPLE_VAULT } from '$lib/vault/sampleVault';
	import {
		getMeta,
		loadNotes,
		loadSensitivity,
		saveNote,
		saveNotes,
		saveSensitivity,
		setMeta,
		type SensitivityMap
	} from '$lib/vault/db';
	import {
		FolderAccessError,
		FolderPickerCancelled,
		readVaultFolder
	} from '$lib/vault/fsAccess';
	import { createIndex, searchNotes } from '$lib/search';
	import { renderMarkdown } from '$lib/vault/markdown';
	import { planCloudQuestion, PrivacyBlockedError, type CloudPlan } from '$lib/ai/router';
	import { summarizeNote } from '$lib/ai/summarize';
	import { extractActionItems } from '$lib/ai/actionItems';
	import { answerWithChunks } from '$lib/ai/citedAnswer';
	import { answerOnDevice } from '$lib/ai/onDeviceAnswer';
	import { describeAiError, type FriendlyError } from '$lib/ai/errors';
	import { apiKeyProblem, appCheckConfigured, envStatus, isFirebaseConfigured } from '$lib/config';
	import type {
		ChatMessage,
		ChatTurn,
		Chunk,
		DeviceStatus,
		Note,
		Sensitivity
	} from '$lib/types';

	type View = 'doc' | 'ask';

	let notes = $state<Note[]>([]);
	let selectedId = $state<string | null>(null);
	let vaultLabel = $state('Sample vault');
	let query = $state('');
	let loading = $state(true);
	let picking = $state(false);
	/** Storage key of the open vault, so every folder keeps its own Private/Shareable labels. */
	let vaultKey = $state('sample');
	let savedTags = $state<SensitivityMap>({});
	/** Non-blocking note: a partial import or a cache failure must not hide a loaded vault. */
	let notice = $state<{ title: string; detail?: string; hint?: string } | null>(null);

	let view = $state<View>('doc');
	let docMessages = $state<ChatMessage[]>([]);
	let vaultMessages = $state<ChatMessage[]>([]);

	let highlight = $state<{ start: number; end: number } | null>(null);

	let busy = $state<null | 'summary' | 'actions' | 'doc-answer' | 'vault-answer'>(null);
	let liveText = $state('');
	let deviceProgress = $state<number | null>(null);
	let error = $state<FriendlyError | null>(null);
	let pending = $state<CloudPlan | null>(null);
	let pendingView = $state<View>('doc');
	let pendingHistory = $state(0);
	let setupOpen = $state(false);
	let device = $state<DeviceStatus>({ state: 'unknown' });

	const index = $derived(createIndex(notes));
	const hits = $derived.by(() => (query.trim() ? searchNotes(index, notes, query) : []));
	const visibleNotes = $derived(query.trim() ? hits.map((hit) => hit.note) : notes);
	const selectedNote = $derived(notes.find((note) => note.id === selectedId) ?? null);
	const html = $derived(selectedNote ? renderMarkdown(selectedNote.content, highlight) : '');
	const configured = $derived(isFirebaseConfigured());
	const appCheck = $derived(appCheckConfigured());

	// -------------------------------------------------- resizable column widths
	const SIDEBAR_MIN = 210;
	const SIDEBAR_MAX = 520;
	const CHAT_MIN = 300;
	const CHAT_MAX = 780;
	const READER_MIN = 320;
	const HANDLE = 5;

	let workspaceEl = $state<HTMLElement | null>(null);
	// `null` means "use the responsive default from the stylesheet".
	let sidebarWidth = $state<number | null>(null);
	let chatWidth = $state<number | null>(null);
	let resizeSide = $state<'sidebar' | 'chat' | null>(null);

	const workspaceStyle = $derived(
		[
			sidebarWidth === null ? '' : `--sidebar-w:${sidebarWidth}px`,
			chatWidth === null ? '' : `--chat-w:${chatWidth}px`
		]
			.filter(Boolean)
			.join('; ')
	);

	const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

	function startResize(side: 'sidebar' | 'chat', event: PointerEvent) {
		const box = workspaceEl;
		if (!box || event.button !== 0) return;
		const sidebar = box.querySelector<HTMLElement>('.sidebar');
		const chat = box.querySelector<HTMLElement>('.chat');
		if (!sidebar || !chat) return;

		event.preventDefault();
		const rect = box.getBoundingClientRect();
		const startX = event.clientX;
		const startSidebar = sidebarWidth ?? sidebar.getBoundingClientRect().width;
		const startChat = chatWidth ?? chat.getBoundingClientRect().width;
		// Never let either panel squeeze the reader out of existence.
		const sidebarMax = Math.max(SIDEBAR_MIN, rect.width - startChat - READER_MIN - 2 * HANDLE);
		const chatMax = Math.max(CHAT_MIN, rect.width - startSidebar - READER_MIN - 2 * HANDLE);

		resizeSide = side;
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';

		const move = (moveEvent: PointerEvent) => {
			const delta = moveEvent.clientX - startX;
			if (side === 'sidebar') {
				sidebarWidth = clamp(startSidebar + delta, SIDEBAR_MIN, Math.min(SIDEBAR_MAX, sidebarMax));
			} else {
				chatWidth = clamp(startChat - delta, CHAT_MIN, Math.min(CHAT_MAX, chatMax));
			}
		};
		const end = () => {
			resizeSide = null;
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', end);
			window.removeEventListener('pointercancel', end);
			window.removeEventListener('blur', end);
		};

		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', end);
		window.addEventListener('pointercancel', end);
		// Releasing the button outside the window never fires pointerup.
		window.addEventListener('blur', end);
	}

	// Arrow keys resize the focused divider; Shift moves in bigger steps.
	function nudgeResize(side: 'sidebar' | 'chat', event: KeyboardEvent) {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		event.preventDefault();
		const box = workspaceEl;
		if (!box) return;
		const step = (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 48 : 16);
		const panel = box.querySelector<HTMLElement>(side === 'sidebar' ? '.sidebar' : '.chat');
		const current =
			side === 'sidebar'
				? (sidebarWidth ?? panel?.getBoundingClientRect().width ?? 288)
				: (chatWidth ?? panel?.getBoundingClientRect().width ?? 384);

		if (side === 'sidebar') {
			sidebarWidth = clamp(current + step, SIDEBAR_MIN, SIDEBAR_MAX);
		} else {
			// The chat divider grows the panel to the left, so the arrow direction flips.
			chatWidth = clamp(current - step, CHAT_MIN, CHAT_MAX);
		}
	}

	const busyLabel = $derived(
		busy === 'summary'
			? 'Summarising on this device…'
			: busy === 'actions'
				? 'Extracting action items on this device…'
				: busy === 'doc-answer'
					? 'Thinking about this file…'
					: busy === 'vault-answer'
						? 'Asking across your files…'
						: null
	);
	const docBusyLabel = $derived(
		busy === 'summary' || busy === 'actions' || busy === 'doc-answer' ? busyLabel : null
	);
	const vaultBusyLabel = $derived(busy === 'vault-answer' ? busyLabel : null);

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

	/** Re-apply the labels the user set the last time this vault was open. */
	function withSavedTags(list: Note[], tags: SensitivityMap): Note[] {
		return list.map((note) => {
			const saved = tags[note.path];
			return saved && saved !== note.sensitivity ? { ...note, sensitivity: saved } : note;
		});
	}

	/**
	 * Cache the vault on this device. A storage problem (full quota, IndexedDB
	 * blocked) must never hide a vault that is already loaded in memory, so it
	 * surfaces as a dismissible notice instead of an error dialog.
	 */
	async function persistVault(name: string, key: string): Promise<string | null> {
		try {
			await saveNotes(notes);
			await setMeta('vaultLabel', name);
			await setMeta('vaultKey', key);
			return null;
		} catch (cause) {
			return cause instanceof Error ? cause.message : String(cause);
		}
	}

	/** Switch vault, re-apply its saved labels, and report any cache failure. */
	async function switchVault(list: Note[], name: string, key: string): Promise<string | null> {
		const tags = await loadSensitivity(key).catch(() => ({}) as SensitivityMap);
		vaultKey = key;
		savedTags = tags;
		notes = withSavedTags(list, tags);
		vaultLabel = name;
		selectedId = notes[0]?.id ?? null;
		query = '';
		resetChats();
		return persistVault(name, key);
	}

	/** One notice for a folder that opened with skipped files and/or was not cached. */
	function vaultNotice(name: string, count: number, cacheError: string | null, warnings: string[]) {
		if (!cacheError && warnings.length === 0) {
			notice = null;
			return;
		}
		const detail = [
			cacheError ? `This browser could not cache the vault on this device: ${cacheError}` : '',
			...warnings
		]
			.filter(Boolean)
			.join(' ');
		notice = {
			title: `${name} is open — ${count} notes read`,
			detail,
			hint: cacheError
				? 'The files stay usable until you reload. Free up disk space or allow site data for this page, then open the folder again.'
				: 'Everything that was read is searchable as usual. Skipped files were left untouched on your disk.'
		};
	}

	onMount(async () => {
		try {
			const saved = await loadNotes();
			if (saved.length > 0) {
				const label =
					(await getMeta<string>('vaultLabel')) ??
					(saved[0]?.source === 'sample' ? 'Sample vault' : 'Saved vault');
				const key =
					(await getMeta<string>('vaultKey')) ??
					(saved[0]?.source === 'sample' ? 'sample' : `folder:${label}`);
				const tags = await loadSensitivity(key).catch(() => ({}) as SensitivityMap);
				vaultKey = key;
				savedTags = tags;
				vaultLabel = label;
				notes = withSavedTags(saved, tags);
			} else {
				const tags = await loadSensitivity('sample').catch(() => ({}) as SensitivityMap);
				vaultKey = 'sample';
				savedTags = tags;
				notes = withSavedTags(
					SAMPLE_VAULT.map((note) => ({ ...note })),
					tags
				);
				await saveNotes(notes).catch(() => undefined);
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

	// ------------------------------------------------------------- chat plumbing
	function userMessage(text: string): ChatMessage {
		return { id: crypto.randomUUID(), role: 'user', kind: 'question', text };
	}

	/** Earlier turns only: the question is appended to the chat but sent separately. */
	function transcript(messages: ChatMessage[]): ChatTurn[] {
		const prior =
			messages[messages.length - 1]?.role === 'user' ? messages.slice(0, -1) : messages;
		return prior
			.filter((message) => message.text.trim().length > 0)
			.map((message) => ({ role: message.role, text: message.text }));
	}

	function appendAssistant(target: View, message: Omit<ChatMessage, 'id' | 'role'>) {
		const full: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', ...message };
		if (target === 'doc') docMessages = [...docMessages, full];
		else vaultMessages = [...vaultMessages, full];
	}

	function openNote(id: string) {
		if (id !== selectedId) {
			selectedId = id;
			docMessages = [];
			liveText = '';
		}
		highlight = null;
	}

	function selectNote(id: string) {
		openNote(id);
	}

	function openCitation(chunks: Chunk[], chunkId: string) {
		const chunk = chunks.find((item) => item.id === chunkId);
		if (!chunk) return;
		openNote(chunk.noteId);
		view = 'doc';
		highlight = { start: chunk.start, end: chunk.end };
	}

	function resetChats() {
		docMessages = [];
		vaultMessages = [];
		liveText = '';
		highlight = null;
	}

	// ------------------------------------------------------------- single file
	async function askDoc(question: string) {
		const note = selectedNote;
		if (!note || busy) return;
		error = null;
		docMessages = [...docMessages, userMessage(question)];

		if (note.sensitivity === 'private') {
			await answerDocOnDevice(note, question);
			return;
		}

		try {
			pending = planCloudQuestion(question, [note]);
			pendingView = 'doc';
			pendingHistory = transcript(docMessages).length;
		} catch (cause) {
			error = describeAiError(cause);
		}
	}

	async function answerDocOnDevice(note: Note, question: string) {
		busy = 'doc-answer';
		deviceProgress = null;
		liveText = '';
		try {
			const answer = await answerOnDevice(question, note, transcript(docMessages), {
				onProgress: (progress) => (deviceProgress = progress),
				onToken: (text) => (liveText = text)
			});
			appendAssistant('doc', {
				kind: 'answer',
				text: answer.text,
				source: answer.source,
				noteTitle: note.title
			});
			device = { state: 'available', detail: 'The on-device model answered.' };
		} catch (cause) {
			error = describeAiError(cause);
		} finally {
			busy = null;
			deviceProgress = null;
			liveText = '';
		}
	}

	async function setSensitivity(next: Sensitivity) {
		if (!selectedNote) return;
		if (selectedNote.sensitivity === next) return;
		// Flipping the label starts a fresh conversation: earlier turns were answered
		// under the old privacy rule, so they must not silently become cloud context.
		docMessages = [];
		liveText = '';
		const updated: Note = { ...selectedNote, sensitivity: next };
		notes = notes.map((note) => (note.id === updated.id ? updated : note));
		// Remember the label per file so it survives switching folders and coming back.
		savedTags = { ...savedTags, [updated.path]: next };
		try {
			await saveNote(updated);
			await saveSensitivity(vaultKey, savedTags);
		} catch {
			/* the label still applies for this session */
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
			appendAssistant('doc', {
				kind: 'summary',
				text: summary.text,
				source: summary.source,
				noteTitle: note.title,
				chunkCount: summary.chunkCount,
				reduced: summary.reduced
			});
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
			appendAssistant('doc', {
				kind: 'actions',
				text: '',
				items: extracted.items,
				source: extracted.source,
				noteTitle: note.title
			});
			device = { state: 'available', detail: 'The on-device model answered.' };
		} catch (cause) {
			error = describeAiError(cause);
		} finally {
			busy = null;
		}
	}

	// ------------------------------------------------------------ ask the vault
	function askVault(question: string, noteIds: string[]) {
		if (busy) return;
		const chosen = notes.filter((note) => noteIds.includes(note.id));
		error = null;
		if (chosen.length === 0) {
			error = {
				kind: 'unknown',
				title: 'No files selected',
				detail: 'Choose at least one shareable file to ask across.',
				hint: 'Private files cannot be sent to the cloud at all.'
			};
			return;
		}
		vaultMessages = [...vaultMessages, userMessage(question)];
		try {
			pending = planCloudQuestion(question, chosen);
			pendingView = 'ask';
			pendingHistory = transcript(vaultMessages).length;
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
		const target = pendingView;
		const history = transcript(target === 'doc' ? docMessages : vaultMessages);
		pending = null;
		busy = target === 'doc' ? 'doc-answer' : 'vault-answer';
		error = null;
		try {
			const answer = await answerWithChunks(plan.question, plan.chunks, history);
			appendAssistant(target, {
				kind: 'answer',
				text: answer.answer,
				claims: answer.claims,
				chunks: plan.chunks,
				source: answer.source
			});
		} catch (cause) {
			error = describeAiError(cause);
		} finally {
			busy = null;
		}
	}

	// ------------------------------------------------------------------ vault
	async function useSampleVault() {
		error = null;
		notice = null;
		const cacheError = await switchVault(
			SAMPLE_VAULT.map((note) => ({ ...note })),
			'Sample vault',
			'sample'
		);
		vaultNotice('Sample vault', notes.length, cacheError, []);
	}

	async function pickFolder() {
		picking = true;
		error = null;
		notice = null;
		try {
			const loaded = await readVaultFolder();
			const cacheError = await switchVault(loaded.notes, loaded.name, `folder:${loaded.name}`);
			vaultNotice(loaded.name, notes.length, cacheError, loaded.warnings);
		} catch (cause) {
			// Closing the picker is a choice, not a failure.
			if (cause instanceof FolderPickerCancelled) return;
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

<svelte:window
	onkeydown={(event) => {
		// Settings are left to their own dialogs; Escape only dismisses the error modal.
		if (event.key !== 'Escape' || pending || setupOpen) return;
		if (error) error = null;
	}}
/>

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

		<nav class="nav-tabs" aria-label="Views">
			<button
				type="button"
				class="nav-tab"
				class:is-active={view === 'doc'}
				aria-current={view === 'doc' ? 'page' : undefined}
				onclick={() => (view = 'doc')}
			>
				<svg
					viewBox="0 0 24 24"
					width="14"
					height="14"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
					focusable="false"
				>
					<path d="M6 3h8l4 4v14H6z" stroke-linejoin="round" />
					<path d="M9 12h6M9 16h6" stroke-linecap="round" />
				</svg>
				Single file
			</button>
			<button
				type="button"
				class="nav-tab"
				class:is-active={view === 'ask'}
				aria-current={view === 'ask' ? 'page' : undefined}
				onclick={() => (view = 'ask')}
			>
				<svg
					viewBox="0 0 24 24"
					width="14"
					height="14"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
					focusable="false"
				>
					<path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-5.5A8 8 0 0 1 11 4h2a8 8 0 0 1 8 8z" stroke-linejoin="round" />
					<path d="M8.5 11.5h7M8.5 15h4" stroke-linecap="round" />
				</svg>
				Ask the vault
			</button>
		</nav>

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

	{#if notice}
		<div class="vault-notice" role="status">
			<div class="min-w-0 flex-1">
				<p class="font-medium {notice.detail ? '' : 'opacity-80'}">{notice.title}</p>
				{#if notice.detail}
					<p class="mt-1 whitespace-pre-line opacity-75">{notice.detail}</p>
				{/if}
				{#if notice.hint}
					<p class="notice-hint">{notice.hint}</p>
				{/if}
			</div>
			<button
				type="button"
				class="btn btn-xs btn-ghost shrink-0"
				onclick={() => (notice = null)}>Dismiss</button
			>
		</div>
	{/if}

	{#if view === 'doc'}
		<div class="workspace" style={workspaceStyle} bind:this={workspaceEl}>
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

			<button
				type="button"
				class="resizer resizer-sidebar"
				class:is-dragging={resizeSide === 'sidebar'}
				aria-label="Resize the notes list"
				title="Drag to resize · double-click to reset"
				onpointerdown={(event) => startResize('sidebar', event)}
				onkeydown={(event) => nudgeResize('sidebar', event)}
				ondblclick={() => (sidebarWidth = null)}
			></button>

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

			<button
				type="button"
				class="resizer resizer-chat"
				class:is-dragging={resizeSide === 'chat'}
				aria-label="Resize the chat panel"
				title="Drag to resize · double-click to reset"
				onpointerdown={(event) => startResize('chat', event)}
				onkeydown={(event) => nudgeResize('chat', event)}
				ondblclick={() => (chatWidth = null)}
			></button>

			<DocChat
				note={selectedNote}
				messages={docMessages}
				busyLabel={docBusyLabel}
				liveText={docBusyLabel ? liveText : ''}
				{deviceProgress}
				onAsk={askDoc}
				onOpenSetup={() => (setupOpen = true)}
				onCitation={openCitation}
			/>
		</div>
	{:else}
		<AskVault
			{notes}
			messages={vaultMessages}
			busyLabel={vaultBusyLabel}
			liveText=""
			deviceProgress={null}
			onAsk={askVault}
			onBlockedNote={blockedNote}
			onCitation={openCitation}
			onDemoBlock={demoBlock}
			onClear={() => (vaultMessages = [])}
		/>
	{/if}
</div>

{#if error}
	<div class="modal modal-open">
		<div class="modal-box max-w-lg" role="dialog" aria-modal="true" aria-labelledby="error-title">
			<div class="flex items-start gap-3">
				<span
					class="grid size-9 shrink-0 place-items-center rounded-full bg-error/15 text-base font-semibold text-error"
					aria-hidden="true">!</span
				>
				<div class="min-w-0">
					<h3 id="error-title" class="text-base font-semibold leading-snug">{error.title}</h3>
					<p class="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-base-content/75">
						{error.detail}
					</p>
				</div>
			</div>

			{#if error.hint}
				<p
					class="mt-4 rounded-lg border border-base-300 bg-base-200/60 px-3 py-2 text-xs leading-relaxed text-base-content/65"
				>
					{error.hint}
				</p>
			{/if}

			<div class="modal-action">
				{#if error.kind === 'setup' || error.kind === 'app-check'}
					<button
						class="btn btn-sm btn-outline"
						onclick={() => {
							error = null;
							setupOpen = true;
						}}>Open setup</button
					>
				{/if}
				<button class="btn btn-sm btn-primary" onclick={() => (error = null)}>Dismiss</button>
			</div>
		</div>
		<button class="modal-backdrop" aria-label="Close" onclick={() => (error = null)}>close</button>
	</div>
{/if}

{#if pending}
	<ApprovalDialog
		payload={pending.payload}
		question={pending.question}
		historyCount={pendingHistory}
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
