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
