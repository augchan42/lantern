export const runtime = "nodejs";

import { ok, fail, readBody } from "@/lib/apiHelpers";
import { assembleContext } from "@/lib/campaignRepo";
import { lanternAiService } from "@/services/lanternAiService";
import { writeEvent } from "@/lib/lanternEvents";
import { USE_CASES } from "@/lib/useCases";
import { sceneTask } from "@/prompts/tasks";
import { roll, wood_locations, omens_weather, scene_seeds, complications } from "@/grounding";

interface SceneBody { campaignId?: string; sessionId?: string; wardenNote?: string }

export async function POST(req: Request) {
  const body = await readBody<SceneBody>(req);
  if (!body.campaignId || !body.sessionId) return fail("campaignId and sessionId are required");

  const { systemPrompt } = await assembleContext(body.campaignId);
  const task = sceneTask({
    wood_location: roll(wood_locations),
    omens_weather: roll(omens_weather),
    scene_seed: roll(scene_seeds),
    complication: roll(complications),
    warden_note: body.wardenNote ?? "",
  });

  const res = await lanternAiService.sendMessage({
    useCase: USE_CASES.scene,
    systemPrompt,
    question: task,
    sessionId: body.sessionId,
  });

  await writeEvent({
    session_id: body.sessionId,
    kind: "scene",
    summary: res.text ?? "",
    ai_request_id: res.requestId,
  });
  return ok({ text: res.text, requestId: res.requestId });
}
