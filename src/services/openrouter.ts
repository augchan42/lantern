import { logAIProviderRequest } from "./aiProviderLog";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

const OPENROUTER_HEADERS = {
  Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
  "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://example.com",
  "X-Title": "Lantern",
  "Content-Type": "application/json",
};

// Default model chain for Lantern.
const DEFAULT_MODELS = [
  "deepseek/deepseek-v4-flash",
  "google/gemini-2.5-flash-lite",
];

const MODEL_TIMEOUT_MS = 55_000;
const USE_CASE = "lantern_scene"; // fallback; callers pass useCase explicitly

// --- OpenRouter Call ---

interface OpenRouterResult {
  text: string;
  model: string;
  provider: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    /** OpenRouter returns cost when the request body includes `usage: { include: true }`. */
    cost?: number;
  };
  rawResponse: unknown;
}

async function callModel(
  model: string,
  systemPrompt: string,
  question: string,
  signal?: AbortSignal
): Promise<OpenRouterResult> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const requestBody = {
    model,
    messages: [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: question },
    ],
    max_tokens: 2048,
    temperature: 0.7,
    stream: false,
    usage: { include: true },
  };

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: OPENROUTER_HEADERS,
    body: JSON.stringify(requestBody),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const usage = data.usage
    ? {
        input_tokens: data.usage.prompt_tokens || data.usage.input_tokens || 0,
        output_tokens: data.usage.completion_tokens || data.usage.output_tokens || 0,
        total_tokens: data.usage.total_tokens || 0,
        cost: typeof data.usage.cost === "number" ? data.usage.cost : undefined,
      }
    : undefined;

  return {
    text: data.choices?.[0]?.message?.content ?? "",
    model: data.model ?? model,
    provider: data.provider ?? "unknown",
    usage,
    rawResponse: data,
  };
}

// --- Main Entry Point ---

export interface SendTextOptions {
  systemPrompt: string;
  question: string;
  /** Override model list — tries in order with fallback. */
  models?: string[];
  /** Override use_case tag for logging, e.g. "lantern_scene". */
  useCase?: string;
  /** Session id to group related calls in ai_provider_requests. */
  sessionId?: string;
}

export interface SendTextResult {
  requestId: string;
  text: string;
  model: string;
  provider: string;
}

export async function sendText(options: SendTextOptions): Promise<SendTextResult> {
  const { systemPrompt, question, useCase = USE_CASE, sessionId } = options;
  const modelsToTry = options.models ?? DEFAULT_MODELS;

  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
    const attemptStart = Date.now();

    try {
      console.log(`[OpenRouter][${requestId}] Trying model ${model} (${i + 1}/${modelsToTry.length})`);
      const result = await callModel(model, systemPrompt, question, controller.signal);
      clearTimeout(timeoutId);

      const responseTimeMs = Date.now() - attemptStart;
      console.log(`[OpenRouter][${requestId}] Success with ${result.model} via ${result.provider} in ${responseTimeMs}ms`);

      await logAIProviderRequest({
        request_id: requestId,
        provider: result.provider,
        model: result.model,
        model_array: modelsToTry,
        use_case: useCase,
        response_status: 200,
        error_message: null,
        raw_request: { model, systemPrompt, question },
        raw_response: result.rawResponse,
        session_id: sessionId ?? null,
        input_tokens: result.usage?.input_tokens ?? null,
        output_tokens: result.usage?.output_tokens ?? null,
        total_tokens: result.usage?.total_tokens ?? null,
        total_cost: result.usage?.cost ?? null,
        metadata: {
          attempt_number: i + 1,
          total_attempts: modelsToTry.length,
          response_time_ms: responseTimeMs,
          total_time_ms: Date.now() - startTime,
          success: true,
          actual_provider: result.provider,
        },
      });

      return { requestId, text: result.text, model: result.model, provider: result.provider };
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      const message = error instanceof Error ? error.message : String(error);
      const responseTimeMs = Date.now() - attemptStart;
      const isTimeout = error instanceof Error && error.name === "AbortError";

      console.log(`[OpenRouter][${requestId}] Model ${model} failed (${isTimeout ? "timeout" : "error"}): ${message}`);

      await logAIProviderRequest({
        request_id: `${requestId}_attempt_${i + 1}`,
        provider: "openrouter",
        model,
        model_array: modelsToTry,
        use_case: useCase,
        response_status: null,
        error_message: message,
        raw_request: { model, systemPrompt, question },
        raw_response: null,
        session_id: sessionId ?? null,
        metadata: {
          attempt_number: i + 1,
          total_attempts: modelsToTry.length,
          response_time_ms: responseTimeMs,
          success: false,
          error_type: isTimeout ? "timeout" : "error",
          is_final_attempt: i === modelsToTry.length - 1,
        },
      });

      if (i === modelsToTry.length - 1) {
        throw new Error(`All models failed. Last error: ${message}`);
      }
    }
  }

  throw new Error("No models available");
}
