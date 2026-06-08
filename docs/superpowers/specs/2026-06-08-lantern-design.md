# Lantern — Design Spec

**Date:** 2026-06-08
**Status:** Approved (pending spec review)
**Tagline:** *a cozy Warden's helper*

## Purpose

Lantern is a personal **Warden's helper** app for running rules-light family fantasy
sessions (Cairn 2e engine, softened) with the author's nieces (ages ~9–12). The author
runs the game out loud; Lantern is a back-pocket idea machine that feeds *the Warden*
material on demand. It does **not** run the game, narrate to the kids, or let the kids
interact directly.

Non-goals (explicitly out of scope for v1):
- No VTT, maps, grids, or token movement.
- No player-facing UI; only the Warden touches the app.
- No auth / multi-user / accounts (single operator at the table).
- No AI narration read verbatim to kids — output is raw material for the Warden.

## Audience & Tone

- **Players:** tweens, ~9–12. Can handle stakes, puzzles, and light peril.
- **Tone knob:** a single setting, `gentle` | `adventurous`, baked into the system prompt.
  - No real death. Peril resolves as setbacks, capture, lost items, or being scared off.
  - Reading level ~age 9–12. Whimsical, warm, "dark but friendly Wood."

## Stack & Infra

- **App:** New standalone Next.js app (App Router) in `projects/local`, its own git repo.
  Tailwind + Radix UI, mirroring 8bitoracle-next conventions. No auth.
- **Database:** Reuses **8bitoracle-next's existing Supabase project**. Lantern does not
  stand up its own database.
- **Migrations:** ALL schema changes live in `8bitoracle-next/supabase/migrations/`
  (the Supabase project of record), named `YYYYMMDDHHMMSS_*.sql` per existing convention.
  Lantern's code repo holds no migrations.
- **Table naming:** Every Lantern-owned table is prefixed `lantern_` for clear separation
  from 8bitoracle tables sharing the same database.
- **Text model:** OpenRouter `deepseek/deepseek-v4-flash` (exact slug to be confirmed
  resolvable on OpenRouter before depending on it; fall back to a current DeepSeek slug
  such as `deepseek/deepseek-chat-v3.1` if not).
- **Image model:** fal.ai `fal-ai/z-image/turbo`.
- **Image storage:** generated images go to Vercel Blob; only the blob URL is logged
  (never base64 in the DB) — matching 8bitoracle's pattern.

## AI Layer (ported from 8bitoracle, trimmed)

Lantern ports the proven pattern from
`8bitoracle-next/src/services/aiProviderService.ts`:

- `lanternAiService.sendMessage()` — thin version of 8bitoracle's `sendMessage`:
  - text → OpenRouter; images → fal.ai; sequential model failover.
  - returns normalized `{ text | imageUrl, usage, model, provider }`.
- `logAIProviderRequest()` — reused behavior: persists **every** call (success AND
  failure) to the shared `ai_provider_requests` table, capturing `provider`, `model`,
  `use_case`, `session_id`, token counts, and `total_cost` from OpenRouter usage.
- **`use_case` values** (so all Lantern AI calls are filterable/groupable):
  `lantern_scene`, `lantern_whatnext`, `lantern_npc`, `lantern_npc_portrait`,
  `lantern_recap`.
- **`session_id`** = the current `lantern_sessions.id`, so every AI call from one game
  session is grouped together.

`ai_provider_requests` already has the needed columns (`use_case`, `session_id`,
`total_cost`, token counts) — no migration to that table is required.

## Grounding Tables (authored as static data)

Generous roll-tables shipped as TS/JSON in the Lantern repo (NOT database tables).
They are injected into prompts so AI output stays on-theme and kid-soft, and the AI is
told to roll from them and then react to what the kids actually did. Tables:

- `names` — folk/creature names
- `npc_traits` — a vivid quirk
- `npc_wants` — a simple motivation
- `scene_seeds` — situation hooks
- `wood_locations` — places in the Wood
- `omens_weather` — atmosphere/foreshadowing
- `soft_monsters` — kid-safe threats (resolve as scuffles, never lethal)
- `clues_treasure` — discoveries/rewards
- `complications` — gentle twists

## Persistence (Approach B — thin Lantern tables)

Two new prefixed tables, both migrated in 8bitoracle-next:

### `lantern_sessions`
One row per game session.
- `id uuid pk default gen_random_uuid()`
- `created_at timestamptz default now()`
- `title text` — optional human label ("Session 3: the Mushroom Market")
- `tone text` — `gentle` | `adventurous`
- `status text` — `active` | `ended`

### `lantern_events`
A clean, human-readable log of what Lantern produced during a session (distinct from the
raw `ai_provider_requests` log). Drives the recap and lets a session be reviewed/resumed.
- `id uuid pk default gen_random_uuid()`
- `created_at timestamptz default now()`
- `session_id uuid` — references `lantern_sessions(id)`
- `kind text` — `scene` | `whatnext` | `npc` | `recap` | `note`
- `summary text` — short human-readable summary for recap
- `payload jsonb` — structured detail (e.g., NPC fields, the 3 what-next options)
- `ai_request_id text` — links to `ai_provider_requests.request_id` when AI-generated
  (null for manual notes / combat which are local-only)

Combat tracker state is **local React state only** — not persisted (a scuffle is
ephemeral; no table needed).

## The Four Panels (single screen, session-scoped)

1. **Scene + What-Next ×3** — generate a location/situation (`lantern_scene`); a button
   produces 3 short "where it could go" options (`lantern_whatnext`) reacting to a Warden
   note about what the kids just did. Each logs a `lantern_events` row.
2. **NPC generator** — name + trait + want + fal.ai portrait (`lantern_npc` +
   `lantern_npc_portrait`). Logs one `lantern_events` row of kind `npc`.
3. **Light combat tracker** — local-only: a few soft creatures, simple HP, turn order.
   No AI, no DB.
4. **Session recap** — reads `lantern_events` for the session → a read-aloud summary for
   next time (`lantern_recap`). Logged as kind `recap`.

## Data Flow

1. Start session → insert `lantern_sessions` row → hold `session_id` in app state.
2. Each AI generation:
   - calls `lanternAiService.sendMessage()` with the right `use_case` + `session_id`,
   - raw call auto-logged to `ai_provider_requests`,
   - a clean summary row written to `lantern_events`.
3. Recap reads `lantern_events` where `session_id = current`.
4. End session → set `lantern_sessions.status = 'ended'`.

## Error Handling

- AI failure: surface a friendly inline message; model failover already tries fallbacks;
  the Warden can retry or improvise (it's an assist tool, never a blocker).
- Image failure: NPC still returns with text; portrait shows a placeholder.
- DB logging failure: non-fatal (logged to console like 8bitoracle); never breaks the
  table experience.

## Testing

- Unit: grounding-table integrity (no empty tables), prompt assembly, `sendMessage`
  routing (text vs image), `lantern_events` summary shaping.
- Integration: a session lifecycle test (create session → generate scene → log event →
  recap reads it back) against a test Supabase or mocked client.
- Manual: one real play-test session before relying on it at the table.

## Open Items

- Confirm `deepseek/deepseek-v4-flash` resolves on OpenRouter; pick fallback slug if not.
- Confirm fal.ai `fal-ai/z-image/turbo` is the intended image model id.
