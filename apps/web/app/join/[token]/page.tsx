"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function JoinPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [message, setMessage] = useState("Checking this invite.");

  useEffect(() => {
    const token = params.token;
    if (!token) return;
    void fetch("/api/care", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "redeem", token }),
    })
      .then(async (response) => {
        const payload = (await response.json()) as { error?: string; redirectTo?: string };
        if (!response.ok || !payload.redirectTo) {
          setMessage(payload.error ?? "This invite cannot be used.");
          return;
        }
        router.replace(payload.redirectTo);
      })
      .catch(() => setMessage("The invite could not be checked. Try the QR code again."));
  }, [params.token, router]);

  return (
    <main id="content" className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6">
      <h1 className="heading-5">Demo family entry</h1>
      <p className="body-6" role="status">{message}</p>
    </main>
  );
}
