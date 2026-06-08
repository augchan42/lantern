import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the two underlying callers so we test routing only.
// vi.hoisted() ensures the fns are available when vi.mock factories run (Vitest hoists vi.mock calls).
const sendText = vi.hoisted(() => vi.fn(async () => ({ requestId: "r1", text: "a scene", model: "m", provider: "p" })));
const genImage = vi.hoisted(() => vi.fn(async () => ({ requestId: "r2", blobUrl: "https://blob/x.png", model: "z", provider: "fal.ai" })));
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
