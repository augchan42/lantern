import { fal } from "@fal-ai/client";
import { put } from "@vercel/blob";
import { logAIProviderRequest } from "./aiProviderLog";

const FAL_MODEL = "fal-ai/z-image/turbo";

let falConfigured = false;
function ensureFalConfig() {
  if (!falConfigured) {
    const key = process.env.FAL_API_KEY || process.env.FAL_KEY;
    if (key) {
      fal.config({ credentials: key });
      falConfigured = true;
    }
  }
}

interface FalImageResult {
  images: Array<{
    url: string;
    width: number;
    height: number;
    content_type: string;
  }>;
  timings?: { inference?: number };
  seed?: number;
  prompt?: string;
}

export interface GenerateImageOptions {
  prompt: string;
  /** Descriptive name for organizing output, e.g. "lantern_npc_portrait-session1" */
  name: string;
  aspectRatio?: string;
  seed?: number;
  numImages?: number;
  /** Optional session id to group this call with others in ai_provider_requests */
  sessionId?: string;
  /** Use-case tag for logging; defaults to "lantern_npc_portrait" */
  useCase?: string;
}

export interface GenerateImageResult {
  requestId: string;
  blobUrl: string;
  model: string;
  provider: string;
}

type FalImageSize = "square" | "square_hd" | "landscape_16_9" | "portrait_16_9" | "landscape_4_3" | "portrait_4_3";

function mapAspectRatio(ratio: string): FalImageSize {
  const map: Record<string, FalImageSize> = {
    "1:1": "square",
    "16:9": "landscape_16_9",
    "9:16": "portrait_16_9",
    "4:3": "landscape_4_3",
    "3:4": "portrait_4_3",
    "3:2": "landscape_4_3",
    "2:3": "portrait_4_3",
  };
  return map[ratio] || "landscape_4_3";
}

async function fetchImageBuffer(imageUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
  const response = await fetch(imageUrl);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get("content-type") || "image/png";
  return { buffer, contentType };
}

export async function genImage(options: GenerateImageOptions): Promise<GenerateImageResult> {
  const {
    prompt,
    name,
    aspectRatio = "4:3",
    seed,
    numImages = 1,
    sessionId,
    useCase = "lantern_npc_portrait",
  } = options;

  if (!process.env.FAL_API_KEY && !process.env.FAL_KEY) {
    throw new Error("FAL_API_KEY (or FAL_KEY) is not set");
  }
  ensureFalConfig();

  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  console.log(`[FalImage][${requestId}] Generating "${name}" with ${FAL_MODEL}`);

  try {
    const result = await fal.subscribe(FAL_MODEL, {
      input: {
        prompt,
        num_images: numImages,
        image_size: mapAspectRatio(aspectRatio),
        seed,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log(`[FalImage][${requestId}] In progress...`);
        }
      },
    }) as { data: FalImageResult; requestId?: string };

    const image = result.data.images[0];
    if (!image) {
      throw new Error("No image returned from fal.ai");
    }

    const inferenceTimeMs = result.data.timings?.inference
      ? Math.round(result.data.timings.inference * 1000)
      : undefined;
    const responseTimeMs = Date.now() - startTime;

    console.log(`[FalImage][${requestId}] Generated in ${responseTimeMs}ms (inference: ${inferenceTimeMs ?? "?"}ms)`);

    // Fetch image and upload to Vercel Blob
    const { buffer, contentType } = await fetchImageBuffer(image.url);
    const ext = contentType.includes("jpeg") ? "jpg" : "png";
    const date = new Date().toISOString().split("T")[0];
    const blobPath = `lantern/${date}/${name}.${ext}`;

    const { url: blobUrl } = await put(blobPath, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });

    console.log(`[FalImage][${requestId}] Uploaded to blob: ${blobUrl}`);

    await logAIProviderRequest({
      request_id: requestId,
      provider: "fal.ai",
      model: FAL_MODEL,
      model_array: [FAL_MODEL],
      use_case: useCase,
      response_status: 200,
      error_message: null,
      session_id: sessionId ?? null,
      raw_request: {
        prompt,
        name,
        aspect_ratio: aspectRatio,
        image_size: mapAspectRatio(aspectRatio),
        seed,
        num_images: numImages,
      },
      raw_response: {
        fal_request_id: result.requestId,
        image_url: image.url,
        blob_url: blobUrl,
        width: image.width,
        height: image.height,
        content_type: image.content_type,
        seed: result.data.seed,
        returned_prompt: result.data.prompt,
      },
      metadata: {
        name,
        blob_url: blobUrl,
        response_time_ms: responseTimeMs,
        inference_time_ms: inferenceTimeMs,
        success: true,
      },
    });

    return {
      requestId,
      blobUrl,
      model: FAL_MODEL,
      provider: "fal.ai",
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const responseTimeMs = Date.now() - startTime;

    console.error(`[FalImage][${requestId}] Failed: ${message}`);

    await logAIProviderRequest({
      request_id: requestId,
      provider: "fal.ai",
      model: FAL_MODEL,
      model_array: [FAL_MODEL],
      use_case: useCase,
      response_status: null,
      error_message: message,
      session_id: sessionId ?? null,
      raw_request: { prompt, name, aspect_ratio: aspectRatio, seed, num_images: numImages },
      raw_response: null,
      metadata: {
        name,
        response_time_ms: responseTimeMs,
        success: false,
      },
    });

    throw error;
  }
}
