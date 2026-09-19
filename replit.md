# CFA Level I — My 2027 Journey

A lightweight personal CFA Level I February 2027 study command center with full Schweser reading tracking, confidence notes, study sessions, and browser-local backup.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/cfa-level-one-journey/src/App.tsx` — routed dashboard, curriculum tracker, session log, subject detail, and local persistence.
- `artifacts/cfa-level-one-journey/src/data/curriculum.ts` — editable source of truth for the 102-reading CFA Level I 2027 curriculum.
- `artifacts/cfa-level-one-journey/src/index.css` — shared visual theme, typography, texture, and responsive styling.

## Architecture decisions

- The first build is frontend-only and local-first; no authentication or backend is required for the personal tracker.
- Progress and study sessions are stored in `localStorage` and can be exported/imported as JSON backups.
- Curriculum source data is kept separate from presentation code so readings/modules can be edited without changing UI logic.

## Product

The app provides:
- A dashboard with exam countdown, completion, confidence, study time, streak, next-up readings, subject progress, and recent sessions.
- A searchable, filterable curriculum tracker with status, 1–5 confidence, notes, last studied date, and revision count.
- Session logging with week/month/all-time views and subject detail pages with weak/revision summaries.
- Local JSON backup/import controls.

## User preferences

The user wants a lightweight browser website rather than an installed app, with a calm professional study experience and no complicated login initially.

## Gotchas

- The web artifact workflow supplies `PORT` and `BASE_PATH`; direct Vite builds from the shell need those variables set.
- The exam countdown currently uses February 20, 2027 as the working exam date because the brief specifies the month but not a day.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
