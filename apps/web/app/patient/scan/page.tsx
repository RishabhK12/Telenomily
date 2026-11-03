"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ScanPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <main id="content" className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
      <a href="/patient" className="caption-2">Back</a>
      <h1 className="heading-4">Scan the discharge sheet</h1>
      <p className="body-6">Add one photo per page. You can choose several images. PDF pages should be saved as photos first.</p>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          const form = new FormData(event.currentTarget);
          form.set("action", "extract");
          const response = await fetch("/api/care", { method: "POST", body: form });
          const payload = (await response.json()) as { planId?: string; error?: string };
          setPending(false);
          if (!response.ok || !payload.planId) {
            setMessage(payload.error ?? "The sheet could not be read.");
            return;
          }
          router.push(`/patient/plan/${payload.planId}`);
        }}
      >
        <input name="files" type="file" accept="image/*" capture="environment" multiple required className="body-6" />
        <button disabled={pending} className="button-xl min-h-16 rounded-2xl bg-forest px-6 py-4 text-paper disabled:opacity-60">{pending ? "Reading" : "Read this sheet"}</button>
      </form>
      {message ? <p className="body-6 text-clay" role="alert">{message}</p> : null}
    </main>
  );
}
