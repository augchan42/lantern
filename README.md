# Lantern

A personal **Warden's helper** for running rules-light family fantasy sessions (a softened
Cairn 2e engine) with kids ~9–12. It is a back-pocket idea machine **and campaign memory**
for the Warden — it does not run the game, narrate to players, or expose any player-facing
UI. See the design spec for the full picture.

> **Status:** foundation built, UI panels pending. The core (env, DB client, grounding
> tables, prompts, AI service, event writer) is implemented and tested. The DB schema
> (`lantern_*` tables + `ai_provider_requests` columns) is live in the shared Supabase
> project `ezlyfsgpcahlnbqgdlxh`. See `docs/superpowers/` for specs and plans.

## Repository layout

```
docs/superpowers/
  specs/    Design specs (the "what" and "why"), one per feature/subsystem
  plans/    Implementation plans (the "how"), bite-sized tasks derived from a spec
reviews/    Independent review artifacts (e.g. Codex review-loop output) — generated, not hand-edited
```

Key documents:
- `docs/superpowers/specs/2026-06-08-lantern-design.md` — the Lantern app design.
- `docs/superpowers/specs/2026-06-08-shared-supabase-platform-design.md` — the shared
  database platform Lantern depends on.
- `docs/superpowers/plans/2026-06-08-platform-db-foundation.md` — implementation plan for
  the platform foundation (do this first; it unblocks Lantern's tables).

## Workflow

`spec → plan → implementation`. Specs are brainstormed and approved first; each spec
becomes one or more implementation plans; plans are executed task-by-task (often with an
independent review loop in between).

## Related repos (siblings under `projects/`)

- **`platform-db`** — canonical migration history + shared AI-logging infra for the shared
  Supabase project `ezlyfsgpcahlnbqgdlxh`. **All** DB schema changes (including Lantern's
  `lantern_*` tables) land here, never in an app repo.
- **`photocritic-site`** / **`ara-eval`** — existing apps that already share that same
  Supabase project. Lantern's AI service is ported from photocritic's proven code (via the
  platform's reference service).

## Adding planning docs

Name files `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` and
`docs/superpowers/plans/YYYY-MM-DD-<feature>.md`. Commit specs/plans; treat `reviews/` as
generated output.
