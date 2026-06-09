"use client";
import { useEffect, useState } from "react";
import { SessionBar } from "@/components/lantern/SessionBar";
import { useCampaignSession } from "@/lib/client/useCampaignSession";
import { getJson } from "@/lib/client/api";

type Tone = "gentle" | "adventurous";
interface Campaign { id: string; title: string | null; tone: Tone; summary: string; status: string }

export default function Home() {
  const { campaignId, sessionId, setCampaignId, setSessionId } = useCampaignSession();
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  // Resume a cached campaign on load.
  useEffect(() => {
    if (campaignId && !campaign) {
      getJson<Campaign[]>(`/api/lantern/npcs?campaignId=${campaignId}`).catch(() => {}); // warm; real fetch below
    }
  }, [campaignId, campaign]);

  return (
    <main className="min-h-screen bg-amber-50/30">
      <SessionBar
        campaign={campaign}
        sessionId={sessionId}
        onCampaign={(c) => { setCampaign(c); setCampaignId(c.id); }}
        onSession={(id) => setSessionId(id)}
        onEditMemory={() => { /* MemoryEditor wired in Task 15 */ }}
      />
      {!campaign || !sessionId ? (
        <p className="p-6 text-sm text-amber-900/70">
          {!campaign ? "Start a campaign to begin." : "Start a session to open the panels."}
        </p>
      ) : (
        <p className="p-6 text-sm text-amber-900/70">Panels load here (Tasks 12–15).</p>
      )}
    </main>
  );
}
