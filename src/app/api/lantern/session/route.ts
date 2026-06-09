export const runtime = "nodejs";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ok, fail, readBody } from "@/lib/apiHelpers";

interface CreateBody { campaignId?: string; title?: string }
interface PatchBody { id?: string; title?: string; status?: "active" | "ended" }

export async function POST(req: Request) {
  const body = await readBody<CreateBody>(req);
  if (!body.campaignId) return fail("campaignId is required");
  const { data, error } = await supabaseAdmin()
    .from("lantern_sessions")
    .insert({ campaign_id: body.campaignId, title: body.title ?? null })
    .select("*")
    .single();
  if (error) return fail(error.message, 500);
  return ok(data);
}

export async function PATCH(req: Request) {
  const body = await readBody<PatchBody>(req);
  if (!body.id) return fail("id is required");
  const patch: Record<string, unknown> = {};
  for (const k of ["title", "status"] as const) if (body[k] !== undefined) patch[k] = body[k];
  const { data, error } = await supabaseAdmin()
    .from("lantern_sessions")
    .update(patch)
    .eq("id", body.id)
    .select("*")
    .single();
  if (error) return fail(error.message, 500);
  return ok(data);
}
