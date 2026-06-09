import { describe, expect, it } from "vitest";
import { parseModelJson } from "./parseModelJson";

describe("parseModelJson", () => {
  it("parses a bare JSON object", () => {
    expect(parseModelJson<{ type: string }>('{"type":"reveal","text":"x"}')).toEqual({
      type: "reveal",
      text: "x",
    });
  });
  it("strips ```json fences and surrounding prose", () => {
    const raw = 'Sure!\n```json\n{"name":"Pib"}\n```\nhope that helps';
    expect(parseModelJson<{ name: string }>(raw)).toEqual({ name: "Pib" });
  });
  it("returns null when there is no JSON object", () => {
    expect(parseModelJson("just some words")).toBeNull();
  });
  it("returns null on malformed JSON", () => {
    expect(parseModelJson('{"type": reveal}')).toBeNull();
  });
});
