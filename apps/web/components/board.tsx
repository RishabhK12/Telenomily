"use client";

import { Basket, Bell, Calendar, CalendarX, CheckCircle, Heartbeat, House, Package, Pill, Prohibit, Question, SignOut, Translate, Users } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PatientNav } from "./patient-nav";

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

const chipStyle: Record<string, string> = {
  on_plan: "bg-on-plan-bg text-on-plan",
  possible_match: "bg-on-plan-bg text-on-plan",
  not_on_plan: "bg-off-plan-bg text-off-plan",
  expired: "bg-expired-bg text-expired",
  candidate: "bg-expired-bg text-expired",
  missing: "bg-missing-bg text-missing",
  cant_confirm: "bg-unsure-bg text-unsure",
};

export function Board({ initial, audience, pollPath = "/api/care" }: { initial: BoardData; audience: "patient" | "family"; pollPath?: string }) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState(false);
  const [note, setNote] = useState("");
  const router = useRouter();
  useEffect(() => {
    const tick = async () => {
      const response = await fetch(pollPath);
      if (response.ok) setData((await response.json()) as BoardData);
    };
    const timer = window.setInterval(() => void tick(), 3000);
    const onFocus = () => void tick();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [pollPath]);

  async function signOut() {
    await fetch("/api/care", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "sign-out" }) });
    router.push("/login");
    router.refresh();
  }

  async function join() {
    if (data.activeRoom?.livekitRoom === "telenomily-demo") {
      router.push("/family/call");
      return;
    }
    const response = await fetch("/api/care", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "join-room" }) });
    const payload = (await response.json()) as { error?: string; token?: string; url?: string; roomName?: string };
    if (!response.ok || !payload.token) {
      setError(payload.error ?? "The room could not be joined.");
      return;
    }
    sessionStorage.setItem("telenomily-room", JSON.stringify(payload));
    router.push("/family/call");
  }

  if (audience === "patient") {
    return <PatientToday data={data} error={error} note={note} menu={menu} setMenu={setMenu} setNote={setNote} setError={setError} signOut={signOut} />;
  }
  return <FamilyHome data={data} error={error} onJoin={() => void join()} onSignOut={() => void signOut()} />;
}

