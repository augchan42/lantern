# Lantern — Design Spec

**Date:** 2026-06-08
**Status:** In review (round 2)
**Tagline:** *a cozy Warden's helper*

> **Depends on** `2026-06-08-shared-supabase-platform-design.md`. The Database / Migrations /
> AI-logging sections below describe the *interim* shared-DB approach and will be **trimmed
> to consume the platform** once that spec is approved: `lantern_*` tables become a
> `platform-db` migration (not photocritic's folder), and `session_id` / cost / tokens log to
> the platform's new **top-level** `ai_provider_requests` columns (dropping the metadata-jsonb
> workaround).

## Purpose

Lantern is a personal **Warden's helper** app for running rules-light family fantasy
sessions (Cairn 2e engine, softened) with the author's nieces (ages ~9–12). The author
runs the game out loud; Lantern is a back-pocket idea machine **and campaign memory** that
feeds *the Warden* material on demand. It does **not** run the game, narrate to the kids,
or let the kids interact directly.

The product is **~20% generation, ~80% remembering**: a Warden's notebook that makes the
campaign about recurring people and consequences, with quick inspiration on tap. Pure
"first encounter" generation goes stale by hour two without memory; the memory layer
(below) is the spine, not an add-on.

Non-goals (explicitly out of scope for v1):
- No VTT, maps, grids, or token movement.
- No player-facing UI; only the Warden touches the app.
- No auth / multi-user / accounts (single operator at the table).
- No AI narration read verbatim to kids — output is raw material for the Warden.
- No character sheets / advancement / inventory (kids' sheets stay on paper).
- No full combat engine — only a tiny ephemeral scuffle counter (real combat is paper).

## Audience & Tone

- **Players:** tweens, ~9–12. Can handle stakes, puzzles, and light peril.
- **Tone knob:** a single per-campaign setting, `gentle` | `adventurous`, baked into the
  system prompt. Sessions inherit their campaign's tone.
  - No real death. Peril resolves as setbacks, capture, lost items, or being scared off.
  - Reading level ~age 9–12. Whimsical, warm, "dark but friendly Wood."

## Cairn 2e Foundation

Lantern **piggybacks off Cairn 2e** rather than inventing an engine. Cairn 2e (by Yochai
Gal) is CC-BY-SA 4.0, so its rules text and tables can be adapted and shipped *with
attribution* and under the *same license*.

What Lantern takes from Cairn 2e:

- **The resolution engine (softened), encoded in the system prompt** so AI output proposes
  outcomes the Warden adjudicates with Cairn's actual rules:
  - **Saves:** roll d20 *under* STR / DEX / WIL. The AI never rolls for the kids; it frames
    moments ("this might call for a DEX save").
  - **Combat:** attacks *always hit*; roll the weapon/creature damage die, subtract Armor,
    apply to HP then STR. (HP is luck/positioning; STR is the body.)
  - **Softening rule (Lantern-specific):** STR reaching 0 is **never death** — knocked-out,
    scared off, captured, or a lost item (Warden's choice, seeded by `complications`). This
    single override is stated in the system prompt and honored by the scuffle counter.
  - **Dropped:** deprivation/fatigue, deep dungeon bookkeeping, lethal monsters.
- **Generator/oracle tables as grounding seed data** — Cairn 2e's open tables seed the
  Lantern grounding tables; adapted for kid-softness and shipped as static TS.

**Attribution:** `CREDITS.md` + an "About" footer credit Cairn 2e under CC-BY-SA 4.0. The
grounding-table source files carry a license header and are themselves CC-BY-SA 4.0
(because they redistribute adapted Cairn text); the app code keeps the repo's own license.

## Memory Model (the spine)

Everything Lantern generates is grounded in a persistent, campaign-scoped memory the
Warden curates. Two ideas:

1. **Campaign summary** — a short prose `summary` on the campaign ("The children befriended
   Pib the goblin; they owe Old Mossback a favor; they carry the Ice Key; they seek the
   Clock Tower."). **Warden-edited** (always works, zero AI dependency) with an optional
   **"Summarize recent events"** AI-assist button that folds the latest `lantern_events`
   into the summary on demand (`use_case: lantern_summary`).
2. **Threads** — structured, persistent, **star-able** notebook entries the Warden curates:
   - **People** → `lantern_npcs` rows (recurring NPCs with portraits).
   - **Places / Problems / Treasures / Notes** → `lantern_threads` rows.

**Prompt injection:** every generation prompt receives the campaign `summary` plus the
**starred** People/Places/Problems/Treasures (compact one-liners). Starring is "⭐ remember
this" — it's how a beloved NPC outranks a random shopkeeper in future prompts, and it keeps
prompt size bounded (only starred entries are injected, not the whole notebook). Visiting
"Hazel-Anne again" works because she's a persisted, campaign-scoped row, not a buried event.

## Stack & Infra

- **App:** New standalone Next.js app (App Router) in `projects/lantern`, its own git repo.
  Tailwind + Radix UI, mirroring photocritic-site / 8bitoracle conventions. No auth.
- **Database:** Reuses the **shared Supabase project `ezlyfsgpcahlnbqgdlxh`** used by
  **photocritic-site and ara-eval**. It already holds `ai_provider_requests`, `critiques`,
  `site_settings`, and `ara_*` tables. Lantern does not stand up its own database.
- **Migrations:** ALL Lantern schema changes live in
  **`photocritic-site/supabase/migrations/`** (the repo with this project's clean migration
  history), following its **numeric** convention `00N_*.sql` — next file
  `005_lantern_tables.sql`. Lantern's code repo holds no migrations.
- **Table naming:** every Lantern-owned table is prefixed `lantern_` for clear separation
  from photocritic / ara tables sharing the database.
- **AI port source:** port from **photocritic-site**, which already targets this DB and
  image model — `src/lib/ai-provider.ts` (OpenRouter send + failover + logging) and
  `src/lib/fal-image.ts` (already `fal-ai/z-image/turbo`). 8bitoracle is a secondary
  reference only.
- **Text model:** OpenRouter `deepseek/deepseek-v4-flash` (intended-current). Fall back to
  `deepseek/deepseek-chat-v3.1` if v4-flash isn't yet resolvable at build time. photocritic
  / 8bitoracle model lists may want the same bump.
- **Image model:** fal.ai `fal-ai/z-image/turbo` (confirmed; already the constant in
  photocritic's `fal-image.ts`).
- **Image storage:** generated images go to Vercel Blob; only the blob URL is stored
  (never base64 in the DB).
- **Env vars** (copy values from `photocritic-site/.env.local`):
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `OPENROUTER_API_KEY`, `BLOB_READ_WRITE_TOKEN`, **and `FAL_API_KEY`** — the latter is
  **not** in photocritic's committed env (set at runtime); Lantern must provide it
  (`fal-image.ts` reads `FAL_API_KEY || FAL_KEY`).

## AI Layer (ported from photocritic-site)

- `lanternAiService.sendMessage()` — thin wrapper over photocritic's `ai-provider.ts`:
  - text → OpenRouter; images → `fal-image.ts` (z-image/turbo); sequential model failover.
  - input: `{ useCase, systemPrompt, question, session_id, aspectRatio? }`.
  - returns `{ text? , imageUrl?, usage, model, provider, request_id }`; for images it
    uploads the fal result to Vercel Blob and returns the **blob URL** (never base64).
- **Logging** reuses photocritic's `ai_provider_requests` insert. That table's columns are
  `request_id`, `use_case`, `model`, `model_array`, `response_status`, `error_message`,
  `raw_request`, `raw_response`, `metadata jsonb` — there are **no** top-level `session_id`,
  `total_cost`, or token columns. So Lantern logs:
  - `use_case` + `request_id` as top-level columns (as photocritic does),
  - `session_id`, token counts, and cost **inside `metadata`** (`metadata.session_id`, etc.).

  Every call (success AND failure) is logged, matching photocritic. **No migration to
  `ai_provider_requests` is needed.**
- **`use_case` values:** `lantern_scene`, `lantern_twist`, `lantern_npc`,
  `lantern_npc_portrait`, `lantern_recap`, `lantern_summary`. Defined as Lantern constants
  (valid strings on the request rows; not added to any other repo's enum).
- **`session_id`** = the current `lantern_sessions.id`, written into `metadata` so a game
  session's AI calls group together.

## Prompts (representative samples — expand during build)

Prompts assemble from four parts: **system prompt** (engine + tone, per session) +
**injected memory** (campaign summary + starred threads) + **rolled grounding** +
**per-use-case task instruction + Warden note**.

### System prompt (full draft)

> You are an idea engine for the *Warden* (game master) of a cozy tabletop fantasy game
> for children aged 9–12, played out loud. You never speak to the players. You produce
> short, vivid raw material the Warden can paraphrase. You run on a softened Cairn 2e
> engine: saves are d20 roll-*under* STR/DEX/WIL; combat attacks always hit and deal damage
> minus Armor to HP then STR. **Nothing is ever fatal** — danger resolves as setbacks,
> capture, lost items, fright, or being chased off. Setting is "the Wood": a
> dark-but-friendly fairytale forest. Tone: {{TONE}}. Reading level ~age 9–12: concrete,
> warm, whimsical, a little spooky. When a moment could call for a roll, *name the save*
> but never roll or decide the result. Honor the ongoing campaign — reuse the people,
> places, and promises in the memory below; make this feel like a continuing story, not a
> first encounter.
>
> CAMPAIGN MEMORY:
> {{campaign_summary}}
> WHO/WHAT MATTERS (starred): {{starred_threads}}

`{{TONE}}` → *"gentle — peril stays soft and reassuring"* or *"adventurous — real stakes
and tension, but still never lethal."*

### Per-use-case task instructions

- **`lantern_scene`** (full sample):
  > Using these rolled details — Location: {{wood_location}}; Omen/Weather:
  > {{omens_weather}}; Hook: {{scene_seed}}; possible Complication: {{complication}} —
  > write a 2–4 sentence scene the Warden can drop the kids into, consistent with the
  > campaign memory. End with one sensory detail the kids could poke at. Warden note:
  > "{{warden_note}}".

- **`lantern_twist`** (replaces "What Next?"; returns JSON): given the current scene +
  Warden note + memory, return ONE concrete development as
  `{ "type": "reveal"|"obstacle"|"opportunity", "text": "…" }` — a *thing that happens*,
  not branching options (e.g. "The bridge already knows their names"; "The lost sheep
  belongs to the witch"; "A rival band of kids arrives first"). Prefer payoffs that use an
  existing thread. Roll one `complication` to flavor obstacles.

- **`lantern_npc`** (returns JSON): given rolled `name`/`npc_trait`/`npc_want` + memory,
  return `{ "name", "trait", "want", "voice_hint", "portrait_prompt" }`.

- **`lantern_npc_portrait`**: image call (async — see panels). Prompt = the NPC's
  `portrait_prompt` + fixed style suffix (*"storybook illustration, soft warm colors,
  friendly, no text"*). `aspectRatio: "1:1"`.

- **`lantern_recap`**: given the session's `lantern_events` summaries, write a warm 4–6
  sentence "previously, in the Wood…" the Warden reads aloud to re-open next session.

- **`lantern_summary`** (AI-assist for campaign memory): given the current campaign
  `summary` + recent `lantern_events`, return an updated short summary (≤ 6 sentences) that
  folds in new people/promises/items and drops resolved ones. The Warden reviews/edits the
  result before it's saved.

## Grounding Tables (authored as static data)

Static TS in the Lantern repo (NOT database tables), seeded by adapting Cairn 2e's open
tables plus kid-soft additions, injected into prompts so output stays on-theme.

**Format** — each is `export const <name>: string[]` in `src/grounding/<name>.ts`,
re-exported from `src/grounding/index.ts`, with `roll<Name>()` / `rollN(table, n)` helpers
that avoid immediate repeats. A unit test asserts size targets.

**Size targets** (repetition kills immersion by session 4 — twelve entries is too few):
- ≥ **50** entries each for the high-churn four: `wood_locations`, `omens_weather`,
  `scene_seeds`, `complications`.
- ≥ 24 each for `names`, `npc_traits`, `npc_wants`, `clues_treasure`.
- ≥ 12 for `soft_monsters` (each a Cairn-shaped shell `{ name, hp, armor, dmg, quirk }`).

Representative entries: locations (*the Hollow Oak, Mushroom Market, the Quiet Pond*);
omens (*sudden warm fog, crows flying backward, first snow*); hooks (*a bridge that asks a
riddle, a sheep stuck in brambles*); complications (*gear gets soggy, a friend wanders off,
the path loops back*); soft_monsters (*grumpy badger-knight, a tickle of pixies, a sleepy
stone golem*).

## Persistence (thin Lantern tables)

Five new prefixed tables, migrated in photocritic-site as `005_lantern_tables.sql`.
Campaign-scoped so people/places survive across sessions. Representative SQL:

```sql
create table if not exists lantern_campaigns (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  title       text,
  tone        text not null default 'gentle' check (tone in ('gentle','adventurous')),
  summary     text not null default '',          -- Warden-edited campaign memory
  status      text not null default 'active' check (status in ('active','ended'))
);

create table if not exists lantern_sessions (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  campaign_id  uuid not null references lantern_campaigns(id) on delete cascade,
  title        text,
  status       text not null default 'active' check (status in ('active','ended'))
);

create table if not exists lantern_npcs (              -- the "People" threads
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  campaign_id   uuid not null references lantern_campaigns(id) on delete cascade,
  session_id    uuid references lantern_sessions(id) on delete set null,  -- where first met
  name          text not null,
  trait         text,
  want          text,
  voice_hint    text,
  portrait_url  text,             -- Vercel Blob URL, filled in asynchronously
  starred       boolean not null default false,
  notes         text
);

create table if not exists lantern_threads (           -- Places / Problems / Treasures / Notes
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  campaign_id  uuid not null references lantern_campaigns(id) on delete cascade,
  kind         text not null check (kind in ('place','problem','treasure','note')),
  title        text not null,
  detail       text,
  starred      boolean not null default false
);

create table if not exists lantern_events (            -- chronological log → recap + summarize
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  session_id     uuid not null references lantern_sessions(id) on delete cascade,
  kind           text not null check (kind in ('scene','twist','npc','recap','note')),
  summary        text not null,
  payload        jsonb,
  ai_request_id  text       -- mirrors photocritic's critiques.ai_request_id → ai_provider_requests.request_id
);
create index on lantern_sessions (campaign_id, created_at);
create index on lantern_npcs (campaign_id);
create index on lantern_threads (campaign_id, kind);
create index on lantern_events (session_id, created_at);
```

RLS: follow photocritic's convention for these single-operator tables — RLS enabled, no
public client access; writes go through the service-role admin client used for logging.

**Scuffle counter state is local React state only** — not persisted (a scuffle is
ephemeral; HP and turn order live only in the panel).

## The Panels (single screen, campaign + session scoped)

A top **campaign/session bar** shows campaign title, tone, current session, and
Start/Resume/End controls (campaign_id + session_id persisted to `localStorage` so a
refresh resumes). Below it a responsive 2×2 grid (stacks to 1 column on narrow widths).

```
┌──────────────────────────────────────────────────────────────┐
│  🏮 Lantern  Campaign: The Wood  tone:[gentle▾]  Session 3 ▸ │
│                                  [End Session]  [Edit Memory]  │
├───────────────────────────────┬──────────────────────────────┤
│  ① SCENE + TWIST              │  ② NPC GENERATOR             │
│  ┌──────────────────────────┐ │  name · trait · want          │
│  │ scene text (2–4 sent.)   │ │  ┌───────┐  "voice hint…"     │
│  └──────────────────────────┘ │  │portrait│ (fills in async)  │
│  Warden note: [__________]    │  └───────┘  [⭐ Remember]      │
│  [ New Scene ]  [ Twist ✦ ]   │  [ New NPC ]                  │
│  ✦ reveal/obstacle/opportunity│                               │
├───────────────────────────────┼──────────────────────────────┤
│  ③ NOTES & THREADS            │  ④ SESSION RECAP             │
│  [People][Places][Problems]…  │  "Previously, in the Wood…"   │
│   ⭐ Hazel-Anne — owes favor  │  (reads this session's events)│
│   ⭐ Ice Key — carried        │  [ Generate Recap ]           │
│  [+ add]   scuffle: Badger HP4│                               │
│            [-][+]  ▸turn      │                               │
└───────────────────────────────┴──────────────────────────────┘
```

1. **Scene + Twist** (`ScenePanel`) — generate a scene (`lantern_scene`); a single
   **Twist** button returns one concrete development (`lantern_twist`) reacting to the
   Warden note + memory. Each logs a `lantern_events` row.
2. **NPC generator** (`NpcPanel`) — name + trait + want (`lantern_npc`) returns **text
   immediately**; the portrait (`lantern_npc_portrait`) is fired **asynchronously** and
   fills in when ready (often 20–40s) so the table never stalls. A **⭐ Remember** button
   promotes the NPC to a persisted `lantern_npcs` row (People thread). Logs a
   `lantern_events` row of kind `npc`.
3. **Notes & Threads + scuffle counter** (`NotebookPanel`) — tabbed People / Places /
   Problems / Treasures / Notes over `lantern_npcs` + `lantern_threads`: add, edit, ⭐ star
   (starred entries feed every prompt). Includes a **tiny local scuffle counter** — a few
   soft creatures seeded from `soft_monsters`, simple HP −/＋, basic turn order, damage =
   die − Armor, 0 HP = "out of the scuffle" (never death). The counter is local-only; the
   threads are persisted. No AI in this panel.
4. **Session recap** (`RecapPanel`) — reads `lantern_events` for the session → a read-aloud
   summary (`lantern_recap`). Logged as kind `recap`. The **Edit Memory** control (in the
   bar) opens the campaign summary for hand-editing with an optional "Summarize recent
   events" AI-assist (`lantern_summary`).

**Panel states:** each AI-backed action has idle → loading → result → error (friendly
inline message + Retry); buttons disable while a call is in flight. The portrait has its
own independent loading state inside the NPC card.

## Backend Wiring & File Structure

Server-side AI + DB calls run in Next.js **Route Handlers** under `/api/lantern/*`; panels
are client components that POST to them. The service-role Supabase client handles all
`lantern_*` writes and `ai_provider_requests` logging.

```
src/
  app/
    page.tsx                          # campaign/session gate + 2×2 panel grid
    api/lantern/
      campaign/route.ts               # POST create, PATCH (summary/tone/end)
      session/route.ts                # POST create, PATCH end
      scene/route.ts                  # POST → lantern_scene (+ log event)
      twist/route.ts                  # POST → lantern_twist (+ log event)
      npc/route.ts                    # POST → lantern_npc (text);  ?portrait → fal call
      npcs/route.ts                   # GET/POST/PATCH lantern_npcs (star, persist, edit)
      threads/route.ts                # GET/POST/PATCH lantern_threads
      recap/route.ts                  # POST → reads events, lantern_recap (+ log)
      summary/route.ts                # POST → lantern_summary AI-assist
  components/lantern/
    SessionBar.tsx  ScenePanel.tsx  NpcPanel.tsx  NotebookPanel.tsx  RecapPanel.tsx
    MemoryEditor.tsx  ScuffleCounter.tsx
  services/lanternAiService.ts        # wrapper over ported photocritic ai-provider + fal
  grounding/  index.ts  wood_locations.ts  …  soft_monsters.ts
  prompts/    systemPrompt.ts  scene.ts  twist.ts  npc.ts  recap.ts  summary.ts
  lib/
    supabaseAdmin.ts                  # service-role client
    memory.ts                         # buildMemoryBlock(campaign): summary + starred threads
    lanternEvents.ts                  # writeEvent({session_id, kind, summary, payload, ai_request_id})
```

Each AI route: validate body → `buildMemoryBlock(campaign)` → assemble prompt (system +
memory + grounding rolls + task + Warden note) → `lanternAiService.sendMessage()` →
`writeEvent(...)` with the returned `request_id` → return the result.

## Data Flow

1. Start/resume **campaign** → POST `/api/lantern/campaign` → hold `campaign_id`. Start a
   **session** under it → POST `/api/lantern/session` → hold `session_id`. Both cached in
   `localStorage`.
2. Each AI generation: route injects campaign memory, calls
   `lanternAiService.sendMessage()` with the right `use_case` + `session_id` (in
   `metadata`); raw call auto-logged to `ai_provider_requests`; a clean summary written to
   `lantern_events`.
3. NPC portrait fires async after NPC text returns; on success, persists `portrait_url` if
   the NPC was ⭐-remembered.
4. Recap reads `lantern_events` where `session_id = current`. "Summarize recent events"
   updates `lantern_campaigns.summary` (Warden reviews before save).
5. End session → PATCH status `ended`; campaign stays active for the next night.

## Error Handling

- AI failure: friendly inline message; model failover already tries fallbacks; the Warden
  can retry or improvise (assist tool, never a blocker).
- Portrait failure: NPC keeps its text; portrait shows a placeholder; no table stall.
- `lantern_twist` / `lantern_npc` / `lantern_summary` JSON parse failure: retry once, then
  show raw text so the Warden still gets material.
- DB logging failure: non-fatal (console-logged, like photocritic); never breaks the table.

## Testing

- Unit: grounding-table size targets + no empties; prompt assembly (system + tone + memory
  block + rolls render correctly); `buildMemoryBlock` injects only starred threads;
  `sendMessage` routing (text vs image); twist/npc/summary JSON shaping + parse-fallback;
  `lantern_events` summary shaping; scuffle math (die − armor, 0 HP = out, never below 0).
- Integration: campaign lifecycle (create campaign → session → generate scene → log event
  → star an NPC → recap reads it back → summarize folds it into campaign.summary) against a
  test Supabase or mocked admin client. Verify `session_id` lands in `metadata`, not a
  top-level column.
- Manual play-test checklist (one real session before relying on it at the table): scene
  reads naturally aloud and uses a remembered thread; twist lands as concrete content; NPC
  text returns instantly with portrait arriving later; notebook starring changes later
  prompts; scuffle counter survives a full fight; recap + summarize capture the night.

## Open Items

- **Text model:** confirm `deepseek/deepseek-v4-flash` resolves on OpenRouter at build
  time; else fall back to `deepseek/deepseek-chat-v3.1`. Consider bumping photocritic /
  8bitoracle model lists too.
- **FAL key:** ensure `FAL_API_KEY` is set for Lantern (absent from photocritic's committed
  env).
- **Cairn attribution:** confirm CC-BY-SA wording and which exact Cairn 2e tables seed the
  initial grounding set.
- **RLS:** confirm the `lantern_*` RLS policy against photocritic's current convention
  before writing `005_lantern_tables.sql`; coordinate the migration with photocritic-site's
  owner since it lands in that repo.
- **Migration ownership:** since `005_lantern_tables.sql` lives in photocritic-site, decide
  how Lantern applies/tracks it (PR to photocritic-site vs. direct `supabase db push`).
```
