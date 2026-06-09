export const runtime = "nodejs";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ok, fail, readBody } from "@/lib/apiHelpers";

interface CreateBody {
  campaignId?: string; sessionId?: string | null; name?: string;
  trait?: string; want?: string; voice_hint?: string; portrait_url?: string; starred?: boolean; notes?: string;
}
interface PatchBody {
  id?: string; name?: string; trait?: string; want?: string; voice_hint?: string;
  portrait_url?: string; starred?: boolean; notes?: string;
}

export async function GET(req: Request) {
  const campaignId = new URL(req.url).searchParams.get("campaignId");
  if (!campaignId) return fail("campaignId is required");
  const { data, error } = await supabaseAdmin()
    .from("lantern_npcs")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function POST(req: Request) {
  const body = await readBody<CreateBody>(req);
  if (!body.campaignId || !body.name) return fail("campaignId and name are required");
  const { data, error } = await supabaseAdmin()
    .from("lantern_npcs")
    .insert({
      campaign_id: body.campaignId,
      session_id: body.sessionId ?? null,
      name: body.name,
      trait: body.trait ?? null,
      want: body.want ?? null,
      voice_hint: body.voice_hint ?? null,
      portrait_url: body.portrait_url ?? null,
      starred: body.starred ?? false,
      notes: body.notes ?? null,
    })
    .select("*")
    .single();
  if (error) return fail(error.message, 500);
  return ok(data);
}

export async function PATCH(req: Request) {
  const body = await readBody<PatchBody>(req);
  if (!body.id) return fail("id is required");
  const patch: Record<string, unknown> = {};
  for (const k of ["name", "trait", "want", "voice_hint", "portrait_url", "starred", "notes"] as const) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  const { data, error } = await supabaseAdmin()
    .from("lantern_npcs")
    .update(patch)
    .eq("id", body.id)
    .select("*")
    .single();
  if (error) return fail(error.message, 500);
  return ok(data);
}
