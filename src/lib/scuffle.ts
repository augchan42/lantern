export interface Combatant {
  id: string;
  name: string;
  hp: number;
  armor: number;
}

/** Apply one hit: damage = max(0, dieRoll - armor); hp floored at 0 (0 = out, never death). */
export function applyDamage(c: Combatant, dieRoll: number): Combatant {
  const dealt = Math.max(0, dieRoll - c.armor);
  return { ...c, hp: Math.max(0, c.hp - dealt) };
}

export function isOut(c: Combatant): boolean {
  return c.hp <= 0;
}

/** Advance turn order, wrapping; returns 0 for an empty roster. */
export function nextTurn(order: number, count: number): number {
  return count === 0 ? 0 : (order + 1) % count;
}
