"use client";
import { useState } from "react";
import { postJson } from "@/lib/client/api";

interface RecapRes { text?: string; requestId: string }

export function RecapPanel({ campaignId, sessionId }: { campaignId: string; sessionId: string }) {
  const [recap, setRecap] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true); setError(null);
    try {
      const r = await postJson<RecapRes>("/api/lantern/recap", { campaignId, sessionId });
      setRecap(r.text ?? "");
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }

  return (
    <section className="rounded-lg border border-amber-900/15 bg-white p-4">
      <h2 className="mb-2 font-semibold">④ Session Recap</h2>
      <div className="min-h-16 rounded bg-amber-50 p-3 text-sm">{recap ?? "“Previously, in the Wood…”"}</div>
      <button disabled={loading} onClick={generate} className="mt-2 rounded bg-amber-700 px-3 py-1 text-sm text-white disabled:opacity-50">
        {loading ? "…" : "Generate Recap"}
      </button>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
