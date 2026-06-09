export const runtime = "nodejs";

import { ok, fail, readBody } from "@/lib/apiHelpers";
import { assembleContext, recentEventSummaries } from "@/lib/campaignRepo";
import { lanternAiService } from "@/services/lanternAiService";
import { writeEvent } from "@/lib/lanternEvents";
import { USE_CASES } from "@/lib/useCases";
import { recapTask } from "@/prompts/tasks";

interface RecapBody { campaignId?: string; sessionId?: string }

export async function POST(req: Request) {
  const body = await readBody<RecapBody>(req);
  if (!body.campaignId || !body.sessionId) return fail("campaignId and sessionId are required");

  const summaries = await recentEventSummaries(body.sessionId);
  if (summaries.length === 0) return fail("no events yet to recap", 409);

  const { systemPrompt } = await assembleContext(body.campaignId);
  const res = await lanternAiService.sendMessage({
    useCase: USE_CASES.recap,
    systemPrompt,
    question: recapTask(summaries),
    sessionId: body.sessionId,
  });

  await writeEvent({
    session_id: body.sessionId,
    kind: "recap",
    summary: res.text ?? "",
    ai_request_id: res.requestId,
  });
  return ok({ text: res.text, requestId: res.requestId });
}
