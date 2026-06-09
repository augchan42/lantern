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
