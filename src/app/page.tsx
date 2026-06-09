"use client";
import { useEffect, useState } from "react";
import { SessionBar } from "@/components/lantern/SessionBar";
import { ScenePanel } from "@/components/lantern/ScenePanel";
import { NpcPanel } from "@/components/lantern/NpcPanel";
import { NotebookPanel } from "@/components/lantern/NotebookPanel";
import { RecapPanel } from "@/components/lantern/RecapPanel";
import { MemoryEditor } from "@/components/lantern/MemoryEditor";
import { useCampaignSession } from "@/lib/client/useCampaignSession";
import { getJson } from "@/lib/client/api";

type Tone = "gentle" | "adventurous";
interface Campaign { id: string; title: string | null; tone: Tone; summary: string; status: string }

export default function Home() {
  const { campaignId, sessionId, setCampaignId, setSessionId } = useCampaignSession();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [editing, setEditing] = useState(false);

  // Resume a cached campaign by reading it back through the campaign list endpoint.
  useEffect(() => {
    if (campaignId && !campaign) {
      getJson<Campaign>(`/api/lantern/campaign?id=${campaignId}`)
        .then(setCampaign)
        .catch(() => setCampaignId(null)); // stale id → reset gate
    }
  }, [campaignId, campaign, setCampaignId]);

  const ready = campaign && sessionId;

  return (
    <main className="min-h-screen bg-amber-50/30">
      <SessionBar
        campaign={campaign}
        sessionId={sessionId}
        onCampaign={(c) => { setCampaign(c); setCampaignId(c.id); }}
        onSession={(id) => setSessionId(id)}
        onEditMemory={() => setEditing(true)}
      />
      {!ready ? (
        <p className="p-6 text-sm text-amber-900/70">
          {!campaign ? "Start a campaign to begin." : "Start a session to open the panels."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
          <ScenePanel campaignId={campaign.id} sessionId={sessionId} />
          <NpcPanel campaignId={campaign.id} sessionId={sessionId} />
          <NotebookPanel campaignId={campaign.id} sessionId={sessionId} />
          <RecapPanel campaignId={campaign.id} sessionId={sessionId} />
        </div>
      )}
      {editing && campaign && sessionId && (
        <MemoryEditor
          campaignId={campaign.id}
          sessionId={sessionId}
          initialSummary={campaign.summary}
          onClose={() => setEditing(false)}
          onSaved={(summary) => setCampaign({ ...campaign, summary })}
        />
      )}
    </main>
  );
}
