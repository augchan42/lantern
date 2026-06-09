export const runtime = "nodejs";

import { ok, fail, readBody } from "@/lib/apiHelpers";
import { assembleContext, recentEventSummaries, getCampaign } from "@/lib/campaignRepo";
import { lanternAiService } from "@/services/lanternAiService";
import { USE_CASES } from "@/lib/useCases";
import { summaryTask } from "@/prompts/tasks";

interface SummaryBody { campaignId?: string; sessionId?: string }

export async function POST(req: Request) {
  const body = await readBody<SummaryBody>(req);
  if (!body.campaignId || !body.sessionId) return fail("campaignId and sessionId are required");

  const campaign = await getCampaign(body.campaignId);
  if (!campaign) return fail("campaign not found", 404);

  const summaries = await recentEventSummaries(body.sessionId);
  const { systemPrompt } = await assembleContext(body.campaignId);
  const res = await lanternAiService.sendMessage({
    useCase: USE_CASES.summary,
    systemPrompt,
    question: summaryTask(campaign.summary, summaries),
    sessionId: body.sessionId,
  });

  // The Warden reviews/edits before saving — return the proposed text, do not persist here.
  return ok({ proposedSummary: res.text, requestId: res.requestId });
}
