"use client";
import { useState } from "react";
import { postJson } from "@/lib/client/api";

interface SceneRes { text?: string; requestId: string }
interface TwistRes { twist: { type: string; text: string } | null; raw?: string; requestId: string }

export function ScenePanel({ campaignId, sessionId }: { campaignId: string; sessionId: string }) {
  const [note, setNote] = useState("");
  const [scene, setScene] = useState<string | null>(null);
  const [twist, setTwist] = useState<string | null>(null);
  const [twistType, setTwistType] = useState<string | null>(null);
  const [loading, setLoading] = useState<null | "scene" | "twist">(null);
  const [error, setError] = useState<string | null>(null);

  async function newScene() {
    setLoading("scene"); setError(null); setTwist(null); setTwistType(null);
    try {
      const r = await postJson<SceneRes>("/api/lantern/scene", { campaignId, sessionId, wardenNote: note });
      setScene(r.text ?? "");
    } catch (e) { setError((e as Error).message); } finally { setLoading(null); }
  }
  async function getTwist() {
    setLoading("twist"); setError(null);
    try {
      const r = await postJson<TwistRes>("/api/lantern/twist", { campaignId, sessionId, wardenNote: note });
      setTwist(r.twist?.text ?? r.raw ?? "");
      setTwistType(r.twist?.type ?? null);
    } catch (e) { setError((e as Error).message); } finally { setLoading(null); }
  }

  return (
    <section className="rounded-lg border border-amber-900/15 bg-white p-4">
      <h2 className="mb-2 font-semibold">① Scene + Twist</h2>
      <div className="min-h-16 rounded bg-amber-50 p-3 text-sm">{scene ?? "Generate a scene to begin."}</div>
      <label className="mt-2 block text-xs text-amber-900/70">Warden note</label>
      <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded border border-amber-900/30 px-2 py-1 text-sm" />
      <div className="mt-2 flex gap-2">
        <button disabled={loading !== null} onClick={newScene} className="rounded bg-amber-700 px-3 py-1 text-sm text-white disabled:opacity-50">
          {loading === "scene" ? "…" : "New Scene"}
        </button>
        <button disabled={loading !== null || !scene} onClick={getTwist} className="rounded border border-amber-700 px-3 py-1 text-sm disabled:opacity-50">
          {loading === "twist" ? "…" : "Twist ✦"}
        </button>
      </div>
      {twist && (
        <p className="mt-2 text-sm">
          <span className="font-medium">✦ {twistType ?? "twist"}:</span> {twist}
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error} <button onClick={newScene} className="underline">retry</button></p>}
    </section>
  );
}