function PatientToday({
  data, error, note, menu, setMenu, setNote, setError, signOut,
}: {
  data: BoardData;
  error: string;
  note: string;
  menu: boolean;
  setMenu: (value: boolean) => void;
  setNote: (value: string) => void;
  setError: (value: string) => void;
  signOut: () => Promise<void>;
}) {
  const pending = useMemo(() => data.doses.filter((dose) => dose.state === "pending"), [data.doses]);
  const [index, setIndex] = useState(0);
  const current = pending[index] ?? null;
  const dateLabel = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date()).toUpperCase();

  async function report(state: "reported_taken" | "reported_not_taken") {
    if (!current) return;
    setError("");
    const response = await fetch("/api/care", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "report-dose", occurrenceId: current.id, state }),
    });
    const payload = (await response.json()) as { spokenScript?: string; error?: string };
    if (!response.ok) {
      setError(payload.error ?? "That dose could not be saved.");
      return;
    }
    setNote(payload.spokenScript ?? "Saved.");
    setIndex(0);
  }

  return (
    <div className="patient-screen">
      <main id="content" className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-5 pb-36 pt-[max(16px,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between">
          <button type="button" className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-lifted" aria-expanded={menu} aria-label="Menu" onClick={() => setMenu(!menu)}>
            <SignOut size={28} color="#FFFFFF" aria-hidden />
          </button>
          <p className="type-label text-white">{data.productName}</p>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-lifted" aria-label="Family can follow along">
            <Users size={28} color="#FFFFFF" aria-hidden />
          </span>
        </header>
        {menu ? (
          <button type="button" className="btn-secondary mt-4" onClick={() => void signOut()}>Sign out</button>
        ) : null}
        <h1 className="type-title mt-6 text-center text-white">Today&apos;s medicine</h1>
        <p className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-indigo-pressed px-4 py-2 type-label text-white">
          <Calendar size={22} weight="fill" color="#F9DF77" aria-hidden />
          {dateLabel}
        </p>
        {error ? <p className="mt-4 text-center type-body text-yellow" role="alert">{error}</p> : null}
        {note ? <p className="mt-4 text-center type-body text-white" role="status">{note}</p> : null}
        <div className="mt-8 flex items-center gap-3">
          <button type="button" className="btn-secondary h-14 w-14 shrink-0" aria-label="Previous dose" onClick={() => setIndex((value) => Math.max(0, value - 1))}>←</button>
          <article className="card-main flex-1 text-center">
            {current ? (
              <>
                <p className="type-time">{new Date(current.scheduledFor).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
                <div className="mx-auto mt-4 flex h-40 w-40 items-center justify-center rounded-full bg-lavender">
                  <Pill size={72} weight="fill" color="#4D50A2" aria-hidden />
                </div>
                <h2 className="type-medicine mt-4">{current.medicationName}</h2>
                <p className="type-body mt-2">{current.instructions}</p>
              </>
            ) : (
              <>
                <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-on-plan-bg">
                  <CheckCircle size={72} weight="fill" color="#176B52" aria-hidden />
                </div>
                <h2 className="type-medicine mt-4">All done for today</h2>
                <p className="type-body mt-2">{data.checkIn.completed} of {data.checkIn.scheduled} doses reported.</p>
                <p className="type-label mt-2 text-muted">{data.checkIn.explanation}</p>
              </>
            )}
          </article>
          <button type="button" className="btn-secondary h-14 w-14 shrink-0" aria-label="Next dose" onClick={() => setIndex((value) => Math.min(Math.max(pending.length - 1, 0), value + 1))}>→</button>
        </div>
        {data.asNeeded[0] ? <p className="mt-6 text-center type-label text-white">As needed: {data.asNeeded[0].name}. Not a daily dose.</p> : null}
        {current ? (
          <div className="mt-6 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <button type="button" className="btn-secondary" onClick={() => void report("reported_not_taken")}>Skip</button>
              <button type="button" className="btn-secondary" onClick={() => setIndex((value) => Math.min(pending.length - 1, value + 1))}>Later</button>
            </div>
            <button type="button" className="btn-main" onClick={() => void report("reported_taken")}>Take now</button>
          </div>
        ) : null}
      </main>
      <PatientNav active="today" />
    </div>
  );
}

function FamilyHome({ data, error, onJoin, onSignOut }: { data: BoardData; error: string; onJoin: () => void; onSignOut: () => void }) {
  return (
    <div className="family-screen">
      <main id="content" className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 py-6 pb-28">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-lavender">
              <Users size={28} color="#4D50A2" aria-hidden />
            </span>
            <div>
              <p className="type-small text-muted">{data.productName}</p>
              <h1 className="type-heading">{data.patient.preferredName}</h1>
              <p className="type-family text-muted">{data.activeRoom ? "Live" : "Following along"}</p>
            </div>
          </div>
          <button type="button" className="btn-quiet" onClick={onSignOut}>Sign out</button>
        </header>
        {error ? <p className="type-family text-off-plan" role="alert">{error}</p> : null}
        <section className="card">
          <h2 className="type-heading">Alerts</h2>
          {data.alerts.length === 0 ? <p className="type-family mt-2">No alerts right now.</p> : data.alerts.map((item) => (
            <article key={item.id} className="mt-3 rounded-3xl bg-off-plan-bg p-4">
              <p className="type-label text-off-plan">{item.status === "urgent" ? "Urgent" : "Alert"}</p>
              <p className="type-family mt-1">{spoken(item.detail)}</p>
            </article>
          ))}
        </section>
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="card lg:col-span-1">
            <h2 className="type-heading">Today&apos;s doses</h2>
            <p className="type-small mt-2 text-muted">{data.checkIn.completed} of {data.checkIn.scheduled} reported. {data.checkIn.explanation}</p>
            <ul className="mt-4 flex flex-col gap-3">
              {data.doses.map((dose) => (
                <li key={dose.id} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="type-label">{dose.medicationName}</p>
                    <p className="type-small text-muted">{new Date(dose.scheduledFor).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
                  </div>
                  <span className="rounded-full bg-lavender px-3 py-1 type-small text-indigo">{dose.state.replaceAll("_", " ")}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="card">
            <h2 className="flex items-center gap-2 type-heading"><Heartbeat size={24} aria-hidden /> Symptoms</h2>
            {data.symptoms.length === 0 ? <p className="type-family mt-2">No symptoms reported.</p> : data.symptoms.map((item) => (
              <article key={item.id} className="mt-3">
                <p className="type-family">{item.text}</p>
                <p className="type-small text-muted">{new Date(item.createdAt).toLocaleString()} · patient report{item.urgent ? " · Urgent" : ""}</p>
              </article>
            ))}
          </section>
          <section className="card">
            <h2 className="type-heading">Medicine checks</h2>
            {data.checks.length === 0 ? <p className="type-family mt-2">No checks yet.</p> : data.checks.slice(0, 6).map((check) => (
              <article key={check.id} className="mt-3">
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 type-small ${chipStyle[check.outcome] ?? "bg-unsure-bg text-unsure"}`}>
                  <OutcomeMark outcome={check.outcome} />
                  {outcomeText(check.outcome)}
                </span>
                <p className="type-family mt-2">{spoken(check.spokenScript)}</p>
                <p className="type-small text-muted">{new Date(check.createdAt).toLocaleString()} · {sourceLabel(check.source)}</p>
              </article>
            ))}
          </section>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card">
            <h2 className="flex items-center gap-2 type-heading"><Basket size={24} aria-hidden /> To obtain</h2>
            {data.tasks.length === 0 ? <p className="type-family mt-2">No open tasks.</p> : data.tasks.map((task) => (
              <p key={task.id} className="type-family mt-3">{task.title} <span className="type-small text-muted">{task.kind.replaceAll("_", " ")} · {new Date(task.createdAt).toLocaleString()}</span></p>
            ))}
          </section>
          <section className="card">
            <h2 className="flex items-center gap-2 type-heading"><House size={24} aria-hidden /> Pharmacy</h2>
            {data.pharmacy.length === 0 ? <p className="type-family mt-2">No pharmacy update yet.</p> : data.pharmacy.map((item) => (
              <article key={item.id} className="mt-3">
                <p className="type-label">{item.decision.replaceAll("_", " ")}{item.priceText ? ` · ${item.priceText}` : ""}</p>
                <p className="type-family mt-1">{item.statement}</p>
                <p className="type-small text-muted">{new Date(item.createdAt).toLocaleString()} · pharmacist statement</p>
              </article>
            ))}
          </section>
        </div>
        <section className="card">
          <h2 className="flex items-center gap-2 type-heading"><Bell size={24} aria-hidden /> Activity</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {data.activity.slice(0, 12).map((item) => (
              <li key={item.id} className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lavender text-indigo">
                  <Package size={20} aria-hidden />
                </span>
                <div>
                  <p className="type-family">{item.title.replace(/^Demo simulation:\s*/i, "")}</p>
                  <p className="type-small text-muted">{new Date(item.createdAt).toLocaleString()} · {sourceLabel(item.source)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
      {data.activeRoom ? (
        <div className="fixed inset-x-0 bottom-0 z-20 px-5 pb-[max(12px,env(safe-area-inset-bottom))]">
          <button type="button" className="btn-main mx-auto max-w-[480px] shadow-high" onClick={onJoin}>Join call</button>
        </div>
      ) : null}
    </div>
  );
}

function sourceLabel(source: string) {
  if (source === "demo_simulation") return "Telenomily";
  return source.replaceAll("_", " ");
}

function spoken(text: string) {
  return text
    .replace(/^Demo simulation\.\s*/gim, "")
    .replaceAll("The phone did not ring. This is not a live Grok video call.", "")
    .trim();
}

function OutcomeMark({ outcome }: { outcome: string }) {
  const common = { size: 18, "aria-hidden": true as const };
  if (outcome === "on_plan") return <CheckCircle {...common} />;
  if (outcome === "not_on_plan") return <Prohibit {...common} />;
  if (outcome === "expired") return <CalendarX {...common} />;
  if (outcome === "missing") return <Package {...common} />;
  if (outcome === "possible_match") return <Pill {...common} />;
  if (outcome === "candidate") return <Translate {...common} />;
  return <Question {...common} />;
}
