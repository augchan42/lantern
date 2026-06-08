export const USE_CASES = {
  scene: "lantern_scene",
  twist: "lantern_twist",
  npc: "lantern_npc",
  npcPortrait: "lantern_npc_portrait",
  recap: "lantern_recap",
  summary: "lantern_summary",
} as const;

export type LanternUseCase = (typeof USE_CASES)[keyof typeof USE_CASES];
