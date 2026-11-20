---
title: Atlas 1.0 launch plan
sensitivity: shareable
---
# Atlas 1.0 launch plan

## Goal

Ship Atlas 1.0 to paying customers on **9 June 2026** with a small, honest launch:
no waitlist theatre, no "beta" badge that never comes off. The bar is a product a
stranger can install, understand in ten minutes, and trust with their notes.

## Positioning

Atlas is a local-first notebook. Notes live in plain files the user owns, search
works offline, and every AI feature is labelled with where it runs. The launch
message is one sentence:

> Your notes stay on your machine. When you want more, you decide what leaves it.

## Timeline

| Milestone | Date | Owner | Status |
| --- | --- | --- | --- |
| Feature freeze | 12 May 2026 | Priya | On track |
| Private beta (40 users) | 19 May 2026 | Jonas | Recruiting |
| Beta feedback review | 26 May 2026 | Mira | Not started |
| Pricing page live | 2 June 2026 | Jonas | Not started |
| Public launch | 9 June 2026 | Priya | Not started |
| First retro | 16 June 2026 | Mira | Not started |

## Workstreams

### Product

- Finish the offline search index so it handles 5,000 notes without a visible pause.
- Add import from a folder of markdown files. This is the migration story and the
  single most requested beta feature.
- Kill the settings screen for 1.0. Everything that matters is inline.

### Pricing and billing

- Three tiers: Free (100 notes), Solo at 6 EUR per month, Studio at 14 EUR per
  month for shared vaults.
- Annual plans get 20 percent off. Beta users keep their discount for twelve months.
- Use a hosted checkout page; do not build card forms ourselves.

### Marketing

- Launch post built around the privacy claim, with a two-minute screen recording.
- Ask ten beta users for a one-line quote we can publish with permission.
- No paid acquisition in month one. The budget is 1,500 EUR and it stays unspent.

## Risks

1. **Search performance on large vaults.** Mitigation: index in a worker, cap the
   first render at 500 results, and measure before the feature freeze.
2. **On-device AI is only available in Chrome on desktop.** Mitigation: label the
   feature honestly, keep cloud AI opt-in, and write setup instructions for judges,
   journalists, and new users.
3. **Billing edge cases.** Mitigation: launch with monthly and annual only. No
   invoicing, no purchase orders, no team seat maths in 1.0.
4. **Support load after launch.** Mitigation: two office hours per week, a public
   issue tracker, and a written response-time promise of two working days.

## Open questions

- Do we ship a Linux build at launch or wait for 1.1?
- Who owns the migration guide for users coming from other note apps?
- Is 100 notes the right free-tier limit, or does it feel punitive?

## Decision log

- 2026-04-02: Launch without a mobile app. Mobile is a 2027 conversation.
- 2026-04-09: No telemetry by default. Opt-in crash reports only.
- 2026-04-18: Pricing locked at 6 and 14 EUR. Free tier stays generous enough to
  be useful, small enough to be a real upgrade decision.

## Action items

- [ ] Finalise the beta user list and send invitations — Jonas, due 18 May
- [ ] Write the migration guide for markdown folders — Mira, due 22 May
- [ ] Book the launch-day support rota — Priya, due 30 May
- [ ] Draft the launch post and get three quotes approved — Mira, due 4 June
- [ ] Confirm the annual discount wording with the accountant — Jonas, due 20 May
