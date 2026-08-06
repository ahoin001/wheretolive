# Room for the Next Chapter

A calm, reusable keep-versus-downsize planning companion. Built first for a late-50s / early-60s household conversation, designed so any household can enter their own numbers.

## Visitor mode

**Operate + Read hybrid:** guided decision support with large plain-English controls, not a sales landing page.

## Jobs

1. Show today’s housing load clearly.
2. Compare keep vs. downsize with live money feedback.
3. Personalize fit/readiness from optional household questions.
4. Save future-home links, notes, and tiers.
5. Stay private on-device in v1, with a repository rail for Supabase later.

## Data path

`AppData` is the persistence envelope (scenario + places + ui). Household answers live only under `Scenario.household`. Loads and imports always run through `migrateAppData` → `normalizeScenario` so readiness UI never sees broken enums or missing owners.

## Non-goals

- Not financial, tax, legal, or real-estate advice.
- No scraping of Zillow / Realtor / Facebook Marketplace.
- No forced keep-or-sell verdict without explainable reasons.
