import { describe, expect, it, vi, beforeEach } from "vitest";

const insertSingle = vi.fn(async () => ({ data: { id: "c1", tone: "gentle" }, error: null }));
const updateSingle = vi.fn(async () => ({ data: { id: "c1", tone: "adventurous" }, error: null }));

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
