"use client";
import { useState } from "react";
import { patchJson, postJson } from "@/lib/client/api";

interface SummaryRes { proposedSummary?: string; requestId: string }

export function MemoryEditor(props: {
  campaignId: string;
  sessionId: string;
  initialSummary: string;
  onClose: () => void;
  onSaved: (summary: string) => void;
}) {
  const { campaignId, sessionId, initialSummary, onClose, onSaved } = props;
  const [summary, setSummary] = useState(initialSummary);
  const [busy, setBusy] = useState(false);

  async function summarize() {
    setBusy(true);
    try {
      const r = await postJson<SummaryRes>("/api/lantern/summary", { campaignId, sessionId });
      if (r.proposedSummary) setSummary(r.proposedSummary);
    } finally { setBusy(false); }
  }
  async function save() {
    setBusy(true);
    try {
      await patchJson("/api/lantern/campaign", { id: campaignId, summary });
      onSaved(summary);
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-4">
        <h2 className="mb-2 font-display text-lg font-semibold text-amber-900">Campaign Memory</h2>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={8} className="w-full rounded border border-amber-900/30 p-2 text-sm" />
        <div className="mt-2 flex justify-end gap-2 text-sm">
          <button disabled={busy} onClick={summarize} className="rounded border border-amber-700 px-3 py-1 disabled:opacity-50">
            {busy ? "…" : "Summarize recent events"}
          </button>
          <button onClick={onClose} className="rounded border border-amber-900/30 px-3 py-1">Cancel</button>
          <button disabled={busy} onClick={save} className="rounded bg-amber-700 px-3 py-1 text-white disabled:opacity-50">Save</button>
        </div>
      </div>
    </div>
  );
}
