"use client";

import { useEffect, useRef, useState } from "react";
import { CallScreen, type LiveCall } from "@/components/call-screen";
import { LAPTOP_SCENES, MEDICINE_SCENES, SCENE_ALT, SCENE_LABEL, SCENE_TITLE, type LaptopScene } from "@/lib/demo-scenes";

type DemoResult = {
  scene: string;
  simulated: true;
  title: string;
  lines: string[];
  image: string | null;
  spokenScript: string;
  pdf?: string;
};

const STAGE_SCENES: LaptopScene[] = [...MEDICINE_SCENES, "finish-cabinet", "obtain-cephalexin", "reminder"];

const card = "card";

function nextScene(done: string[], cabinetText: string): LaptopScene | null {
  for (const scene of LAPTOP_SCENES) {
    if (scene === "obtain-cephalexin" && !cabinetText.toLowerCase().includes("cephalexin")) continue;
    if (!done.includes(scene)) return scene;
  }
  return null;
}

function Spoken({ lines }: { lines?: string[] }) {
  if (!lines || lines.length === 0) return null;
  return (
    <div className="mt-4 flex flex-col gap-3" aria-live="polite">
      {lines.map((line, index) => (
        <p key={`${index}-${line.slice(0, 32)}`} className="type-body text-navy">
          {line}
        </p>
      ))}
    </div>
  );
}

