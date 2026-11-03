"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PatientNav } from "@/components/patient-nav";

export default function ScanPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div className="patient-screen">
      <main id="content" className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-5 pb-32 pt-[max(24px,env(safe-area-inset-top))]">
        <h1 className="type-title text-white">Take a photo of your hospital sheet</h1>
        <p className="type-body mt-4 text-white">Add one photo per page. Save PDF pages as photos first.</p>
        <form
          className="card-main mt-8 flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            const form = new FormData(event.currentTarget);
            form.set("action", "extract");
            const response = await fetch("/api/care", { method: "POST", body: form });
            const payload = (await response.json()) as { planId?: string; error?: string };
            setPending(false);
            if (!response.ok || !payload.planId) {
              setMessage(payload.error ?? "The sheet could not be read. Try another photo.");
              return;
            }
            router.push(`/patient/plan/${payload.planId}`);
          }}
        >
          <input name="files" type="file" accept="image/*" capture="environment" multiple required className="type-family" />
          <button disabled={pending} className="btn-main">{pending ? "Reading" : "Read this sheet"}</button>
        </form>
        {message ? <p className="mt-4 type-body text-yellow" role="alert">{message}</p> : null}
        <a href="/fixtures/DischargeSample.pdf" className="mt-6 text-center type-label text-white underline">Open the sample hospital form</a>
      </main>
      <PatientNav active="scan" />
    </div>
  );
}
