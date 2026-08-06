# Graph Report - .  (2026-08-06)

## Corpus Check
- Corpus is ~21,333 words - fits in a single context window. You may not need a graph.

## Summary
- 299 nodes · 649 edges · 18 communities (16 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- App Shell UI
- Data & Migrations
- App Routing Forms
- Household Questions
- Runtime Dependencies
- TypeScript Config
- Readiness Summary
- Finance Steps
- Dev Tooling
- Product Design Docs
- Supabase Core Schema
- Market Pulse
- Supabase RLS
- Schema Indexes
- Typography Design

## God Nodes (most connected - your core abstractions)
1. `cn()` - 30 edges
2. `formatMoney()` - 20 edges
3. `compilerOptions` - 18 edges
4. `PlacesWorkspace()` - 15 edges
5. `computeFinance()` - 13 edges
6. `AppData` - 11 edges
7. `AppController` - 11 edges
8. `evaluateReadiness()` - 10 edges
9. `useApp()` - 10 edges
10. `Button()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Room for the Next Chapter product` --conceptually_related_to--> `Kitchen-table planning folio world`  [INFERRED]
  PRODUCT.md → DESIGN.md
- `Room for the Next Chapter product` --uses--> `Local device persistence v1`  [EXTRACTED]
  PRODUCT.md → README.md
- `App()` --calls--> `useApp()`  [EXTRACTED]
  src/App.tsx → src/hooks/useApp.ts
- `AppShell()` --calls--> `cn()`  [EXTRACTED]
  src/components/layout/AppShell.tsx → src/lib/utils.ts
- `Stat()` --calls--> `cn()`  [EXTRACTED]
  src/components/layout/AppShell.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (18 total, 2 thin omitted)

### Community 0 - "App Shell UI"
Cohesion: 0.06
Nodes (48): ErrorBoundary, State, Stat(), STEP_META, DualRangeSlider(), niceStep(), padBounds(), ImageLightbox() (+40 more)

### Community 1 - "Data & Migrations"
Cohesion: 0.12
Nodes (21): createBlankScenario(), createExampleScenario(), emptyAppData(), migrateAppData(), normalizePets(), normalizePlace(), normalizeStatus(), seedExampleAppData() (+13 more)

### Community 2 - "App Routing Forms"
Cohesion: 0.13
Nodes (20): App(), PlacesWorkspace, AppShell(), CurrencyInput(), Field(), NumberInput(), TextInput(), TextTextarea() (+12 more)

### Community 3 - "Household Questions"
Cohesion: 0.11
Nodes (24): ageOptions, attachmentOptions, conversationStarters, incomeOptions, likelihoodOptions, maintenanceOptions, retirementOptions, AgeRange (+16 more)

### Community 4 - "Runtime Dependencies"
Cohesion: 0.08
Nodes (25): clsx, idb, lucide-react, next-chapter-planner, dependencies, clsx, idb, lucide-react (+17 more)

### Community 5 - "TypeScript Config"
Cohesion: 0.08
Nodes (23): DOM, DOM.Iterable, ES2022, src, compilerOptions, allowImportingTsExtensions, isolatedModules, jsx (+15 more)

### Community 6 - "Readiness Summary"
Cohesion: 0.21
Nodes (16): ReadinessPanel(), SummaryStep(), buildSummary(), collectFinanceSignals(), collectHouseholdSignals(), countAnswered(), evaluateReadiness(), fitLabel() (+8 more)

### Community 7 - "Finance Steps"
Cohesion: 0.29
Nodes (14): HouseholdStep(), PeaceStep(), computeFinance(), estimateCashAfterMove(), estimateEquity(), estimateNetProceeds(), money(), moveMonthlyParts() (+6 more)

### Community 8 - "Dev Tooling"
Cohesion: 0.12
Nodes (17): devDependencies, tailwindcss, @tailwindcss/vite, @types/react, @types/react-dom, typescript, vite, @vitejs/plugin-react (+9 more)

### Community 9 - "Product Design Docs"
Cohesion: 0.25
Nodes (8): Motion subtle prefers-reduced-motion, Kitchen-table planning folio world, Show today housing load, Compare keep vs downsize, Places board for future homes, Room for the Next Chapter product, Local device persistence v1, Supabase repository adapter later

### Community 10 - "Supabase Core Schema"
Cohesion: 0.43
Nodes (7): app_next_chapter_v1.places, app_next_chapter_v1.scenarios, app_next_chapter_v1.set_updated_at(), app_next_chapter_v1.user_prefs, trg_next_chapter_places_updated_at, trg_next_chapter_scenarios_updated_at, trg_next_chapter_user_prefs_updated_at

### Community 11 - "Market Pulse"
Cohesion: 0.38
Nodes (5): MarketPulseCard(), getMarketPulse(), MarketPulseBundle, MarketPulseNote, CurrentHome

### Community 12 - "Supabase RLS"
Cohesion: 0.50
Nodes (3): app_next_chapter_v1.places, app_next_chapter_v1.scenarios, app_next_chapter_v1.user_prefs

## Knowledge Gaps
- **79 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+74 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppData` connect `Data & Migrations` to `Household Questions`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `formatMoney()` connect `App Routing Forms` to `App Shell UI`, `Readiness Summary`, `Finance Steps`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `cn()` connect `App Shell UI` to `App Routing Forms`, `Readiness Summary`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `PlacesWorkspace()` (e.g. with `allowsPets()` and `listPrice()`) actually correct?**
  _`PlacesWorkspace()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _79 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App Shell UI` be split into smaller, more focused modules?**
  _Cohesion score 0.06093189964157706 - nodes in this community are weakly interconnected._
- **Should `Data & Migrations` be split into smaller, more focused modules?**
  _Cohesion score 0.12312312312312312 - nodes in this community are weakly interconnected._