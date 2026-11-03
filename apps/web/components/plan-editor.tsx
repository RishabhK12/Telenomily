"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Med = {
  id: string;
  name: string;
  instructionKind: string;
  instructions: string;
  sourceText: string;
  strengthLabel: string;
  missingFields: string[];
  timings: string[];
  frequency: string | null;
  amountPerDose: string | null;
  route: string | null;
  formulation: string | null;
  release: string | null;
  specialInstructions: string | null;
  ingredients: { name: string; strengthValue: number | null; strengthUnit: string | null }[];
};

export function PlanEditor({ planId }: { planId: string }) {
  const router = useRouter();
  const [meds, setMeds] = useState<Med[]>([]);
  const [message, setMessage] = useState("Loading the draft.");

  useEffect(() => {
    void fetch("/api/care")
      .then((response) => response.json())
      .then((data: { draft?: { id: string; medications: Med[] }; error?: string }) => {
        if (data.draft?.id !== planId) {
          setMessage(data.error ?? "This draft is not open.");
          return;
        }
        setMeds(data.draft.medications);
        setMessage("");
      });
  }, [planId]);

  function update(id: string, patch: Partial<Med>) {
    setMeds((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function confirm() {
    const payload = meds.map((medication) => ({
      id: medication.id,
      name: medication.name,
      instructionKind: medication.instructionKind,
      timings: medication.timings,
    }));
    const saved = await fetch("/api/care", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save-draft", planId, medications: payload }) });
    if (!saved.ok) {
      const body = (await saved.json()) as { error?: string };
      setMessage(body.error ?? "The draft could not be saved.");
      return;
    }
    const confirmed = await fetch("/api/care", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "confirm", planId }) });
    const body = (await confirmed.json()) as { error?: string };
    if (!confirmed.ok) {
      setMessage(body.error ?? "The plan could not be confirmed.");
      return;
    }
    router.push("/patient");
    router.refresh();
  }

  return (
    <main id="content" className="family-screen mx-auto flex max-w-[720px] flex-col gap-4 px-5 py-6">
      <a href="/patient" className="type-label text-indigo">Back</a>
      <h1 className="type-title">Confirm the plan</h1>
      <p className="type-family">The source text stays next to each row. As needed medicines stay off the daily list. Stopped medicines stay off the schedule.</p>
      {message ? <p className="type-family">{message}</p> : null}
      {meds.map((medication) => (
        <article key={medication.id} className="card grid gap-4 md:grid-cols-2">
          <div>
            <p className="type-small text-muted">Source text</p>
            <p className="type-family mt-2">{medication.sourceText || "No source text was captured."}</p>
            {medication.missingFields.length > 0 ? <p className="type-small mt-2 text-expired">Please check this: {medication.missingFields.join(", ")}</p> : null}
          </div>
          <div className="flex flex-col gap-3">
            <label className="type-label">Name
              <input className="mt-1 block min-h-14 w-full rounded-full border border-lavender px-4" value={medication.name} onChange={(event) => update(medication.id, { name: event.target.value })} />
            </label>
            <label className="type-label">Kind
              <select className="mt-1 block min-h-14 w-full rounded-full border border-lavender px-4" value={medication.instructionKind} onChange={(event) => update(medication.id, { instructionKind: event.target.value })}>
                <option value="start">Start</option>
                <option value="continue">Continue</option>
                <option value="stop">Stop</option>
                <option value="as_needed">As needed</option>
              </select>
            </label>
            <label className="type-label">Clock times
              <input className="mt-1 block min-h-14 w-full rounded-full border border-lavender px-4" value={medication.timings.join(", ")} onChange={(event) => update(medication.id, { timings: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} />
            </label>
            <p className="type-small text-muted">{medication.strengthLabel}. {medication.instructions}</p>
          </div>
        </article>
      ))}
      <button type="button" className="btn-main" onClick={() => void confirm()}>Save plan</button>
    </main>
  );
}
