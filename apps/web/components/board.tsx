"use client";

import { CheckCircle, ClockCountdown, MagnifyingGlass, Pill, Prohibit, Question, Translate } from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type Dose = { id: string; medicationName: string; scheduledFor: string; state: string; instructions: string };
type Check = { id: string; outcome: string; spokenScript: string; createdAt: string; source: string };
type Symptom = { id: string; text: string; urgent: boolean; createdAt: string };
type Task = { id: string; title: string; kind: string; createdAt: string };
type Pharmacy = { id: string; statement: string; decision: string; priceText: string | null; createdAt: string };
type Activity = { id: string; title: string; detail: string; source: string; status: string; createdAt: string };
type Med = { id: string; name: string; instructionKind: string; instructions: string; sourceText: string; strengthLabel: string; missingFields: string[] };

export type BoardData = {
  mode: string;
  productName: string;
  viewer: { role: string; name: string };
  patient: { id: string; preferredName: string; phoneLast4: string | null };
  plan: { medications: Med[] } | null;
  draft: { id: string; medications: Med[] } | null;
  doses: Dose[];
  asNeeded: Med[];
  symptoms: Symptom[];
  checks: Check[];
  tasks: Task[];
  pharmacy: Pharmacy[];
  calls: { id: string; purpose: string; status: string; createdAt: string; summary: string | null }[];
  activeRoom: { livekitRoom: string; createdAt: string } | null;
  activity: Activity[];
  checkIn: { completed: number; scheduled: number; explanation: string };
  alerts: Activity[];
  duplicates: { ingredient: string; products: string[] }[];
};

const outcomeLabel: Record<string, string> = {
  on_plan: "On plan",
  not_on_plan: "Not on plan",
  expired: "Expired",
  missing: "Missing",
  cant_confirm: "Can't confirm",
  possible_match: "Possible match",
  candidate: "Needs pharmacist",
};

export function outcomeText(outcome: string) {
  return outcomeLabel[outcome] ?? outcome;
}

