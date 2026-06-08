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
- No character sheets / advancement / inventory management (kids' sheets stay on paper).

## Audience & Tone

- **Players:** tweens, ~9–12. Can handle stakes, puzzles, and light peril.
- **Tone knob:** a single setting, `gentle` | `adventurous`, baked into the system prompt.
  - No real death. Peril resolves as setbacks, capture, lost items, or being scared off.
  - Reading level ~age 9–12. Whimsical, warm, "dark but friendly Wood."

## Cairn 2e Foundation

Lantern **piggybacks off Cairn 2e** rather than inventing an engine. Cairn 2e (by Yochai
Gal) is released under **CC-BY-SA 4.0**, so its rules text and tables can be adapted and
shipped, *with attribution* and under the *same license*.

What Lantern takes from Cairn 2e:

- **The resolution engine (softened), encoded in the system prompt** — so AI output
  proposes outcomes the Warden can adjudicate with Cairn's actual rules:
  - **Saves:** roll d20 *under* the relevant attribute (STR / DEX / WIL). The AI never
    rolls for the kids; it frames moments as "this might call for a DEX save."
  - **Combat:** attacks *always hit*; roll the weapon/creature damage die, subtract
    Armor, apply to HP, then to STR. Cairn's "HP is luck/positioning, STR is the body."
  - **Softening rule (Lantern-specific):** STR reaching 0 is **never death**. It resolves
    as knocked-out, scared off, captured, or a lost item — Warden's choice, seeded by the
    `complications` table. This single override is stated in the system prompt and honored
    by the combat tracker.
  - **Deprivation/fatigue, deep dungeon-crawl bookkeeping, and lethal monsters are
    dropped** — out of scope for a rules-light family table.
- **Generator/oracle tables as grounding seed data** — Cairn 2e's open tables (NPC
  appearance/quirk/want, wilderness/dungeon features, weather/omens, reactions, monster
  shells) seed the Lantern grounding tables below. We adapt entries for kid-softness and
  add our own; the result ships as static TS in the Lantern repo (see Grounding Tables).

**Attribution:** a `CREDITS.md` in the Lantern repo and an "About" footer credit Cairn 2e
under CC-BY-SA 4.0. The grounding-table source files carry a license header. Because we
redistribute adapted Cairn text, the grounding-table files (and only those) are licensed
CC-BY-SA 4.0; the app code stays under the repo's own license.

## Stack & Infra

- **App:** New standalone Next.js app (App Router) in `projects/lantern`, its own git repo.
  Tailwind + Radix UI, mirroring 8bitoracle-next conventions. No auth.
- **Database:** Reuses **8bitoracle-next's existing Supabase project**. Lantern does not
  stand up its own database.
- **Migrations:** ALL schema changes live in `8bitoracle-next/supabase/migrations/`
  (the Supabase project of record), named `YYYYMMDDHHMMSS_*.sql` per existing convention.
  Lantern's code repo holds no migrations.
- **Table naming:** Every Lantern-owned table is prefixed `lantern_` for clear separation
  from 8bitoracle tables sharing the same database.
- **Text model:** OpenRouter `deepseek/deepseek-v4-flash` — a newer DeepSeek slug than
  what 8bitoracle-next currently ships (its checked-in `STANDARD_MODELS` still lists
  `deepseek/deepseek-v3.2` / `deepseek/deepseek-chat-v3.1`). v4-flash should become the
  current model; 8bitoracle-next's model list likely wants the same bump. Fallback to a
  current DeepSeek slug (`deepseek/deepseek-chat-v3.1`) if v4-flash isn't yet resolvable on
  OpenRouter at build time.
- **Image model:** fal.ai `fal-ai/z-image/turbo` (confirmed — the only image model
  Lantern uses). It is newer than 8bitoracle's checked-in `FAL_IMAGE_MODELS` set, so the
  ported fal call uses this slug directly rather than `getFalModelsForUseCase`.
