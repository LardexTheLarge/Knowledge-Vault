---
title: Competitor teardown
sensitivity: shareable
---
# Competitor teardown

Three products matter for the 1.0 launch. Names are deliberately omitted here so
this note can be shared without dragging other brands into a public repo.

## Product A — the cloud notebook with AI baked in

- Strong editor, excellent mobile apps, zero setup.
- Every AI action happens server-side, including summarising a single line.
- Pricing: free for 200 notes, 12 EUR per month for AI features.
- Weakness for our audience: no local files, no export that preserves structure.

## Product B — the local-first editor

- Files on disk, fast search, a loyal technical audience.
- AI is a plugin the user installs and configures with their own API key.
- Pricing: one-time 49 EUR, no subscription.
- Weakness: setup friction. Our beta users called the plugin flow "a weekend project".

## Product C — the AI research assistant

- Excellent cross-document answers with citations.
- Requires uploading a corpus to their servers. No per-document privacy boundary.
- Pricing: 20 EUR per month, team plans at 18 EUR per seat.
- Weakness: trust. Two interviewees had stopped using it after a data-retention
  policy change.

## Feature comparison

| Capability | A | B | C | Atlas 1.0 |
| --- | --- | --- | --- | --- |
| Notes as local files | No | Yes | No | Yes |
| Offline search | No | Yes | No | Yes |
| On-device AI | No | Plugin | No | Yes |
| Per-note privacy labels | No | No | No | Yes |
| Cited cross-document answers | Yes | No | Yes | Yes, cloud and opt-in |
| Zero-setup onboarding | Yes | No | Yes | Partly |

## Gaps we can own

1. Per-note control over what is sent to a model. Nobody ships this clearly.
2. An approval panel that shows the exact payload. It is a trust feature and a
   demo feature at the same time.
3. A pricing position between B's one-time licence and C's 20 EUR subscription:
   6 EUR solo, 14 EUR studio.

## Threat

Product A could copy the labels in a quarter. The defensible part is the local
file model plus the honesty of the labels; if we drift into a hosted silo we lose
the only story that made people switch.
