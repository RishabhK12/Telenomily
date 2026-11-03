"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AuthForm({ mode }: { mode: "live" | "rehearsal" | "unconfigured" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function send(body: Record<string, unknown>) {
    setPending(true);
    setError("");
    const response = await fetch("/api/care", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload = (await response.json()) as { error?: string; redirectTo?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Sign in failed.");
      return;
    }
    router.push(payload.redirectTo ?? "/patient");
    router.refresh();
  }

  if (mode === "unconfigured") {
    return <p className="body-3">This server has no Supabase keys and rehearsal mode is off. Set APP_MODE=rehearsal or add the live keys. Nothing is being simulated.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {mode === "rehearsal" ? (
        <div className="rounded-2xl border border-amber bg-card p-4">
          <p className="title-3">Rehearsal mode</p>
          <p className="body-6 mt-2">These buttons open the fictional household only. They do not place phone calls or start a live video room.</p>
          <div className="mt-4 flex flex-col gap-3">
            <button type="button" disabled={pending} className="button-xl min-h-16 rounded-2xl bg-forest px-6 py-4 text-paper disabled:opacity-60" onClick={() => send({ action: "rehearsal", role: "patient" })}>Continue as Elena</button>
            <button type="button" disabled={pending} className="button-lg min-h-12 rounded-2xl border border-ink px-6 py-3" onClick={() => send({ action: "rehearsal", role: "family" })}>Continue as Mateo</button>
          </div>
        </div>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void send({ action: "sign-in", email: data.get("email"), password: data.get("password") });
          }}
        >
          <label className="title-4 flex flex-col gap-2">Email
            <input name="email" type="email" required className="min-h-12 rounded-xl border border-line px-3" />
          </label>
          <label className="title-4 flex flex-col gap-2">Password
            <input name="password" type="password" required minLength={8} className="min-h-12 rounded-xl border border-line px-3" />
          </label>
          <button className="button-lg min-h-12 rounded-2xl bg-ink px-4 py-3 text-paper" disabled={pending}>Sign in</button>
        </form>
      )}
      {error ? <p className="body-6 text-clay" role="alert">{error}</p> : null}
    </div>
  );
}
