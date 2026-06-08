// CC-BY-SA 4.0 — adapted from Cairn 2e (Yochai Gal) plus original kid-soft entries.
export interface SoftMonster {
  name: string;
  hp: number;
  armor: number;
  dmg: string;
  quirk: string;
}

export const soft_monsters: SoftMonster[] = [
  { name: "grumpy badger-knight", hp: 4, armor: 1, dmg: "d6", quirk: "demands a toll of snacks" },
  { name: "a tickle of pixies", hp: 2, armor: 0, dmg: "d4", quirk: "steals shiny buttons" },
  { name: "sleepy stone golem", hp: 8, armor: 2, dmg: "d8", quirk: "moves only every other turn" },
  { name: "hedge maze guardian", hp: 5, armor: 1, dmg: "d6", quirk: "lets you pass if you solve a riddle" },
  { name: "enormous sulky raven", hp: 3, armor: 0, dmg: "d4", quirk: "collects only red things" },
  { name: "mud sprite horde", hp: 2, armor: 0, dmg: "d4", quirk: "retreats if someone laughs loudly" },
  { name: "wolf made of autumn leaves", hp: 6, armor: 1, dmg: "d6", quirk: "disperses if it gets wet" },
  { name: "friendly but enormous toad", hp: 7, armor: 1, dmg: "d6", quirk: "can be bribed with flies or flowers" },
  { name: "grumbling tree-spirit", hp: 5, armor: 2, dmg: "d6", quirk: "calms down if given a compliment about its bark" },
  { name: "a litter of mischievous fox kits", hp: 2, armor: 0, dmg: "d4", quirk: "distracted by mirrors or bright cloth" },
  { name: "mossy bridge troll", hp: 6, armor: 1, dmg: "d6", quirk: "accepts poems as payment" },
  { name: "mirror-faced ghost", hp: 4, armor: 0, dmg: "d4", quirk: "reflects spooky faces back; can't follow you into sunlight" },
  { name: "enormous drowsy bear", hp: 9, armor: 1, dmg: "d8", quirk: "just wants to go back to sleep" },
  { name: "tangled vine-worm", hp: 5, armor: 1, dmg: "d6", quirk: "knots around itself if confused" },
  { name: "wax-faced hollow one", hp: 4, armor: 0, dmg: "d6", quirk: "loses interest if nobody looks at it" },
];
