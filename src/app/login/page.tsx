"use client";
import { useState, type FormEvent } from "react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) window.location.href = "/";
    else setError("Wrong password");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="w-80 space-y-3 rounded-2xl border border-amber-900/15 bg-white/80 p-6 shadow-xl shadow-amber-900/10 backdrop-blur-sm"
      >
        <h1 className="font-display text-2xl font-semibold tracking-tight text-amber-900">🏮 Lantern</h1>
        <p className="text-sm text-amber-900/70">A cozy Warden&apos;s helper. Enter the password to begin.</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="w-full rounded-lg border border-amber-900/30 bg-white px-3 py-2 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20"
        />
        <button className="w-full rounded-lg bg-amber-700 px-3 py-2 font-medium text-white transition hover:bg-amber-800">
          Enter
        </button>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </form>
    </main>
  );
}
