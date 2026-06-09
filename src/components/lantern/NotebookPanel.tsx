"use client";
import { useCallback, useEffect, useState } from "react";
import { getJson, postJson, patchJson } from "@/lib/client/api";
import { ScuffleCounter } from "./ScuffleCounter";

type Tab = "People" | "Places" | "Problems" | "Treasures" | "Notes";
const THREAD_KIND: Record<Exclude<Tab, "People">, "place" | "problem" | "treasure" | "note"> = {
  Places: "place", Problems: "problem", Treasures: "treasure", Notes: "note",
};
interface Npc { id: string; name: string; want: string | null; starred: boolean }
interface Thread { id: string; kind: string; title: string; detail: string | null; starred: boolean }

export function NotebookPanel({ campaignId, sessionId }: { campaignId: string; sessionId: string }) {
  const [tab, setTab] = useState<Tab>("People");
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [title, setTitle] = useState("");

  const refresh = useCallback(async () => {
    setNpcs(await getJson<Npc[]>(`/api/lantern/npcs?campaignId=${campaignId}`));
    setThreads(await getJson<Thread[]>(`/api/lantern/threads?campaignId=${campaignId}`));
  }, [campaignId]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function addEntry() {
    if (!title.trim()) return;
    if (tab === "People") {
      await postJson("/api/lantern/npcs", { campaignId, name: title, starred: true });
    } else {
      await postJson("/api/lantern/threads", { campaignId, kind: THREAD_KIND[tab], title, starred: true });
    }
    setTitle(""); await refresh();
  }
  async function toggleNpc(n: Npc) { await patchJson("/api/lantern/npcs", { id: n.id, starred: !n.starred }); await refresh(); }
  async function toggleThread(t: Thread) { await patchJson("/api/lantern/threads", { id: t.id, starred: !t.starred }); await refresh(); }

  const tabThreads = tab === "People" ? [] : threads.filter((t) => t.kind === THREAD_KIND[tab]);

  return (
    <section className="rounded-lg border border-amber-900/15 bg-white p-4">
      <h2 className="mb-2 font-display text-lg font-semibold text-amber-900">③ Notes &amp; Threads</h2>
      <div className="mb-2 flex flex-wrap gap-1 text-xs">
        {(["People", "Places", "Problems", "Treasures", "Notes"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded px-2 py-0.5 ${tab === t ? "bg-amber-700 text-white" : "border border-amber-900/30"}`}>
            {t}
          </button>
        ))}
      </div>
      <ul className="space-y-1 text-sm">
        {tab === "People"
          ? npcs.map((n) => (
              <li key={n.id} className="flex items-center gap-2">
                <button onClick={() => toggleNpc(n)}>{n.starred ? "⭐" : "☆"}</button>
                <span>{n.name}{n.want ? ` — ${n.want}` : ""}</span>
              </li>
            ))
          : tabThreads.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <button onClick={() => toggleThread(t)}>{t.starred ? "⭐" : "☆"}</button>
                <span>{t.title}{t.detail ? ` — ${t.detail}` : ""}</span>
              </li>
            ))}
      </ul>
      <div className="mt-2 flex gap-1">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Add ${tab}`} className="flex-1 rounded border border-amber-900/30 px-2 py-1 text-sm" />
        <button onClick={addEntry} className="rounded border border-amber-700 px-2 text-sm">+ add</button>
      </div>
      <ScuffleCounter sessionId={sessionId} />
    </section>
  );
}
