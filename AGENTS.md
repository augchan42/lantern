# AGENTS.md

Guidance for agents working in the `lantern` repo. See `README.md` for repo scope, the
directory map, and related repos.

## What this repo is right now

Design/planning for the Lantern app. The app is **not scaffolded yet** — the authoritative
artifacts are the specs and plans under `docs/superpowers/`. When the app is built, source
will be added here (App Router Next.js + Tailwind + Radix), but the DB schema will **not**.

## Authoritative files & boundaries

- `docs/superpowers/specs/` and `docs/superpowers/plans/` are the source of truth. Keep them
  internally consistent — if a decision changes, update every spec/plan that references it
  (e.g. the AI-logging contract is defined by the platform spec; Lantern's spec must match).
- `reviews/` holds generated review output. Read it; don't hand-edit it.
- The active review loop, if any, is tracked in `.claude/review-loop.local.md`.

## Cross-repo coordination (important)

- **Database schema changes live in the `platform-db` repo only** — never add a
  `supabase/migrations/` folder here or in any app repo. Lantern's `lantern_*` tables ship
  as a `platform-db` migration.
- The Supabase project `ezlyfsgpcahlnbqgdlxh` is **shared & live** (photocritic, ara-eval).
  Treat any `supabase db push` / `db pull` / `migration repair` as a production action:
  require operator auth, prefer additive/backward-compatible changes, verify with
  `supabase db diff`, and do not run these autonomously.

## Workflow

`spec → plan → implementation`, brainstormed/approved before building. Plans are bite-sized
(one action per step) and executed task-by-task. Prefer frequent, scoped commits. End
commit messages per the repo's house style.
