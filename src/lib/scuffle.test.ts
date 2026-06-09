import { describe, expect, it } from "vitest";
import { applyDamage, isOut, nextTurn, type Combatant } from "./scuffle";

const c = (hp: number, armor = 0): Combatant => ({ id: "x", name: "Badger", hp, armor });

describe("scuffle math", () => {
  it("damage = die roll minus armor", () => {
    expect(applyDamage(c(4, 1), 3).hp).toBe(2); // 3 - 1 = 2 dealt
  });
  it("never reduces hp below 0", () => {
    expect(applyDamage(c(1, 0), 6).hp).toBe(0);
  });
  it("a roll at or under armor deals no damage", () => {
    expect(applyDamage(c(4, 3), 2).hp).toBe(4);
  });
  it("isOut is true only at 0 hp", () => {
    expect(isOut(c(0))).toBe(true);
    expect(isOut(c(1))).toBe(false);
  });
  it("nextTurn wraps and handles an empty roster", () => {
    expect(nextTurn(0, 3)).toBe(1);
    expect(nextTurn(2, 3)).toBe(0);
    expect(nextTurn(0, 0)).toBe(0);
  });
});
