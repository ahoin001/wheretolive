# Room for the Next Chapter

A calm web companion for deciding whether to keep a home or downsize. Built with React, Vite, and Tailwind. Data stays on this device in version 1.

## Run locally

```bash
cd Room-for-the-Next-Chapter
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

## Scripts

- `npm run dev` — local development
- `npm run build` — production build
- `npm run preview` — preview the production build
- `npm test` — finance calculation tests

## What’s included

- Guided keep-vs-downsize flow with large, plain-English controls
- Live monthly / yearly money comparison
- Optional household questionnaire + explainable readiness fit
- Market pulse notes for the Miramar example (labeled, sourced, not an appraisal)
- Places board for saving listing links, notes, favorites, and tiers
- Local save, export/import backup, erase-all

## Later: Supabase

Persistence goes through `src/data/repositories`. Version 1 uses `localStorage`. A Supabase adapter can implement the same `AppRepository` interface later (project URL, publishable key, auth, RLS).

## Disclaimer

This is a planning aid for family conversations. It is not financial, tax, legal, or real-estate advice.
