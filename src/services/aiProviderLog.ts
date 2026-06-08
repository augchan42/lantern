import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function logAIProviderRequest({
  request_id,
  provider,
  model,
  model_array,
  use_case,
  response_status,
  error_message,
  raw_request,
  raw_response,
  metadata,
  session_id = null,
  total_cost = null,
  input_tokens = null,
  output_tokens = null,
  total_tokens = null,
}: {
  request_id: string;
  provider: string;
  model: string | null;
  model_array: string[] | null;
  use_case: string;
  response_status: number | null;
  error_message: string | null;
  raw_request: unknown;
  raw_response: unknown;
  metadata?: unknown;
  session_id?: string | null;
  total_cost?: number | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
}) {
  try {
    const supabase = supabaseAdmin();
    const { error } = await supabase.from("ai_provider_requests").insert({
      request_id,
      provider,
      model,
      model_array,
      use_case,
      response_status,
      error_message,
      raw_request,
      raw_response,
      metadata,
      session_id,
      total_cost,
      input_tokens,
      output_tokens,
      total_tokens,
    });
    if (error) {
      console.error(`[AIProvider][${request_id}] Failed to log to DB:`, error);
    }
  } catch (err) {
    console.error(`[AIProvider] Logging error:`, err);
  }
}