export function Board({ initial, audience }: { initial: BoardData; audience: "patient" | "family" }) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => {
    const tick = async () => {
      const response = await fetch("/api/care");
      if (response.ok) setData((await response.json()) as BoardData);
    };
    const timer = window.setInterval(() => void tick(), 3000);
    const onFocus = () => void tick();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  async function signOut() {
    await fetch("/api/care", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "sign-out" }) });
    router.push("/login");
    router.refresh();
  }

  async function join() {
    const response = await fetch("/api/care", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "join-room" }) });
    const payload = (await response.json()) as { error?: string; token?: string; url?: string; roomName?: string };
    if (!response.ok || !payload.token) {
      setError(payload.error ?? "The room could not be joined.");
      return;
    }
    sessionStorage.setItem("telenomily-room", JSON.stringify(payload));
    router.push("/family/call");
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
      {error ? <p className="body-6 text-clay" role="alert">{error}</p> : null}
      {data.mode === "rehearsal" ? (
        <p className="rounded-2xl border border-amber bg-card px-4 py-3 body-6">Rehearsal mode. Phone calls and live video are not being simulated as success.</p>
      ) : null}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="caption-2">{data.productName}</p>
          <h1 className={audience === "patient" ? "heading-4" : "heading-5"}>{audience === "patient" ? `Hello, ${data.patient.preferredName}` : data.patient.preferredName}</h1>
          <p className="caption-2">{audience === "family" ? "Family view. You only see people linked to this account." : "Your schedule for today."}</p>
        </div>
        <button type="button" className="button-md rounded-xl border border-line px-3 py-2" onClick={() => void signOut()}>Sign out</button>
      </header>
      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="title-2">Completed check ins</h2>
        <p className="heading-5 mt-2">{data.checkIn.completed} of {data.checkIn.scheduled}</p>
        <p className="caption-2 mt-2">{data.checkIn.explanation}</p>
      </section>
      {audience === "patient" ? (
        <a href="/patient/check" className="button-xl flex min-h-16 items-center justify-center rounded-2xl bg-forest px-6 py-4 text-center text-paper">Start medicine check</a>
      ) : null}
      {data.activeRoom ? (
        <section className="rounded-2xl border border-forest bg-card p-4">
          <h2 className="title-2">Active call</h2>
          <p className="caption-2">Started {new Date(data.activeRoom.createdAt).toLocaleTimeString()}</p>
          {audience === "family" ? <button type="button" className="button-lg mt-3 min-h-12 rounded-2xl bg-ink px-4 py-3 text-paper" onClick={() => void join()}>Join</button> : <a className="button-lg mt-3 inline-flex" href="/patient/check">Return to the call</a>}
        </section>
      ) : null}
      <section>
        <h2 className={audience === "patient" ? "heading-5" : "title-1"}>Today</h2>
        {data.doses.length === 0 ? <p className="body-6 mt-3">No clock doses are scheduled today.</p> : (
          <ul className="mt-3 flex flex-col gap-3">
            {data.doses.map((dose) => (
              <li key={dose.id} className="rounded-2xl border border-line bg-card p-4">
                <p className={audience === "patient" ? "heading-6" : "title-2"}>{dose.medicationName}</p>
                <p className="body-6">{new Date(dose.scheduledFor).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {dose.state.replaceAll("_", " ")}</p>
                <p className="body-6 mt-2">{dose.instructions}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      {data.asNeeded.length > 0 ? (
        <section>
          <h2 className="title-1">As needed</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {data.asNeeded.map((item) => (
              <li key={item.id} className="rounded-2xl border border-line bg-card p-4">
                <p className="title-2">{item.name}</p>
                <p className="body-6">{item.instructions}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {audience === "patient" ? <a className="button-lg inline-flex min-h-12 items-center justify-center rounded-2xl border border-ink px-4 py-3" href="/patient/scan">Scan a discharge sheet</a> : null}
      <Section title="Medicine checks" empty="No checks yet.">
        {data.checks.map((check) => (
          <article key={check.id} className={`flex gap-3 rounded-2xl border bg-card p-4 ${outcomeBorder(check.outcome)}`}>
            <OutcomeMark outcome={check.outcome} />
            <div>
              <p className="title-3">{outcomeText(check.outcome)}</p>
              <p className="caption-2">{new Date(check.createdAt).toLocaleString()} · {check.source.replaceAll("_", " ")}</p>
              <p className="body-6 mt-2">{check.spokenScript}</p>
            </div>
          </article>
        ))}
      </Section>
      <section>
        <h2 className="title-1">Shared ingredients</h2>
        {data.duplicates.length === 0 ? (
          <p className="body-6 mt-3">No exact duplicate active ingredient was found across the confirmed products. This is not a full interaction check.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {data.duplicates.map((item) => (
              <li key={item.ingredient} className="rounded-2xl border border-amber bg-card p-4">
                <p className="title-3">{item.ingredient}</p>
                <p className="body-6 mt-2">Also listed in {item.products.join(", ")}. This flag is not a full interaction check.</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Section title="Symptoms" empty="No symptoms reported.">
        {data.symptoms.map((item) => (
          <article key={item.id} className="rounded-2xl border border-line bg-card p-4">
            <p className="title-3">{item.urgent ? "Urgent report" : "Symptom"}</p>
            <p className="caption-2">{new Date(item.createdAt).toLocaleString()} · patient report</p>
            <p className="body-6 mt-2">{item.text}</p>
          </article>
        ))}
      </Section>
      <Section title="To obtain or replace" empty="No open tasks.">
        {data.tasks.map((task) => (
          <article key={task.id} className="rounded-2xl border border-line bg-card p-4">
            <p className="title-3">{task.title}</p>
            <p className="caption-2">{task.kind.replaceAll("_", " ")} · {new Date(task.createdAt).toLocaleString()}</p>
          </article>
        ))}
      </Section>
      <Section title="Pharmacy" empty="No pharmacy call yet.">
        {data.pharmacy.map((item) => (
          <article key={item.id} className="rounded-2xl border border-line bg-card p-4">
            <p className="title-3">{item.decision.replaceAll("_", " ")}</p>
            <p className="caption-2">{new Date(item.createdAt).toLocaleString()} · pharmacist statement{item.priceText ? ` · ${item.priceText}` : ""}</p>
            <p className="body-6 mt-2">{item.statement}</p>
          </article>
        ))}
      </Section>
      <Section title="Activity" empty="Nothing has been recorded yet.">
        {data.activity.slice(0, 20).map((item) => (
          <article key={item.id} className="rounded-2xl border border-line bg-card p-4">
            <p className="title-3">{item.title}</p>
            <p className="caption-2">{new Date(item.createdAt).toLocaleString()} · {item.source.replaceAll("_", " ")} · {item.status.replaceAll("_", " ")}</p>
            <p className="body-6 mt-2">{item.detail}</p>
          </article>
        ))}
      </Section>
    </div>
  );
}

function outcomeBorder(outcome: string) {
  if (outcome === "on_plan" || outcome === "possible_match") return "border-forest";
  if (outcome === "not_on_plan") return "border-clay";
  if (outcome === "expired" || outcome === "candidate") return "border-amber";
  if (outcome === "missing") return "border-ink";
  return "border-line";
}

function OutcomeMark({ outcome }: { outcome: string }) {
  const common = { size: 28, "aria-hidden": true as const };
  if (outcome === "on_plan") return <CheckCircle {...common} />;
  if (outcome === "not_on_plan") return <Prohibit {...common} />;
  if (outcome === "expired") return <ClockCountdown {...common} />;
  if (outcome === "missing") return <MagnifyingGlass {...common} />;
  if (outcome === "possible_match") return <Pill {...common} />;
  if (outcome === "candidate") return <Translate {...common} />;
  return <Question {...common} />;
}

function Section({ title, empty, children }: { title: string; empty: string; children: ReactNode[] }) {
  return (
    <section>
      <h2 className="title-1">{title}</h2>
      {children.length === 0 ? <p className="body-6 mt-3">{empty}</p> : <div className="mt-3 flex flex-col gap-3">{children}</div>}
    </section>
  );
}
