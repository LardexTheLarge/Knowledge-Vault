# Personal Knowledge Vault: MVP Plan

A private-by-default knowledge vault built for the Firebase AI Logic hackathon. Sensitive notes stay on-device; the cloud is used only when the user approves it.

> **Important constraint:** Firebase AI Logic's hybrid on-device inference is currently **web-only (Chrome on Desktop)**. It uses Chrome's built-in Prompt API (Gemini Nano) and supports only **single-turn text generation** (no chat), plus PNG/JPEG image input, with streaming. Build this as a Chrome desktop web app and design around those limits.

The docs list four inference modes: `PREFER_ON_DEVICE`, `ONLY_ON_DEVICE`, `PREFER_IN_CLOUD`, and `ONLY_IN_CLOUD`. The privacy feature below is built on them.

---

## 1. The Winning Idea: A Privacy Router

"Local + cloud" is easy to claim, so make it visible and controllable.

- **Every note gets a label:** 🔒 Private (never leaves the device) or ☁️ Shareable.
- **Private notes** use `ONLY_ON_DEVICE`. If the on-device model is unavailable, the app shows an error and never silently falls back to the cloud.
- **Shareable notes** can use the cloud (`ONLY_IN_CLOUD`) for the heavy features.
- **"What leaves your device" panel:** before any cloud call, show the exact payload (which chunks, how many characters) and require a click to approve. This is the demo centerpiece.
- **Mode badge on every answer:** "Answered on-device" or "Answered in cloud".

---

## 2. MVP Scope

| Feature                                                          | Where it runs   | Firebase AI Logic mode                                   |
| ---------------------------------------------------------------- | --------------- | -------------------------------------------------------- |
| Open a local folder of `.md`/`.txt` files (Obsidian-style vault) | Browser         | None (File System Access API)                            |
| Search notes                                                     | Browser, no LLM | None (MiniSearch/BM25 over IndexedDB)                    |
| Summarize a note                                                 | On-device       | `ONLY_ON_DEVICE`                                         |
| Extract action items (JSON checklist)                            | On-device       | `ONLY_ON_DEVICE` + structured output                     |
| Cross-document Q&A with citations                                | Cloud           | `ONLY_IN_CLOUD` + structured output                      |
| Deep research (notes + web)                                      | Cloud           | `ONLY_IN_CLOUD`, optionally with Google Search grounding |

**Cut from the MVP:** chat history, embeddings/vector search, mobile app, auth, sync, PDF parsing (start with markdown and text), graph view, settings UI. Keyword search is fine and keeps the "nothing leaves your device" story simple.

---

## 3. Architecture

```
Chrome (desktop)
├─ UI (Sveltekit)
├─ Vault layer: File System Access API → chunker → IndexedDB
├─ Search: MiniSearch index (local)
├─ AI layer (src/ai/):
│    ├─ localModel  = getGenerativeModel(ai, { mode: ONLY_ON_DEVICE })
│    ├─ cloudModel  = getGenerativeModel(ai, { mode: ONLY_IN_CLOUD })
│    └─ router.ts   → picks model from note labels + user approval
└─ Firebase Hosting (public demo URL, with a sample vault)
```

### Technical notes

- **On-device context is small.** Chunk notes to roughly 1–2k characters. For long documents, use map-reduce: summarize each chunk, then summarize the summaries.
- **Citations:** give each chunk an ID like `[note-name#3]` and require the cloud model to return JSON (the answer plus claims, each with chunk IDs). Render these as clickable links that open the source note and highlight the passage. Validate the IDs against real chunks so the model can't invent citations.
- **Structured output** for action items: `{ task, owner?, due?, sourceLine }[]`.
- Call `getGenerativeModel` after a user interaction (the docs require this for on-device mode), and handle the first-use model download with a progress indicator.
- **Verify which model answered.** Check whether the SDK reports which backend ran. If not, rely on the requested mode plus Chrome's availability check, and be honest about it.
- The docs listed `gemini-2.0-flash-lite` as the default cloud model for the hybrid modes. Set a current model explicitly and check the docs for the best available Gemini model.
- Consider App Check on the hosted demo to protect your quota.

---

## 4. Build Schedule (10 days)

I don't know your deadline, so this is a 10-day plan. Compress as needed.

