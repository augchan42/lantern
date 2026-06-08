export interface CampaignMemoryInput {
  summary: string;
}
export interface MemoryThreads {
  npcs: Array<{ name: string; want?: string | null; starred: boolean }>;
  threads: Array<{ kind: string; title: string; detail?: string | null; starred: boolean }>;
}

/** Assemble the prompt memory block: campaign summary + only starred people/threads. */
export function buildMemoryBlock(campaign: CampaignMemoryInput, m: MemoryThreads): string {
  const people = m.npcs
    .filter((n) => n.starred)
    .map((n) => `- ${n.name}${n.want ? ` (wants ${n.want})` : ""}`);
  const things = m.threads
    .filter((t) => t.starred)
    .map((t) => `- [${t.kind}] ${t.title}${t.detail ? ` — ${t.detail}` : ""}`);

  const lines = [`CAMPAIGN MEMORY:\n${campaign.summary || "(new campaign)"}`];
  if (people.length) lines.push(`WHO MATTERS:\n${people.join("\n")}`);
  if (things.length) lines.push(`WHAT MATTERS:\n${things.join("\n")}`);
  return lines.join("\n\n");
}
