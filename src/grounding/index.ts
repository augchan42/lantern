export { wood_locations } from "./wood_locations";
export { omens_weather } from "./omens_weather";
export { scene_seeds } from "./scene_seeds";
export { complications } from "./complications";
export { names } from "./names";
export { npc_traits } from "./npc_traits";
export { npc_wants } from "./npc_wants";
export { clues_treasure } from "./clues_treasure";
export { soft_monsters, type SoftMonster } from "./soft_monsters";

/** Pick one random element. */
export function roll<T>(table: readonly T[]): T {
  return table[Math.floor(Math.random() * table.length)];
}

/** Pick n distinct elements (no immediate repeats); n is clamped to table length. */
export function rollN<T>(table: readonly T[], n: number): T[] {
  const count = Math.min(n, table.length);
  const pool = [...table];
  const out: T[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}
