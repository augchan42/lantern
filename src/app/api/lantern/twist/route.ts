export const runtime = "nodejs";

import { ok, fail, readBody } from "@/lib/apiHelpers";
import { assembleContext } from "@/lib/campaignRepo";
import { lanternAiService } from "@/services/lanternAiService";
import { writeEvent } from "@/lib/lanternEvents";
import { USE_CASES } from "@/lib/useCases";
import { twistTask } from "@/prompts/tasks";
import { roll, complications } from "@/grounding";
import { parseModelJson } from "@/lib/parseModelJson";

interface TwistBody { campaignId?: string; sessionId?: string; wardenNote?: string }
interface Twist { type: "reveal" | "obstacle" | "opportunity"; text: string }

export async function POST(req: Request) {
  const body = await readBody<TwistBody>(req);
  if (!body.campaignId || !body.sessionId) return fail("campaignId and sessionId are required");

  const { systemPrompt } = await assembleContext(body.campaignId);
  const task = twistTask({ warden_note: body.wardenNote ?? "", complication: roll(complications) });
  const res = await lanternAiService.sendMessage({
    useCase: USE_CASES.twist,
    systemPrompt,
    question: task,
    sessionId: body.sessionId,
  });

  const twist = parseModelJson<Twist>(res.text ?? "");
  const summary = twist?.text ?? (res.text ?? "").trim();
  await writeEvent({
    session_id: body.sessionId,
    kind: "twist",
    summary,
    payload: twist ?? { raw: res.text },
    ai_request_id: res.requestId,
  });
  return ok({ twist, raw: res.text, requestId: res.requestId });
}
