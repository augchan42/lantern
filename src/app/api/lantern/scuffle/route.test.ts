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
