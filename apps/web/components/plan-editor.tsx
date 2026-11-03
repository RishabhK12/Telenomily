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
    <main id="content" className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <a href="/patient" className="caption-2">Back</a>
      <h1 className="heading-4">Confirm the plan</h1>
      <p className="body-6">The source text stays next to each row. As needed medicines will not become daily doses. Stopped medicines stay off the schedule.</p>
      {message ? <p className="body-6">{message}</p> : null}
      {meds.map((medication) => (
        <article key={medication.id} className="grid gap-4 rounded-2xl border border-line bg-card p-4 md:grid-cols-2">
          <div>
            <p className="caption-4">Source text</p>
            <p className="body-6 mt-2">{medication.sourceText || "No source text was captured."}</p>
            {medication.missingFields.length > 0 ? <p className="caption-2 mt-2">Missing: {medication.missingFields.join(", ")}</p> : null}
          </div>
          <div className="flex flex-col gap-2">
            <label className="title-3">Name
              <input className="mt-1 block min-h-12 w-full rounded-xl border border-line px-3" value={medication.name} onChange={(event) => update(medication.id, { name: event.target.value })} />
            </label>
            <label className="title-3">Kind
              <select className="mt-1 block min-h-12 w-full rounded-xl border border-line px-3" value={medication.instructionKind} onChange={(event) => update(medication.id, { instructionKind: event.target.value })}>
                <option value="start">Start</option>
                <option value="continue">Continue</option>
                <option value="stop">Stop</option>
                <option value="as_needed">As needed</option>
              </select>
            </label>
            <label className="title-3">Clock times
              <input className="mt-1 block min-h-12 w-full rounded-xl border border-line px-3" value={medication.timings.join(", ")} onChange={(event) => update(medication.id, { timings: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} />
            </label>
            <p className="caption-2">{medication.strengthLabel}. {medication.instructions}</p>
          </div>
        </article>
      ))}
      <button type="button" className="button-xl min-h-16 rounded-2xl bg-forest px-6 py-4 text-paper" onClick={() => void confirm()}>Confirm schedule</button>
    </main>
  );
}
