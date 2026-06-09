import { supabaseAdmin } from "./supabaseAdmin";
import { buildMemoryBlock } from "./memory";
import { buildSystemPrompt, type Tone } from "@/prompts/systemPrompt";

export interface CampaignRow {
  id: string;
  title: string | null;
  tone: Tone;
  summary: string;
  status: string;
}

export async function getCampaign(id: string): Promise<CampaignRow | null> {
  const { data } = await supabaseAdmin()
    .from("lantern_campaigns")
    .select("*")
    .eq("id", id)
    .single();
  return (data as CampaignRow) ?? null;
}

export interface SessionContext {
  campaign: CampaignRow;
  systemPrompt: string;
}

/** Load a campaign + its starred memory and assemble the full system prompt. */
export async function assembleContext(campaignId: string): Promise<SessionContext> {
  const sb = supabaseAdmin();
  const [campaignRes, npcsRes, threadsRes] = await Promise.all([
    sb.from("lantern_campaigns").select("*").eq("id", campaignId).single(),
    sb.from("lantern_npcs").select("name, want, starred").eq("campaign_id", campaignId).eq("starred", true),
    sb.from("lantern_threads").select("kind, title, detail, starred").eq("campaign_id", campaignId).eq("starred", true),
  ]);

  const campaign = campaignRes.data as CampaignRow | null;
  if (!campaign) throw new Error(`campaign ${campaignId} not found`);

  const memory = buildMemoryBlock(
    { summary: campaign.summary },
    {
      npcs: (npcsRes.data ?? []) as Array<{ name: string; want?: string | null; starred: boolean }>,
      threads: (threadsRes.data ?? []) as Array<{ kind: string; title: string; detail?: string | null; starred: boolean }>,
    },
  );
  return { campaign, systemPrompt: buildSystemPrompt(campaign.tone, memory) };
}

/** Chronological event summaries for a session (oldest first), for recap/summary tasks. */
export async function recentEventSummaries(sessionId: string, limit = 40): Promise<string[]> {
  const { data } = await supabaseAdmin()
    .from("lantern_events")
    .select("summary")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(limit);
  return ((data ?? []) as Array<{ summary: string }>).map((e) => e.summary);
}
