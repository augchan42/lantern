import { describe, expect, it } from "vitest";
import { buildMemoryBlock } from "./memory";

describe("buildMemoryBlock", () => {
  const campaign = { summary: "The kids owe Old Mossback a favor." };

  it("includes the campaign summary and only starred threads", () => {
    const block = buildMemoryBlock(campaign, {
      npcs: [
        { name: "Hazel-Anne", want: "find her lost sheep", starred: true },
        { name: "Random Shopkeeper", want: "sell turnips", starred: false },
      ],
      threads: [
        { kind: "treasure", title: "Ice Key", detail: "carried", starred: true },
        { kind: "note", title: "weather is odd", detail: "", starred: false },
      ],
    });
    expect(block).toContain("Old Mossback");
    expect(block).toContain("Hazel-Anne");
    expect(block).toContain("Ice Key");
    expect(block).not.toContain("Random Shopkeeper");
    expect(block).not.toContain("weather is odd");
  });

  it("handles an empty campaign gracefully", () => {
    const block = buildMemoryBlock({ summary: "" }, { npcs: [], threads: [] });
    expect(typeof block).toBe("string");
  });
});
