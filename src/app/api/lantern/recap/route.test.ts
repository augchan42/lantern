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
