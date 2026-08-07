# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: a late-50s / early-60s household having a keep-versus-downsize conversation at the kitchen table. Designed so any household can enter their own numbers.

## Product Purpose

A calm, reusable keep-versus-downsize planning companion. Success means the household can see today’s housing load clearly, compare keep vs. downsize with live money feedback, and decide with explainable reasons — not a forced verdict.

Guided decision support with large plain-English controls; not a sales landing page.

## Positioning

Reusable household planning for keep-versus-downsize: live money comparison plus optional fit/readiness questions, with saved future-home places and tiers. Private on-device by default, with an optional cloud rail for shared lists.

## Operating Context

Kitchen-table conversation — often shared screen or sitting side by side. Core workflows:

1. Show today’s housing load clearly.
2. Compare keep vs. downsize with live money feedback.
3. Personalize fit/readiness from optional household questions.
4. Save future-home links, notes, and tiers (list / board / compare).
5. Stay private on-device in v1 local storage; optional Supabase auth for multi-list and shared collaboration.

App modes: Places workspace (default for most signed-in users) and Guide wizard (allowlisted accounts). Persistence envelope is `AppData` (scenario + places + ui).

## Capabilities and Constraints

**Capabilities**

- Scenario wizard: stay costs, move/downsize path, household picture / readiness.
- Places: save listings, photos, notes, pets policy, tiers (Dream / Strong / Maybe / Pass), filters, compare up to 3.
- Guest share links (`/s/:token`): signed-in users create snapshot links for one place or a selection; guests view a read-only looking-glass page with a View listing CTA. Personal notes and likes are not included.
- Optional shared lists via Supabase when signed in (likes, invites, copy between lists).
- Guest local data can be imported into a private account list.

**Data path (must preserve)**

`AppData` is the persistence envelope (scenario + places + ui). Household answers live only under `Scenario.household`. Loads and imports always run through `migrateAppData` → `normalizeScenario` so readiness UI never sees broken enums or missing owners. Local repo uses `localStorage` with migration on every load.

**Non-goals**

- Not financial, tax, legal, or real-estate advice.
- No scraping of Zillow / Realtor / Facebook Marketplace.
- No forced keep-or-sell verdict without explainable reasons.

**Undecided / open**

- Whether Guide access stays allowlist-only long term.
- Breadth of cloud sync beyond collaboration lists.

## Brand Commitments

- Product name: **Room for the Next Chapter**
- Voice: plain English, non-judgmental; no forced winner colors; always show “because” reasons beside fit summaries.
- Visual system is recorded separately in `DESIGN.md` (folio / mist / sea / honey; Petrona + Atkinson Hyperlegible) — do not invent a competing brand here.

## Evidence on Hand

- Runnable Vite + React app in this repo (`npm run dev`).
- Domain types, finance calculations, readiness insights, and `migrateAppData` tests under `src/`.
- Design system documented in `DESIGN.md`.
- No fabricated testimonials, benchmarks, or pricing claims — future work must not invent them.

## Product Principles

1. Kitchen-table clarity over dashboard density — large controls, plain language.
2. Explain decisions — show reasons beside fit summaries; never force a winner.
3. Household numbers stay theirs — private by default; migrate and normalize every load.
4. Advice boundaries stay firm — planning companion, not financial/legal/real-estate advice.
5. Places support the conversation — save, tier, and compare homes without scraping listings.

## Accessibility & Inclusion

Large plain-English controls aimed at a late-50s / early-60s household. Prefer high-legibility type (Atkinson Hyperlegible) and respect `prefers-reduced-motion`. No stricter WCAG target locked yet.
