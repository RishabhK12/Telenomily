"use client";

import { useEffect, useState } from "react";
import type { LaptopFamilyBoard } from "@/lib/demo-hub";

const font = "[font-family:Nunito,ui-sans-serif,system-ui,sans-serif]";
const card = "rounded-3xl bg-white p-5 shadow-sm";

const doseState: Record<string, string> = {
  pending: "Pending",
  reported_taken: "Reported taken",
  reported_not_taken: "Reported not taken",
  unsure: "Unsure",
  no_response: "No response",
};

const outcomeLabel: Record<string, string> = {
  on_plan: "On plan",
  not_on_plan: "Not on plan",
  expired: "Expired",
  missing: "Missing",
  cant_confirm: "Can't confirm",
  possible_match: "Possible match",
  candidate: "Needs a pharmacist",
};

const kindLabel: Record<string, string> = {
  continue: "Continue",
  start: "Start",
  as_needed: "As needed",
  stop: "Stopped",
  replace_expired: "Replace expired",
  obtain_missing: "Obtain",
};

function formatWhen(iso: string, timeZone: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function Empty({ children }: { children: string }) {
  return <p className="mt-3 text-base text-[#5F6296]">{children}</p>;
}

function clean(text: string) {
  return text
    .replace(/^Demo simulation:\s*/i, "")
    .replace(/^Demo simulation\.\s*/gim, "")
    .replaceAll("The phone did not ring. This is not a live Grok video call.", "")
    .replaceAll("This is a scripted laptop simulation.", "")
    .trim();
}

function sourceLabel(source: string) {
  if (source === "demo_simulation") return "Telenomily";
  return source.replaceAll("_", " ");
}

export function FamilyLive({ initial }: { initial: LaptopFamilyBoard }) {
  const [data, setData] = useState(initial);
  const [clock, setClock] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const timeZone = data.patient.timeZone || "America/New_York";

  useEffect(() => {
    const showClock = () => {
      setClock(
        new Intl.DateTimeFormat("en-US", {
          timeZone,
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
        }).format(new Date()),
      );
    };
    showClock();
    const clockTimer = window.setInterval(showClock, 1000);
    const tick = async () => {
      try {
        const response = await fetch("/api/demo", { cache: "no-store" });
        const payload = (await response.json()) as LaptopFamilyBoard & { error?: string };
        if (!response.ok) {
          setError(payload.error ?? "The family screen could not refresh.");
          return;
        }
        setData(payload);
        setRefreshedAt(new Date().toISOString());
        setError("");
      } catch {
        setError("The family screen could not refresh.");
      }
    };
    const pollTimer = window.setInterval(() => void tick(), 3000);
    return () => {
      window.clearInterval(clockTimer);
      window.clearInterval(pollTimer);
    };
  }, [timeZone]);

  const stopped = data.plan?.medications.filter((medication) => medication.instructionKind === "stop") ?? [];
  const activePlan = data.plan?.medications.filter((medication) => medication.instructionKind !== "stop") ?? [];

  return (
    <main id="content" className={`min-h-screen bg-[#F6F6FE] text-[#0F0E35] antialiased ${font}`}>
      <div className={`mx-auto flex w-full max-w-[480px] flex-col gap-4 px-4 py-6 ${data.activeRoom ? "pb-28" : ""}`}>
        <header className={card}>
          <p className="text-sm font-semibold text-[#6669BA]">{data.productName}</p>
          <h1 className="mt-1 text-3xl font-bold text-[#2F3273]">{data.patient.preferredName}</h1>
          <p className="mt-2 text-lg text-[#0F0E35]">{data.activeRoom ? "Live with Telenomily" : "Mateo is following Elena"}</p>
          <p className="mt-1 text-base text-[#5F6296]">{data.viewer.name}</p>
          <p className="mt-3 text-sm text-[#5F6296]">{clock ? `Laptop time ${clock}` : "Laptop time"}</p>
          <p className="text-sm text-[#5F6296]">
            {refreshedAt ? `Refreshed ${formatWhen(refreshedAt, timeZone)}` : "Refreshes about every 3 seconds"}
          </p>
        </header>
        {error ? (
          <p className="rounded-3xl bg-[#EBEAFC] px-4 py-3 text-base text-[#2F3273]" role="alert">
            {error}
          </p>
        ) : null}

        <section className={card}>
          <h2 className="text-xl font-bold text-[#4D50A2]">Completed check ins</h2>
          <p className="mt-2 text-3xl font-bold text-[#2F3273]">
            {data.checkIn.completed} of {data.checkIn.scheduled}
          </p>
          <p className="mt-2 text-base text-[#5F6296]">{data.checkIn.explanation}</p>
        </section>

        <section className={card}>
          <h2 className="text-xl font-bold text-[#4D50A2]">Confirmed plan</h2>
          <p className="mt-2 text-base text-[#5F6296]">Confirmed plan. Nothing was added from the blank hospital sheet.</p>
          {activePlan.length === 0 ? <Empty>The confirmed plan has no active medicine.</Empty> : (
            <ul className="mt-3 flex flex-col gap-3">
              {activePlan.map((medication) => (
                <li key={medication.id} className="rounded-2xl bg-[#F6F6FE] p-3">
                  <p className="font-semibold text-[#2F3273]">{medication.name}</p>
                  <p className="text-sm text-[#5F6296]">{kindLabel[medication.instructionKind] ?? medication.instructionKind} · {medication.strengthLabel}</p>
                  <p className="mt-1 text-base">{medication.instructions}</p>
                </li>
              ))}
            </ul>
          )}
          {stopped.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2">
              {stopped.map((medication) => (
                <li key={medication.id} className="text-base text-[#5F6296]">
                  Stopped: {medication.name}. {medication.instructions}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className={card}>
          <h2 className="text-xl font-bold text-[#4D50A2]">Today&apos;s doses</h2>
          {data.doses.length === 0 ? <Empty>Today&apos;s clock list is empty.</Empty> : (
            <ul className="mt-3 flex flex-col gap-3">
              {data.doses.map((dose) => (
                <li key={dose.id} className="rounded-2xl bg-[#F6F6FE] p-3">
                  <p className="font-semibold text-[#2F3273]">{dose.medicationName}</p>
                  <p className="text-sm text-[#5F6296]">{formatWhen(dose.scheduledFor, timeZone)}</p>
                  <p className="mt-1 inline-flex rounded-full bg-[#EBEAFC] px-3 py-1 text-sm font-semibold text-[#4D50A2]">
                    {doseState[dose.state] ?? dose.state}
                  </p>
                  <p className="mt-2 text-base">{dose.instructions}</p>
                </li>
              ))}
            </ul>
          )}
          {data.asNeeded.length > 0 ? (
            <div className="mt-4">
              <h3 className="font-semibold text-[#2F3273]">As needed, not a clock dose</h3>
              <ul className="mt-2 flex flex-col gap-2">
                {data.asNeeded.map((medication) => (
                  <li key={medication.id}>
                    <p className="font-semibold">{medication.name}</p>
                    <p className="text-base text-[#5F6296]">{medication.instructions}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        {data.alerts.length > 0 ? (
          <section className={card}>
            <h2 className="text-xl font-bold text-[#4D50A2]">Needs a look</h2>
            <ul className="mt-3 flex flex-col gap-3">
              {data.alerts.map((item) => (
                <li key={item.id}>
                  <p className="font-semibold">{clean(item.title)}</p>
                  <p className="text-sm text-[#5F6296]">{formatWhen(item.createdAt, timeZone)} · {sourceLabel(item.source)}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className={card}>
          <h2 className="text-xl font-bold text-[#4D50A2]">Medicine checks</h2>
          {data.checks.length === 0 ? <Empty>Medicine checks will appear here.</Empty> : (
            <ul className="mt-3 flex flex-col gap-3">
              {[...data.checks].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((check) => (
                <li key={check.id} className="rounded-2xl bg-[#F6F6FE] p-3">
                  <p className="font-semibold text-[#2F3273]">{outcomeLabel[check.outcome] ?? check.outcome}</p>
                  <p className="text-sm text-[#5F6296]">{formatWhen(check.createdAt, timeZone)} · {sourceLabel(check.source)}</p>
                  <p className="mt-2 whitespace-pre-wrap text-base">{clean(check.spokenScript)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={card}>
          <h2 className="text-xl font-bold text-[#4D50A2]">Symptoms</h2>
          {data.symptoms.length === 0 ? <Empty>Symptoms will appear here.</Empty> : (
            <ul className="mt-3 flex flex-col gap-3">
              {[...data.symptoms].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((symptom) => (
                <li key={symptom.id} className="rounded-2xl bg-[#F6F6FE] p-3">
                  <p className="font-semibold text-[#2F3273]">{symptom.text}</p>
                  <p className="text-sm text-[#5F6296]">
                    {formatWhen(symptom.createdAt, timeZone)} · {sourceLabel(symptom.source)} · {symptom.urgent ? "Urgent" : "Not urgent"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={card}>
          <h2 className="text-xl font-bold text-[#4D50A2]">Shopping tasks</h2>
          {data.tasks.length === 0 ? <Empty>Shopping tasks will appear here.</Empty> : (
            <ul className="mt-3 flex flex-col gap-3">
              {data.tasks.map((task) => (
                <li key={task.id} className="rounded-2xl bg-[#F6F6FE] p-3">
                  <p className="font-semibold text-[#2F3273]">{task.title}</p>
                  <p className="text-sm text-[#5F6296]">
                    {kindLabel[task.kind] ?? task.kind} · {formatWhen(task.createdAt, timeZone)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={card}>
          <h2 className="text-xl font-bold text-[#4D50A2]">Pharmacy</h2>
          {data.pharmacy.length === 0 ? <Empty>Pharmacy statements will appear here.</Empty> : (
            <ul className="mt-3 flex flex-col gap-3">
              {[...data.pharmacy].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((row) => (
                <li key={row.id} className="rounded-2xl bg-[#F6F6FE] p-3">
                  <p className="font-semibold text-[#2F3273]">{row.priceText ?? "No price saved"}</p>
                  <p className="mt-1 text-base">{row.statement}</p>
                  <p className="mt-1 text-sm text-[#5F6296]">Decision: {row.decision.replaceAll("_", " ")}</p>
                  <p className="text-sm text-[#5F6296]">{formatWhen(row.createdAt, timeZone)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {data.duplicates.length > 0 ? (
          <section className={card}>
            <h2 className="text-xl font-bold text-[#4D50A2]">Shared ingredients</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {data.duplicates.map((item) => (
                <li key={item.ingredient}>
                  {item.ingredient}: {item.products.join(", ")}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className={card}>
          <h2 className="text-xl font-bold text-[#4D50A2]">Activity</h2>
          {data.activity.length === 0 ? <Empty>Activity will appear here.</Empty> : (
            <ul className="mt-3 flex flex-col gap-3">
              {data.activity.map((item) => (
                <li key={item.id} className="border-t border-[#EBEAFC] pt-3 first:border-t-0 first:pt-0">
                  <p className="font-semibold text-[#2F3273]">{clean(item.title)}</p>
                  <p className="mt-1 whitespace-pre-wrap text-base">{clean(item.detail)}</p>
                  <p className="mt-1 text-sm text-[#5F6296]">
                    {formatWhen(item.createdAt, timeZone)} · {sourceLabel(item.source)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {data.activeRoom ? (
        <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-4">
          <a className="mx-auto flex min-h-16 max-w-[480px] items-center justify-center rounded-full bg-[#F9DF77] px-6 text-lg font-extrabold text-[#2F3273]" href="/family/call">
            Join call
          </a>
        </div>
      ) : null}
    </main>
  );
}
