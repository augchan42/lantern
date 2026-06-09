export const runtime = "nodejs";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ok, fail, readBody } from "@/lib/apiHelpers";

interface Combatant { id: string; name: string; hp: number; armor: number }
interface UpsertBody { sessionId?: string; combatants?: Combatant[]; turn?: number }

export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) return fail("sessionId is required");
  const { data, error } = await supabaseAdmin()
    .from("lantern_scuffles")
    .select("combatants, turn")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) return fail(error.message, 500);
  return ok(data ?? { combatants: [], turn: 0 });
}

export async function POST(req: Request) {
  const body = await readBody<UpsertBody>(req);
  if (!body.sessionId) return fail("sessionId is required");
  const { error } = await supabaseAdmin()
    .from("lantern_scuffles")
    .upsert(
      { session_id: body.sessionId, combatants: body.combatants ?? [], turn: body.turn ?? 0, updated_at: new Date().toISOString() },
      { onConflict: "session_id" },
    );
  if (error) return fail(error.message, 500);
  return ok({ ok: true });
}
