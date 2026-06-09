"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { isOut, nextTurn, type Combatant } from "@/lib/scuffle";
import { soft_monsters, roll } from "@/grounding";
import { getJson, postJson } from "@/lib/client/api";

let nextId = 0;
function spawn(): Combatant {
  const m = roll(soft_monsters);
  return { id: `m${nextId++}`, name: m.name, hp: m.hp, armor: m.armor };
}

interface ScuffleState { combatants: Combatant[]; turn: number }
const cacheKey = (sid: string) => `lantern.scuffle.${sid}`;

export function ScuffleCounter({ sessionId }: { sessionId: string }) {
  const [foes, setFoes] = useState<Combatant[]>([]);
  const [turn, setTurn] = useState(0);
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate: localStorage first (instant), then the DB row as source of truth.
  useEffect(() => {
    const cached = window.localStorage.getItem(cacheKey(sessionId));
    if (cached) {
      try { const s = JSON.parse(cached) as ScuffleState; setFoes(s.combatants); setTurn(s.turn); } catch { /* ignore */ }
    }
    getJson<ScuffleState>(`/api/lantern/scuffle?sessionId=${sessionId}`)
      .then((s) => { setFoes(s.combatants ?? []); setTurn(s.turn ?? 0); })
      .catch(() => { /* offline: keep cached state */ })
      .finally(() => { hydrated.current = true; });
  }, [sessionId]);

  // Write-through: localStorage immediately + debounced DB upsert (only after hydration).
  const persist = useCallback((combatants: Combatant[], t: number) => {
    window.localStorage.setItem(cacheKey(sessionId), JSON.stringify({ combatants, turn: t }));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void postJson("/api/lantern/scuffle", { sessionId, combatants, turn: t }).catch(() => {});
    }, 600);
  }, [sessionId]);

  useEffect(() => { if (hydrated.current) persist(foes, turn); }, [foes, turn, persist]);

  function add() { setFoes((f) => [...f, spawn()]); }
  function bump(id: string, amount: number) {
    setFoes((f) => f.map((c) => (c.id === id ? { ...c, hp: Math.max(0, c.hp + amount) } : c)));
  }

  return (
    <div className="mt-3 rounded border border-amber-900/15 p-2 text-xs">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-medium">Scuffle</span>
        <span>
          <button onClick={add} className="rounded border px-1">+ foe</button>
          <button onClick={() => setTurn((t) => nextTurn(t, foes.length))} className="ml-1 rounded border px-1">▸ turn</button>
        </span>
      </div>
      {foes.length === 0 && <p className="text-amber-900/50">No foes. Add one to start a scuffle.</p>}
      {foes.map((c, i) => (
        <div key={c.id} className={`flex items-center gap-2 ${i === turn ? "font-semibold" : ""}`}>
          <span className="w-32 truncate">{i === turn ? "▸ " : ""}{c.name}</span>
          <button onClick={() => bump(c.id, -1)} className="rounded border px-1">−</button>
          <span className="w-8 text-center">{c.hp}</span>
          <button onClick={() => bump(c.id, +1)} className="rounded border px-1">+</button>
          <span className="text-amber-900/50">armor {c.armor}</span>
          {isOut(c) && <span className="text-amber-700">out</span>}
        </div>
      ))}
    </div>
  );
}
