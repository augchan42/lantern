import { supabaseAdmin } from "./supabaseAdmin";

export type LanternEventKind = "scene" | "twist" | "npc" | "recap" | "note";

export interface WriteEventInput {
  session_id: string;
  kind: LanternEventKind;
  summary: string;
  payload?: unknown;
  ai_request_id?: string | null;
}

export async function writeEvent(input: WriteEventInput): Promise<void> {
  const { error } = await supabaseAdmin().from("lantern_events").insert({
    session_id: input.session_id,
    kind: input.kind,
    summary: input.summary,
    payload: input.payload ?? null,
    ai_request_id: input.ai_request_id ?? null,
  });
  if (error) console.error("[lanternEvents] insert failed:", error);
}
