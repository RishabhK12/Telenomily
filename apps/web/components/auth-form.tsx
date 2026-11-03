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
    return <p className="type-body">This server has no Supabase keys and rehearsal mode is off. Set APP_MODE=rehearsal or add the live keys. Nothing is being simulated.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {mode === "rehearsal" ? (
        <>
          <p className="type-heading">Rehearsal</p>
          <p className="type-family text-muted">These buttons open the fictional household only. They do not place phone calls or start a live video room.</p>
          <button type="button" disabled={pending} className="btn-main" onClick={() => send({ action: "rehearsal", role: "patient" })}>Continue as Elena</button>
          <button type="button" disabled={pending} className="btn-secondary" onClick={() => send({ action: "rehearsal", role: "family" })}>Continue as Mateo</button>
        </>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void send({ action: "sign-in", email: data.get("email"), password: data.get("password") });
          }}
        >
          <label className="type-label flex flex-col gap-2">Email
            <input name="email" type="email" required autoComplete="username" className="min-h-14 rounded-full border border-lavender px-4" />
          </label>
          <label className="type-label flex flex-col gap-2">Password
            <input name="password" type="password" required minLength={8} autoComplete="current-password" className="min-h-14 rounded-full border border-lavender px-4" />
          </label>
          <button className="btn-main" disabled={pending}>Sign in</button>
        </form>
      )}
      {error ? <p className="type-body text-off-plan" role="alert">{error}</p> : null}
    </div>
  );
}
