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
    <main className="flex min-h-screen items-center justify-center bg-amber-50/30">
      <form onSubmit={submit} className="w-72 space-y-2 rounded-lg border border-amber-900/15 bg-white p-4">
        <h1 className="text-lg">🏮 Lantern</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="w-full rounded border border-amber-900/30 px-2 py-1"
        />
        <button className="w-full rounded bg-amber-700 px-3 py-1 text-white">Enter</button>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </form>
    </main>
  );
}
