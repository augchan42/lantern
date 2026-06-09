"use client";
import { useState } from "react";
import { postJson, patchJson } from "@/lib/client/api";

type Tone = "gentle" | "adventurous";
interface Campaign { id: string; title: string | null; tone: Tone; summary: string; status: string }
interface Session { id: string; title: string | null; status: string }

export function SessionBar(props: {
  campaign: Campaign | null;
  sessionId: string | null;
  onCampaign: (c: Campaign) => void;
  onSession: (id: string | null) => void;
  onEditMemory: () => void;
}) {
  const { campaign, sessionId, onCampaign, onSession, onEditMemory } = props;
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createCampaign() {
    setBusy(true);
    try {
      const c = await postJson<Campaign>("/api/lantern/campaign", { title: title || "The Wood", tone: "gentle" });
      onCampaign(c);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function setTone(tone: Tone) {
    if (!campaign) return;
    try {
      const c = await patchJson<Campaign>("/api/lantern/campaign", { id: campaign.id, tone });
      onCampaign(c);
    } catch (e) { setError((e as Error).message); }
  }
  async function startSession() {
    if (!campaign) return;
    setBusy(true);
    try {
      const s = await postJson<Session>("/api/lantern/session", { campaignId: campaign.id });
      onSession(s.id);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function endSession() {
    if (!sessionId) return;
    try {
      await patchJson<Session>("/api/lantern/session", { id: sessionId, status: "ended" });
      onSession(null);
    } catch (e) { setError((e as Error).message); }
  }

  if (!campaign) {
    return (
      <header className="flex items-center gap-3 border-b border-amber-900/20 bg-amber-50/70 px-4 py-3 backdrop-blur-sm">
        <span className="font-display text-xl font-semibold tracking-tight text-amber-900">🏮 Lantern</span>
        <input
          className="rounded border border-amber-900/30 px-2 py-1 text-sm"
          placeholder="Campaign name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button disabled={busy} onClick={createCampaign} className="rounded bg-amber-700 px-3 py-1 text-sm text-white disabled:opacity-50">
          Start campaign
        </button>
      </header>
    );
  }

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-amber-900/20 bg-amber-50/70 px-4 py-3 text-sm backdrop-blur-sm">
      <span className="font-display text-xl font-semibold tracking-tight text-amber-900">🏮 Lantern</span>
      <span className="font-medium">Campaign: {campaign.title ?? "Untitled"}</span>
      <label className="flex items-center gap-1">
        tone:
        <select value={campaign.tone} onChange={(e) => setTone(e.target.value as Tone)} className="rounded border border-amber-900/30 px-1">
          <option value="gentle">gentle</option>
          <option value="adventurous">adventurous</option>
        </select>
      </label>
      {sessionId ? (
        <>
          <span className="rounded bg-amber-200 px-2 py-0.5">Session active</span>
          <button onClick={endSession} className="rounded border border-amber-900/30 px-2 py-0.5">End Session</button>
        </>
      ) : (
        <button disabled={busy} onClick={startSession} className="rounded bg-amber-700 px-3 py-1 text-white disabled:opacity-50">
          Start session
        </button>
      )}
      <button onClick={onEditMemory} className="ml-auto rounded border border-amber-900/30 px-2 py-0.5">Edit Memory</button>
      {error && <span className="text-red-700">{error}</span>}
    </header>
  );
}
