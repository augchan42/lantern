export const runtime = "nodejs";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ok, fail, readBody } from "@/lib/apiHelpers";

interface CreateBody { title?: string; tone?: "gentle" | "adventurous" }
interface PatchBody { id?: string; title?: string; tone?: "gentle" | "adventurous"; summary?: string; status?: "active" | "ended" }

export async function POST(req: Request) {
  const body = await readBody<CreateBody>(req);
  const { data, error } = await supabaseAdmin()
    .from("lantern_campaigns")
    .insert({ title: body.title ?? null, tone: body.tone ?? "gentle" })
    .select("*")
    .single();
  if (error) return fail(error.message, 500);
  return ok(data);
}

export async function PATCH(req: Request) {
  const body = await readBody<PatchBody>(req);
  if (!body.id) return fail("id is required");
  const patch: Record<string, unknown> = {};
  for (const k of ["title", "tone", "summary", "status"] as const) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  const { data, error } = await supabaseAdmin()
    .from("lantern_campaigns")
    .update(patch)
    .eq("id", body.id)
    .select("*")
    .single();
  if (error) return fail(error.message, 500);
  return ok(data);
}
