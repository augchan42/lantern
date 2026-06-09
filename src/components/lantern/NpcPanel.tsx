"use client";
import { useEffect, useRef, useState } from "react";
import { postJson, patchJson } from "@/lib/client/api";

interface Npc { name: string; trait: string; want: string; voice_hint: string; portrait_prompt: string }
interface NpcRes { npc: Npc | null; raw?: string; requestId: string }
interface PortraitRes { imageUrl?: string; requestId: string }

export function NpcPanel({ campaignId, sessionId }: { campaignId: string; sessionId: string }) {
  const [npc, setNpc] = useState<Npc | null>(null);
  const [portrait, setPortrait] = useState<string | null>(null);
  const [portraitLoading, setPortraitLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberedId, setRememberedId] = useState<string | null>(null);
  const patched = useRef(false); // portrait already saved onto the row?

  async function newNpc() {
    setLoading(true); setError(null); setNpc(null); setPortrait(null); setRememberedId(null); patched.current = false;
    try {
      const r = await postJson<NpcRes>("/api/lantern/npc", { campaignId, sessionId });
      if (!r.npc) { setError("Could not parse NPC; raw: " + (r.raw ?? "")); return; }
      setNpc(r.npc);
      void firePortrait(r.npc.portrait_prompt); // async; does not block the card
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }

  // Fire the portrait. After Remember (rememberedId set), pass npcId so the server attaches it too.
  async function firePortrait(prompt: string) {
    setPortraitLoading(true);
    try {
      const r = await postJson<PortraitRes>("/api/lantern/npc?portrait=1", {
        sessionId, portraitPrompt: prompt, npcId: rememberedId ?? undefined,
      });
      if (r.imageUrl) setPortrait(r.imageUrl);
    } catch { /* portrait failure is non-fatal: keep the text */ } finally { setPortraitLoading(false); }
  }

  async function remember() {
    if (!npc) return;
    try {
      const row = await postJson<{ id: string }>("/api/lantern/npcs", {
        campaignId, sessionId, name: npc.name, trait: npc.trait, want: npc.want,
        voice_hint: npc.voice_hint, portrait_url: portrait, starred: true,
      });
      if (portrait) patched.current = true; // portrait was saved by the insert
      setRememberedId(row.id);
    } catch (e) { setError((e as Error).message); }
  }

  // Reconcile: if the portrait lands *after* Remember, attach it to the saved row exactly once.
  useEffect(() => {
    if (rememberedId && portrait && !patched.current) {
      patched.current = true;
      void patchJson("/api/lantern/npcs", { id: rememberedId, portrait_url: portrait });
    }
  }, [rememberedId, portrait]);

  return (
    <section className="rounded-lg border border-amber-900/15 bg-white p-4">
      <h2 className="mb-2 font-display text-lg font-semibold text-amber-900">② NPC Generator</h2>
      {npc ? (
        <div className="flex gap-3">
          <div className="flex h-20 w-20 flex-none items-center justify-center rounded bg-amber-100 text-xs text-amber-900/60">
            {portrait ? <img src={portrait} alt={npc.name} className="h-20 w-20 rounded object-cover" />
              : portraitLoading ? "…"
              : <button onClick={() => firePortrait(npc.portrait_prompt)} className="underline">retry</button>}
          </div>
          <div className="text-sm">
            <p className="font-medium">{npc.name}</p>
            <p className="text-amber-900/70">{npc.trait} · wants {npc.want}</p>
            <p className="italic">"{npc.voice_hint}"</p>
            <button disabled={rememberedId !== null} onClick={remember} className="mt-1 rounded border border-amber-700 px-2 py-0.5 text-xs disabled:opacity-50">
              {rememberedId ? "⭐ Remembered" : "⭐ Remember"}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-amber-900/60">Generate an NPC.</p>
      )}
      <button disabled={loading} onClick={newNpc} className="mt-3 rounded bg-amber-700 px-3 py-1 text-sm text-white disabled:opacity-50">
        {loading ? "…" : "New NPC"}
      </button>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
