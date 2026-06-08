# Shared Supabase Platform — Design Spec

**Date:** 2026-06-08
**Status:** In review (round 1)
**Relationship:** Foundational. The Lantern app spec
(`2026-06-08-lantern-design.md`) consumes this platform; Lantern is its first *new*
onboarded app.

## Purpose

Formalize the Supabase project that `photocritic-site` and `ara-eval` already share into a
real **shared database platform**: one canonical migration history, shared AI-logging
infrastructure, a table-namespacing convention, and a documented recipe so new apps
(starting with Lantern) plug in cleanly. The motivating pain: migrations are split across
repos pointing at one DB, so there is no single source of truth and `supabase db push`
drifts.

## Current State (the mess)

- **One physical project, two repos.** `photocritic-site` and `ara-eval` both link to
  Supabase project **`ezlyfsgpcahlnbqgdlxh`**. They already share the database today.
- **photocritic-site** has a clean checked-in history: `supabase/migrations/001–004`
  (`critiques`, `leads`, `ai_provider_requests`, `site_settings`, an RPC).
- **ara-eval** applied its `ara_*` schema **out-of-band** (dashboard/manual) — no checked-in
  DDL; its `supabase/` holds only link metadata. Its schema exists *only in the live DB*.
- **Consequence:** no canonical `supabase/migrations/` folder for the project; the live DB
  is the only complete record of truth. Adding a third contributor (Lantern) the same way
  makes it worse.

## Goals / Non-Goals

**Goals**
- A single **canonical migration history** for project `ezlyfsgpcahlnbqgdlxh`, in one repo.
- Capture current live schema (photocritic + ara) as a **baseline** so the history is
  complete and `supabase db diff` is empty against production.
- **Shared `ai_provider_requests`** logging infra with first-class `session_id` / cost /
  token columns, plus a reference AI service module any app can port.
- A **namespacing + onboarding convention** so new apps add prefixed tables and reuse the
  AI layer in minutes.

**Non-Goals (v1)**
- No data migration / no new project / no key-or-URL cutover — we canonicalize **in place**
  (photocritic stays live untouched).
- No renaming of legacy photocritic/ara tables (grandfathered as-is).
- No published npm package for the AI layer yet (documented copy convention for v1).
- No auth/multi-tenant RBAC — these remain single-operator/admin apps.

## Target Architecture

- **Canonical project:** existing `ezlyfsgpcahlnbqgdlxh`, adopted in place.
- **Repo of record:** a new dedicated **`platform-db`** repo that owns
  `supabase/migrations/` for the project and ships the reference AI service. Apps never
  push migrations from their own repos again.
- **Table classes:**
  - **Platform-shared** (unprefixed, owned by platform-db): `ai_provider_requests`, and any
    future cross-app infra.
  - **App-owned** (prefixed `<app>_` going forward): `lantern_*`. Legacy photocritic
    (`critiques`, `leads`, `site_settings`) and `ara_*` tables are grandfathered.

### `platform-db` repo layout

```
platform-db/
  supabase/
    config.toml                       # linked to ezlyfsgpcahlnbqgdlxh
    migrations/
      <ts>_baseline.sql               # full current schema, captured via `db pull`
      <ts>_ai_provider_requests_columns.sql   # add session_id/cost/token columns
      <ts>_lantern_tables.sql         # Lantern's tables (replaces old "005")
  reference/ai/
    ai-provider.ts                    # ported from photocritic: OpenRouter send+failover+logging
    fal-image.ts                      # fal-ai/z-image/turbo
    ai_provider_requests.contract.md  # the logging contract (columns + what goes where)
  docs/
    onboarding-a-new-app.md           # the reuse recipe (below)
  README.md
```

## Canonical Migration Strategy

1. `platform-db`: `supabase init` → `supabase link --project-ref ezlyfsgpcahlnbqgdlxh`.
2. **Schema backup first** — from the linked `platform-db` dir, `supabase db dump -f <file>`
   (schema-only by default) as a safety net. (Single canonical backup workflow; the
   implementation plan documents the exact command, working dir, and verification.)
3. **Baseline:** `supabase db pull` → generates a single `<ts>_baseline.sql` reflecting the
   *entire* current remote schema (photocritic tables, `ara_*`, RPCs, policies). Reconcile
   the remote `supabase_migrations.schema_migrations` history with
   `supabase migration list` / `supabase migration repair` so the baseline registers as the
   canonical starting point.
4. **Verify:** `supabase db diff` is empty against production (baseline == live).
5. **Freeze legacy folders:** photocritic-site's `supabase/migrations/` and ara's
   out-of-band process are marked read-only (README note; stop running `db push` from those
   repos). Optionally relocate them to `legacy/` to prevent accidents.
