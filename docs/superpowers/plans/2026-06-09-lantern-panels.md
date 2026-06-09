# Lantern Panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Lantern UI — a single-password middleware gate, the campaign/session gate, the four panels (Scene+Twist, NPC, Notebook+Scuffle, Recap), the memory editor, and the `/api/lantern/*` route handlers that wire them to the already-built AI service, grounding tables, prompt assembly, and `lantern_*` tables. The scuffle counter persists via localStorage + a new `lantern_scuffles` row.

> **2026-06-09 decisions folded in:** middleware password gate over page + API (Task B); text-model fallback → `google/gemini-2.5-flash-lite` (Task A); scuffle persistence localStorage **and** DB (Tasks C, 10, 14, plus the scuffle route); order-independent async portrait (Task 6). Run Tasks A–C before the panel tasks.

**Architecture:** Server-side AI + DB calls live in Next.js App Router **Route Handlers** (`src/app/api/lantern/*`); panels are client components that POST to them. Each AI route loads campaign memory → assembles `system + memory + grounding rolls + task` → calls `lanternAiService.sendMessage()` → writes a `lantern_events` row with the returned `request_id`. All `lantern_*` reads/writes go through the service-role `supabaseAdmin()` client. Campaign/session ids live in `localStorage` so a refresh resumes. The scuffle counter is local React state only (never persisted).

**Tech Stack:** Next.js 16 (App Router, route handlers, `nodejs` runtime), React 19 client components, Tailwind CSS v4, `@supabase/supabase-js` (service-role), Vitest for tests. Builds entirely on the foundation modules already in `src/` (`lanternAiService`, `buildMemoryBlock`, `buildSystemPrompt`, `*Task` builders, `USE_CASES`, grounding `roll`/`rollN`, `writeEvent`, `supabaseAdmin`).

**Prerequisites (already done):** Foundation plan complete and committed (env, `supabaseAdmin`, grounding tables, prompts, `lanternAiService`, `writeEvent`, `useCases`, `memory`). The `lantern_*` tables and `ai_provider_requests` columns are live in Supabase project `ezlyfsgpcahlnbqgdlxh`. `.env.local` is populated (DB + OpenRouter + Blob + FAL).

**Reused foundation signatures (do not redefine — import these):**
- `lanternAiService.sendMessage({ useCase, systemPrompt, question, sessionId, models?, aspectRatio? })` → `{ text?, imageUrl?, model, provider, requestId }`
- `buildMemoryBlock({ summary }, { npcs, threads })` → `string`
- `buildSystemPrompt(tone: "gentle"|"adventurous", memoryBlock: string)` → `string`
- `sceneTask`, `twistTask`, `npcTask`, `recapTask`, `summaryTask` from `@/prompts/tasks`
- `USE_CASES` from `@/lib/useCases`; `roll`/`rollN` + tables from `@/grounding`
- `writeEvent({ session_id, kind: "scene"|"twist"|"npc"|"recap"|"note", summary, payload?, ai_request_id? })`

---

## File Structure

**New backend / lib files**
- `src/lib/apiHelpers.ts` — `ok()` / `fail()` / `readBody()` JSON response + parse helpers for route handlers.
- `src/lib/parseModelJson.ts` — tolerant `{...}` extractor for model JSON (twist/npc/summary) with null-on-failure.
- `src/lib/campaignRepo.ts` — `getCampaign()`, `assembleContext()` (campaign + starred memory → system prompt), `recentEventSummaries()`.
- `src/lib/scuffle.ts` — pure scuffle math (`applyDamage`, `isOut`, `nextTurn`).
- `src/lib/client/api.ts` — typed `postJson()` / `getJson()` fetch wrappers + shared client request/response types.
- `src/lib/client/useCampaignSession.ts` — `localStorage`-backed campaign/session id hook.

**New route handlers** (all `export const runtime = "nodejs"`)
- `src/app/api/lantern/campaign/route.ts` — `POST` create, `PATCH` (summary/tone/status).
- `src/app/api/lantern/session/route.ts` — `POST` create, `PATCH` end.
- `src/app/api/lantern/scene/route.ts` — `POST` → `lantern_scene` (+ event).
- `src/app/api/lantern/twist/route.ts` — `POST` → `lantern_twist` JSON (+ event).
- `src/app/api/lantern/npc/route.ts` — `POST` → `lantern_npc` text; `?portrait=1` → `lantern_npc_portrait` image.
- `src/app/api/lantern/npcs/route.ts` — `GET`/`POST`/`PATCH` `lantern_npcs` (list, persist/star, edit).
- `src/app/api/lantern/threads/route.ts` — `GET`/`POST`/`PATCH` `lantern_threads`.
- `src/app/api/lantern/recap/route.ts` — `POST` → reads events → `lantern_recap` (+ event).
- `src/app/api/lantern/summary/route.ts` — `POST` → `lantern_summary` AI-assist.

**New components**
- `src/components/lantern/SessionBar.tsx` — campaign/session bar + gate controls.
- `src/components/lantern/ScenePanel.tsx`, `NpcPanel.tsx`, `NotebookPanel.tsx`, `RecapPanel.tsx`, `MemoryEditor.tsx`, `ScuffleCounter.tsx`.
- `src/app/page.tsx` — **modify** to the campaign/session gate + 2×2 grid.

**New docs**
- `CREDITS.md` — Cairn 2e CC-BY-SA attribution.

**New auth / persistence files (2026-06-09 decisions)**
- `src/proxy.ts`, `src/app/login/page.tsx`, `src/app/api/login/route.ts` — password gate.
- `src/app/api/lantern/scuffle/route.ts` — GET + upsert `lantern_scuffles`.
- `../platform-db/supabase/migrations/<ts>_lantern_scuffles.sql` — the scuffle table (gated push).

---

### Task A: Backup text-model fallback (foundation tweak)

**Files:**
- Modify: `src/services/openrouter.ts:13-16`

- [ ] **Step 1: Change the fallback model**

In `src/services/openrouter.ts`, the `DEFAULT_MODELS` array is:
```ts
const DEFAULT_MODELS = [
  "deepseek/deepseek-v4-flash",
  "deepseek/deepseek-chat-v3.1",
];
```
Change the second entry so it reads:
```ts
const DEFAULT_MODELS = [
  "deepseek/deepseek-v4-flash",
  "google/gemini-2.5-flash-lite",
];
```
(Primary unchanged; only the failover model changes.)

- [ ] **Step 2: Verify the suite still passes**

Run: `npm test`
Expected: all existing suites PASS (the routing test mocks the caller, so the model-list change is non-breaking).

- [ ] **Step 3: Commit**

```bash
git add src/services/openrouter.ts
git commit -m "feat: use google/gemini-2.5-flash-lite as text-model fallback"
```

---

### Task B: Single-password middleware gate

