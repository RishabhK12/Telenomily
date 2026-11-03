"use client";

import { useEffect, useState } from "react";
import { CallScreen, type LiveCall } from "./call-screen";

async function post(action: "answer" | "end") {
  await fetch("/api/demo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action }),
  });
}

export function PatientCall() {
  const [call, setCall] = useState<LiveCall | null>(null);

  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      try {
        const response = await fetch("/api/demo?call=1", { cache: "no-store" });
        if (!response.ok || stopped) return;
        const payload = (await response.json()) as { call?: LiveCall | null };
        setCall(payload.call ?? null);
      } catch {
        if (!stopped) setCall(null);
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 800);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  if (!call) return null;
  return (
    <CallScreen
      camera
      call={call}
      onAnswer={() => void post("answer")}
      onDecline={() => void post("end")}
      onEnd={() => void post("end")}
    />
  );
}