- **Image storage:** generated images go to Vercel Blob via the same
  `uploadAIGeneratedImage` path; only the blob URL is logged (never base64 in the DB) —
  matching 8bitoracle's pattern.
- **Env vars** (mirroring 8bitoracle; Lantern reuses the *same values*):
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  (admin client for logging), `OPENROUTER_API_KEY`, `FAL_API_KEY`, `BLOB_READ_WRITE_TOKEN`.

## AI Layer (ported from 8bitoracle, trimmed)

Lantern ports the proven pattern from
`8bitoracle-next/src/services/aiProviderService.ts`:

- `lanternAiService.sendMessage()` — thin wrapper over 8bitoracle's `sendMessage`:
  - text → OpenRouter; images → fal.ai; sequential model failover.
  - input: `{ useCase, systemPrompt, question, session_id, aspectRatio?, modalities? }`.
  - returns normalized `{ text? , imageUrl?, usage, model, provider, ai_request_id }`.
  - for images it receives base64 from fal, uploads via `uploadAIGeneratedImage`, and
    returns the **blob URL** as `imageUrl` (never the base64).
- `logAIProviderRequest()` — reused behavior: persists **every** call (success AND
  failure) to the shared `ai_provider_requests` table, capturing `provider`, `model`,
  `use_case`, `session_id`, token counts, and `total_cost` from OpenRouter usage.
- **`use_case` values** (so all Lantern AI calls are filterable/groupable):
  `lantern_scene`, `lantern_whatnext`, `lantern_npc`, `lantern_npc_portrait`,
  `lantern_recap`. Defined as constants in Lantern (not added to 8bitoracle's
  `ALL_USE_CASES`); they only need to be valid strings on the request rows.
- **`session_id`** = the current `lantern_sessions.id`, so every AI call from one game
  session is grouped together.

`ai_provider_requests` already has the needed columns (`use_case`, `session_id`,
`total_cost`, token counts, `request_id`) — no migration to that table is required.

## Prompts (representative samples — expand during build)

Prompts assemble from three parts: **system prompt** (engine + tone, constant per
session) + **injected grounding rolls** + **per-use-case task instruction + Warden note**.

### System prompt (full draft)

