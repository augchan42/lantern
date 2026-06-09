import { describe, expect, it, vi, beforeEach } from "vitest";

const { sendMessage, writeEvent, assembleContext } = vi.hoisted(() => ({
  sendMessage: vi.fn(async () => ({ text: "A misty glade.", model: "m", provider: "p", requestId: "r1" })),
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
