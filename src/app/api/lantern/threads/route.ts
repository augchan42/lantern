export const runtime = "nodejs";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ok, fail, readBody } from "@/lib/apiHelpers";

type ThreadKind = "place" | "problem" | "treasure" | "note";
interface CreateBody { campaignId?: string; kind?: ThreadKind; title?: string; detail?: string; starred?: boolean }
interface PatchBody { id?: string; kind?: ThreadKind; title?: string; detail?: string; starred?: boolean }

export async function GET(req: Request) {
  const url = new URL(req.url);
  const campaignId = url.searchParams.get("campaignId");
  const kind = url.searchParams.get("kind");
  if (!campaignId) return fail("campaignId is required");
  let q = supabaseAdmin().from("lantern_threads").select("*").eq("campaign_id", campaignId);
  if (kind) q = q.eq("kind", kind);
  const { data, error } = await q.order("created_at", { ascending: true });
  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function POST(req: Request) {
  const body = await readBody<CreateBody>(req);
  if (!body.campaignId || !body.kind || !body.title) return fail("campaignId, kind and title are required");
  const { data, error } = await supabaseAdmin()
    .from("lantern_threads")
    .insert({
      campaign_id: body.campaignId,
      kind: body.kind,
      title: body.title,
      detail: body.detail ?? null,
      starred: body.starred ?? false,
    })
    .select("*")
    .single();
  if (error) return fail(error.message, 500);
  return ok(data);
}

export async function PATCH(req: Request) {
  const body = await readBody<PatchBody>(req);
  if (!body.id) return fail("id is required");
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ["kind", "title", "detail", "starred"] as const) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  const { data, error } = await supabaseAdmin()
    .from("lantern_threads")
    .update(patch)
    .eq("id", body.id)
    .select("*")
    .single();
  if (error) return fail(error.message, 500);
  return ok(data);
}
