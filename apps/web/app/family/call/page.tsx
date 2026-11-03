"use client";

import { FamilyCall } from "@/components/medicine-call";
import { useEffect, useState } from "react";

export default function FamilyCallPage() {
  const [session, setSession] = useState<{ token: string; url: string } | null>(null);
  useEffect(() => {
    const raw = sessionStorage.getItem("telenomily-room");
    if (!raw) return;
    const parsed = JSON.parse(raw) as { token?: string; url?: string };
    if (parsed.token && parsed.url) setSession({ token: parsed.token, url: parsed.url });
  }, []);
  return <FamilyCall initial={session} />;
}