> You are an idea engine for the *Warden* (game master) of a cozy tabletop fantasy game
> for children aged 9–12, played out loud. You never speak to the players. You produce
> short, vivid raw material the Warden can paraphrase. You run on a softened Cairn 2e
> engine: saves are d20 roll-*under* STR/DEX/WIL; combat attacks always hit and deal
> damage minus Armor to HP then STR. **Nothing is ever fatal** — danger resolves as
> setbacks, capture, lost items, fright, or being chased off, never death or gore.
> Setting is "the Wood": a dark-but-friendly fairytale forest. Tone: {{TONE}}. Keep
> reading level around age 9–12: concrete, warm, whimsical, a little spooky. When a moment
> could call for a roll, *name the save* ("a DEX save to leap the brook") but never roll
> or decide the result — that's the Warden's job. Use the provided rolled grounding
> details; weave them into what the kids actually just did (the Warden's note). Be brief.

`{{TONE}}` expands to either *"gentle — peril stays soft and reassuring"* or
*"adventurous — real stakes and tension, but still never lethal."*

### Per-use-case task instructions

- **`lantern_scene`** (one full sample):
  > Using these rolled details — Location: {{wood_location}}; Omen/Weather:
  > {{omens_weather}}; Hook: {{scene_seed}}; possible Complication: {{complication}} —
  > write a 2–4 sentence scene the Warden can drop the kids into. End with one sensory
  > detail the kids could poke at. Warden note (what just happened): "{{warden_note}}".

- **`lantern_whatnext`** (returns JSON): given the current scene + Warden note, return
  exactly 3 short "where this could go" options as
  `{ "options": ["…","…","…"] }`. Each ≤ 20 words, distinct in direction (one safe, one
  curious, one risky-but-soft). Roll one `complication` to flavor the risky option.

- **`lantern_npc`** (returns JSON): given rolled `name` / `npc_trait` / `npc_want`, return
  `{ "name", "trait", "want", "voice_hint", "portrait_prompt" }`. `voice_hint` = one line
  the Warden can read in character; `portrait_prompt` = a short kid-friendly illustration
  prompt for the portrait call.

- **`lantern_npc_portrait`**: image call. Prompt = the NPC's `portrait_prompt` + a fixed
  style suffix (*"storybook illustration, soft warm colors, friendly, no text"*).
  `aspectRatio: "1:1"`.

- **`lantern_recap`**: given the session's `lantern_events` summaries (chronological),
  write a warm 4–6 sentence "previously, in the Wood…" recap the Warden can read aloud to
  re-open next session.

## Grounding Tables (authored as static data)

Generous roll-tables shipped as TS in the Lantern repo (NOT database tables), seeded by
adapting Cairn 2e's open tables and adding kid-soft entries. They are injected into
prompts so AI output stays on-theme and kid-soft, and the AI is told to roll from them and
then react to what the kids actually did.

**Format** — each table is `export const <name>: string[]` in
`src/grounding/<name>.ts`, re-exported from `src/grounding/index.ts`, with a helper
`roll<Name>()` / `rollN(table, n)` that picks without immediate repeats. A unit test
asserts every table is non-empty and has ≥ 12 entries. Representative samples (final
tables expanded during build):

- `names` — folk/creature names: *Pib, Hazel-Anne, Old Mossback, Tamsin, Clatterjack…*
- `npc_traits` — a vivid quirk: *hums constantly, hoards buttons, terrified of owls,
  speaks only in questions…*
- `npc_wants` — a simple motivation: *find a lost sibling, trade for a warm coat, win a
  bet, get someone to leave…*
- `scene_seeds` — situation hooks: *a bridge that asks a riddle, a market closing at
  dusk, a sheep stuck in brambles…*
- `wood_locations` — places in the Wood: *the Hollow Oak, Mushroom Market, the Quiet
  Pond, a leaning watchtower…*
- `omens_weather` — atmosphere/foreshadowing: *sudden warm fog, crows flying backward,
  the smell of woodsmoke, first snow…*
- `soft_monsters` — kid-safe threats with Cairn-shaped shells `{ name, hp, armor, dmg,
  quirk }`, resolve as scuffles, never lethal: *a grumpy badger-knight, a tickle of
  pixies, a sleepy stone golem…*
- `clues_treasure` — discoveries/rewards: *a key made of ice, a map drawn by a child, a
  jar of fireflies that never dims…*
- `complications` — gentle twists / soft "failure" outcomes: *gear gets soggy, a friend
  wanders off, the path loops back, someone gets the hiccups of invisibility…*

## Persistence (Approach B — thin Lantern tables)

Two new prefixed tables, both migrated in 8bitoracle-next. Representative migration SQL
(final filename `YYYYMMDDHHMMSS_create_lantern_tables.sql`):

```sql
create table if not exists lantern_sessions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  title       text,
  tone        text not null default 'gentle' check (tone in ('gentle','adventurous')),
  status      text not null default 'active' check (status in ('active','ended'))
);

create table if not exists lantern_events (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  session_id     uuid not null references lantern_sessions(id) on delete cascade,
  kind           text not null check (kind in ('scene','whatnext','npc','recap','note')),
  summary        text not null,
  payload        jsonb,
  ai_request_id  text
);
create index on lantern_events (session_id, created_at);
```

RLS follows 8bitoracle's convention for these single-operator tables (no public client
access; writes go through the service-role admin client used for logging).

