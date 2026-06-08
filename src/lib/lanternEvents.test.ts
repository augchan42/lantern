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
