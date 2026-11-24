# Knowledge Vault

A private-by-default knowledge vault built with SvelteKit and Firebase AI Logic.
Open a folder of markdown notes and PDFs, search it locally, summarise and extract
action items **on-device**, and use the cloud for cross-document answers only
after you approve exactly what is sent.

> **Platform note:** Firebase AI Logic's on-device inference uses Chrome's built-in
> Prompt API (Gemini Nano) and is **web-only, Chrome on Desktop 139+**, single-turn
> text only. Private notes use `ONLY_ON_DEVICE` and stop with an error rather than
> falling back to the cloud.

## The Privacy Router

Every note carries a label:

| Label | Runs on | Behaviour |
| --- | --- | --- |
| 🔒 **Private** | `ONLY_ON_DEVICE` | Never sent anywhere. If the on-device model is missing, the feature fails and says so. |
| ☁️ **Shareable** | `ONLY_IN_CLOUD` | Eligible for cloud requests, but only after the payload panel is approved. |

Before every cloud call the app shows **What leaves your device**: the notes, chunk
count, character count and the exact text. Every answer is stamped **Answered
on-device** or **Answered in cloud** using the SDK's `inferenceSource`.

What ships in this repo:

- Folder import of `.md`, `.txt`, `.mdx` and `.pdf` files via the File System Access
  API, PDF text extraction with pdf.js, chunking and IndexedDB persistence
- Instant keyword search with MiniSearch (no network, no embeddings)
- On-device summaries with streaming and map-reduce for long notes
- On-device action items as structured JSON (`task`, `owner`, `due`, `sourceLine`)
- Cloud cross-document Q&A with schema-constrained JSON and validated citations
- Sensitivity labels, the approval panel and the guardrail that blocks private notes

Deliberately deferred (see `Plan.md` §7): deep research with Google Search
grounding. It is the first thing the plan says to cut.

## Quick start

```bash
npm install
cp .env.example .env     # then fill in the Firebase values — see below
npm run dev              # http://localhost:3000
```

The vault, search, folder import and labels work **without any keys**. AI features
show a setup notice until Firebase is configured, and the in-app **Setup & API keys**
panel tells you which value is missing.

## Where the API keys go

All keys are Vite environment variables read from **`.env` at the project root**
(`.env` is git-ignored; `.env.example` is the template). The app reads them in
[`src/lib/config.ts`](src/lib/config.ts) and initialises Firebase in
[`src/lib/ai/firebase.ts`](src/lib/ai/firebase.ts).

| Variable | Required | Where to find it |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY` | yes | Firebase console → Project settings → General → Your apps → Web app → `apiKey` |
| `VITE_FIREBASE_PROJECT_ID` | yes | Same config block → `projectId` |
| `VITE_FIREBASE_APP_ID` | yes | Same config block → `appId` |
| `VITE_APPCHECK_SITE_KEY` | yes for deployed builds | Security → App Check → Apps → reCAPTCHA Enterprise site key (App Check is enforced for AI Logic; on localhost the debug token alone is enough) |
| `VITE_APPCHECK_DEBUG_TOKEN` | local dev | Set to `true`, reload, copy the token from the browser console, safelist it under App Check → Apps → ⋮ → Manage debug tokens |
| `VITE_FIREBASE_AUTH_DOMAIN` | optional | Same config block → `authDomain` |
| `VITE_FIREBASE_STORAGE_BUCKET` | optional | `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | optional | `messagingSenderId` |
| `VITE_FIREBASE_MEASUREMENT_ID` | optional | `measurementId` |
| `VITE_CLOUD_MODEL` | optional | Defaults to `gemini-3.5-flash-lite`; set an explicit current Gemini model |

Restart `npm run dev` after editing `.env` — Vite only reads it at startup.

### Firebase project setup

1. Create a Firebase project (no Analytics needed), then **Build → AI Logic → Get started**
   and choose the **Gemini Developer API** provider. The guided flow enables the
   required APIs, registers a Web app and turns on App Check for AI Logic.
2. Copy the web app config into `.env`.
3. **Security → App Check → Apps** → register reCAPTCHA Enterprise for the web app,
   put the site key in `VITE_APPCHECK_SITE_KEY`. This is the production provider.