### `lantern_sessions`
One row per game session. Fields: `id`, `created_at`, `title` (optional human label —
"Session 3: the Mushroom Market"), `tone` (`gentle` | `adventurous`),
`status` (`active` | `ended`).

### `lantern_events`
A clean, human-readable log of what Lantern produced during a session (distinct from the
raw `ai_provider_requests` log). Drives the recap and lets a session be reviewed/resumed.
`kind` is `scene` | `whatnext` | `npc` | `recap` | `note`; `summary` is a short
human-readable line; `payload` holds structured detail (NPC fields, the 3 what-next
options); `ai_request_id` links to `ai_provider_requests.request_id` when AI-generated
(null for manual notes / combat which are local-only).

Combat tracker state is **local React state only** — not persisted (a scuffle is
ephemeral; no table needed).

## The Four Panels (single screen, session-scoped)

One screen, no routing beyond a session start/resume gate. Desktop/tablet-first (the
Warden's laptop at the table). A top **session bar** shows title, tone, and Start/End
controls; below it a responsive 2×2 grid of panels (stacks to 1 column on narrow widths).

```
┌──────────────────────────────────────────────────────────────┐
│  🏮 Lantern   Session 3: the Mushroom Market   tone:[gentle▾] │
│                                        [ End Session ]         │
├───────────────────────────────┬──────────────────────────────┤
│  ① SCENE + WHAT-NEXT          │  ② NPC GENERATOR             │
│  ┌──────────────────────────┐ │  name · trait · want          │
│  │ scene text (2–4 sent.)   │ │  ┌───────┐  "voice hint…"     │
│  └──────────────────────────┘ │  │portrait│  want: …          │
│  Warden note: [__________]    │  └───────┘                    │
│  [ New Scene ]  [ What Next? ]│  [ New NPC ]                  │
│  • option A                   │                               │
│  • option B                   │                               │
│  • option C                   │                               │
├───────────────────────────────┼──────────────────────────────┤
│  ③ COMBAT TRACKER (local)     │  ④ SESSION RECAP             │
│  Badger-Knight  HP 4  [-][+]  │  "Previously, in the Wood…"   │
│  Pixies         HP 2  [-][+]  │  (reads this session's events)│
│  [ + add soft monster ]       │  [ Generate Recap ]           │
│  turn: ▸ Badger-Knight        │                               │
└───────────────────────────────┴──────────────────────────────┘
```

1. **Scene + What-Next ×3** (`ScenePanel`) — generate a location/situation
   (`lantern_scene`); a "What Next?" button produces 3 short "where it could go" options
   (`lantern_whatnext`) reacting to a Warden note about what the kids just did. Each
   generation logs a `lantern_events` row (`kind: scene` / `kind: whatnext`).
2. **NPC generator** (`NpcPanel`) — name + trait + want + fal.ai portrait
   (`lantern_npc` then `lantern_npc_portrait`). Logs one `lantern_events` row of
   `kind: npc` (payload holds the NPC fields + portrait blob URL).
3. **Light combat tracker** (`CombatPanel`) — local-only React state: add a few soft
   creatures (seeded from `soft_monsters`), track simple HP with −/＋, basic turn order,
   damage = die − Armor applied to HP (Cairn-softened; 0 HP → "out of the scuffle," never
   death). No AI, no DB.
4. **Session recap** (`RecapPanel`) — reads `lantern_events` for the session → a
   read-aloud summary for next time (`lantern_recap`). Logged as `kind: recap`.

**Panel states:** each AI-backed panel has idle → loading (skeleton/spinner) → result →
error (inline friendly message + Retry). Buttons disable while a call is in flight.

## Backend Wiring & File Structure

Server-side AI calls run in Next.js **Route Handlers** (App Router) under `/api/lantern/*`;
the panels are client components that POST to them. The admin Supabase client (service
role) is used server-side for `lantern_*` writes and for `logAIProviderRequest`.

```
src/
  app/
    page.tsx                        # session gate + 2×2 panel grid
    api/lantern/
      session/route.ts              # POST create, PATCH end  → lantern_sessions
      scene/route.ts                # POST → lantern_scene  (+ log event)
      whatnext/route.ts             # POST → lantern_whatnext (+ log event)
      npc/route.ts                  # POST → lantern_npc + lantern_npc_portrait (+ log)
      recap/route.ts                # POST → reads events, lantern_recap (+ log)
  components/lantern/
    SessionBar.tsx  ScenePanel.tsx  NpcPanel.tsx  CombatPanel.tsx  RecapPanel.tsx
  services/
    lanternAiService.ts             # thin wrapper over ported sendMessage
  grounding/
    index.ts  names.ts  npc_traits.ts  …  soft_monsters.ts   # static tables
  prompts/
    systemPrompt.ts  scene.ts  whatnext.ts  npc.ts  recap.ts  # assembly helpers
  lib/
    supabaseAdmin.ts                # service-role client for lantern_* + logging
    lanternEvents.ts                # writeEvent({session_id, kind, summary, payload, ai_request_id})
```

Each route: validate body → assemble prompt (system + grounding rolls + task + Warden
note) → `lanternAiService.sendMessage()` → `writeEvent(...)` with the returned
`ai_request_id` → return the normalized result to the client.

## Data Flow

1. Start session → POST `/api/lantern/session` → insert `lantern_sessions` row → client
   holds `session_id` in app state (and in `localStorage` so a refresh resumes it).
2. Each AI generation:
   - route calls `lanternAiService.sendMessage()` with the right `use_case` + `session_id`,
   - raw call auto-logged to `ai_provider_requests`,
   - a clean summary row written to `lantern_events` via `writeEvent`.
3. Recap reads `lantern_events` where `session_id = current` (chronological).
4. End session → PATCH `/api/lantern/session` → set `lantern_sessions.status = 'ended'`.

## Error Handling

- AI failure: surface a friendly inline message; model failover already tries fallbacks;
  the Warden can retry or improvise (it's an assist tool, never a blocker).
- Image failure: NPC still returns with text; portrait shows a placeholder.
- `lantern_whatnext` / `lantern_npc` JSON parse failure: retry once, then fall back to
  showing the raw text so the Warden still gets material.
- DB logging failure: non-fatal (logged to console like 8bitoracle); never breaks the
  table experience.

## Testing

- Unit: grounding-table integrity (every table ≥ 12 entries, no empties), prompt assembly
  (system + tone + injected rolls render correctly), `sendMessage` routing (text vs
  image), `whatnext`/`npc` JSON shaping + parse-fallback, `lantern_events` summary shaping,
  combat damage math (die − armor, 0 HP = out, never below the floor).
- Integration: a session lifecycle test (create session → generate scene → log event →
  recap reads it back) against a test Supabase or mocked admin client.
- Manual play-test checklist (one real session before relying on it at the table):
  scene reads naturally aloud; what-next options feel distinct; NPC + portrait return in
  reasonable time; combat tracker survives a full scuffle; recap captures the session.

## Open Items

- **Text model:** `deepseek/deepseek-v4-flash` is the intended current model but is newer
  than 8bitoracle-next's checked-in list. Verify it resolves on OpenRouter at build time;
  if not yet, fall back to `deepseek/deepseek-chat-v3.1`. Consider bumping
  8bitoracle-next's `STANDARD_MODELS` to v4-flash in the same pass.
- **Image model:** `fal-ai/z-image/turbo` is confirmed; just confirm the ported fal call
  passes this slug directly (8bitoracle's checked-in `FAL_IMAGE_MODELS` predates it).
- Confirm CC-BY-SA attribution wording and which exact Cairn 2e tables to adapt for the
  initial grounding-table seed.
- Confirm the `lantern_*` RLS policy with 8bitoracle's current convention before writing
  the migration.
```
