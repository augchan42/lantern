import { describe, expect, it } from "vitest";
import * as g from "./index";

describe("grounding tables", () => {
  it("string tables meet their size targets and have no blanks/dupes", () => {
    const targets: Record<string, number> = {
      wood_locations: 50, omens_weather: 50, scene_seeds: 50, complications: 50,
      names: 24, npc_traits: 24, npc_wants: 24, clues_treasure: 24,
    };
    for (const [name, min] of Object.entries(targets)) {
      const table = (g as Record<string, string[]>)[name];
      expect(table, `${name} exists`).toBeTruthy();
      expect(table.length, `${name} >= ${min}`).toBeGreaterThanOrEqual(min);
      expect(table.every((e) => e.trim().length > 0), `${name} no blanks`).toBe(true);
      expect(new Set(table).size, `${name} no dupes`).toBe(table.length);
    }
  });

  it("soft_monsters have valid shells", () => {
    expect(g.soft_monsters.length).toBeGreaterThanOrEqual(12);
    for (const m of g.soft_monsters) {
      expect(m.name.trim().length).toBeGreaterThan(0);
      expect(m.hp).toBeGreaterThan(0);
      expect(m.armor).toBeGreaterThanOrEqual(0);
      expect(m.dmg.trim().length).toBeGreaterThan(0);
    }
  });

  it("rollN returns the requested count without immediate repeats", () => {
    const picks = g.rollN(g.wood_locations, 3);
    expect(picks).toHaveLength(3);
    expect(new Set(picks).size).toBe(3);
  });
});
