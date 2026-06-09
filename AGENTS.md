# AGENTS.md

Guidance for agents working in the `lantern` repo. See `README.md` for repo scope, the
directory map, and related repos.

## What this repo is right now

Lantern app — **foundation implemented, panels implemented; first play-test pending.** The core is built and tested
(env config, service-role DB client, grounding tables, prompt assembly, AI service, event
writer). The DB schema (`lantern_*` tables + `ai_provider_requests` columns) is live in
the shared Supabase project. The UI panels, API routes, and campaign/session gate are also
built and tested.

## Authoritative files & boundaries

- `docs/superpowers/specs/` and `docs/superpowers/plans/` are the source of truth. Keep them
  internally consistent — if a decision changes, update every spec/plan that references it
  (e.g. the AI-logging contract is defined by the platform spec; Lantern's spec must match).
- `reviews/` holds generated review output. Read it; don't hand-edit it.
- The active review loop, if any, is tracked in `.claude/review-loop.local.md`.

## Cross-repo coordination (important)

- **Database schema changes live in the `platform-db` repo only** — it is the single
  canonical owner of `supabase/migrations/` for the shared project (a `db pull` baseline +
  forward migrations). Never add a `supabase/migrations/` folder here or in any app repo;
  the photocritic-site / ara-eval migration folders are frozen (`FROZEN.md`). Lantern's
  `lantern_*` tables ship as a `platform-db` migration. New-app recipe:
  `platform-db/docs/onboarding-a-new-app.md`; reusable AI logging service:
  `platform-db/reference/ai/`.
- The Supabase project `ezlyfsgpcahlnbqgdlxh` is **shared & live** (lantern, photocritic,
  ara-eval). Treat any `supabase db push` / `db pull` / `migration repair` as a production
  action: require operator auth, prefer additive/backward-compatible changes, verify with
  `supabase db diff`, and do not run these autonomously.
- **Reading/writing data (not schema):** there is no cached DB password — do **not** use
  psql/`.pgpass`. Use the **service-role key via the PostgREST REST API**: read
  `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from `photocritic-site/.env.local`
  (don't echo them) and `curl "$URL/rest/v1/<table>?<col>=eq.<val>"` with
  `apikey`/`Authorization: Bearer` headers (GET read, POST insert, PATCH update, DELETE).
- App tables are prefixed `<app>_`; the shared AI log is `ai_provider_requests` (top-level
  `session_id` / `total_cost` / `input_tokens` / `output_tokens` / `total_tokens` columns).

## Workflow

`spec → plan → implementation`, brainstormed/approved before building. Plans are bite-sized
(one action per step) and executed task-by-task. Prefer frequent, scoped commits. End
commit messages per the repo's house style.