| Days | Focus                  | Tasks                                                                                                                                                                                                    |
| ---- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–2  | Foundation             | Create Firebase project, enable AI Logic (Gemini Developer API), set up Chrome on-device flags or origin trial. Get a "hello world" on-device call and a cloud call working. **Biggest risk, do first.** |
| 3–4  | Vault and search       | Folder picker, chunking, IndexedDB, MiniSearch, note viewer                                                                                                                                              |
| 5–6  | On-device features     | Summarize, extract action items, streaming, map-reduce for long notes, model-download UX                                                                                                                 |
| 7–8  | Cloud + Privacy Router | Cross-doc Q&A with citations, deep research, sensitivity labels, payload-approval panel                                                                                                                  |
| 9    | Polish and deploy      | Sample vault, Firebase Hosting, README, license                                                                                                                                                          |
| 10   | Video and submission   | Record, edit, upload to YouTube, submit                                                                                                                                                                  |

---

## 5. Submission Checklist Mapped to the Rules

- [x] **Public GitHub/GitLab repo with an open source license.** Add an Apache-2.0 `LICENSE` file on day 1 and confirm it appears in the repo's About section.
- [ ] **Firebase AI Logic used at runtime**, not just named in the README. `firebase/ai` is imported and called in `src/ai/`. Link those files in your description.
- [ ] **Repo contains everything needed to run it:** source, a sample vault, setup instructions, and the Chrome flag steps.
- [ ] **Platform:** select Web.
- [ ] **Existing app?** If new, say so. If reusing prior code, write a summary of what you built during the submission period.
- [ ] **Text description** covering how you used Firebase AI Logic, the features, and the value proposition.
- [ ] **Demo video:** 3 minutes max, public on YouTube, English or with subtitles, showing the app running in Chrome.
- [ ] **Hosted URL** (strongly encouraged). Judges' browsers may lack Gemini Nano, so include clear setup instructions and a README note.
- [ ] **No third-party logos or branding** in the video or app. Don't show Obsidian or NotebookLM logos, and avoid unrelated branded tabs. Use your own sample notes, not copyrighted material.
- [ ] **Optional:** use a coding agent with Firebase agent skills.

---

## 6. Demo Video Script (under 3:00)

1. **0:00–0:20 Problem:** your notes are private, but the best AI is in the cloud.
2. **0:20–0:50 Open vault and search:** pick a folder, search instantly, no network.
3. **0:50–1:30 Private AI:** summarize a 🔒 note and extract action items. Show DevTools' Network tab with zero requests, or put the browser in airplane mode, and show the "on-device" badge.
4. **1:30–2:30 Cloud AI:** select shareable notes, show the "what leaves your device" panel, approve, then show a cross-document answer with clickable citations that jump to the source passage.
5. **2:30–2:50 Guardrail:** try to send a private note to the cloud and show it being blocked.
6. **2:50–3:00 Value prop** one-liner.

The airplane-mode and empty-network-tab shots are what convince judges the privacy claim is real.

---

## 7. Risks and Mitigations

| Risk                                     | Mitigation                                                                                                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gemini Nano is hard for judges to enable | Provide exact setup steps and a hosted demo. Record the video on a machine where it works.                                                                                |
| Small on-device context                  | Chunk, map-reduce, keep demo notes short                                                                                                                                  |
| On-device quality is modest              | Keep on-device tasks simple (summaries, extraction); save reasoning for the cloud. That split is also your narrative.                                                     |
| Scope creep                              | If behind, cut deep research with web grounding first. Core: local search, on-device summaries and action items, cloud Q&A with citations, all behind the Privacy Router. |
| Rule drift                               | Re-read the official contest page for the deadline and any rules that differ from the pasted text                                                                         |

---

## 8. Submission Description Outline

- **One-liner:** A private-by-default knowledge vault that keeps sensitive notes on-device and uses the cloud only when you approve it.
- **How Firebase AI Logic is used:** hybrid inference with `ONLY_ON_DEVICE` for private notes and `ONLY_IN_CLOUD` for approved notes, plus structured output for action items and citations (list the actual files).
- **Features:** local search, summaries, action items, cited cross-document answers, and the Privacy Router.
- **Value proposition:** people want AI over their personal notes but won't upload everything. The user decides what leaves the device, and can see it.

---

## Suggested Repo Structure

```
personal-knowledge-vault/
├─ LICENSE                 # Apache-2.0
├─ README.md               # value prop, setup, Chrome flags, demo link
├─ sample-vault/           # demo notes (private + shareable)
├─ src/
│  ├─ ai/
│  │  ├─ firebase.ts       # initializeApp, getAI
│  │  ├─ models.ts         # localModel / cloudModel
│  │  ├─ router.ts         # Privacy Router
│  │  ├─ summarize.ts      # on-device
│  │  ├─ actionItems.ts    # on-device, structured output
│  │  └─ citedAnswer.ts    # cloud, structured output + citation validation
│  ├─ vault/               # folder access, chunker, IndexedDB
│  ├─ search/              # MiniSearch index
│  └─ ui/                  # components, payload-approval panel
└─ firebase.json
```
