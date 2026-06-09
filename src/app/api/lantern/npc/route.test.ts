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
