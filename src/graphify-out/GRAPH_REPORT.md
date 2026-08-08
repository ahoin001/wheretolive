# Graph Report - src  (2026-08-08)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 589 nodes · 1600 edges · 13 communities (12 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dcdcabe4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- cn
- api.ts
- types.ts
- PlacesWorkspace.tsx
- migrations.ts
- calculations.ts
- addedDate.ts
- TierTiles.tsx
- address.ts
- duplicates.ts
- tierReview.ts
- PublicSharePage.tsx
- vite-env.d.ts

## God Nodes (most connected - your core abstractions)
1. `cn()` - 57 edges
2. `requireSupabase()` - 25 edges
3. `useCollaboration()` - 22 edges
4. `SavedPlace` - 21 edges
5. `money()` - 19 edges
6. `PlacesWorkspace()` - 19 edges
7. `formatMoney()` - 17 edges
8. `LocalAppRepository` - 15 edges
9. `Button` - 14 edges
10. `computeFinance()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Pill()` --calls--> `cn()`  [EXTRACTED]
  components/wizard/ReadinessPanel.tsx → lib/utils.ts
- `ReasonList()` --calls--> `cn()`  [EXTRACTED]
  components/wizard/ReadinessPanel.tsx → lib/utils.ts
- `App()` --calls--> `useApp()`  [EXTRACTED]
  App.tsx → hooks/useApp.ts
- `AccountPage()` --calls--> `cn()`  [EXTRACTED]
  components/account/AccountPage.tsx → lib/utils.ts
- `AppShell()` --calls--> `formatMoney()`  [EXTRACTED]
  components/layout/AppShell.tsx → domain/finance/calculations.ts

## Import Cycles
- None detected.

## Communities (13 total, 1 thin omitted)

### Community 0 - "cn"
Cohesion: 0.05
Nodes (66): AppShell(), Stat(), STEP_META, DualRangeSlider(), niceStep(), padBounds(), FloatingListDock(), ImageLightbox() (+58 more)

### Community 1 - "api.ts"
Cohesion: 0.06
Nodes (68): App(), PlacesWorkspace, PublicSharePage, useShareToken(), AccountPage(), AuthPage(), ErrorBoundary, State (+60 more)

### Community 2 - "types.ts"
Cohesion: 0.05
Nodes (66): MarketPulseCard(), Pill(), ReadinessPanel(), ReasonList(), createExampleScenario(), getMarketPulse(), MarketPulseBundle, MarketPulseNote (+58 more)

### Community 3 - "PlacesWorkspace.tsx"
Cohesion: 0.09
Nodes (51): EmptyPlaces(), PETS_LABEL, PetsBadge(), PlaceCard(), primaryCostLabel(), STATUS_LABEL, TagRow(), TIER_LABEL (+43 more)

### Community 4 - "migrations.ts"
Cohesion: 0.08
Nodes (28): createBlankScenario(), emptyAppData(), LEGACY_STEP_MAP, migrateAppData(), normalizeCompletedSteps(), normalizePets(), normalizePlace(), normalizeStatus() (+20 more)

### Community 5 - "calculations.ts"
Cohesion: 0.13
Nodes (39): CurrencyInput(), NumberInput(), TextTextarea(), HORIZONS, MoneyPicture(), PART_COLORS, MoveStep(), ATTACH (+31 more)

### Community 6 - "addedDate.ts"
Cohesion: 0.11
Nodes (33): AddedFilterMenu(), PlaceStamp, ListDensity, ListGroupMode, PlacesList(), PlacesListProps, sliceGroupedSections(), AddedBucket (+25 more)

### Community 7 - "TierTiles.tsx"
Cohesion: 0.12
Nodes (24): FloatingTierMode, FloatingTierNavProps, SelectionDock(), SelectionDockProps, SelectionDockSpacer(), TierFocusMobile(), emptyReviews(), PETS_LABEL (+16 more)

### Community 8 - "address.ts"
Cohesion: 0.16
Nodes (30): CityCombobox(), addressesMatch(), AddressLike, buildTwoPart(), cityKey(), collapseSpace(), duplicatePlaceIds(), emptyAddress() (+22 more)

### Community 9 - "duplicates.ts"
Cohesion: 0.13
Nodes (24): DuplicatePlacesWizard(), DuplicatePlacesWizardProps, PlacePickCard(), buildPlaceDiffRows(), comparableRaw(), DIFF_FIELDS, displayValue(), DuplicateGroup (+16 more)

### Community 10 - "tierReview.ts"
Cohesion: 0.13
Nodes (21): BoardPlacement, compareBoardOrder(), findBoardContainer(), groupPlacesByTier(), isPlaceTier(), itemsByTierFromPlaces(), movePlaceOnBoard(), movePlaceToTier() (+13 more)

### Community 11 - "PublicSharePage.tsx"
Cohesion: 0.27
Nodes (9): bedsLine(), PETS_LABEL, placeAddress(), PublicSharePage(), costLabel(), homeTypeLabel(), ShareHeroCarousel(), ShareHeroCarouselProps (+1 more)

## Knowledge Gaps
- **91 isolated node(s):** `PlacesWorkspace`, `PublicSharePage`, `State`, `PlaceStamp`, `DuplicatePlacesWizardProps` (+86 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `api.ts`, `types.ts`, `calculations.ts`, `addedDate.ts`, `address.ts`, `duplicates.ts`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `SavedPlace` connect `duplicates.ts` to `cn`, `api.ts`, `types.ts`, `migrations.ts`, `addedDate.ts`, `tierReview.ts`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `AppData` connect `migrations.ts` to `types.ts`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `PlacesWorkspace`, `PublicSharePage`, `State` to the rest of the system?**
  _91 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.05493133583021224 - nodes in this community are weakly interconnected._
- **Should `api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05526675786593707 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0519311911716975 - nodes in this community are weakly interconnected._