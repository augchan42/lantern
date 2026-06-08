import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./systemPrompt";
import { sceneTask } from "./tasks";

describe("buildSystemPrompt", () => {
  it("bakes in the tone and the memory block", () => {
    const sys = buildSystemPrompt("gentle", "CAMPAIGN MEMORY:\nThe Ice Key is carried.");
    expect(sys).toContain("gentle");
    expect(sys).toContain("Ice Key");
    expect(sys).toContain("never");        // the no-death rule
  });
});

describe("sceneTask", () => {
  it("injects rolled grounding and the warden note", () => {
    const task = sceneTask({
      wood_location: "the Hollow Oak", omens_weather: "warm fog",
      scene_seed: "a sheep stuck in brambles", complication: "the path loops back",
      warden_note: "the kids freed the sheep",
    });
    expect(task).toContain("the Hollow Oak");
    expect(task).toContain("warm fog");
    expect(task).toContain("the kids freed the sheep");
  });
});