**Files:**
- Create: `src/proxy.ts`  (Next 16's proxy file convention — the renamed `middleware`)
- Create: `src/app/login/page.tsx`
- Create: `src/app/api/login/route.ts`
- Modify: `.env.local.example` (add `LANTERN_PASSWORD=`)

> Threat model: single operator, single shared password, public HTTPS URL. The httpOnly
> cookie holds the password and the middleware compares it to `LANTERN_PASSWORD` — a
> deliberate simplification (no per-user identity, no session store). It must cover the
> `/api/*` routes because they front the service-role key.

- [ ] **Step 1: Add the env var to the example file**

Append to `.env.local.example`:
```
# Single shared password for the middleware auth gate
LANTERN_PASSWORD=
```
Then set a real value in `.env.local` (not committed).

- [ ] **Step 2: Implement the middleware**

Create `src/proxy.ts` (Next 16 renamed `middleware` → `proxy`; the file must export a function named `proxy` or a default export):
```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE = "lantern_auth";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Let the login page + its endpoint through (everything else is gated).
  if (pathname.startsWith("/login") || pathname.startsWith("/api/login")) {
    return NextResponse.next();
  }
  const token = req.cookies.get(COOKIE)?.value;
  if (token && token === process.env.LANTERN_PASSWORD) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

// Run on everything except Next internals + static assets.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 3: Implement the login endpoint**

Create `src/app/api/login/route.ts`:
```ts
export const runtime = "nodejs";
import { NextResponse } from "next/server";

const COOKIE = "lantern_auth";

export async function POST(req: Request) {
  const { password } = (await req.json()) as { password?: string };
  if (!password || password !== process.env.LANTERN_PASSWORD) {
    return NextResponse.json({ error: "wrong password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, password, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
```

- [ ] **Step 4: Implement the login page**

Create `src/app/login/page.tsx`:
```tsx
"use client";
import { useState, type FormEvent } from "react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) window.location.href = "/";
    else setError("Wrong password");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-amber-50/30">
      <form onSubmit={submit} className="w-72 space-y-2 rounded-lg border border-amber-900/15 bg-white p-4">
        <h1 className="text-lg">🏮 Lantern</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="w-full rounded border border-amber-900/30 px-2 py-1"
        />
        <button className="w-full rounded bg-amber-700 px-3 py-1 text-white">Enter</button>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </form>
    </main>
  );
}
```

- [ ] **Step 5: Manually verify the gate**

Run: `npm run dev`, open `http://localhost:3000` → expect redirect to `/login`. Wrong
password → "Wrong password"; right one → land on the panels. Confirm
`curl -s -o /dev/null -w '%{http_code}' "http://localhost:3000/api/lantern/npcs?campaignId=x"`
returns `401` without the cookie.

- [ ] **Step 6: Commit**

```bash
git add src/proxy.ts src/app/login src/app/api/login .env.local.example
git commit -m "feat: single-password middleware auth gate over page + api"
```

---

### Task C: `lantern_scuffles` migration (platform-db — GATED)

**Files:**
- Create: `../platform-db/supabase/migrations/<ts>_lantern_scuffles.sql`

> **This is a production schema change on the shared Supabase project.** Per repo rules the
> agent **authors** the migration in `platform-db`; the **operator pushes it** (`supabase db
> push`, operator auth) and verifies with `supabase db diff`. The scuffle route (Task D) and
> the DB half of Task 14 stay blocked until this is live. The localStorage half works without it.

- [ ] **Step 1: Author the migration in platform-db**

Create `../platform-db/supabase/migrations/<ts>_lantern_scuffles.sql` (timestamp after the
existing `20260608151700_lantern_tables.sql`, e.g. `20260609120000_lantern_scuffles.sql`):
```sql
-- lantern_scuffles: persisted scuffle-counter state (one row per session, upserted).
-- Single-operator: RLS enabled with no policies; only the service-role client reaches it.
create table if not exists "public"."lantern_scuffles" (
  "id"          uuid primary key default gen_random_uuid(),
  "session_id"  uuid not null unique references "public"."lantern_sessions"("id") on delete cascade,
  "combatants"  jsonb not null default '[]'::jsonb,   -- [{ id, name, hp, armor }]
  "turn"        integer not null default 0,
  "updated_at"  timestamptz not null default now()
);
create index if not exists "idx_lantern_scuffles_session" on "public"."lantern_scuffles" ("session_id");
alter table "public"."lantern_scuffles" enable row level security;
```

- [ ] **Step 2: Operator pushes + verifies (GATED — not run by the agent)**

From the `platform-db` repo (requires operator auth):
```bash
supabase db push
supabase db diff   # expect: no diff after push (table present)
```
Then confirm via REST (service-role), expecting HTTP 200 + `[]`:
```bash
curl -s -o /dev/null -w '%{http_code}\n' "$URL/rest/v1/lantern_scuffles?select=*&limit=1" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

- [ ] **Step 3: Commit the migration (in platform-db)**

```bash
# in ../platform-db
git add supabase/migrations/<ts>_lantern_scuffles.sql
git commit -m "feat: lantern_scuffles table (persisted scuffle counter)"
```

---

### Task 1: API + model-JSON helpers

**Files:**
- Create: `src/lib/apiHelpers.ts`
- Create: `src/lib/parseModelJson.ts`
- Test: `src/lib/parseModelJson.test.ts`

- [ ] **Step 1: Write the failing test for `parseModelJson`**

Create `src/lib/parseModelJson.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseModelJson } from "./parseModelJson";

describe("parseModelJson", () => {
  it("parses a bare JSON object", () => {
    expect(parseModelJson<{ type: string }>('{"type":"reveal","text":"x"}')).toEqual({
      type: "reveal",
      text: "x",
    });
  });
  it("strips ```json fences and surrounding prose", () => {
    const raw = 'Sure!\n```json\n{"name":"Pib"}\n```\nhope that helps';
    expect(parseModelJson<{ name: string }>(raw)).toEqual({ name: "Pib" });
  });
  it("returns null when there is no JSON object", () => {
    expect(parseModelJson("just some words")).toBeNull();
  });
  it("returns null on malformed JSON", () => {
    expect(parseModelJson('{"type": reveal}')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/parseModelJson.test.ts`
Expected: FAIL ("Cannot find module './parseModelJson'").

- [ ] **Step 3: Implement `parseModelJson.ts`**

Create `src/lib/parseModelJson.ts`:
```ts
/** Extract the first balanced-ish {...} from model output, tolerating code fences and prose. */
export function parseModelJson<T>(text: string): T | null {
  if (!text) return null;
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Implement `apiHelpers.ts` (no test — thin wrappers)**

Create `src/lib/apiHelpers.ts`:
```ts
import { NextResponse } from "next/server";

export function ok(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function readBody<T>(req: Request): Promise<T> {
  return (await req.json()) as T;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/parseModelJson.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/parseModelJson.ts src/lib/parseModelJson.test.ts src/lib/apiHelpers.ts
git commit -m "feat: api response helpers + tolerant model-JSON parser"
```

---

### Task 2: Campaign repository + context assembly

**Files:**
- Create: `src/lib/campaignRepo.ts`
- Test: `src/lib/campaignRepo.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/campaignRepo.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

// Chainable supabase stub: every builder method returns `this`; the chain is awaited
// to a { data } result configured per-table.
const results: Record<string, unknown> = {};
function makeBuilder(table: string) {
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit"]) {
    builder[m] = () => builder;
  }
  builder.single = async () => ({ data: results[`${table}:single`] ?? null, error: null });
  // Awaiting the builder itself resolves to the list result.
  builder.then = (resolve: (v: unknown) => unknown) =>
    resolve({ data: results[`${table}:list`] ?? [], error: null });
  return builder;
}
vi.mock("./supabaseAdmin", () => ({
  supabaseAdmin: () => ({ from: (table: string) => makeBuilder(table) }),
}));

import { getCampaign, assembleContext, recentEventSummaries } from "./campaignRepo";

beforeEach(() => {
  for (const k of Object.keys(results)) delete results[k];
});

describe("assembleContext", () => {
  it("builds a system prompt from campaign tone + starred memory only", async () => {
    results["lantern_campaigns:single"] = {
      id: "c1", title: "The Wood", tone: "gentle", summary: "They owe Old Mossback a favor.", status: "active",
    };
    results["lantern_npcs:list"] = [{ name: "Hazel-Anne", want: "find her sheep", starred: true }];
    results["lantern_threads:list"] = [{ kind: "treasure", title: "Ice Key", detail: "carried", starred: true }];

    const ctx = await assembleContext("c1");
    expect(ctx.campaign.tone).toBe("gentle");
    expect(ctx.systemPrompt).toContain("gentle");
    expect(ctx.systemPrompt).toContain("Old Mossback");
    expect(ctx.systemPrompt).toContain("Hazel-Anne");
    expect(ctx.systemPrompt).toContain("Ice Key");
    expect(ctx.systemPrompt).toContain("never"); // no-death rule baked in
  });

  it("throws when the campaign is missing", async () => {
    results["lantern_campaigns:single"] = null;
    await expect(assembleContext("nope")).rejects.toThrow("nope");
  });
});

describe("getCampaign", () => {
  it("returns the row", async () => {
    results["lantern_campaigns:single"] = { id: "c1", tone: "adventurous", summary: "", status: "active", title: null };
    const c = await getCampaign("c1");
    expect(c?.tone).toBe("adventurous");
  });
});

describe("recentEventSummaries", () => {
  it("maps event rows to their summaries", async () => {
    results["lantern_events:list"] = [{ summary: "Met a fox" }, { summary: "Crossed the bridge" }];
    expect(await recentEventSummaries("s1")).toEqual(["Met a fox", "Crossed the bridge"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/campaignRepo.test.ts`
Expected: FAIL ("Cannot find module './campaignRepo'").

- [ ] **Step 3: Implement `campaignRepo.ts`**

Create `src/lib/campaignRepo.ts`:
```ts
import { supabaseAdmin } from "./supabaseAdmin";
import { buildMemoryBlock } from "./memory";
import { buildSystemPrompt, type Tone } from "@/prompts/systemPrompt";

export interface CampaignRow {
  id: string;
  title: string | null;
  tone: Tone;
  summary: string;
  status: string;
}

export async function getCampaign(id: string): Promise<CampaignRow | null> {
  const { data } = await supabaseAdmin()
    .from("lantern_campaigns")
    .select("*")
    .eq("id", id)
    .single();
  return (data as CampaignRow) ?? null;
}

export interface SessionContext {
  campaign: CampaignRow;
  systemPrompt: string;
}

/** Load a campaign + its starred memory and assemble the full system prompt. */
export async function assembleContext(campaignId: string): Promise<SessionContext> {
  const sb = supabaseAdmin();
  const [campaignRes, npcsRes, threadsRes] = await Promise.all([
    sb.from("lantern_campaigns").select("*").eq("id", campaignId).single(),
    sb.from("lantern_npcs").select("name, want, starred").eq("campaign_id", campaignId).eq("starred", true),
    sb.from("lantern_threads").select("kind, title, detail, starred").eq("campaign_id", campaignId).eq("starred", true),
  ]);

  const campaign = campaignRes.data as CampaignRow | null;
  if (!campaign) throw new Error(`campaign ${campaignId} not found`);

  const memory = buildMemoryBlock(
    { summary: campaign.summary },
    {
      npcs: (npcsRes.data ?? []) as Array<{ name: string; want?: string | null; starred: boolean }>,
      threads: (threadsRes.data ?? []) as Array<{ kind: string; title: string; detail?: string | null; starred: boolean }>,
    },
  );
  return { campaign, systemPrompt: buildSystemPrompt(campaign.tone, memory) };
}

/** Chronological event summaries for a session (oldest first), for recap/summary tasks. */
export async function recentEventSummaries(sessionId: string, limit = 40): Promise<string[]> {
  const { data } = await supabaseAdmin()
    .from("lantern_events")
    .select("summary")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(limit);
  return ((data ?? []) as Array<{ summary: string }>).map((e) => e.summary);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/campaignRepo.test.ts`
Expected: PASS (4 tests). If `buildSystemPrompt` import fails, confirm `src/prompts/systemPrompt.ts` exports `Tone` (it does).

- [ ] **Step 5: Commit**

```bash
git add src/lib/campaignRepo.ts src/lib/campaignRepo.test.ts
git commit -m "feat: campaign repo + memory/context assembly for routes"
```

---

### Task 3: Campaign + session lifecycle routes

**Files:**
- Create: `src/app/api/lantern/campaign/route.ts`
- Create: `src/app/api/lantern/session/route.ts`
- Test: `src/app/api/lantern/campaign/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/lantern/campaign/route.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const insertSingle = vi.fn(async () => ({ data: { id: "c1", tone: "gentle" }, error: null }));
const updateSingle = vi.fn(async () => ({ data: { id: "c1", tone: "adventurous" }, error: null }));

function chain(finalizer: () => Promise<unknown>) {
  const b: Record<string, unknown> = {};
  for (const m of ["insert", "update", "select", "eq"]) b[m] = () => b;
  b.single = finalizer;
  return b;
}
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      insert: () => ({ select: () => ({ single: insertSingle }) }),
      update: () => ({ eq: () => ({ select: () => ({ single: updateSingle }) }) }),
    }),
  }),
}));

import { POST, PATCH } from "./route";

beforeEach(() => { insertSingle.mockClear(); updateSingle.mockClear(); });

function post(body: unknown) {
  return POST(new Request("http://t/api/lantern/campaign", { method: "POST", body: JSON.stringify(body) }));
}
function patch(body: unknown) {
  return PATCH(new Request("http://t/api/lantern/campaign", { method: "PATCH", body: JSON.stringify(body) }));
}

describe("campaign route", () => {
  it("POST creates a campaign and returns it", async () => {
    const res = await post({ title: "The Wood", tone: "gentle" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "c1", tone: "gentle" });
    expect(insertSingle).toHaveBeenCalledOnce();
  });

  it("PATCH requires an id", async () => {
    const res = await patch({ summary: "x" });
    expect(res.status).toBe(400);
  });

  it("PATCH updates the campaign", async () => {
    const res = await patch({ id: "c1", tone: "adventurous" });
    expect(res.status).toBe(200);
    expect(updateSingle).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/lantern/campaign/route.test.ts`
Expected: FAIL ("Cannot find module './route'").

- [ ] **Step 3: Implement the campaign route**

Create `src/app/api/lantern/campaign/route.ts`:
```ts
export const runtime = "nodejs";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ok, fail, readBody } from "@/lib/apiHelpers";

interface CreateBody { title?: string; tone?: "gentle" | "adventurous" }
interface PatchBody { id?: string; title?: string; tone?: "gentle" | "adventurous"; summary?: string; status?: "active" | "ended" }

export async function POST(req: Request) {
  const body = await readBody<CreateBody>(req);
  const { data, error } = await supabaseAdmin()
    .from("lantern_campaigns")
    .insert({ title: body.title ?? null, tone: body.tone ?? "gentle" })
    .select("*")
    .single();
  if (error) return fail(error.message, 500);
  return ok(data);
}

export async function PATCH(req: Request) {
  const body = await readBody<PatchBody>(req);
  if (!body.id) return fail("id is required");
  const patch: Record<string, unknown> = {};
  for (const k of ["title", "tone", "summary", "status"] as const) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  const { data, error } = await supabaseAdmin()
    .from("lantern_campaigns")
    .update(patch)
    .eq("id", body.id)
    .select("*")
    .single();
  if (error) return fail(error.message, 500);
  return ok(data);
}
```

- [ ] **Step 4: Implement the session route**

Create `src/app/api/lantern/session/route.ts`:
```ts
export const runtime = "nodejs";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ok, fail, readBody } from "@/lib/apiHelpers";

interface CreateBody { campaignId?: string; title?: string }
interface PatchBody { id?: string; title?: string; status?: "active" | "ended" }

export async function POST(req: Request) {
  const body = await readBody<CreateBody>(req);
  if (!body.campaignId) return fail("campaignId is required");
  const { data, error } = await supabaseAdmin()
    .from("lantern_sessions")
    .insert({ campaign_id: body.campaignId, title: body.title ?? null })
    .select("*")
    .single();
  if (error) return fail(error.message, 500);
  return ok(data);
}

export async function PATCH(req: Request) {
  const body = await readBody<PatchBody>(req);
  if (!body.id) return fail("id is required");
  const patch: Record<string, unknown> = {};
  for (const k of ["title", "status"] as const) if (body[k] !== undefined) patch[k] = body[k];
  const { data, error } = await supabaseAdmin()
    .from("lantern_sessions")
    .update(patch)
    .eq("id", body.id)
    .select("*")
    .single();
  if (error) return fail(error.message, 500);
  return ok(data);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/app/api/lantern/campaign/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/lantern/campaign src/app/api/lantern/session
git commit -m "feat: campaign + session lifecycle routes"
```

---

### Task 4: Scene route

**Files:**
- Create: `src/app/api/lantern/scene/route.ts`
- Test: `src/app/api/lantern/scene/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/lantern/scene/route.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

// vi.hoisted() so the mock fns exist before the hoisted vi.mock() factories run (avoids TDZ).
// sendMessage takes a typed arg so `.mock.calls[0][0]` type-checks under `tsc`.
const { sendMessage, writeEvent, assembleContext } = vi.hoisted(() => ({
  sendMessage: vi.fn(async (_input?: unknown) => ({ text: "A misty glade.", model: "m", provider: "p", requestId: "r1" })),
  writeEvent: vi.fn(async () => undefined),
  assembleContext: vi.fn(async () => ({
    campaign: { id: "c1", title: null, tone: "gentle", summary: "", status: "active" },
    systemPrompt: "SYS",
  })),
}));
vi.mock("@/services/lanternAiService", () => ({ lanternAiService: { sendMessage } }));
vi.mock("@/lib/lanternEvents", () => ({ writeEvent }));
vi.mock("@/lib/campaignRepo", () => ({ assembleContext }));

import { POST } from "./route";

beforeEach(() => { sendMessage.mockClear(); writeEvent.mockClear(); assembleContext.mockClear(); });

function post(body: unknown) {
  return POST(new Request("http://t/api/lantern/scene", { method: "POST", body: JSON.stringify(body) }));
}

describe("scene route", () => {
  it("400s without ids", async () => {
    expect((await post({})).status).toBe(400);
  });

  it("generates a scene, logs an event, returns text", async () => {
    const res = await post({ campaignId: "c1", sessionId: "s1", wardenNote: "freed the sheep" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ text: "A misty glade.", requestId: "r1" });
    expect(assembleContext).toHaveBeenCalledWith("c1");
    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendMessage.mock.calls[0][0]).toMatchObject({ useCase: "lantern_scene", systemPrompt: "SYS", sessionId: "s1" });
    expect(writeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: "s1", kind: "scene", summary: "A misty glade.", ai_request_id: "r1" }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/lantern/scene/route.test.ts`
Expected: FAIL ("Cannot find module './route'").

- [ ] **Step 3: Implement the scene route**

Create `src/app/api/lantern/scene/route.ts`:
```ts
export const runtime = "nodejs";

import { ok, fail, readBody } from "@/lib/apiHelpers";
import { assembleContext } from "@/lib/campaignRepo";
import { lanternAiService } from "@/services/lanternAiService";
import { writeEvent } from "@/lib/lanternEvents";
import { USE_CASES } from "@/lib/useCases";
import { sceneTask } from "@/prompts/tasks";
import { roll, wood_locations, omens_weather, scene_seeds, complications } from "@/grounding";

interface SceneBody { campaignId?: string; sessionId?: string; wardenNote?: string }

export async function POST(req: Request) {
  const body = await readBody<SceneBody>(req);
  if (!body.campaignId || !body.sessionId) return fail("campaignId and sessionId are required");

  const { systemPrompt } = await assembleContext(body.campaignId);
  const task = sceneTask({
    wood_location: roll(wood_locations),
    omens_weather: roll(omens_weather),
    scene_seed: roll(scene_seeds),
    complication: roll(complications),
    warden_note: body.wardenNote ?? "",
  });

  const res = await lanternAiService.sendMessage({
    useCase: USE_CASES.scene,
    systemPrompt,
    question: task,
    sessionId: body.sessionId,
  });

  await writeEvent({
    session_id: body.sessionId,
    kind: "scene",
    summary: res.text ?? "",
    ai_request_id: res.requestId,
  });
  return ok({ text: res.text, requestId: res.requestId });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/lantern/scene/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/lantern/scene
git commit -m "feat: scene route (lantern_scene + event log)"
```

---

### Task 5: Twist route (JSON with parse-fallback)

**Files:**
- Create: `src/app/api/lantern/twist/route.ts`
- Test: `src/app/api/lantern/twist/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/lantern/twist/route.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

// vitest hoists vi.mock() above top-level consts, so mock fns referenced directly in a
// factory must be created inside vi.hoisted() to avoid a TDZ ReferenceError.
const { sendMessage, writeEvent } = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  writeEvent: vi.fn(async () => undefined),
}));
vi.mock("@/services/lanternAiService", () => ({ lanternAiService: { sendMessage } }));
vi.mock("@/lib/lanternEvents", () => ({ writeEvent }));
vi.mock("@/lib/campaignRepo", () => ({
  assembleContext: async () => ({ campaign: { tone: "gentle" }, systemPrompt: "SYS" }),
}));

import { POST } from "./route";

beforeEach(() => { sendMessage.mockReset(); writeEvent.mockClear(); });
function post(body: unknown) {
  return POST(new Request("http://t/api/lantern/twist", { method: "POST", body: JSON.stringify(body) }));
}

describe("twist route", () => {
  it("parses a JSON twist and logs its text", async () => {
    sendMessage.mockResolvedValue({ text: '{"type":"reveal","text":"The bridge knows their names."}', requestId: "r1", model: "m", provider: "p" });
    const res = await post({ campaignId: "c1", sessionId: "s1", wardenNote: "" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ twist: { type: "reveal", text: "The bridge knows their names." }, requestId: "r1" });
    expect(writeEvent).toHaveBeenCalledWith(expect.objectContaining({ kind: "twist", summary: "The bridge knows their names." }));
  });

  it("falls back to raw text when JSON is unparseable", async () => {
    sendMessage.mockResolvedValue({ text: "the sheep belongs to the witch", requestId: "r2", model: "m", provider: "p" });
    const res = await post({ campaignId: "c1", sessionId: "s1" });
    const json = await res.json();
    expect(json.twist).toBeNull();
    expect(json.raw).toBe("the sheep belongs to the witch");
    expect(writeEvent).toHaveBeenCalledWith(expect.objectContaining({ kind: "twist", summary: "the sheep belongs to the witch" }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/lantern/twist/route.test.ts`
Expected: FAIL ("Cannot find module './route'").

- [ ] **Step 3: Implement the twist route**

Create `src/app/api/lantern/twist/route.ts`:
```ts
export const runtime = "nodejs";

import { ok, fail, readBody } from "@/lib/apiHelpers";
import { assembleContext } from "@/lib/campaignRepo";
import { lanternAiService } from "@/services/lanternAiService";
import { writeEvent } from "@/lib/lanternEvents";
import { USE_CASES } from "@/lib/useCases";
import { twistTask } from "@/prompts/tasks";
import { roll, complications } from "@/grounding";
import { parseModelJson } from "@/lib/parseModelJson";

interface TwistBody { campaignId?: string; sessionId?: string; wardenNote?: string }
interface Twist { type: "reveal" | "obstacle" | "opportunity"; text: string }

export async function POST(req: Request) {
  const body = await readBody<TwistBody>(req);
  if (!body.campaignId || !body.sessionId) return fail("campaignId and sessionId are required");

  const { systemPrompt } = await assembleContext(body.campaignId);
  const task = twistTask({ warden_note: body.wardenNote ?? "", complication: roll(complications) });
  const res = await lanternAiService.sendMessage({
    useCase: USE_CASES.twist,
    systemPrompt,
    question: task,
    sessionId: body.sessionId,
  });

  const twist = parseModelJson<Twist>(res.text ?? "");
  const summary = twist?.text ?? (res.text ?? "").trim();
  await writeEvent({
    session_id: body.sessionId,
    kind: "twist",
    summary,
    payload: twist ?? { raw: res.text },
    ai_request_id: res.requestId,
  });
  return ok({ twist, raw: res.text, requestId: res.requestId });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/lantern/twist/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/lantern/twist
git commit -m "feat: twist route (JSON twist + parse fallback + event)"
```

---

### Task 6: NPC route (text + async portrait branch)

**Files:**
- Create: `src/app/api/lantern/npc/route.ts`
- Test: `src/app/api/lantern/npc/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/lantern/npc/route.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

// vi.hoisted() so the mock fns exist before the hoisted vi.mock() factories run (avoids TDZ).
const { sendMessage, writeEvent, npcUpdate } = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  writeEvent: vi.fn(async () => undefined),
  npcUpdate: vi.fn(() => ({ eq: async () => ({ error: null }) })),
}));
vi.mock("@/services/lanternAiService", () => ({ lanternAiService: { sendMessage } }));
vi.mock("@/lib/lanternEvents", () => ({ writeEvent }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => ({ from: () => ({ update: npcUpdate }) }) }));
vi.mock("@/lib/campaignRepo", () => ({
  assembleContext: async () => ({ campaign: { tone: "gentle" }, systemPrompt: "SYS" }),
}));

import { POST } from "./route";

beforeEach(() => { sendMessage.mockReset(); writeEvent.mockClear(); npcUpdate.mockClear(); });
function post(url: string, body: unknown) {
  return POST(new Request(url, { method: "POST", body: JSON.stringify(body) }));
}

describe("npc route", () => {
  it("returns parsed NPC text and logs a npc event", async () => {
    sendMessage.mockResolvedValue({
      text: '{"name":"Pib","trait":"shy","want":"a friend","voice_hint":"hi…","portrait_prompt":"a small green goblin"}',
      requestId: "r1", model: "m", provider: "p",
    });
    const res = await post("http://t/api/lantern/npc", { campaignId: "c1", sessionId: "s1" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.npc).toMatchObject({ name: "Pib", portrait_prompt: "a small green goblin" });
    expect(json.requestId).toBe("r1");
    expect(writeEvent).toHaveBeenCalledWith(expect.objectContaining({ kind: "npc", summary: expect.stringContaining("Pib") }));
  });

  it("?portrait=1 routes to the image use-case and returns an imageUrl", async () => {
    sendMessage.mockResolvedValue({ imageUrl: "https://blob/x.png", requestId: "r2", model: "z", provider: "fal.ai" });
    const res = await post("http://t/api/lantern/npc?portrait=1", { sessionId: "s1", portraitPrompt: "a small green goblin" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ imageUrl: "https://blob/x.png", requestId: "r2" });
    expect(sendMessage.mock.calls[0][0]).toMatchObject({ useCase: "lantern_npc_portrait", aspectRatio: "1:1" });
    expect(writeEvent).not.toHaveBeenCalled(); // portrait does not write an event row
  });

  it("?portrait=1 with npcId writes portrait_url onto the row", async () => {
    sendMessage.mockResolvedValue({ imageUrl: "https://blob/y.png", requestId: "r3", model: "z", provider: "fal.ai" });
    const res = await post("http://t/api/lantern/npc?portrait=1", { sessionId: "s1", portraitPrompt: "x", npcId: "n9" });
    expect(res.status).toBe(200);
    expect(npcUpdate).toHaveBeenCalledWith({ portrait_url: "https://blob/y.png" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/lantern/npc/route.test.ts`
Expected: FAIL ("Cannot find module './route'").

- [ ] **Step 3: Implement the npc route**

Create `src/app/api/lantern/npc/route.ts`:
```ts
export const runtime = "nodejs";

import { ok, fail, readBody } from "@/lib/apiHelpers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assembleContext } from "@/lib/campaignRepo";
import { lanternAiService } from "@/services/lanternAiService";
import { writeEvent } from "@/lib/lanternEvents";
import { USE_CASES } from "@/lib/useCases";
import { npcTask } from "@/prompts/tasks";
import { roll, names, npc_traits, npc_wants } from "@/grounding";
import { parseModelJson } from "@/lib/parseModelJson";

const PORTRAIT_STYLE = "storybook illustration, soft warm colors, friendly, no text";

interface NpcBody { campaignId?: string; sessionId?: string; portraitPrompt?: string; npcId?: string }
interface Npc { name: string; trait: string; want: string; voice_hint: string; portrait_prompt: string }

export async function POST(req: Request) {
  const isPortrait = new URL(req.url).searchParams.get("portrait");
  const body = await readBody<NpcBody>(req);
  if (!body.sessionId) return fail("sessionId is required");

  // Image branch: generate the portrait blob URL (no event row — portrait is a facet of the NPC).
  // Order-independent: if the NPC is already remembered (npcId given), write portrait_url onto
  // that row server-side; otherwise return the URL for the client to hold and reconcile later.
  if (isPortrait) {
    if (!body.portraitPrompt) return fail("portraitPrompt is required for a portrait");
    const res = await lanternAiService.sendMessage({
      useCase: USE_CASES.npcPortrait,
      systemPrompt: "",
      question: `${body.portraitPrompt}. ${PORTRAIT_STYLE}`,
      sessionId: body.sessionId,
      aspectRatio: "1:1",
    });
    if (body.npcId && res.imageUrl) {
      await supabaseAdmin().from("lantern_npcs").update({ portrait_url: res.imageUrl }).eq("id", body.npcId);
    }
    return ok({ imageUrl: res.imageUrl, requestId: res.requestId });
  }

  // Text branch.
  if (!body.campaignId) return fail("campaignId is required");
  const { systemPrompt } = await assembleContext(body.campaignId);
  const task = npcTask({ name: roll(names), trait: roll(npc_traits), want: roll(npc_wants) });
  const res = await lanternAiService.sendMessage({
    useCase: USE_CASES.npc,
    systemPrompt,
    question: task,
    sessionId: body.sessionId,
  });

  const npc = parseModelJson<Npc>(res.text ?? "");
  const summary = npc ? `${npc.name} — ${npc.trait}, wants ${npc.want}` : (res.text ?? "").trim();
  await writeEvent({
    session_id: body.sessionId,
    kind: "npc",
    summary,
    payload: npc ?? { raw: res.text },
    ai_request_id: res.requestId,
  });
  return ok({ npc, raw: res.text, requestId: res.requestId });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/lantern/npc/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/lantern/npc
git commit -m "feat: npc route (text + async portrait branch)"
```

---

### Task 7: Notebook CRUD routes (npcs + threads)

**Files:**
- Create: `src/app/api/lantern/npcs/route.ts`
- Create: `src/app/api/lantern/threads/route.ts`
- Test: `src/app/api/lantern/npcs/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/lantern/npcs/route.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const listData = [{ id: "n1", name: "Pib", starred: true }];
const selectList = vi.fn(() => ({ eq: () => ({ order: async () => ({ data: listData, error: null }) }) }));
const insertSingle = vi.fn(async () => ({ data: { id: "n2", name: "Hazel" }, error: null }));
const updateSingle = vi.fn(async () => ({ data: { id: "n1", starred: true }, error: null }));
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: selectList,
      insert: () => ({ select: () => ({ single: insertSingle }) }),
      update: () => ({ eq: () => ({ select: () => ({ single: updateSingle }) }) }),
    }),
  }),
}));

import { GET, POST, PATCH } from "./route";

beforeEach(() => { selectList.mockClear(); insertSingle.mockClear(); updateSingle.mockClear(); });

describe("npcs route", () => {
  it("GET lists npcs for a campaign", async () => {
    const res = await GET(new Request("http://t/api/lantern/npcs?campaignId=c1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(listData);
  });

  it("GET 400s without campaignId", async () => {
    expect((await GET(new Request("http://t/api/lantern/npcs"))).status).toBe(400);
  });

  it("POST persists a remembered npc", async () => {
    const res = await POST(new Request("http://t/api/lantern/npcs", {
      method: "POST",
      body: JSON.stringify({ campaignId: "c1", name: "Hazel", want: "her sheep", starred: true }),
    }));
    expect(res.status).toBe(200);
    expect(insertSingle).toHaveBeenCalledOnce();
  });

  it("PATCH toggles a star", async () => {
    const res = await PATCH(new Request("http://t/api/lantern/npcs", {
      method: "PATCH",
      body: JSON.stringify({ id: "n1", starred: true }),
    }));
    expect(res.status).toBe(200);
    expect(updateSingle).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/lantern/npcs/route.test.ts`
Expected: FAIL ("Cannot find module './route'").

- [ ] **Step 3: Implement the npcs route**

Create `src/app/api/lantern/npcs/route.ts`:
```ts
export const runtime = "nodejs";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ok, fail, readBody } from "@/lib/apiHelpers";

interface CreateBody {
  campaignId?: string; sessionId?: string | null; name?: string;
  trait?: string; want?: string; voice_hint?: string; portrait_url?: string; starred?: boolean; notes?: string;
}
interface PatchBody {
  id?: string; name?: string; trait?: string; want?: string; voice_hint?: string;
  portrait_url?: string; starred?: boolean; notes?: string;
}

export async function GET(req: Request) {
  const campaignId = new URL(req.url).searchParams.get("campaignId");
  if (!campaignId) return fail("campaignId is required");
  const { data, error } = await supabaseAdmin()
    .from("lantern_npcs")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function POST(req: Request) {
  const body = await readBody<CreateBody>(req);
  if (!body.campaignId || !body.name) return fail("campaignId and name are required");
  const { data, error } = await supabaseAdmin()
    .from("lantern_npcs")
    .insert({
      campaign_id: body.campaignId,
      session_id: body.sessionId ?? null,
      name: body.name,
      trait: body.trait ?? null,
      want: body.want ?? null,
      voice_hint: body.voice_hint ?? null,
      portrait_url: body.portrait_url ?? null,
      starred: body.starred ?? false,
      notes: body.notes ?? null,
    })
    .select("*")
    .single();
  if (error) return fail(error.message, 500);
  return ok(data);
}

export async function PATCH(req: Request) {
  const body = await readBody<PatchBody>(req);
  if (!body.id) return fail("id is required");
  const patch: Record<string, unknown> = {};
  for (const k of ["name", "trait", "want", "voice_hint", "portrait_url", "starred", "notes"] as const) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  const { data, error } = await supabaseAdmin()
    .from("lantern_npcs")
    .update(patch)
    .eq("id", body.id)
    .select("*")
    .single();
  if (error) return fail(error.message, 500);
  return ok(data);
}
```

- [ ] **Step 4: Implement the threads route**

Create `src/app/api/lantern/threads/route.ts`:
```ts
export const runtime = "nodejs";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ok, fail, readBody } from "@/lib/apiHelpers";

type ThreadKind = "place" | "problem" | "treasure" | "note";
interface CreateBody { campaignId?: string; kind?: ThreadKind; title?: string; detail?: string; starred?: boolean }
interface PatchBody { id?: string; kind?: ThreadKind; title?: string; detail?: string; starred?: boolean }

export async function GET(req: Request) {
  const url = new URL(req.url);
  const campaignId = url.searchParams.get("campaignId");
  const kind = url.searchParams.get("kind");
  if (!campaignId) return fail("campaignId is required");
  let q = supabaseAdmin().from("lantern_threads").select("*").eq("campaign_id", campaignId);
  if (kind) q = q.eq("kind", kind);
  const { data, error } = await q.order("created_at", { ascending: true });
  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function POST(req: Request) {
  const body = await readBody<CreateBody>(req);
  if (!body.campaignId || !body.kind || !body.title) return fail("campaignId, kind and title are required");
  const { data, error } = await supabaseAdmin()
    .from("lantern_threads")
    .insert({
      campaign_id: body.campaignId,
      kind: body.kind,
      title: body.title,
      detail: body.detail ?? null,
      starred: body.starred ?? false,
    })
    .select("*")
    .single();
  if (error) return fail(error.message, 500);
  return ok(data);
}

export async function PATCH(req: Request) {
  const body = await readBody<PatchBody>(req);
  if (!body.id) return fail("id is required");
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ["kind", "title", "detail", "starred"] as const) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  const { data, error } = await supabaseAdmin()
    .from("lantern_threads")
    .update(patch)
    .eq("id", body.id)
    .select("*")
    .single();
  if (error) return fail(error.message, 500);
  return ok(data);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/app/api/lantern/npcs/route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/lantern/npcs src/app/api/lantern/threads
git commit -m "feat: notebook CRUD routes (npcs + threads)"
```

---

### Task 8: Recap + summary routes

**Files:**
- Create: `src/app/api/lantern/recap/route.ts`
- Create: `src/app/api/lantern/summary/route.ts`
- Test: `src/app/api/lantern/recap/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/lantern/recap/route.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

// vi.hoisted() so the mock fns exist before the hoisted vi.mock() factories run (avoids TDZ).
const { sendMessage, writeEvent, recentEventSummaries } = vi.hoisted(() => ({
  sendMessage: vi.fn(async () => ({ text: "Previously, in the Wood…", requestId: "r1", model: "m", provider: "p" })),
  writeEvent: vi.fn(async () => undefined),
  recentEventSummaries: vi.fn(async () => ["Met a fox", "Crossed the bridge"]),
}));
vi.mock("@/services/lanternAiService", () => ({ lanternAiService: { sendMessage } }));
vi.mock("@/lib/lanternEvents", () => ({ writeEvent }));
vi.mock("@/lib/campaignRepo", () => ({
  recentEventSummaries,
  assembleContext: async () => ({ campaign: { tone: "gentle" }, systemPrompt: "SYS" }),
}));

import { POST } from "./route";

beforeEach(() => { sendMessage.mockClear(); writeEvent.mockClear(); recentEventSummaries.mockClear(); });

describe("recap route", () => {
  it("reads session events and returns a recap", async () => {
    const res = await POST(new Request("http://t/api/lantern/recap", {
      method: "POST", body: JSON.stringify({ campaignId: "c1", sessionId: "s1" }),
    }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ text: "Previously, in the Wood…", requestId: "r1" });
    expect(recentEventSummaries).toHaveBeenCalledWith("s1");
    expect(writeEvent).toHaveBeenCalledWith(expect.objectContaining({ kind: "recap" }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/lantern/recap/route.test.ts`
Expected: FAIL ("Cannot find module './route'").

- [ ] **Step 3: Implement the recap route**

Create `src/app/api/lantern/recap/route.ts`:
```ts
export const runtime = "nodejs";

import { ok, fail, readBody } from "@/lib/apiHelpers";
import { assembleContext, recentEventSummaries } from "@/lib/campaignRepo";
import { lanternAiService } from "@/services/lanternAiService";
import { writeEvent } from "@/lib/lanternEvents";
import { USE_CASES } from "@/lib/useCases";
import { recapTask } from "@/prompts/tasks";

interface RecapBody { campaignId?: string; sessionId?: string }

export async function POST(req: Request) {
  const body = await readBody<RecapBody>(req);
  if (!body.campaignId || !body.sessionId) return fail("campaignId and sessionId are required");

  const summaries = await recentEventSummaries(body.sessionId);
  if (summaries.length === 0) return fail("no events yet to recap", 409);

  const { systemPrompt } = await assembleContext(body.campaignId);
  const res = await lanternAiService.sendMessage({
    useCase: USE_CASES.recap,
    systemPrompt,
    question: recapTask(summaries),
    sessionId: body.sessionId,
  });

  await writeEvent({
    session_id: body.sessionId,
    kind: "recap",
    summary: res.text ?? "",
    ai_request_id: res.requestId,
  });
  return ok({ text: res.text, requestId: res.requestId });
}
```

- [ ] **Step 4: Implement the summary route**

Create `src/app/api/lantern/summary/route.ts`:
```ts
export const runtime = "nodejs";

import { ok, fail, readBody } from "@/lib/apiHelpers";
import { assembleContext, recentEventSummaries, getCampaign } from "@/lib/campaignRepo";
import { lanternAiService } from "@/services/lanternAiService";
import { USE_CASES } from "@/lib/useCases";
import { summaryTask } from "@/prompts/tasks";

interface SummaryBody { campaignId?: string; sessionId?: string }

export async function POST(req: Request) {
  const body = await readBody<SummaryBody>(req);
  if (!body.campaignId || !body.sessionId) return fail("campaignId and sessionId are required");

  const campaign = await getCampaign(body.campaignId);
  if (!campaign) return fail("campaign not found", 404);

  const summaries = await recentEventSummaries(body.sessionId);
  const { systemPrompt } = await assembleContext(body.campaignId);
  const res = await lanternAiService.sendMessage({
    useCase: USE_CASES.summary,
    systemPrompt,
    question: summaryTask(campaign.summary, summaries),
    sessionId: body.sessionId,
  });

  // The Warden reviews/edits before saving — return the proposed text, do not persist here.
  return ok({ proposedSummary: res.text, requestId: res.requestId });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/app/api/lantern/recap/route.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/lantern/recap src/app/api/lantern/summary
git commit -m "feat: recap + summary (memory-assist) routes"
```

---

### Task 9: Client fetch layer + campaign/session hook

**Files:**
- Create: `src/lib/client/api.ts`
- Create: `src/lib/client/useCampaignSession.ts`
- Test: `src/lib/client/useCampaignSession.test.ts`

- [ ] **Step 1: Implement the fetch wrappers (no test — thin)**

Create `src/lib/client/api.ts`:
```ts
async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  return handle<T>(await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

export async function patchJson<T>(url: string, body: unknown): Promise<T> {
  return handle<T>(await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

export async function getJson<T>(url: string): Promise<T> {
  return handle<T>(await fetch(url));
}
```

- [ ] **Step 2: Switch the Vitest env to jsdom for client tests**

In `vitest.config.ts`, change `test.environment` from `"node"` to `"jsdom"` (jsdom is already a dev dependency). Node-environment route/lib tests continue to pass under jsdom; the hook test needs `window.localStorage`.

Verify nothing regressed: `npm test` (expected: all existing suites still PASS).

- [ ] **Step 3: Write the failing hook test**

Create `src/lib/client/useCampaignSession.test.ts`:
```ts
import { describe, expect, it, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCampaignSession } from "./useCampaignSession";

beforeEach(() => window.localStorage.clear());

describe("useCampaignSession", () => {
  it("starts empty and persists ids to localStorage", () => {
    const { result } = renderHook(() => useCampaignSession());
    expect(result.current.campaignId).toBeNull();

    act(() => result.current.setCampaignId("c1"));
    act(() => result.current.setSessionId("s1"));

    expect(result.current.campaignId).toBe("c1");
    expect(window.localStorage.getItem("lantern.campaignId")).toBe("c1");
    expect(window.localStorage.getItem("lantern.sessionId")).toBe("s1");
  });

  it("clear() forgets the session but keeps the campaign", () => {
    const { result } = renderHook(() => useCampaignSession());
    act(() => result.current.setCampaignId("c1"));
    act(() => result.current.setSessionId("s1"));
    act(() => result.current.clearSession());
    expect(result.current.sessionId).toBeNull();
    expect(result.current.campaignId).toBe("c1");
  });
});
```

- [ ] **Step 4: Add `@testing-library/react` dev dependency**

Run: `npm install -D @testing-library/react @testing-library/dom`
Expected: both appear under `devDependencies`.

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run src/lib/client/useCampaignSession.test.ts`
Expected: FAIL ("Cannot find module './useCampaignSession'").

- [ ] **Step 6: Implement the hook**

Create `src/lib/client/useCampaignSession.ts`:
```ts
"use client";
import { useCallback, useEffect, useState } from "react";

const CAMPAIGN_KEY = "lantern.campaignId";
const SESSION_KEY = "lantern.sessionId";

export function useCampaignSession() {
  const [campaignId, setCampaignIdState] = useState<string | null>(null);
  const [sessionId, setSessionIdState] = useState<string | null>(null);

  // Hydrate from localStorage on mount (client-only).
  useEffect(() => {
    setCampaignIdState(window.localStorage.getItem(CAMPAIGN_KEY));
    setSessionIdState(window.localStorage.getItem(SESSION_KEY));
  }, []);

  const setCampaignId = useCallback((id: string | null) => {
    setCampaignIdState(id);
    if (id) window.localStorage.setItem(CAMPAIGN_KEY, id);
    else window.localStorage.removeItem(CAMPAIGN_KEY);
  }, []);

  const setSessionId = useCallback((id: string | null) => {
    setSessionIdState(id);
    if (id) window.localStorage.setItem(SESSION_KEY, id);
    else window.localStorage.removeItem(SESSION_KEY);
  }, []);

  const clearSession = useCallback(() => setSessionId(null), [setSessionId]);

  return { campaignId, sessionId, setCampaignId, setSessionId, clearSession };
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run src/lib/client/useCampaignSession.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add src/lib/client vitest.config.ts package.json package-lock.json
git commit -m "feat: client fetch layer + campaign/session localStorage hook"
```

---

### Task 10: Scuffle math (pure, tested)

**Files:**
- Create: `src/lib/scuffle.ts`
- Test: `src/lib/scuffle.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/scuffle.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { applyDamage, isOut, nextTurn, type Combatant } from "./scuffle";

const c = (hp: number, armor = 0): Combatant => ({ id: "x", name: "Badger", hp, armor });

describe("scuffle math", () => {
  it("damage = die roll minus armor", () => {
    expect(applyDamage(c(4, 1), 3).hp).toBe(2); // 3 - 1 = 2 dealt
  });
  it("never reduces hp below 0", () => {
    expect(applyDamage(c(1, 0), 6).hp).toBe(0);
  });
  it("a roll at or under armor deals no damage", () => {
    expect(applyDamage(c(4, 3), 2).hp).toBe(4);
  });
  it("isOut is true only at 0 hp", () => {
    expect(isOut(c(0))).toBe(true);
    expect(isOut(c(1))).toBe(false);
  });
  it("nextTurn wraps and handles an empty roster", () => {
    expect(nextTurn(0, 3)).toBe(1);
    expect(nextTurn(2, 3)).toBe(0);
    expect(nextTurn(0, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/scuffle.test.ts`
Expected: FAIL ("Cannot find module './scuffle'").

- [ ] **Step 3: Implement `scuffle.ts`**

Create `src/lib/scuffle.ts`:
```ts
export interface Combatant {
  id: string;
  name: string;
  hp: number;
  armor: number;
}

/** Apply one hit: damage = max(0, dieRoll - armor); hp floored at 0 (0 = out, never death). */
export function applyDamage(c: Combatant, dieRoll: number): Combatant {
  const dealt = Math.max(0, dieRoll - c.armor);
  return { ...c, hp: Math.max(0, c.hp - dealt) };
}

export function isOut(c: Combatant): boolean {
  return c.hp <= 0;
}

/** Advance turn order, wrapping; returns 0 for an empty roster. */
export function nextTurn(order: number, count: number): number {
  return count === 0 ? 0 : (order + 1) % count;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/scuffle.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scuffle.ts src/lib/scuffle.test.ts
git commit -m "feat: pure scuffle-counter math (die - armor, 0 = out)"
```

---

### Task 11: SessionBar + campaign/session gate

**Files:**
- Create: `src/components/lantern/SessionBar.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Implement `SessionBar.tsx`**

Create `src/components/lantern/SessionBar.tsx`:
```tsx
"use client";
import { useState } from "react";
import { postJson, patchJson } from "@/lib/client/api";

type Tone = "gentle" | "adventurous";
interface Campaign { id: string; title: string | null; tone: Tone; summary: string; status: string }
interface Session { id: string; title: string | null; status: string }

export function SessionBar(props: {
  campaign: Campaign | null;
  sessionId: string | null;
  onCampaign: (c: Campaign) => void;
  onSession: (id: string | null) => void;
  onEditMemory: () => void;
}) {
  const { campaign, sessionId, onCampaign, onSession, onEditMemory } = props;
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function createCampaign() {
    setBusy(true);
    try {
      const c = await postJson<Campaign>("/api/lantern/campaign", { title: title || "The Wood", tone: "gentle" });
      onCampaign(c);
    } finally { setBusy(false); }
  }
  async function setTone(tone: Tone) {
    if (!campaign) return;
    const c = await patchJson<Campaign>("/api/lantern/campaign", { id: campaign.id, tone });
    onCampaign(c);
  }
  async function startSession() {
    if (!campaign) return;
    setBusy(true);
    try {
      const s = await postJson<Session>("/api/lantern/session", { campaignId: campaign.id });
      onSession(s.id);
    } finally { setBusy(false); }
  }
  async function endSession() {
    if (!sessionId) return;
    await patchJson<Session>("/api/lantern/session", { id: sessionId, status: "ended" });
    onSession(null);
  }

  if (!campaign) {
    return (
      <header className="flex items-center gap-3 border-b border-amber-900/20 bg-amber-50/60 px-4 py-3">
        <span className="text-lg">🏮 Lantern</span>
        <input
          className="rounded border border-amber-900/30 px-2 py-1 text-sm"
          placeholder="Campaign name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button disabled={busy} onClick={createCampaign} className="rounded bg-amber-700 px-3 py-1 text-sm text-white disabled:opacity-50">
          Start campaign
        </button>
      </header>
    );
  }

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-amber-900/20 bg-amber-50/60 px-4 py-3 text-sm">
      <span className="text-lg">🏮 Lantern</span>
      <span className="font-medium">Campaign: {campaign.title ?? "Untitled"}</span>
      <label className="flex items-center gap-1">
        tone:
        <select value={campaign.tone} onChange={(e) => setTone(e.target.value as Tone)} className="rounded border border-amber-900/30 px-1">
          <option value="gentle">gentle</option>
          <option value="adventurous">adventurous</option>
        </select>
      </label>
      {sessionId ? (
        <>
          <span className="rounded bg-amber-200 px-2 py-0.5">Session active</span>
          <button onClick={endSession} className="rounded border border-amber-900/30 px-2 py-0.5">End Session</button>
        </>
      ) : (
        <button disabled={busy} onClick={startSession} className="rounded bg-amber-700 px-3 py-1 text-white disabled:opacity-50">
          Start session
        </button>
      )}
      <button onClick={onEditMemory} className="ml-auto rounded border border-amber-900/30 px-2 py-0.5">Edit Memory</button>
    </header>
  );
}
```

- [ ] **Step 2: Wire a minimal gate into `page.tsx`**

Replace `src/app/page.tsx` with:
```tsx
"use client";
import { useEffect, useState } from "react";
import { SessionBar } from "@/components/lantern/SessionBar";
import { useCampaignSession } from "@/lib/client/useCampaignSession";
import { getJson } from "@/lib/client/api";

type Tone = "gentle" | "adventurous";
interface Campaign { id: string; title: string | null; tone: Tone; summary: string; status: string }

export default function Home() {
  const { campaignId, sessionId, setCampaignId, setSessionId } = useCampaignSession();
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  // Resume a cached campaign on load.
  useEffect(() => {
    if (campaignId && !campaign) {
      getJson<Campaign[]>(`/api/lantern/npcs?campaignId=${campaignId}`).catch(() => {}); // warm; real fetch below
    }
  }, [campaignId, campaign]);

  return (
    <main className="min-h-screen bg-amber-50/30">
      <SessionBar
        campaign={campaign}
        sessionId={sessionId}
        onCampaign={(c) => { setCampaign(c); setCampaignId(c.id); }}
        onSession={(id) => setSessionId(id)}
        onEditMemory={() => { /* MemoryEditor wired in Task 15 */ }}
      />
      {!campaign || !sessionId ? (
        <p className="p-6 text-sm text-amber-900/70">
          {!campaign ? "Start a campaign to begin." : "Start a session to open the panels."}
        </p>
      ) : (
        <p className="p-6 text-sm text-amber-900/70">Panels load here (Tasks 12–15).</p>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: typecheck clean; build succeeds (the page is a client component; routes compile).

- [ ] **Step 4: Commit**

```bash
git add src/components/lantern/SessionBar.tsx src/app/page.tsx
git commit -m "feat: session bar + campaign/session gate"
```

---

### Task 12: ScenePanel

**Files:**
- Create: `src/components/lantern/ScenePanel.tsx`

- [ ] **Step 1: Implement `ScenePanel.tsx`**

Create `src/components/lantern/ScenePanel.tsx`:
```tsx
"use client";
import { useState } from "react";
import { postJson } from "@/lib/client/api";

interface SceneRes { text?: string; requestId: string }
interface TwistRes { twist: { type: string; text: string } | null; raw?: string; requestId: string }

export function ScenePanel({ campaignId, sessionId }: { campaignId: string; sessionId: string }) {
  const [note, setNote] = useState("");
  const [scene, setScene] = useState<string | null>(null);
  const [twist, setTwist] = useState<string | null>(null);
  const [twistType, setTwistType] = useState<string | null>(null);
  const [loading, setLoading] = useState<null | "scene" | "twist">(null);
  const [error, setError] = useState<string | null>(null);

  async function newScene() {
    setLoading("scene"); setError(null); setTwist(null); setTwistType(null);
    try {
      const r = await postJson<SceneRes>("/api/lantern/scene", { campaignId, sessionId, wardenNote: note });
      setScene(r.text ?? "");
    } catch (e) { setError((e as Error).message); } finally { setLoading(null); }
  }
  async function getTwist() {
    setLoading("twist"); setError(null);
    try {
      const r = await postJson<TwistRes>("/api/lantern/twist", { campaignId, sessionId, wardenNote: note });
      setTwist(r.twist?.text ?? r.raw ?? "");
      setTwistType(r.twist?.type ?? null);
    } catch (e) { setError((e as Error).message); } finally { setLoading(null); }
  }

  return (
    <section className="rounded-lg border border-amber-900/15 bg-white p-4">
      <h2 className="mb-2 font-semibold">① Scene + Twist</h2>
      <div className="min-h-16 rounded bg-amber-50 p-3 text-sm">{scene ?? "Generate a scene to begin."}</div>
      <label className="mt-2 block text-xs text-amber-900/70">Warden note</label>
      <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded border border-amber-900/30 px-2 py-1 text-sm" />
      <div className="mt-2 flex gap-2">
        <button disabled={loading !== null} onClick={newScene} className="rounded bg-amber-700 px-3 py-1 text-sm text-white disabled:opacity-50">
          {loading === "scene" ? "…" : "New Scene"}
        </button>
        <button disabled={loading !== null || !scene} onClick={getTwist} className="rounded border border-amber-700 px-3 py-1 text-sm disabled:opacity-50">
          {loading === "twist" ? "…" : "Twist ✦"}
        </button>
      </div>
      {twist && (
        <p className="mt-2 text-sm">
          <span className="font-medium">✦ {twistType ?? "twist"}:</span> {twist}
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error} <button onClick={newScene} className="underline">retry</button></p>}
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/lantern/ScenePanel.tsx
git commit -m "feat: scene + twist panel"
```

---

### Task 13: NpcPanel (async portrait)

**Files:**
- Create: `src/components/lantern/NpcPanel.tsx`

- [ ] **Step 1: Implement `NpcPanel.tsx`**

Create `src/components/lantern/NpcPanel.tsx`:
```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { postJson, patchJson } from "@/lib/client/api";

interface Npc { name: string; trait: string; want: string; voice_hint: string; portrait_prompt: string }
interface NpcRes { npc: Npc | null; raw?: string; requestId: string }
interface PortraitRes { imageUrl?: string; requestId: string }

export function NpcPanel({ campaignId, sessionId }: { campaignId: string; sessionId: string }) {
  const [npc, setNpc] = useState<Npc | null>(null);
  const [portrait, setPortrait] = useState<string | null>(null);
  const [portraitLoading, setPortraitLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberedId, setRememberedId] = useState<string | null>(null);
  const patched = useRef(false); // portrait already saved onto the row?

  async function newNpc() {
    setLoading(true); setError(null); setNpc(null); setPortrait(null); setRememberedId(null); patched.current = false;
    try {
      const r = await postJson<NpcRes>("/api/lantern/npc", { campaignId, sessionId });
      if (!r.npc) { setError("Could not parse NPC; raw: " + (r.raw ?? "")); return; }
      setNpc(r.npc);
      void firePortrait(r.npc.portrait_prompt); // async; does not block the card
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }

  // Fire the portrait. After Remember (rememberedId set), pass npcId so the server attaches it too.
  async function firePortrait(prompt: string) {
    setPortraitLoading(true);
    try {
      const r = await postJson<PortraitRes>("/api/lantern/npc?portrait=1", {
        sessionId, portraitPrompt: prompt, npcId: rememberedId ?? undefined,
      });
      if (r.imageUrl) setPortrait(r.imageUrl);
    } catch { /* portrait failure is non-fatal: keep the text */ } finally { setPortraitLoading(false); }
  }

  async function remember() {
    if (!npc) return;
    const row = await postJson<{ id: string }>("/api/lantern/npcs", {
      campaignId, sessionId, name: npc.name, trait: npc.trait, want: npc.want,
      voice_hint: npc.voice_hint, portrait_url: portrait, starred: true,
    });
    if (portrait) patched.current = true; // portrait was saved by the insert
    setRememberedId(row.id);
  }

  // Reconcile: if the portrait lands *after* Remember, attach it to the saved row exactly once.
  useEffect(() => {
    if (rememberedId && portrait && !patched.current) {
      patched.current = true;
      void patchJson("/api/lantern/npcs", { id: rememberedId, portrait_url: portrait });
    }
  }, [rememberedId, portrait]);

  return (
    <section className="rounded-lg border border-amber-900/15 bg-white p-4">
      <h2 className="mb-2 font-semibold">② NPC Generator</h2>
      {npc ? (
        <div className="flex gap-3">
          <div className="flex h-20 w-20 flex-none items-center justify-center rounded bg-amber-100 text-xs text-amber-900/60">
            {portrait ? <img src={portrait} alt={npc.name} className="h-20 w-20 rounded object-cover" />
              : portraitLoading ? "…"
              : <button onClick={() => firePortrait(npc.portrait_prompt)} className="underline">retry</button>}
          </div>
          <div className="text-sm">
            <p className="font-medium">{npc.name}</p>
            <p className="text-amber-900/70">{npc.trait} · wants {npc.want}</p>
            <p className="italic">“{npc.voice_hint}”</p>
            <button disabled={rememberedId !== null} onClick={remember} className="mt-1 rounded border border-amber-700 px-2 py-0.5 text-xs disabled:opacity-50">
              {rememberedId ? "⭐ Remembered" : "⭐ Remember"}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-amber-900/60">Generate an NPC.</p>
      )}
      <button disabled={loading} onClick={newNpc} className="mt-3 rounded bg-amber-700 px-3 py-1 text-sm text-white disabled:opacity-50">
        {loading ? "…" : "New NPC"}
      </button>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (`<img>` over `next/image` is intentional — the portrait is a remote Blob URL filled in async; add the Blob host to `next.config.ts` images only if switching to `next/image`.)

- [ ] **Step 3: Commit**

```bash
git add src/components/lantern/NpcPanel.tsx
git commit -m "feat: npc panel with async portrait + remember"
```

---

### Task D: Scuffle persistence route

**Files:**
- Create: `src/app/api/lantern/scuffle/route.ts`
- Test: `src/app/api/lantern/scuffle/route.test.ts`

> Requires the `lantern_scuffles` table (Task C) live to work against the DB; the route code +
> test can be written/committed earlier (the test mocks the DB client).

- [ ] **Step 1: Write the failing test**

Create `src/app/api/lantern/scuffle/route.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const maybeSingle = vi.fn(async () => ({ data: { combatants: [{ id: "m0", name: "Badger", hp: 4, armor: 1 }], turn: 0 }, error: null }));
const upsert = vi.fn(async () => ({ error: null }));
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
      upsert,
    }),
  }),
}));

import { GET, POST } from "./route";

beforeEach(() => { maybeSingle.mockClear(); upsert.mockClear(); });

describe("scuffle route", () => {
  it("GET returns the session's scuffle state", async () => {
    const res = await GET(new Request("http://t/api/lantern/scuffle?sessionId=s1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ turn: 0 });
  });

  it("GET 400s without sessionId", async () => {
    expect((await GET(new Request("http://t/api/lantern/scuffle"))).status).toBe(400);
  });

  it("POST upserts the state", async () => {
    const res = await POST(new Request("http://t/api/lantern/scuffle", {
      method: "POST",
      body: JSON.stringify({ sessionId: "s1", combatants: [], turn: 2 }),
    }));
    expect(res.status).toBe(200);
    expect(upsert).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/lantern/scuffle/route.test.ts`
Expected: FAIL ("Cannot find module './route'").

- [ ] **Step 3: Implement the scuffle route**

Create `src/app/api/lantern/scuffle/route.ts`:
```ts
export const runtime = "nodejs";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ok, fail, readBody } from "@/lib/apiHelpers";

interface Combatant { id: string; name: string; hp: number; armor: number }
interface UpsertBody { sessionId?: string; combatants?: Combatant[]; turn?: number }

export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) return fail("sessionId is required");
  const { data, error } = await supabaseAdmin()
    .from("lantern_scuffles")
    .select("combatants, turn")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) return fail(error.message, 500);
  return ok(data ?? { combatants: [], turn: 0 });
}

export async function POST(req: Request) {
  const body = await readBody<UpsertBody>(req);
  if (!body.sessionId) return fail("sessionId is required");
  const { error } = await supabaseAdmin()
    .from("lantern_scuffles")
    .upsert(
      { session_id: body.sessionId, combatants: body.combatants ?? [], turn: body.turn ?? 0, updated_at: new Date().toISOString() },
      { onConflict: "session_id" },
    );
  if (error) return fail(error.message, 500);
  return ok({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/lantern/scuffle/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/lantern/scuffle
git commit -m "feat: scuffle persistence route (lantern_scuffles upsert)"
```

---

### Task 14: NotebookPanel + ScuffleCounter

**Files:**
- Create: `src/components/lantern/ScuffleCounter.tsx`
- Create: `src/components/lantern/NotebookPanel.tsx`

- [ ] **Step 1: Implement `ScuffleCounter.tsx` (local state only)**

Create `src/components/lantern/ScuffleCounter.tsx`:
```tsx
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { isOut, nextTurn, type Combatant } from "@/lib/scuffle";
import { soft_monsters, roll } from "@/grounding";
import { getJson, postJson } from "@/lib/client/api";

function spawn(): Combatant {
  const m = roll(soft_monsters);
  // crypto.randomUUID() (not a module counter) so ids don't collide with combatants
  // hydrated from localStorage/DB after a reload.
  return { id: crypto.randomUUID(), name: m.name, hp: m.hp, armor: m.armor };
}

interface ScuffleState { combatants: Combatant[]; turn: number }
const cacheKey = (sid: string) => `lantern.scuffle.${sid}`;

export function ScuffleCounter({ sessionId }: { sessionId: string }) {
  const [foes, setFoes] = useState<Combatant[]>([]);
  const [turn, setTurn] = useState(0);
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate: localStorage first (instant), then the DB row as source of truth.
  useEffect(() => {
    const cached = window.localStorage.getItem(cacheKey(sessionId));
    if (cached) {
      try { const s = JSON.parse(cached) as ScuffleState; setFoes(s.combatants); setTurn(s.turn); } catch { /* ignore */ }
    }
    getJson<ScuffleState>(`/api/lantern/scuffle?sessionId=${sessionId}`)
      .then((s) => { setFoes(s.combatants ?? []); setTurn(s.turn ?? 0); })
      .catch(() => { /* offline: keep cached state */ })
      .finally(() => { hydrated.current = true; });
  }, [sessionId]);

  // Write-through: localStorage immediately + debounced DB upsert (only after hydration).
  const persist = useCallback((combatants: Combatant[], t: number) => {
    window.localStorage.setItem(cacheKey(sessionId), JSON.stringify({ combatants, turn: t }));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void postJson("/api/lantern/scuffle", { sessionId, combatants, turn: t }).catch(() => {});
    }, 600);
  }, [sessionId]);

  useEffect(() => { if (hydrated.current) persist(foes, turn); }, [foes, turn, persist]);

  function add() { setFoes((f) => [...f, spawn()]); }
  function bump(id: string, amount: number) {
    setFoes((f) => f.map((c) => (c.id === id ? { ...c, hp: Math.max(0, c.hp + amount) } : c)));
  }

  return (
    <div className="mt-3 rounded border border-amber-900/15 p-2 text-xs">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-medium">Scuffle</span>
        <span>
          <button onClick={add} className="rounded border px-1">+ foe</button>
          <button onClick={() => setTurn((t) => nextTurn(t, foes.length))} className="ml-1 rounded border px-1">▸ turn</button>
        </span>
      </div>
      {foes.length === 0 && <p className="text-amber-900/50">No foes. Add one to start a scuffle.</p>}
      {foes.map((c, i) => (
        <div key={c.id} className={`flex items-center gap-2 ${i === turn ? "font-semibold" : ""}`}>
          <span className="w-32 truncate">{i === turn ? "▸ " : ""}{c.name}</span>
          <button onClick={() => bump(c.id, -1)} className="rounded border px-1">−</button>
          <span className="w-8 text-center">{c.hp}</span>
          <button onClick={() => bump(c.id, +1)} className="rounded border px-1">+</button>
          <span className="text-amber-900/50">armor {c.armor}</span>
          {isOut(c) && <span className="text-amber-700">out</span>}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Implement `NotebookPanel.tsx`**

Create `src/components/lantern/NotebookPanel.tsx`:
```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { getJson, postJson, patchJson } from "@/lib/client/api";
import { ScuffleCounter } from "./ScuffleCounter";

type Tab = "People" | "Places" | "Problems" | "Treasures" | "Notes";
const THREAD_KIND: Record<Exclude<Tab, "People">, "place" | "problem" | "treasure" | "note"> = {
  Places: "place", Problems: "problem", Treasures: "treasure", Notes: "note",
};
interface Npc { id: string; name: string; want: string | null; starred: boolean }
interface Thread { id: string; kind: string; title: string; detail: string | null; starred: boolean }

export function NotebookPanel({ campaignId, sessionId }: { campaignId: string; sessionId: string }) {
  const [tab, setTab] = useState<Tab>("People");
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [title, setTitle] = useState("");

  const refresh = useCallback(async () => {
    setNpcs(await getJson<Npc[]>(`/api/lantern/npcs?campaignId=${campaignId}`));
    setThreads(await getJson<Thread[]>(`/api/lantern/threads?campaignId=${campaignId}`));
  }, [campaignId]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function addEntry() {
    if (!title.trim()) return;
    if (tab === "People") {
      await postJson("/api/lantern/npcs", { campaignId, name: title, starred: true });
    } else {
      await postJson("/api/lantern/threads", { campaignId, kind: THREAD_KIND[tab], title, starred: true });
    }
    setTitle(""); await refresh();
  }
  async function toggleNpc(n: Npc) { await patchJson("/api/lantern/npcs", { id: n.id, starred: !n.starred }); await refresh(); }
  async function toggleThread(t: Thread) { await patchJson("/api/lantern/threads", { id: t.id, starred: !t.starred }); await refresh(); }

  const tabThreads = tab === "People" ? [] : threads.filter((t) => t.kind === THREAD_KIND[tab]);

  return (
    <section className="rounded-lg border border-amber-900/15 bg-white p-4">
      <h2 className="mb-2 font-semibold">③ Notes &amp; Threads</h2>
      <div className="mb-2 flex flex-wrap gap-1 text-xs">
        {(["People", "Places", "Problems", "Treasures", "Notes"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded px-2 py-0.5 ${tab === t ? "bg-amber-700 text-white" : "border border-amber-900/30"}`}>
            {t}
          </button>
        ))}
      </div>
      <ul className="space-y-1 text-sm">
        {tab === "People"
          ? npcs.map((n) => (
              <li key={n.id} className="flex items-center gap-2">
                <button onClick={() => toggleNpc(n)}>{n.starred ? "⭐" : "☆"}</button>
                <span>{n.name}{n.want ? ` — ${n.want}` : ""}</span>
              </li>
            ))
          : tabThreads.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <button onClick={() => toggleThread(t)}>{t.starred ? "⭐" : "☆"}</button>
                <span>{t.title}{t.detail ? ` — ${t.detail}` : ""}</span>
              </li>
            ))}
      </ul>
      <div className="mt-2 flex gap-1">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Add ${tab}`} className="flex-1 rounded border border-amber-900/30 px-2 py-1 text-sm" />
        <button onClick={addEntry} className="rounded border border-amber-700 px-2 text-sm">+ add</button>
      </div>
      <ScuffleCounter sessionId={sessionId} />
    </section>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/lantern/ScuffleCounter.tsx src/components/lantern/NotebookPanel.tsx
git commit -m "feat: notebook panel (people/places/...) + persisted scuffle counter"
```

---

### Task 15: RecapPanel + MemoryEditor

**Files:**
- Create: `src/components/lantern/RecapPanel.tsx`
- Create: `src/components/lantern/MemoryEditor.tsx`

- [ ] **Step 1: Implement `RecapPanel.tsx`**

Create `src/components/lantern/RecapPanel.tsx`:
```tsx
"use client";
import { useState } from "react";
import { postJson } from "@/lib/client/api";

interface RecapRes { text?: string; requestId: string }

export function RecapPanel({ campaignId, sessionId }: { campaignId: string; sessionId: string }) {
  const [recap, setRecap] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true); setError(null);
    try {
      const r = await postJson<RecapRes>("/api/lantern/recap", { campaignId, sessionId });
      setRecap(r.text ?? "");
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }

  return (
    <section className="rounded-lg border border-amber-900/15 bg-white p-4">
      <h2 className="mb-2 font-semibold">④ Session Recap</h2>
      <div className="min-h-16 rounded bg-amber-50 p-3 text-sm">{recap ?? "“Previously, in the Wood…”"}</div>
      <button disabled={loading} onClick={generate} className="mt-2 rounded bg-amber-700 px-3 py-1 text-sm text-white disabled:opacity-50">
        {loading ? "…" : "Generate Recap"}
      </button>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
```

- [ ] **Step 2: Implement `MemoryEditor.tsx`**

Create `src/components/lantern/MemoryEditor.tsx`:
```tsx
"use client";
import { useState } from "react";
import { patchJson, postJson } from "@/lib/client/api";

interface SummaryRes { proposedSummary?: string; requestId: string }

export function MemoryEditor(props: {
  campaignId: string;
  sessionId: string;
  initialSummary: string;
  onClose: () => void;
  onSaved: (summary: string) => void;
}) {
  const { campaignId, sessionId, initialSummary, onClose, onSaved } = props;
  const [summary, setSummary] = useState(initialSummary);
  const [busy, setBusy] = useState(false);

  async function summarize() {
    setBusy(true);
    try {
      const r = await postJson<SummaryRes>("/api/lantern/summary", { campaignId, sessionId });
      if (r.proposedSummary) setSummary(r.proposedSummary);
    } finally { setBusy(false); }
  }
  async function save() {
    setBusy(true);
    try {
      await patchJson("/api/lantern/campaign", { id: campaignId, summary });
      onSaved(summary);
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-4">
        <h2 className="mb-2 font-semibold">Campaign Memory</h2>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={8} className="w-full rounded border border-amber-900/30 p-2 text-sm" />
        <div className="mt-2 flex justify-end gap-2 text-sm">
          <button disabled={busy} onClick={summarize} className="rounded border border-amber-700 px-3 py-1 disabled:opacity-50">
            {busy ? "…" : "Summarize recent events"}
          </button>
          <button onClick={onClose} className="rounded border border-amber-900/30 px-3 py-1">Cancel</button>
          <button disabled={busy} onClick={save} className="rounded bg-amber-700 px-3 py-1 text-white disabled:opacity-50">Save</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/lantern/RecapPanel.tsx src/components/lantern/MemoryEditor.tsx
git commit -m "feat: recap panel + campaign memory editor (with AI summarize)"
```

---

### Task 16: Assemble the 2×2 grid in page.tsx

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace `page.tsx` with the full assembled screen**

Replace `src/app/page.tsx` with:
```tsx
"use client";
import { useEffect, useState } from "react";
import { SessionBar } from "@/components/lantern/SessionBar";
import { ScenePanel } from "@/components/lantern/ScenePanel";
import { NpcPanel } from "@/components/lantern/NpcPanel";
import { NotebookPanel } from "@/components/lantern/NotebookPanel";
import { RecapPanel } from "@/components/lantern/RecapPanel";
import { MemoryEditor } from "@/components/lantern/MemoryEditor";
import { useCampaignSession } from "@/lib/client/useCampaignSession";
import { getJson } from "@/lib/client/api";

type Tone = "gentle" | "adventurous";
interface Campaign { id: string; title: string | null; tone: Tone; summary: string; status: string }

export default function Home() {
  const { campaignId, sessionId, setCampaignId, setSessionId } = useCampaignSession();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [editing, setEditing] = useState(false);

  // Resume a cached campaign by reading it back through the campaign list endpoint.
  useEffect(() => {
    if (campaignId && !campaign) {
      getJson<Campaign>(`/api/lantern/campaign?id=${campaignId}`)
        .then(setCampaign)
        .catch(() => setCampaignId(null)); // stale id → reset gate
    }
  }, [campaignId, campaign, setCampaignId]);

  const ready = campaign && sessionId;

  return (
    <main className="min-h-screen bg-amber-50/30">
      <SessionBar
        campaign={campaign}
        sessionId={sessionId}
        onCampaign={(c) => { setCampaign(c); setCampaignId(c.id); }}
        onSession={(id) => setSessionId(id)}
        onEditMemory={() => setEditing(true)}
      />
      {!ready ? (
        <p className="p-6 text-sm text-amber-900/70">
          {!campaign ? "Start a campaign to begin." : "Start a session to open the panels."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
          <ScenePanel campaignId={campaign.id} sessionId={sessionId} />
          <NpcPanel campaignId={campaign.id} sessionId={sessionId} />
          <NotebookPanel campaignId={campaign.id} sessionId={sessionId} />
          <RecapPanel campaignId={campaign.id} sessionId={sessionId} />
        </div>
      )}
      {editing && campaign && sessionId && (
        <MemoryEditor
          campaignId={campaign.id}
          sessionId={sessionId}
          initialSummary={campaign.summary}
          onClose={() => setEditing(false)}
          onSaved={(summary) => setCampaign({ ...campaign, summary })}
        />
      )}
    </main>
  );
}
```

- [ ] **Step 2: Add a `GET` handler to the campaign route (needed by resume)**

In `src/app/api/lantern/campaign/route.ts`, add:
```ts
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return fail("id is required");
  const { data, error } = await supabaseAdmin().from("lantern_campaigns").select("*").eq("id", id).maybeSingle();
  if (error) return fail(error.message, 500);
  if (!data) return fail("campaign not found", 404);
  return ok(data);
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: typecheck clean; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/api/lantern/campaign/route.ts
git commit -m "feat: assemble 2x2 panel grid + campaign resume"
```

---

### Task 17: Attribution + status docs + full verification

**Files:**
- Create: `CREDITS.md`
- Modify: `README.md` (status line), `AGENTS.md` (status section)
- Modify: `src/app/layout.tsx` (About footer credit)

- [ ] **Step 1: Write `CREDITS.md`**

Create `CREDITS.md`:
```markdown
# Credits

Lantern's softened engine and several grounding tables adapt **Cairn 2e** by Yochai Gal,
used under **CC-BY-SA 4.0**. Adapted tables (`src/grounding/*`) carry the same license and
a per-file header. The application code is licensed under this repository's own license.

- Cairn 2e — https://cairnrpg.com — © Yochai Gal, CC-BY-SA 4.0.
```

- [ ] **Step 2: Add an About footer credit**

In `src/app/layout.tsx`, add a small footer inside `<body>` after `{children}`:
```tsx
<footer className="px-4 py-2 text-center text-xs text-amber-900/50">
  Engine &amp; tables adapt <a className="underline" href="https://cairnrpg.com">Cairn 2e</a> (Yochai Gal), CC-BY-SA 4.0.
</footer>
```

- [ ] **Step 3: Update the status lines**

In `README.md`, change the `> **Status:**` block to: `foundation + panels built; first play-test pending.`
In `AGENTS.md`, change "panels pending" in the "What this repo is right now" section to "panels implemented; first play-test pending."

- [ ] **Step 4: Full suite + typecheck + build**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: all tests PASS (foundation suites + new parseModelJson, campaignRepo, route, scuffle, hook suites), typecheck clean, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add CREDITS.md README.md AGENTS.md src/app/layout.tsx
git commit -m "docs: Cairn 2e attribution + panels-built status"
```

---

### Task 18: Live lifecycle smoke test (manual, against shared DB)

**Files:** none (operational verification using the running app + real Supabase).

> This replaces a brittle DB-integration automated test with a guided manual run, per the
> spec's "one real session before relying on it at the table" checklist. The shared Supabase
> project is live; use the dev server with the populated `.env.local`.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` and open `http://localhost:3000`.

- [ ] **Step 2: Walk the campaign lifecycle**

In the UI, in order: log in with `LANTERN_PASSWORD` → Start campaign → Start session →
New Scene (reads naturally) → Twist (concrete development) → New NPC (text instant, portrait
fills in after ~20–40s; try ⭐ Remember *before* the portrait lands and confirm it still
attaches) → add a starred Place in the notebook → add foes to the scuffle, damage one, then
refresh the page and confirm the scuffle state survives → New Scene again and confirm the
output references a remembered thread → Generate Recap (reflects the events) →
Edit Memory → Summarize recent events → edit → Save.

- [ ] **Step 3: Verify rows + logging landed (service-role REST, no secrets echoed)**

Using the `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`:
```bash
# events for the session
curl -s "$URL/rest/v1/lantern_events?session_id=eq.<SID>&select=kind,summary" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
# AI calls grouped by session with top-level columns populated
curl -s "$URL/rest/v1/ai_provider_requests?session_id=eq.<SID>&select=use_case,response_status,total_cost,input_tokens,output_tokens,total_tokens" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```
Expected: `lantern_events` rows of kinds `scene/twist/npc/recap`; `ai_provider_requests`
rows with `use_case` values `lantern_scene/twist/npc/npc_portrait/recap/summary`, non-null
`session_id`, and **top-level** `total_cost`/token columns populated (not buried in `metadata`).

- [ ] **Step 4: Clean up the test campaign**

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE "$URL/rest/v1/lantern_campaigns?id=eq.<CID>" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```
Expected: `204` (cascades to sessions, npcs, threads, events).

- [ ] **Step 5: Record the result**

Note pass/fail of each checklist item in the commit message or a short note; fix any panel
whose output didn't read naturally or didn't use a remembered thread before relying on it.

---

## Self-Review notes

**Spec coverage (Lantern design spec → tasks):**
- Single-password middleware gate over page + `/api` (public URL fronts the service-role key) → Task B.
- Text-model fallback `google/gemini-2.5-flash-lite` → Task A.
- Campaign/session gate + bar (`localStorage` resume) → Tasks 9, 11, 16.
- Panel ① Scene + Twist (each logs an event) → Tasks 4, 5, 12.
- Panel ② NPC text-immediate + order-independent async portrait (optional `npcId`, client reconciliation, self-healing retry) + ⭐ Remember → Tasks 6, 7, 13.
- Panel ③ Notebook (People/Places/Problems/Treasures/Notes, star, add) + persisted scuffle counter (localStorage + `lantern_scuffles`) → Tasks 7, 10, 14, C, D.
- Panel ④ Recap + Edit Memory with AI summarize → Tasks 8, 15.
- AI routes assemble system + injected memory + grounding rolls + task and log to `lantern_events` with `request_id` → Tasks 2, 4–8.
- `session_id` + cost/token land in top-level `ai_provider_requests` columns → covered by the foundation's `aiProviderLog` (verified live in Task 18).
- Error handling: friendly inline + retry (panels); twist/npc JSON parse-fallback (Tasks 5, 6); portrait failure non-fatal + retry (Task 13); DB-logging failure non-fatal (foundation `writeEvent`).
- Cairn attribution (`CREDITS.md` + footer) → Task 17.
- Testing: unit (parse, context, routes, scuffle math + route, hook) + manual lifecycle checklist → Tasks 1–10, D, 18.

**Deferred / explicitly out of scope (matches spec non-goals):** no VTT/maps, no player UI, no per-user accounts (single shared password only), no character sheets, no full combat engine.

**Type consistency check:**
- `lanternAiService.sendMessage` input/output used in routes exactly matches the foundation interface (`{ useCase, systemPrompt, question, sessionId, aspectRatio? }` → `{ text?, imageUrl?, model, provider, requestId }`).
- `writeEvent` kinds used (`scene|twist|npc|recap`) ⊆ `LanternEventKind` and the `lantern_events.kind` CHECK constraint.
- `assembleContext()` / `getCampaign()` / `recentEventSummaries()` signatures defined in Task 2 are the same ones imported in Tasks 4–8.
- Client helpers `postJson`/`patchJson`/`getJson` (Task 9) are the only fetch surface used by every panel (Tasks 11–16).
- Route response shapes (`{ text, requestId }`, `{ twist, raw, requestId }`, `{ npc, raw, requestId }`, `{ imageUrl, requestId }`, `{ proposedSummary, requestId }`) match what each panel destructures.

**Notes for the executor:**
- Run Tasks A–C first. Task C's `supabase db push` is **operator-gated** (production schema change); the scuffle route (D) and the DB half of Task 14 only work once `lantern_scuffles` is live, but their code + tests can land earlier (the DB client is mocked in tests). The localStorage half of the scuffle counter works without the table.
- The middleware gate stores the password in an httpOnly cookie compared against `LANTERN_PASSWORD` — a deliberate single-operator simplification, not per-user auth. It must keep covering `/api/*` (those routes front the service-role key).
- All route handlers set `export const runtime = "nodejs"` (service-role client + node libs; not edge).
- `Math.random` in `roll`/`rollN` is fine here (app code, not a workflow script).
- The Vitest environment flips to `jsdom` in Task 9; re-run `npm test` there to confirm node-style route tests still pass under jsdom (they do — they don't touch the DOM).
- `<img>` is used for async Blob portraits intentionally; switching to `next/image` requires whitelisting the Blob host in `next.config.ts`.
