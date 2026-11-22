<script lang="ts">
	import type { EnvVarInfo } from '$lib/config';

	interface Props {
		vars: EnvVarInfo[];
		configured: boolean;
		appCheck: boolean;
		keyProblem?: string | null;
		onClose: () => void;
	}

	let { vars, configured, appCheck, keyProblem = null, onClose }: Props = $props();
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && onClose()} />

<div class="modal modal-open">
	<div class="modal-box max-w-3xl" role="dialog" aria-modal="true" aria-label="Setup and API keys">
		<span class="badge badge-sm badge-outline">Setup</span>
		<h3 class="mt-3 text-lg font-semibold">API keys and setup</h3>
		<p class="mt-1 text-xs leading-relaxed text-base-content/60">
			All keys live in <code class="rounded bg-base-300 px-1 py-0.5">.env</code> at the project root. Copy
			<code class="rounded bg-base-300 px-1 py-0.5">.env.example</code> to
			<code class="rounded bg-base-300 px-1 py-0.5">.env</code>, fill in the values, and restart
			<code class="rounded bg-base-300 px-1 py-0.5">npm run dev</code>. This panel reads the same values
			the app uses: a green row means the value is set, not that Firebase accepts it.
		</p>

		<h4 class="mt-5 text-[11px] font-medium uppercase tracking-[0.1em] text-base-content/45">
			Environment
		</h4>
		<div class="mt-2 overflow-hidden rounded-lg border border-base-300">
			<table class="table table-sm">
				<tbody>
					{#each vars as item (item.name)}
						<tr>
							<td>
								<div class="font-mono text-[11px]">{item.name}</div>
								<div class="text-[11px] text-base-content/40">{item.where}</div>
							</td>
							<td class="text-right">
								{#if item.present}
									<span class="badge badge-xs badge-success">set</span>
								{:else if item.required}
									<span class="badge badge-xs badge-warning">needed</span>
								{:else}
									<span class="badge badge-xs badge-ghost">optional</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if !configured}
			<div class="alert alert-warning mt-4 text-xs leading-relaxed">
				<span>
					Missing keys: the vault, search, folder import and labels all work now. AI features stay
					disabled until <code>VITE_FIREBASE_API_KEY</code>, <code>VITE_FIREBASE_PROJECT_ID</code> and
					<code>VITE_FIREBASE_APP_ID</code> are set.
				</span>
			</div>
		{:else if keyProblem}
			<div class="alert alert-error mt-4 text-xs leading-relaxed">
				<span>{keyProblem}</span>
			</div>
		{:else if !appCheck}
			<div class="alert alert-warning mt-4 text-xs leading-relaxed">
				<span>
					Firebase config found, but no App Check key. Firebase enforces App Check for AI Logic, so
					cloud requests will be rejected until <code>VITE_APPCHECK_SITE_KEY</code> is set.
				</span>
			</div>
		{:else}
			<div class="alert alert-success mt-4 text-xs">
				<span>Firebase config and App Check key are present.</span>
			</div>
		{/if}

		<h4 class="mt-5 text-[11px] font-medium uppercase tracking-[0.1em] text-base-content/45">
			Firebase setup
		</h4>
		<ol class="mt-2 flex list-decimal flex-col gap-2 pl-4 text-xs leading-relaxed text-base-content/70">
			<li>
				Create a Firebase project, then open <strong>Build → AI Logic → Get started</strong> and choose
				the <strong>Gemini Developer API</strong> provider. The guided flow enables the required APIs,
				registers a Web app and turns on App Check.
			</li>
			<li>
				In <strong>Project settings → General → Your apps → Web app</strong>, open the SDK config and
				copy <code>apiKey</code>, <code>projectId</code> and <code>appId</code> into <code>.env</code>.
			</li>
			<li>
				In <strong>Security → App Check → Apps</strong>, register a reCAPTCHA Enterprise provider for
				the web app and copy the site key to <code>VITE_APPCHECK_SITE_KEY</code>.
			</li>
			<li>
				On localhost, set <code>VITE_APPCHECK_DEBUG_TOKEN=true</code>, reload, copy the debug token
				printed in the browser console, and add it under
				<strong>App Check → Apps → ⋮ → Manage debug tokens</strong>.
			</li>
			<li>Restart the dev server so Vite picks up the new environment values.</li>
		</ol>

		<h4 class="mt-5 text-[11px] font-medium uppercase tracking-[0.1em] text-base-content/45">
			On-device model (Chrome desktop)
		</h4>
		<ol class="mt-2 flex list-decimal flex-col gap-2 pl-4 text-xs leading-relaxed text-base-content/70">
			<li>Use <strong>Chrome 139+</strong> on desktop. Other browsers keep the cloud path only.</li>
			<li>
				Open <code>chrome://flags</code>, enable the on-device multimodal / Prompt API flag, and restart
				Chrome.
			</li>
			<li>
				Click the on-device status chip in the header to check availability and start the model
				download. It can take several minutes.
			</li>
		</ol>

		<div class="modal-action items-end justify-between gap-4">
			<p class="max-w-sm text-[11px] leading-relaxed text-base-content/45">
				Keys are client-side Firebase web config, not a server secret. Restrict them with App Check and
				Firebase security rules before publishing a public demo.
			</p>
			<button class="btn btn-sm" onclick={onClose}>Close</button>
		</div>
	</div>
	<button class="modal-backdrop" aria-label="Close" onclick={onClose}>close</button>
</div>
