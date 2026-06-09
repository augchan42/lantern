export const runtime = "nodejs";

import { ok, fail, readBody } from "@/lib/apiHelpers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assembleContext } from "@/lib/campaignRepo";
import { lanternAiService } from "@/services/lanternAiService";
import { writeEvent } from "@/lib/lanternEvents";
import { USE_CASES } from "@/lib/useCases";
import { npcTask } from "@/prompts/tasks";
import { roll, names, npc_traits, npc_wants } from "@/grounding";
import { parseModelJson } from "@/lib/parseModelJson";

const PORTRAIT_STYLE = "storybook illustration, soft warm colors, friendly, no text";

interface NpcBody { campaignId?: string; sessionId?: string; portraitPrompt?: string; npcId?: string }
interface Npc { name: string; trait: string; want: string; voice_hint: string; portrait_prompt: string }

export async function POST(req: Request) {
  const isPortrait = new URL(req.url).searchParams.get("portrait");
  const body = await readBody<NpcBody>(req);
  if (!body.sessionId) return fail("sessionId is required");

  // Image branch: generate the portrait blob URL (no event row — portrait is a facet of the NPC).
  // Order-independent: if the NPC is already remembered (npcId given), write portrait_url onto
  // that row server-side; otherwise return the URL for the client to hold and reconcile later.
  if (isPortrait) {
    if (!body.portraitPrompt) return fail("portraitPrompt is required for a portrait");
    const res = await lanternAiService.sendMessage({
      useCase: USE_CASES.npcPortrait,
      systemPrompt: "",
      question: `${body.portraitPrompt}. ${PORTRAIT_STYLE}`,
      sessionId: body.sessionId,
      aspectRatio: "1:1",
    });
    if (body.npcId && res.imageUrl) {
      await supabaseAdmin().from("lantern_npcs").update({ portrait_url: res.imageUrl }).eq("id", body.npcId);
    }
    return ok({ imageUrl: res.imageUrl, requestId: res.requestId });
  }

  // Text branch.
  if (!body.campaignId) return fail("campaignId is required");
  const { systemPrompt } = await assembleContext(body.campaignId);
  const task = npcTask({ name: roll(names), trait: roll(npc_traits), want: roll(npc_wants) });
  const res = await lanternAiService.sendMessage({
    useCase: USE_CASES.npc,
    systemPrompt,
    question: task,
    sessionId: body.sessionId,
  });

  const npc = parseModelJson<Npc>(res.text ?? "");
  const summary = npc ? `${npc.name} — ${npc.trait}, wants ${npc.want}` : (res.text ?? "").trim();
  await writeEvent({
    session_id: body.sessionId,
    kind: "npc",
    summary,
    payload: npc ?? { raw: res.text },
    ai_request_id: res.requestId,
  });
  return ok({ npc, raw: res.text, requestId: res.requestId });
}
