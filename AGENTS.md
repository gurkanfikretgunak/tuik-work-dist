<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# TÜİK Work Distribution Tool — agent/developer guide

A login-free, serverless work-distribution tool that runs entirely in the browser. Data is never sent to a server (the UI carries a KVKK/privacy notice and `layout.tsx` states it in the page description). Do NOT add network calls, analytics, or external services that would break this. The single exception is **v3** (read-only download of public TÜİK statistics through the allow-listed `/api/tuik/*` route handlers); never send user data upstream. The UI and the domain field names are in Turkish.

## Stack
Next.js 16.4.6 (App Router, `cacheComponents` and `partialPrefetching` enabled, Turbopack) · React 19 · TypeScript (strict) · Tailwind 4 (`@tailwindcss/turbopack`) · Zustand · PapaParse · Zod 4 · Recharts · JSZip · Radix Dialog · Vitest. Path alias `@/*` → `src/*`.

It is a single-page client app: `src/app/page.tsx` → `src/components/App.tsx` (`"use client"`). There is no routing; screens switch via Zustand state.

## Commands
```bash
npm install --legacy-peer-deps   # --legacy-peer-deps is required (same as README)
npm run dev                      # http://localhost:3000  (.claude/launch.json uses port 3111)
npm run build && npm start
npm run lint                     # eslint (or: npx eslint src)
npx tsc --noEmit                 # type check
npx vitest run                   # tests; package.json has NO "test" script
npx vitest run src/i18n          # dictionary consistency only
node scripts/i18n-scan.mjs <path> # lists untranslated Turkish strings
node scripts/ornek-veri.mjs      # regenerates the public/ornek/*.csv sample data (fixed seed)
```
Before finishing a change, `npx tsc --noEmit`, `npx eslint src` and `npx vitest run` must be clean.

## Architecture
Three independent tools, selected on the home screen (`src/lib/appstore.ts`: `engine = "home" | "v1" | "v2" | "v3"`).

### v1 — Job Distribution Engine (`src/screens`, `src/lib`)
Flow (9 screens, `Screen0..8`): Staff → Capacity → Rules → Job upload → Distribution → Pre-approval → Approval/Output → Process report → Overall summary/sharing.
- `lib/types.ts` — `Employee`, `Job`, `RuleSet`, `DEFAULT_RULESET`, `RULE_META` (rules: il, mahalle, denge, kir, gecenAy).
- `lib/csv.ts` — CSV parsing/validation with PapaParse + Zod. Column names are the schema: `calisan_id, ad_soyad, rol, il, ilce, donemlik_kapasite, musait_oran, kir_gorevi_yapabilir, aktif, kapasite_notu` and `is_id, il, ilce, mahalle, yerlesim_tipi, birim_no, gorusme_sayisi, onceki_ay_gorusen_calisan_id, oncelik, anket_turu`.
- `lib/engine.ts` — the distribution engine (`runDistribution`, `computeLoads`, `computeCompliance`, `checkMove`); `lib/run.ts` is the run wrapper; `lib/report.ts`, `lib/outputs.ts`, `lib/share.ts` produce the report/CSV/JSON/ZIP outputs.
- `lib/store.ts` — Zustand state; saves/loads the settings set in `localStorage` (the only persistent store).

### v2 — Notebook ("defter") Rotation Engine (`src/rotation`)
A monthly rotation plan for N staff / N notebooks. Flow (`RotationApp.tsx`): R0 Start Wizard → R1 Parameters (6-step wizard) → R2 Plan Generation → R3 Review & Validation → R4 Approval & Output.
- Rules: **K1** no-repeat (window of G months), **K2** no-follow (pair limit), **K3** yearly equality (targets derive from the base distribution count **D**), **K5** notebook-group balance (optional), **K6** minimum month gap between weekly special notebooks, **K7** leave (day/range → monthly threshold; a person over the threshold counts as absent that month). There is no K4 in the code.
- `math.ts` (targets/feasibility warnings, `calcTargets`), `engine.ts` (seeded generation via `mulberry32`, `RotParams`), `validator.ts` (`Plan[month][notebook] = person index`, -1 = unassigned), `leave.ts` (leave parsing/validation; date formats YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY), `params.ts` (store → `RotParams`/`RotRules`; single source of truth), `store.ts`.
- The engine and the validator MUST share the same rules: when a rule changes, update `engine.ts`, `validator.ts` and `math.ts` together and run `rotation.test.ts` and `leave.test.ts`.

### v3 — Open Data Explorer (`src/opendata`, `src/app/api/tuik`, `src/lib/{tuikProxy,tuikCatalog,jsonstat}.ts`)
Browses TÜİK Veri Portalı datasets (`databrowser2.tuik.gov.tr`; no CORS, hence the proxy). `tuikProxy.ts` holds the validators (`validDatasetId`, `sanitizeCriteria`), `sameOrigin` and `relay` (fixed upstream, 45 s timeout, 25 MB cap) used by the three route handlers (`catalog`, `structure`, `data`). `jsonstat.ts` parses JSON-stat 2.0 and builds rows/pivot/series/CSV; `tuikCatalog.ts` builds and searches the catalogue (offline snapshot `public/tuik/catalog.json`, script `scripts/tuik-catalog.mjs`). Screens D0 (catalogue) and D1 (dataset); store in `opendata/store.ts`. Route handlers must not use route-segment config (`cacheComponents` is on) — they are dynamic because they read the request. Tests: `src/lib/jsonstat.test.ts`.

## Internationalization (i18n) — mandatory
Languages: tr (default), en, fr, de, ja, zh. Core: `src/i18n/index.ts`; detailed rules are in **`docs-i18n.md`** (read it first — note it is written in Turkish).
- In components use `const { t, rt } = useT()`; outside components use `tx()` / `rtx()`. Keys must be constant string literals (`t("v1.s3.title")`) — a test scans for them.
- Dictionaries live in `src/i18n/dict/{common,v1ui,v1core,v2ui,v2core}.ts`; all six languages must have the same keys and the same `{placeholder}` names and `<b>` count.
- For dates/numbers/sorting use `monthName`, `fmtDate…`, `collate`; do not use `toLocaleString("tr-TR")` / `localeCompare(…, "tr")`.
- Never translated: CSV column names, file names, JSON keys, identifiers, `data-testid`, code comments.

## Known state (keep updated)
- i18n is complete for v1, v2 and v3 (6 languages); `npx vitest run` is expected to be fully green. Event-log and validation messages are stored in the language active when produced (accepted limitation); translations are machine-written.
- `src/rotation/store.ts` — a single eslint warning for an unused `get`.
- v3 depends on an undocumented upstream API and needs a running Next.js server.

## Rules and pitfalls
- Do not add network/server dependencies; data stays in the browser. Persistence is `localStorage` only (`tuik-lang`, the v1 settings set).
- Everything that needs `"use client"` (stores, components) carries it at the top of the file; because `cacheComponents` is enabled, read `node_modules/next/dist/docs/` before using dynamic or time-dependent data in server components.
- Randomness is seeded (`seed`); tests must stay deterministic — do not add `Math.random`.
- Do not hand-edit the sample data; generate it with `scripts/ornek-veri.mjs` (it intentionally contains faulty rows as a validation demo).
- `.next/`, `tsconfig.tsbuildinfo` and `next-env.d.ts` are not committed.
- Commit messages follow `feat(v2): …`, `feat(i18n): …` with a short Turkish summary (match existing history).
