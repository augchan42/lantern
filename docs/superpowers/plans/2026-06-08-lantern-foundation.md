# Lantern Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Lantern Next.js app and its tested core (config, service-role DB client, grounding roll-tables, prompt assembly + memory block, AI service, event writer) — everything the UI panels will sit on, with no panels yet.

**Architecture:** App Router Next.js + TypeScript + Tailwind in the `lantern` repo, mirroring photocritic-site conventions. AI calls go through `lanternAiService` (ported from `platform-db/reference/ai/`) and log to the shared `ai_provider_requests`. Persistence uses the already-migrated `lantern_*` tables via a service-role Supabase client. Grounding tables ship as static TS; prompts assemble from system + injected campaign memory + rolled grounding + task.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Tailwind CSS, `@supabase/supabase-js`, `@fal-ai/client`, `@vercel/blob`, Vitest for tests.

**Scope:** Foundation only. The campaign/session gate, the four panels, the memory editor, and the `/api/lantern/*` routes are a **separate follow-on plan** (`lantern-panels`). This plan produces a running app whose core logic is unit/integration tested.

**Prerequisites (already done):** the `lantern_*` tables and the `ai_provider_requests` columns exist in the shared Supabase project `ezlyfsgpcahlnbqgdlxh` (platform-db migrations, pushed + verified).

---

### Task 1: Scaffold the Next.js app + Vitest

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind` setup, `src/app/*` (via create-next-app)
- Create: `vitest.config.ts`, `src/test/setup.ts`

- [ ] **Step 1: Scaffold in-place (the repo already exists with docs/)**

Run from the repo root (`/home/hosermage/projects/lantern`):
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-npm --no-turbopack
```
When prompted that the directory is not empty, allow it to proceed (it keeps `docs/`, `AGENTS.md`, `.git`, etc.). If it **refuses** because of a conflicting file (commonly `README.md`), move the conflicting files aside first, then restore/merge them after:
```bash
mkdir -p /tmp/lantern-keep && mv README.md /tmp/lantern-keep/ 2>/dev/null || true
# re-run the create-next-app command above, then:
mv /tmp/lantern-keep/README.md ./README.md 2>/dev/null || true   # keep our README, discard the generated one if any
```
Expected: `src/app/page.tsx`, `package.json`, `tsconfig.json` created; `@/*` → `src/*` alias in `tsconfig.json`.

- [ ] **Step 2: Add runtime + test deps**

Run:
```bash
npm install @supabase/supabase-js @fal-ai/client @vercel/blob
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths jsdom
```
Expected: deps appear in `package.json`.

- [ ] **Step 3: Add Vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "node",
    setupFiles: [],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
```

- [ ] **Step 4: Add the test script**

In `package.json`, add to `"scripts"`: `"test": "vitest run"` and `"test:watch": "vitest"`.

- [ ] **Step 5: Smoke-test the runner**

Create `src/lib/_smoke.test.ts`:
```ts
import { expect, test } from "vitest";
test("vitest runs", () => { expect(1 + 1).toBe(2); });
```
Run: `npm test`
Expected: 1 passed. Then delete `src/lib/_smoke.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js app + Vitest"
```

---

### Task 2: Environment config

**Files:**
- Create: `.env.local.example`
- Create: `src/lib/env.ts`
- Test: `src/lib/env.test.ts`

- [ ] **Step 1: Write `.env.local.example`**

Create `.env.local.example`:
```
# Shared Supabase project ezlyfsgpcahlnbqgdlxh (values from photocritic-site/.env.local)
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
# Providers (Lantern's own keys)
OPENROUTER_API_KEY=
FAL_API_KEY=
BLOB_READ_WRITE_TOKEN=
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/env.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { requireEnv } from "./env";

describe("requireEnv", () => {
  it("returns the value when set", () => {
    process.env.LANTERN_TEST_VAR = "hello";
    expect(requireEnv("LANTERN_TEST_VAR")).toBe("hello");
  });
  it("throws a named error when missing", () => {
    delete process.env.LANTERN_TEST_MISSING;
    expect(() => requireEnv("LANTERN_TEST_MISSING")).toThrow("LANTERN_TEST_MISSING");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/env.test.ts`
Expected: FAIL ("Cannot find module './env'").

- [ ] **Step 4: Implement `env.ts`**

Create `src/lib/env.ts`:
```ts
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  supabaseUrl: () => requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  serviceRoleKey: () => requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  openRouterKey: () => requireEnv("OPENROUTER_API_KEY"),
  falKey: () => requireEnv("FAL_API_KEY"),
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/env.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add .env.local.example src/lib/env.ts src/lib/env.test.ts
git commit -m "feat: env config + requireEnv helper"
```

---

### Task 3: Service-role Supabase client

**Files:**
- Create: `src/lib/supabaseAdmin.ts`

- [ ] **Step 1: Implement the admin client**

Create `src/lib/supabaseAdmin.ts`:
```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let client: SupabaseClient | null = null;

/** Server-only Supabase client using the service-role key (bypasses RLS). */
export function supabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl(), env.serviceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabaseAdmin.ts
git commit -m "feat: service-role supabase admin client"
```

---

### Task 4: Grounding tables + roll helpers

**Files:**
- Create: `src/grounding/index.ts` and one file per table (`wood_locations.ts`, `omens_weather.ts`, `scene_seeds.ts`, `complications.ts`, `names.ts`, `npc_traits.ts`, `npc_wants.ts`, `clues_treasure.ts`, `soft_monsters.ts`)
- Test: `src/grounding/grounding.test.ts`

- [ ] **Step 1: Write the failing integrity test**

Create `src/grounding/grounding.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import * as g from "./index";

