import { sendText } from "./openrouter";
import { genImage } from "./falImage";

const IMAGE_USE_CASES = new Set(["lantern_npc_portrait"]);

export interface SendMessageInput {
  useCase: string;
  systemPrompt: string;
  question: string;
  sessionId: string;
  models?: string[];
  aspectRatio?: string;
}
export interface SendMessageOutput {
  text?: string;
  imageUrl?: string;
  model: string;
  provider: string;
  requestId: string;
}

export const lanternAiService = {
  async sendMessage(input: SendMessageInput): Promise<SendMessageOutput> {
    if (IMAGE_USE_CASES.has(input.useCase)) {
      const r = await genImage({
        prompt: input.question, name: `${input.useCase}-${input.sessionId}`,
        aspectRatio: input.aspectRatio ?? "1:1", sessionId: input.sessionId,
        useCase: input.useCase,
      });
      return { imageUrl: r.blobUrl, model: r.model, provider: r.provider, requestId: r.requestId };
    }
    const r = await sendText({
      systemPrompt: input.systemPrompt, question: input.question,
      useCase: input.useCase, sessionId: input.sessionId, models: input.models,
    });
    return { text: r.text, model: r.model, provider: r.provider, requestId: r.requestId };
  },
};
