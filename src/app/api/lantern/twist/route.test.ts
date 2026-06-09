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