describe("grounding tables", () => {
  it("string tables meet their size targets and have no blanks/dupes", () => {
    const targets: Record<string, number> = {
      wood_locations: 50, omens_weather: 50, scene_seeds: 50, complications: 50,
      names: 24, npc_traits: 24, npc_wants: 24, clues_treasure: 24,
    };
    for (const [name, min] of Object.entries(targets)) {
      const table = (g as Record<string, string[]>)[name];
      expect(table, `${name} exists`).toBeTruthy();
      expect(table.length, `${name} >= ${min}`).toBeGreaterThanOrEqual(min);
      expect(table.every((e) => e.trim().length > 0), `${name} no blanks`).toBe(true);
      expect(new Set(table).size, `${name} no dupes`).toBe(table.length);
    }
  });

  it("soft_monsters have valid shells", () => {
    expect(g.soft_monsters.length).toBeGreaterThanOrEqual(12);
    for (const m of g.soft_monsters) {
      expect(m.name.trim().length).toBeGreaterThan(0);
      expect(m.hp).toBeGreaterThan(0);
      expect(m.armor).toBeGreaterThanOrEqual(0);
      expect(m.dmg.trim().length).toBeGreaterThan(0);
    }
  });

  it("rollN returns the requested count without immediate repeats", () => {
    const picks = g.rollN(g.wood_locations, 3);
    expect(picks).toHaveLength(3);
    expect(new Set(picks).size).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/grounding/grounding.test.ts`
Expected: FAIL ("Cannot find module './index'").

- [ ] **Step 3: Create one string table (pattern for all eight)**

Create `src/grounding/wood_locations.ts` (expand to ≥ 50 entries; seed from Cairn 2e's open tables + kid-soft additions):
```ts
// CC-BY-SA 4.0 — adapted from Cairn 2e (Yochai Gal) plus original kid-soft entries.
export const wood_locations: string[] = [
  "the Hollow Oak", "the Mushroom Market", "the Quiet Pond", "a leaning watchtower",
  "the Singing Bridge", "a cottage made of moss", "the Lantern Glade", "a fox's burrow",
  // ... continue to >= 50 distinct entries
];
```
Repeat this pattern for `omens_weather.ts`, `scene_seeds.ts`, `complications.ts` (target ≥ 50 each) and `names.ts`, `npc_traits.ts`, `npc_wants.ts`, `clues_treasure.ts` (target ≥ 24 each), using the representative entries from the spec's Grounding Tables section as seeds.

- [ ] **Step 4: Create the soft_monsters table**

Create `src/grounding/soft_monsters.ts` (≥ 12 entries):
```ts
// CC-BY-SA 4.0 — adapted from Cairn 2e (Yochai Gal) plus original kid-soft entries.
export interface SoftMonster {
  name: string;
  hp: number;
  armor: number;
  dmg: string;   // damage die, e.g. "d6"
  quirk: string;
}

export const soft_monsters: SoftMonster[] = [
  { name: "grumpy badger-knight", hp: 4, armor: 1, dmg: "d6", quirk: "demands a toll of snacks" },
  { name: "a tickle of pixies", hp: 2, armor: 0, dmg: "d4", quirk: "steals shiny buttons" },
  { name: "sleepy stone golem", hp: 8, armor: 2, dmg: "d8", quirk: "moves only every other turn" },
  // ... continue to >= 12 distinct entries
];
```

- [ ] **Step 5: Create the index + roll helpers**

Create `src/grounding/index.ts`:
```ts
export { wood_locations } from "./wood_locations";
export { omens_weather } from "./omens_weather";
export { scene_seeds } from "./scene_seeds";
export { complications } from "./complications";
export { names } from "./names";
export { npc_traits } from "./npc_traits";
export { npc_wants } from "./npc_wants";
export { clues_treasure } from "./clues_treasure";
export { soft_monsters, type SoftMonster } from "./soft_monsters";

/** Pick one random element. */
export function roll<T>(table: readonly T[]): T {
  return table[Math.floor(Math.random() * table.length)];
}

/** Pick n distinct elements (no immediate repeats); n is clamped to table length. */
export function rollN<T>(table: readonly T[], n: number): T[] {
  const count = Math.min(n, table.length);
  const pool = [...table];
  const out: T[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/grounding/grounding.test.ts`
Expected: PASS (3 tests). If a size assertion fails, add more entries until it passes.

- [ ] **Step 7: Commit**

```bash
git add src/grounding/
git commit -m "feat: grounding roll-tables + roll helpers (Cairn 2e CC-BY-SA seed)"
```

---

### Task 5: Use-case constants + memory block

**Files:**
- Create: `src/lib/useCases.ts`
- Create: `src/lib/memory.ts`
- Test: `src/lib/memory.test.ts`

- [ ] **Step 1: Define use-case constants**

Create `src/lib/useCases.ts`:
```ts
export const USE_CASES = {
  scene: "lantern_scene",
  twist: "lantern_twist",
  npc: "lantern_npc",
  npcPortrait: "lantern_npc_portrait",
  recap: "lantern_recap",
  summary: "lantern_summary",
} as const;

export type LanternUseCase = (typeof USE_CASES)[keyof typeof USE_CASES];
```

- [ ] **Step 2: Write the failing memory test**

Create `src/lib/memory.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildMemoryBlock } from "./memory";

describe("buildMemoryBlock", () => {
  const campaign = { summary: "The kids owe Old Mossback a favor." };

  it("includes the campaign summary and only starred threads", () => {
    const block = buildMemoryBlock(campaign, {
      npcs: [
        { name: "Hazel-Anne", want: "find her lost sheep", starred: true },
        { name: "Random Shopkeeper", want: "sell turnips", starred: false },
      ],
      threads: [
        { kind: "treasure", title: "Ice Key", detail: "carried", starred: true },
        { kind: "note", title: "weather is odd", detail: "", starred: false },
      ],
    });
    expect(block).toContain("Old Mossback");
    expect(block).toContain("Hazel-Anne");
    expect(block).toContain("Ice Key");
    expect(block).not.toContain("Random Shopkeeper");
    expect(block).not.toContain("weather is odd");
  });

  it("handles an empty campaign gracefully", () => {
    const block = buildMemoryBlock({ summary: "" }, { npcs: [], threads: [] });
    expect(typeof block).toBe("string");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/memory.test.ts`
Expected: FAIL ("Cannot find module './memory'").

- [ ] **Step 4: Implement `memory.ts`**

Create `src/lib/memory.ts`:
```ts
export interface CampaignMemoryInput {
  summary: string;
}
export interface MemoryThreads {
  npcs: Array<{ name: string; want?: string | null; starred: boolean }>;
  threads: Array<{ kind: string; title: string; detail?: string | null; starred: boolean }>;
}

/** Assemble the prompt memory block: campaign summary + only starred people/threads. */
export function buildMemoryBlock(campaign: CampaignMemoryInput, m: MemoryThreads): string {
  const people = m.npcs
    .filter((n) => n.starred)
    .map((n) => `- ${n.name}${n.want ? ` (wants ${n.want})` : ""}`);
  const things = m.threads
    .filter((t) => t.starred)
    .map((t) => `- [${t.kind}] ${t.title}${t.detail ? ` — ${t.detail}` : ""}`);

  const lines = [`CAMPAIGN MEMORY:\n${campaign.summary || "(new campaign)"}`];
  if (people.length) lines.push(`WHO MATTERS:\n${people.join("\n")}`);
  if (things.length) lines.push(`WHAT MATTERS:\n${things.join("\n")}`);
  return lines.join("\n\n");
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/memory.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/useCases.ts src/lib/memory.ts src/lib/memory.test.ts
git commit -m "feat: use-case constants + campaign memory block"
```

---

### Task 6: Prompt assembly

**Files:**
- Create: `src/prompts/systemPrompt.ts`
- Create: `src/prompts/tasks.ts`
- Test: `src/prompts/prompts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/prompts/prompts.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./systemPrompt";
import { sceneTask } from "./tasks";

describe("buildSystemPrompt", () => {
  it("bakes in the tone and the memory block", () => {
    const sys = buildSystemPrompt("gentle", "CAMPAIGN MEMORY:\nThe Ice Key is carried.");
    expect(sys).toContain("gentle");
    expect(sys).toContain("Ice Key");
    expect(sys).toContain("never");        // the no-death rule
  });
});

describe("sceneTask", () => {
  it("injects rolled grounding and the warden note", () => {
    const task = sceneTask({
      wood_location: "the Hollow Oak", omens_weather: "warm fog",
      scene_seed: "a sheep stuck in brambles", complication: "the path loops back",
      warden_note: "the kids freed the sheep",
    });
    expect(task).toContain("the Hollow Oak");
    expect(task).toContain("warm fog");
    expect(task).toContain("the kids freed the sheep");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/prompts/prompts.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `systemPrompt.ts`**

Create `src/prompts/systemPrompt.ts`:
```ts
export type Tone = "gentle" | "adventurous";

const TONE_TEXT: Record<Tone, string> = {
  gentle: "gentle — peril stays soft and reassuring",
  adventurous: "adventurous — real stakes and tension, but still never lethal",
};

export function buildSystemPrompt(tone: Tone, memoryBlock: string): string {
  return [
    "You are an idea engine for the Warden (game master) of a cozy tabletop fantasy game",
    "for children aged 9–12, played out loud. You never speak to the players. You produce",
    "short, vivid raw material the Warden can paraphrase. You run on a softened Cairn 2e",
    "engine: saves are d20 roll-under STR/DEX/WIL; combat attacks always hit and deal damage",
    "minus Armor to HP then STR. Nothing is ever fatal — danger resolves as setbacks,",
    "capture, lost items, fright, or being chased off, never death or gore. Setting is",
    `"the Wood": a dark-but-friendly fairytale forest. Tone: ${TONE_TEXT[tone]}. Reading`,
    "level ~age 9–12: concrete, warm, whimsical, a little spooky. When a moment could call",
    "for a roll, name the save but never roll or decide the result. Honor the ongoing",
    "campaign — reuse the people, places, and promises in the memory below.",
    "",
    memoryBlock,
  ].join("\n");
}
```

- [ ] **Step 4: Implement `tasks.ts`**

Create `src/prompts/tasks.ts`:
```ts
export function sceneTask(p: {
  wood_location: string; omens_weather: string; scene_seed: string;
  complication: string; warden_note: string;
}): string {
  return [
    `Using these rolled details — Location: ${p.wood_location}; Omen/Weather: ${p.omens_weather};`,
    `Hook: ${p.scene_seed}; possible Complication: ${p.complication} — write a 2–4 sentence`,
    "scene the Warden can drop the kids into, consistent with the campaign memory. End with",
    `one sensory detail the kids could poke at. Warden note: "${p.warden_note}".`,
  ].join("\n");
}

export function twistTask(p: { warden_note: string; complication: string }): string {
  return [
    "Given the current scene, the campaign memory, and the Warden note, return ONE concrete",
    'development as JSON: {"type":"reveal"|"obstacle"|"opportunity","text":"..."} — a thing',
    "that happens, not branching options. Prefer payoffs that use an existing thread.",
    `Flavor obstacles with this complication: ${p.complication}. Warden note: "${p.warden_note}".`,
  ].join("\n");
}

export function npcTask(p: { name: string; trait: string; want: string }): string {
  return [
    `Given rolled details — name: ${p.name}; trait: ${p.trait}; want: ${p.want} — and the`,
    'campaign memory, return JSON: {"name","trait","want","voice_hint","portrait_prompt"}.',
    "voice_hint = one line the Warden can read in character; portrait_prompt = a short",
    "kid-friendly illustration prompt.",
  ].join("\n");
}

export function recapTask(eventSummaries: string[]): string {
  return [
    "Given these things that happened this session (chronological):",
    eventSummaries.map((s) => `- ${s}`).join("\n"),
    'Write a warm 4–6 sentence "previously, in the Wood…" the Warden reads aloud next time.',
  ].join("\n");
}

export function summaryTask(currentSummary: string, eventSummaries: string[]): string {
  return [
    `Current campaign summary: "${currentSummary}".`,
    "Recent events:",
    eventSummaries.map((s) => `- ${s}`).join("\n"),
    "Return an updated short summary (<= 6 sentences) folding in new people/promises/items",
    "and dropping resolved ones. Plain prose, no preamble.",
  ].join("\n");
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/prompts/prompts.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/prompts/
git commit -m "feat: system prompt + per-use-case task assembly"
```

---

### Task 7: lanternAiService (text + image)

**Files:**
- Create: `src/services/lanternAiService.ts` (adapted from `platform-db/reference/ai/`)
- Test: `src/services/lanternAiService.test.ts`

- [ ] **Step 1: Copy the reference logger + adapt the supabase import**

Create `src/services/aiProviderLog.ts` by copying `platform-db/reference/ai/ai-provider.ts`'s `logAIProviderRequest` (the function body and its param type) and replacing its import line with:
```ts
import { supabaseAdmin } from "@/lib/supabaseAdmin";
// ...inside the function, replace createServerClient() with supabaseAdmin()
```
Keep the rest of `logAIProviderRequest` identical (it inserts the top-level `session_id` / `total_cost` / token columns).

- [ ] **Step 2: Write the failing routing test**

Create `src/services/lanternAiService.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the two underlying callers so we test routing only.
const sendText = vi.fn(async () => ({ requestId: "r1", text: "a scene", model: "m", provider: "p" }));
const genImage = vi.fn(async () => ({ requestId: "r2", blobUrl: "https://blob/x.png", model: "z", provider: "fal.ai" }));
vi.mock("./openrouter", () => ({ sendText }));
vi.mock("./falImage", () => ({ genImage }));

import { lanternAiService } from "./lanternAiService";

describe("lanternAiService.sendMessage", () => {
  beforeEach(() => { sendText.mockClear(); genImage.mockClear(); });

  it("routes text use-cases to OpenRouter", async () => {
    const res = await lanternAiService.sendMessage({
      useCase: "lantern_scene", systemPrompt: "sys", question: "q", sessionId: "s1",
    });
    expect(sendText).toHaveBeenCalledOnce();
    expect(genImage).not.toHaveBeenCalled();
    expect(res.text).toBe("a scene");
  });

  it("routes portrait use-case to fal and returns a blob url", async () => {
    const res = await lanternAiService.sendMessage({
      useCase: "lantern_npc_portrait", systemPrompt: "", question: "a fox", sessionId: "s1",
      aspectRatio: "1:1",
    });
    expect(genImage).toHaveBeenCalledOnce();
    expect(sendText).not.toHaveBeenCalled();
    expect(res.imageUrl).toBe("https://blob/x.png");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/services/lanternAiService.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 4: Create the two thin callers**

Create `src/services/openrouter.ts` by adapting `platform-db/reference/ai/ai-provider.ts`'s `sendMessage` (rename its export to `sendText`, import `logAIProviderRequest` from `./aiProviderLog`, default models `["deepseek/deepseek-v4-flash","deepseek/deepseek-chat-v3.1"]`). Its input is `{ systemPrompt, question, useCase?, sessionId?, models? }` and it returns `{ requestId, text, model, provider }`.

Create `src/services/falImage.ts` by adapting `platform-db/reference/ai/fal-image.ts`: export `genImage`, blob path prefix `lantern/`, import the same logger, and **add a `useCase` option to `GenerateImageOptions`** (default `"lantern_npc_portrait"`) that is passed through to `logAIProviderRequest` instead of the module-level constant. Returns `{ requestId, blobUrl, model, provider }`.

- [ ] **Step 5: Implement the router**

Create `src/services/lanternAiService.ts`:
```ts
import { sendText } from "./openrouter";
import { genImage } from "./falImage";

const IMAGE_USE_CASES = new Set(["lantern_npc_portrait"]);

export interface SendMessageInput {
  useCase: string;
  systemPrompt: string;
  question: string;
  sessionId: string;
  models?: string[];
  aspectRatio?: string;
}
export interface SendMessageOutput {
  text?: string;
  imageUrl?: string;
  model: string;
  provider: string;
  requestId: string;
}

export const lanternAiService = {
  async sendMessage(input: SendMessageInput): Promise<SendMessageOutput> {
    if (IMAGE_USE_CASES.has(input.useCase)) {
      const r = await genImage({
        prompt: input.question, name: `${input.useCase}-${input.sessionId}`,
        aspectRatio: input.aspectRatio ?? "1:1", sessionId: input.sessionId,
        useCase: input.useCase,
      });
      return { imageUrl: r.blobUrl, model: r.model, provider: r.provider, requestId: r.requestId };
    }
    const r = await sendText({
      systemPrompt: input.systemPrompt, question: input.question,
      useCase: input.useCase, sessionId: input.sessionId, models: input.models,
    });
    return { text: r.text, model: r.model, provider: r.provider, requestId: r.requestId };
  },
};
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/services/lanternAiService.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add src/services/
git commit -m "feat: lanternAiService (text→OpenRouter, portrait→fal) with shared logging"
```

---

### Task 8: Event writer

**Files:**
- Create: `src/lib/lanternEvents.ts`
- Test: `src/lib/lanternEvents.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/lanternEvents.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";

const insert = vi.fn(async () => ({ error: null }));
vi.mock("./supabaseAdmin", () => ({
  supabaseAdmin: () => ({ from: () => ({ insert }) }),
}));

import { writeEvent } from "./lanternEvents";

describe("writeEvent", () => {
  it("inserts a shaped lantern_events row", async () => {
    await writeEvent({
      session_id: "s1", kind: "scene", summary: "Hollow Oak scene",
      payload: { foo: 1 }, ai_request_id: "r1",
    });
    expect(insert).toHaveBeenCalledWith({
      session_id: "s1", kind: "scene", summary: "Hollow Oak scene",
      payload: { foo: 1 }, ai_request_id: "r1",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/lanternEvents.test.ts`
Expected: FAIL ("Cannot find module './lanternEvents'").

- [ ] **Step 3: Implement `lanternEvents.ts`**

Create `src/lib/lanternEvents.ts`:
```ts
import { supabaseAdmin } from "./supabaseAdmin";

export type LanternEventKind = "scene" | "twist" | "npc" | "recap" | "note";

export interface WriteEventInput {
  session_id: string;
  kind: LanternEventKind;
  summary: string;
  payload?: unknown;
  ai_request_id?: string | null;
}

export async function writeEvent(input: WriteEventInput): Promise<void> {
  const { error } = await supabaseAdmin().from("lantern_events").insert({
    session_id: input.session_id,
    kind: input.kind,
    summary: input.summary,
    payload: input.payload ?? null,
    ai_request_id: input.ai_request_id ?? null,
  });
  if (error) console.error("[lanternEvents] insert failed:", error);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/lanternEvents.test.ts`
Expected: PASS. Note: the mock returns the row passed to `insert`; the test asserts `payload`/`ai_request_id` defaulting is bypassed because both are provided — that's intended.

- [ ] **Step 5: Full test + typecheck + commit**

```bash
npm test && npx tsc --noEmit
git add src/lib/lanternEvents.ts src/lib/lanternEvents.test.ts
git commit -m "feat: lantern_events writer"
```

---

## Self-Review notes

- **Spec coverage:** AI layer (Tasks 5–7), grounding tables (Task 4), prompts incl. memory injection (Tasks 5–6), env/admin client/event writer (Tasks 2,3,8). **Deferred to the `lantern-panels` plan:** the four panels, `/api/lantern/*` routes, campaign/session gate, memory editor, async portraits, scuffle counter, session lifecycle integration test.
- **Type consistency:** `lanternAiService.sendMessage` input `{ useCase, systemPrompt, question, sessionId, aspectRatio? }` and output `{ text?, imageUrl?, model, provider, requestId }` are reused by the panels plan. `writeEvent` kinds match `lantern_events.kind` CHECK constraint (`scene|twist|npc|recap|note`). Use-case strings match the migration/contract.
- **Note for executor:** `Math.random` in `roll`/`rollN` is fine in app code (this is not a workflow script). Grounding tables must be expanded to their size targets — the Task 4 test enforces it and will fail until they are.
