"use client";

import { CallScreen, type LiveCall } from "@/components/call-screen";
import { FamilyCall } from "@/components/medicine-call";
import { useEffect, useState } from "react";

export default function FamilyCallPage() {
  const [session, setSession] = useState<{ token: string; url: string } | null>(null);
  const [call, setCall] = useState<LiveCall | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("telenomily-room");
    if (raw) {
      const parsed = JSON.parse(raw) as { token?: string; url?: string };
      if (parsed.token && parsed.url) setSession({ token: parsed.token, url: parsed.url });
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (session) return;
    let stopped = false;
    const tick = async () => {
      const response = await fetch("/api/demo?call=1", { cache: "no-store" });
      if (!response.ok || stopped) return;
      const payload = (await response.json()) as { call?: LiveCall | null };
      setCall(payload.call ?? null);
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 800);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [session]);

  if (!ready) return <main className="min-h-dvh bg-night" />;
  if (session) return <FamilyCall initial={session} />;
  if (call) return <CallScreen call={call} onEnd={() => void fetch("/api/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "end" }) })} />;
  return (
    <main id="content" className="family-screen flex min-h-dvh flex-col items-start gap-4 px-5 py-10">
      <h1 className="type-title">Call ended</h1>
      <a className="type-label text-indigo" href="/family">Back to the family screen</a>
    </main>
  );
}
