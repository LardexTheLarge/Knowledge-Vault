---
title: Pricing model v3
sensitivity: shareable
---
# Pricing model v3

## Tiers

| Tier | Price | Notes | Cloud AI | Shared vaults |
| --- | --- | --- | --- | --- |
| Free | 0 EUR | 100 | 25 requests per month | No |
| Solo | 6 EUR / month | Unlimited | 1,000 requests per month | No |
| Studio | 14 EUR / month | Unlimited | 5,000 requests per month | Up to 5 people |

Annual billing: 20 percent off, so 57.60 EUR for Solo and 134.40 EUR for Studio.
Beta users keep their founding discount for twelve months after launch.

## Why 6 EUR

- Interviews clustered at 10 EUR for a personal tool, but 6 EUR clears the
  "impulse" threshold and undercuts Product C at 20 EUR by a wide margin.
- At 6 EUR the gross margin after payment fees and cloud inference is still above
  80 percent for a typical user who makes fewer than 200 cloud requests a month.
- A low solo price makes the Studio upsell (shared vaults, not more storage) the
  obvious next step for teams.

## Guardrails

- The free tier must be useful without a card. 100 notes is roughly six months of
  daily note-taking for a new user.
- Never meter local features. Search, reading, and on-device summarisation are
  unlimited on every tier, including Free.
- Cloud AI is always opt-in per request, so a quota is a ceiling, not a surprise.

## Open risks

- Inference costs are volatile. If cloud prices double, Solo at 6 EUR with 1,000
  requests could dip below 70 percent margin.
- Studio sharing is not built yet. Launching the tier before the feature exists
  would be dishonest, so Studio ships as "coming in 1.1" with a waitlist.

## Decision

Launch with Free and Solo. Announce Studio with a waitlist and a firm 1.1 date.
Revisit the free note limit after the first 500 signups.
