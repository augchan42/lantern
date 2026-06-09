export function sceneTask(p: {
  wood_location: string; omens_weather: string; scene_seed: string;
  complication: string; warden_note: string;
}): string {
  const lines = [
    `Using these rolled details — Location: ${p.wood_location}; Omen/Weather: ${p.omens_weather};`,
    `Hook: ${p.scene_seed}; possible Complication: ${p.complication} — give the Warden 2–4`,
    "sentences of raw scene material to drop the kids into, consistent with the campaign memory.",
    "Third-person prep notes the Warden paraphrases, not read-aloud narration. Plain prose, no",
    "labels or headings. End with one sensory detail the kids could poke at.",
  ];
  if (p.warden_note.trim()) {
    lines.push(`Steer toward this Warden request: ${p.warden_note.trim()}.`);
  }
  return lines.join("\n");
}

export function twistTask(p: { warden_note: string; complication: string }): string {
  const lines = [
    "Given the current scene and the campaign memory, return ONE concrete development as JSON:",
    '{"type":"reveal"|"obstacle"|"opportunity","text":"..."} — a thing that happens, not',
    "branching options. Write text as a third-person note for the Warden, not read-aloud",
    "narration. Prefer payoffs that use an existing thread.",
    `Flavor obstacles with this complication: ${p.complication}.`,
  ];
  if (p.warden_note.trim()) {
    lines.push(`Steer toward this Warden request: ${p.warden_note.trim()}.`);
  }
  return lines.join("\n");
}

export function npcTask(p: { name: string; trait: string; want: string }): string {
  return [
    `Given rolled details — name: ${p.name}; trait: ${p.trait}; want: ${p.want} — and the`,
    'campaign memory, return JSON: {"name","trait","want","voice_hint","portrait_prompt"}.',
    "voice_hint = one line the Warden can read in character; portrait_prompt = a short",
    "kid-friendly illustration prompt.",
  ].join("\n");
}

export function recapTask(eventSummaries: string[]): string {
  return [
    "Given these things that happened this session (chronological):",
    eventSummaries.map((s) => `- ${s}`).join("\n"),
    'Write a warm 4–6 sentence "previously, in the Wood…" the Warden reads aloud next time.',
  ].join("\n");
}

export function summaryTask(currentSummary: string, eventSummaries: string[]): string {
  return [
    `Current campaign summary: "${currentSummary}".`,
    "Recent events:",
    eventSummaries.map((s) => `- ${s}`).join("\n"),
    "Return an updated short summary (<= 6 sentences) folding in new people/promises/items",
    "and dropping resolved ones. Plain prose, no preamble.",
  ].join("\n");
}