export default function DemoPage() {
  const [done, setDone] = useState<string[]>([]);
  const [byScene, setByScene] = useState<Partial<Record<LaptopScene, DemoResult>>>({});
  const [stage, setStage] = useState<DemoResult | null>(null);
  const [restoredCabinet, setRestoredCabinet] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [call, setCall] = useState<LiveCall | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      const response = await fetch("/api/demo?call=1", { cache: "no-store" });
      if (!response.ok || stopped) return;
      const payload = (await response.json()) as { call?: LiveCall | null };
      setCall(payload.call ?? null);
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 800);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/demo", { cache: "no-store" });
      if (!response.ok || cancelled) return;
      const data = (await response.json()) as {
        activity?: { title: string; detail: string }[];
        checks?: { requestId?: string }[];
        tasks?: { title?: string; kind?: string }[];
      };
      const titles = new Set((data.activity ?? []).map((item) => item.title));
      const requestIds = new Set((data.checks ?? []).map((item) => item.requestId).filter((id): id is string => Boolean(id)));
      const finished = LAPTOP_SCENES.filter((scene) => titles.has(SCENE_TITLE[scene]) || requestIds.has(`demo:${scene}`));
      const obtain = (data.tasks ?? []).some((task) => task.kind === "obtain_missing" && /cephalexin/i.test(task.title ?? ""));
      if (obtain) finished.push("obtain-cephalexin");
      const cabinet = (data.activity ?? []).find((item) => item.title === SCENE_TITLE["finish-cabinet"]);
      if (cancelled) return;
      setDone((current) => Array.from(new Set([...finished, ...current])));
      if (cabinet?.detail) setRestoredCabinet(cabinet.detail);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cabinetText = `${byScene["finish-cabinet"]?.spokenScript ?? ""}\n${restoredCabinet}`;
  const recommended = nextScene(done, cabinetText);
  const showObtain = cabinetText.toLowerCase().includes("cephalexin");

  async function run(scene: LaptopScene) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scene }),
      });
      const payload = (await response.json()) as DemoResult & { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "That step did not run.");
        return;
      }
      setByScene((current) => ({ ...current, [scene]: payload }));
      setDone((current) => (current.includes(scene) ? current : [...current, scene]));
      if (STAGE_SCENES.includes(scene)) setStage(payload);
      await fetch("/api/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "show",
          caption: payload.spokenScript,
          image: payload.image,
          status: payload.image ? "Reading the label..." : "Speaking",
        }),
      });
    } catch {
      setError("That step did not run.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function buttonClass(scene: LaptopScene) {
    const yellow = call?.phase === "connected" && scene === recommended;
    return `flex min-h-16 w-full cursor-pointer items-center justify-center rounded-full px-6 py-3 text-center text-[20px] font-extrabold leading-6 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-not-allowed disabled:opacity-40 ${
      yellow ? "bg-yellow text-navy" : "bg-indigo text-white"
    }`;
  }

  return (
    <main id="content" className="family-screen min-h-dvh text-navy">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-5 py-6">
        <header>
          <p className="type-small uppercase text-indigo-light">Telenomily</p>
          <h1 className="type-title mt-1">Laptop</h1>
          <p className="type-family mt-2 max-w-3xl text-muted">Call Elena from here. Her phone rings, then this laptop sends each medicine onto the call.</p>
        </header>
        <section className={card}>
          <h2 className="type-heading">Call Elena</h2>
          {call ? (
            <div className="mt-4">
              <CallScreen contained call={call} onEnd={() => void fetch("/api/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "end" }) })} />
            </div>
          ) : (
            <button
              type="button"
              className="btn-main mt-4 max-w-md"
              onClick={() => void fetch("/api/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "ring" }) })}
            >
              Call Elena
            </button>
          )}
        </section>
        {error ? (
          <p className="rounded-3xl bg-[#EBEAFC] px-4 py-3 text-lg text-[#2F3273]" role="alert">
            {error}
          </p>
        ) : null}

        <section className={card}>
          <h2 className="text-2xl font-bold text-[#2F3273]">Open two screens</h2>
          <p className="mt-2 text-lg text-[#5F6296]">
            Elena&apos;s phone is the patient screen. Mateo&apos;s screen follows the same day and can join the call.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <a className="flex min-h-16 items-center justify-center rounded-full bg-[#4D50A2] px-6 text-center text-lg font-semibold text-white" href="/patient" target="_blank" rel="noopener noreferrer">
              Open Elena&apos;s screen
            </a>
            <a className="flex min-h-16 items-center justify-center rounded-full bg-[#4D50A2] px-6 text-center text-lg font-semibold text-white" href="/demo/family" target="_blank" rel="noopener noreferrer">
              Open Mateo&apos;s screen
            </a>
          </div>
        </section>

        <section className={card}>
          <h2 className="text-2xl font-bold text-[#2F3273]">Hospital sheet</h2>
          <p className="mt-2 text-lg leading-relaxed text-[#0F0E35]">
            This file is a blank hospital discharge form. The medication table is empty. No dose is read from it. Elena Vasquez&apos;s confirmed plan is the fictional schedule already loaded: lisinopril, acetaminophen as needed, cholecalciferol, cephalexin, and stopped aspirin.
          </p>
          <a className="mt-3 inline-flex text-lg font-semibold text-[#4D50A2] underline" href="/fixtures/DischargeSample.pdf" target="_blank" rel="noopener noreferrer">
            Open the blank discharge form
          </a>
          <iframe className="mt-4 h-[28rem] w-full rounded-3xl border border-[#EBEAFC] bg-white" src="/fixtures/DischargeSample.pdf" title="Blank hospital discharge form" />
          <button className={`mt-4 ${buttonClass("discharge")}`} type="button" disabled={busy} onClick={() => void run("discharge")}>
            {recommended === "discharge" ? <span className="sr-only">Next step. </span> : null}
            {SCENE_LABEL.discharge}
          </button>
          <Spoken lines={byScene.discharge?.lines} />
        </section>

        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-[#2F3273]">Simulated video call</h2>
            {stage ? <span className="rounded-full bg-[#EBEAFC] px-4 py-1 text-sm font-semibold text-[#4D50A2]">Speaking</span> : null}
          </div>
          <div className="mt-4 overflow-hidden rounded-3xl bg-[#F6F6FE]">
            {stage?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={stage.image} alt={SCENE_ALT[stage.scene as LaptopScene] || "Illustrative package drawing"} className="max-h-80 w-full object-contain" />
            ) : (
              <p className="px-4 py-10 text-center text-lg text-[#5F6296]">
                {stage ? "No package drawing is on screen for this step." : "The simulated call has not started."}
              </p>
            )}
          </div>
          <p className="mt-2 text-sm text-[#5F6296]">Illustrative drawings. Cephalexin has no picture, so the cabinet scan can report it missing.</p>
          <Spoken lines={stage?.lines} />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {MEDICINE_SCENES.map((scene) => (
              <button key={scene} className={buttonClass(scene)} type="button" disabled={busy} onClick={() => void run(scene)}>
                {recommended === scene ? <span className="sr-only">Next step. </span> : null}
                {SCENE_LABEL[scene]}
              </button>
            ))}
          </div>
        </section>

        <section className={card}>
          <h2 className="text-2xl font-bold text-[#2F3273]">Cabinet</h2>
          <p className="mt-2 text-lg text-[#5F6296]">
            Finish the scan when the packages above have been shown. Acetaminophen is as needed and has no drawing. Cephalexin has no drawing. A shopping task is added only when you confirm cephalexin is needed.
          </p>
          <button className={`mt-4 ${buttonClass("finish-cabinet")}`} type="button" disabled={busy} onClick={() => void run("finish-cabinet")}>
            {recommended === "finish-cabinet" ? <span className="sr-only">Next step. </span> : null}
            {SCENE_LABEL["finish-cabinet"]}
          </button>
          <Spoken lines={byScene["finish-cabinet"]?.lines} />
          {showObtain ? (
            <button className={`mt-4 ${buttonClass("obtain-cephalexin")}`} type="button" disabled={busy} onClick={() => void run("obtain-cephalexin")}>
              {recommended === "obtain-cephalexin" ? <span className="sr-only">Next step. </span> : null}
              {SCENE_LABEL["obtain-cephalexin"]}
            </button>
          ) : null}
          <Spoken lines={byScene["obtain-cephalexin"]?.lines} />
        </section>

        <section className={card}>
          <h2 className="text-2xl font-bold text-[#2F3273]">Pharmacy</h2>
          <p className="mt-2 text-lg text-[#5F6296]">The pharmacy answer plays on the call. The price is marked demo data. The plan stays as loaded.</p>
          <button className={`mt-4 ${buttonClass("pharmacy")}`} type="button" disabled={busy} onClick={() => void run("pharmacy")}>
            {recommended === "pharmacy" ? <span className="sr-only">Next step. </span> : null}
            {SCENE_LABEL.pharmacy}
          </button>
          {byScene.pharmacy ? <p className="mt-4 text-xl font-semibold text-[#2F3273]">$4.37 demo data. The plan was not changed.</p> : null}
          <Spoken lines={byScene.pharmacy?.lines} />
        </section>

        <section className={card}>
          <h2 className="text-2xl font-bold text-[#2F3273]">Reminder</h2>
          <p className="mt-2 text-lg text-[#5F6296]">Elena hears the reminder on the call. Her dose and how she feels show up for Mateo.</p>
          <button className={`mt-4 ${buttonClass("reminder")}`} type="button" disabled={busy} onClick={() => void run("reminder")}>
            {recommended === "reminder" ? <span className="sr-only">Next step. </span> : null}
            {SCENE_LABEL.reminder}
          </button>
          <Spoken lines={byScene.reminder?.lines} />
        </section>
      </div>
    </main>
  );
}