6. **Go forward:** every schema change is a new timestamped migration in `platform-db`,
   applied via `supabase db push` from `platform-db` **only**.

All new migrations are **additive/backward-compatible** so photocritic and ara keep working
untouched throughout.

## Shared Infra: `ai_provider_requests` + reference service

Today's columns: `request_id`, `provider`, `model`, `model_array`, `use_case`,
`response_status`, `error_message`, `raw_request`, `raw_response`, `metadata jsonb`.

**Migration `<ts>_ai_provider_requests_columns.sql`** promotes the values apps currently
bury in `metadata` to first-class, queryable columns (additive, all nullable):

```sql
alter table ai_provider_requests
  add column if not exists session_id    text,
  add column if not exists total_cost    numeric,
  add column if not exists input_tokens  integer,
  add column if not exists output_tokens integer,
  add column if not exists total_tokens  integer;
create index if not exists idx_apr_session_id on ai_provider_requests(session_id);
```

- Existing rows keep these null; photocritic/ara keep working unchanged.
- The **reference `ai-provider.ts`** is updated to populate the new columns (and may keep
  writing the same values into `metadata` for back-compat). New apps (Lantern) populate
  them from the start → clean "cost per session", "tokens per use_case" queries with no
  jsonb digging. This is the answer to "is it worth adding those columns to top level": yes,
  now that we own the canonical schema.
- **Logging contract** (`reference/ai/ai_provider_requests.contract.md`): top-level
  `request_id` (unique), `use_case` (`<app>_<action>`), `session_id`, `model`/`model_array`,
  `response_status`, token + cost columns; `metadata` for anything app-specific.

## Onboarding a New App (the reuse recipe)

Documented in `platform-db/docs/onboarding-a-new-app.md`; Lantern is the worked example:

1. **Env:** point the app at `ezlyfsgpcahlnbqgdlxh` — `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Set the app's own provider
   keys: `OPENROUTER_API_KEY`, `FAL_API_KEY`, `BLOB_READ_WRITE_TOKEN`.
2. **Tables:** add a `<ts>_<app>_tables.sql` migration in `platform-db` with all tables
   prefixed `<app>_`; `supabase db push`.
3. **AI layer:** copy `reference/ai/ai-provider.ts` + `fal-image.ts`; wrap in an
   `<app>AiService`; log with `use_case = <app>_<action>` and the app's `session_id`.
4. **RLS:** enable RLS; writes go through the service-role admin client (single-operator
   pattern). No public client access to `<app>_*` tables.

## Impact on Lantern spec

The Lantern spec is trimmed to *consume* this platform: `lantern_*` tables become a
`platform-db` migration (not photocritic's folder); the AI layer ports the reference
service; `session_id` / cost / tokens are logged to the **new top-level columns** (drop the
metadata-jsonb workaround). I'll apply that trim after this platform spec is approved, to
avoid thrashing both docs at once.

## Migration / Cutover Plan (ordered)

1. Create `platform-db`, link, schema backup.
2. `db pull` baseline → verify empty `db diff` → commit.
3. Freeze photocritic + ara migration folders.
4. Push `ai_provider_requests` columns migration; update reference `ai-provider.ts`.
5. (Optional, non-blocking) update photocritic's `ai-provider.ts` to populate new columns.
6. Push `lantern_*` migration; Lantern app builds against it.

## Risks & Rollback

- **History reconciliation hiccup** (`db pull` vs existing numeric history): mitigated by
  the schema backup + verifying `db diff` empty before freezing anything; can iterate on the
  baseline without touching production data.
- **Accidental push from a legacy repo:** mitigated by freezing/relocating those folders.
- **Live photocritic risk:** minimal — all changes are additive and in place; no cutover.
- **Rollback:** additive migrations are safe; worst case, don't push forward. The baseline
  is a read-only capture of what already exists.

## Testing / Verification

- `supabase db diff` empty after baseline (proves canonical == live).
- A throwaway migration push + rollback from `platform-db` proves the repo is now the
  working source of truth.
- Insert a row via the updated reference `ai-provider.ts` and confirm `session_id` /
  `total_cost` / token columns populate (not just `metadata`).
- Onboarding dry-run: follow the recipe for Lantern end-to-end on the live project.

## Open Items

- Confirm whether to also update photocritic's logging code to populate the new top-level
  columns now, or leave it on `metadata` (back-compat) and only adopt in new apps.
- Reuse mechanism: documented copy convention for v1 vs. extracting a shared `@platform/ai`
  package later (Python clients like ara log to the same table independently — the durable
  contract is the *schema*, not a TS package).
- Confirm there are no Supabase Edge Functions / cron / RLS policies on the live project
  that `db pull` won't capture and that need manual baselining.
- Decide final `platform-db` repo name and where it lives (sibling under `projects/`).