4. For localhost, use the App Check debug provider as described above — no site
   key needed; Firebase allows enforcement with only the debug provider.
5. Before a public demo, register the hosted domain under App Check and restrict the
   API key in Google Cloud.

### Chrome setup for on-device AI

1. Chrome **139 or newer** on desktop.
2. `chrome://flags` → enable the on-device multimodal / Prompt API flag → restart.
3. Open the app and click the **On-device** chip in the header to check availability
   and start the model download (it can take several minutes).
4. Verify in the DevTools console:

   ```js
   await LanguageModel.availability(); // "available" | "downloadable" | "downloading"
   await LanguageModel.create();        // starts the download when "downloadable"
   ```

Private notes never fall back to the cloud if this is unavailable.

## Features in the UI

- **Left:** vault switcher (folder or bundled sample), local search, note list with labels.
- **Middle:** the note, its sensitivity toggle, and two on-device actions.
- **Right:** ask across shareable notes, the payload approval panel, and results
  (summaries, checklists, cited answers). Clicking a citation opens the source note
  and highlights the exact passage.

## Sample vault

`sample-vault/` contains nine markdown notes. Three are `sensitivity: private`
(journal, health, finances) and the rest are `sensitivity: shareable`, so the
guardrail and the approval panel can be demonstrated without real data. Imported
notes and PDFs are **private by default**; add `sensitivity: shareable` to a note's
frontmatter or flip the label in the note header. PDFs have no frontmatter, so
they always start private and must be flipped by hand.

## Build and deploy

```bash
npm run build            # static SPA in build/
npm run preview
```

Firebase Hosting is preconfigured in `firebase.json` (rewrites to `index.html`):

```bash
npm i -g firebase-tools
firebase login
# put your project id in .firebaserc
firebase deploy --only hosting
```

The build is a static SPA, so any static host works.

### GitHub Pages

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds the app and
publishes it to GitHub Pages on every push to `main`. The workflow builds with
`BASE_PATH=/Knowledge-Vault`, so the site is served from
<https://lardexthelarge.github.io/Knowledge-Vault/>.

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.** This one
   step has to be done in the browser: creating the Pages site is a repository
   administration call, and the workflow's `GITHUB_TOKEN` is never allowed to make
   it. Without it the first run fails at *Configure Pages* with
   `Resource not accessible by integration`. Subsequent pushes need nothing extra.
2. Add the build-time Firebase values under **Settings → Secrets and variables →
   Actions → Secrets**, using the same names as `.env` (`VITE_FIREBASE_API_KEY`,
   `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_APPCHECK_SITE_KEY`, and
   any optional ones you use). Without them the site still deploys and only the AI
   features show the setup notice. Values in the **Variables** tab, or under an
   environment's own secrets, are not visible to the build. Saving a secret does not
   redeploy anything: start a new run (or **Re-run all jobs**) afterwards, and check
   the *Check the Firebase values reached the build* step, which lists which of the
   four values were present.
3. Push to `main`, or run the workflow from the **Actions** tab.
4. Add `lardexthelarge.github.io` as an allowed domain in Firebase **App Check**,
   otherwise cloud AI calls on the deployed copy fail the App Check check.

Folder import, search and labels work from the HTTPS Pages URL, because the File
System Access API only needs a secure context. `static/.nojekyll` stops GitHub
Pages from running Jekyll, which would otherwise drop the `_app/` directory.

## Project structure

```
src/
├─ ai/
│  ├─ firebase.ts        # initializeApp, App Check, getAI
│  ├─ models.ts          # hybrid model factory (ONLY_ON_DEVICE / ONLY_IN_CLOUD)
│  ├─ router.ts          # Privacy Router: labels, payload plan, guardrail
│  ├─ summarize.ts       # on-device, streaming + map-reduce
│  ├─ actionItems.ts     # on-device, structured output
│  ├─ citedAnswer.ts     # cloud, structured output + citation validation
│  └─ errors.ts          # actionable error messages
├─ vault/                # folder access, PDF text, frontmatter, chunker, IndexedDB
├─ search/               # MiniSearch index
├─ components/           # sidebar, reader, studio, approval + setup dialogs
└─ routes/+page.svelte   # app shell and flow wiring
sample-vault/            # demo notes (private + shareable)
```

## License

Apache-2.0 — see [LICENSE](LICENSE).
