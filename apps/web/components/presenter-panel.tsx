"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type Feed = {
  calls: { id: string; purpose: string; status: string; createdAt: string; summary: string | null }[];
  activity: { id: string; title: string; detail: string; status: string; createdAt: string; source: string }[];
};

export function PresenterPanel({ readiness }: { readiness: { name: string; ready: boolean; missing: string[] }[] }) {
  const [code, setCode] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [feed, setFeed] = useState<Feed>({ calls: [], activity: [] });
  const [invite, setInvite] = useState("");

  async function send(body: Record<string, unknown>) {
    const response = await fetch("/api/care", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload = (await response.json()) as { error?: string; url?: string };
    if (!response.ok) {
      setError(payload.error ?? "That action failed.");
      return payload;
    }
    setError("");
    return payload;
  }

  useEffect(() => {
    if (!open) return;
    const tick = () => void send({ action: "feed" }).then((payload) => {
      if (payload && "calls" in payload) setFeed(payload as Feed);
    });
    tick();
    const timer = window.setInterval(tick, 3000);
    return () => window.clearInterval(timer);
  }, [open]);

  if (!open) {
    return (
      <form
        className="flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const payload = await send({ action: "presenter-login", code });
          if (payload && !("error" in payload && payload.error)) setOpen(true);
        }}
      >
        <label className="title-3">Presenter code
          <input className="mt-2 block min-h-12 w-full rounded-xl border border-line px-3" value={code} onChange={(event) => setCode(event.target.value)} type="password" />
        </label>
        <button className="button-lg min-h-12 rounded-2xl bg-ink px-4 py-3 text-paper">Open presenter panel</button>
        {error ? <p className="body-6 text-clay" role="alert">{error}</p> : null}
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="title-1">Integration readiness</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {readiness.map((item) => (
            <li key={item.name} className="rounded-2xl border border-line bg-card p-3">
              <p className="title-3">{item.name}: {item.ready ? "Ready" : "Missing setup"}</p>
              {item.missing.length > 0 ? <p className="caption-2">{item.missing.join(", ")}</p> : null}
            </li>
          ))}
        </ul>
      </section>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="button-md rounded-xl border border-ink px-3 py-2" onClick={() => void send({ action: "reset" })}>Reset demo</button>
        <button type="button" className="button-md rounded-xl border border-ink px-3 py-2" onClick={() => void send({ action: "call", purpose: "reminder", idempotencyKey: crypto.randomUUID() })}>Start patient reminder call</button>
        <button type="button" className="button-md rounded-xl border border-ink px-3 py-2" onClick={() => void send({ action: "call", purpose: "pharmacy", idempotencyKey: crypto.randomUUID() })}>Start pharmacy call</button>
        <a className="button-md rounded-xl border border-ink px-3 py-2" href="/family">Open demo dashboard</a>
        <button type="button" className="button-md rounded-xl bg-ink px-3 py-2 text-paper" onClick={() => void send({ action: "invite" }).then((payload) => payload.url && setInvite(payload.url))}>Display judge QR code</button>
      </div>
      {error ? <p className="body-6 text-clay" role="alert">{error}</p> : null}
      {invite ? (
        <section className="rounded-2xl border border-line bg-card p-4">
          <h2 className="title-2">Judge QR code</h2>
          <p className="caption-2">One use. Expires in two hours. It opens only the fictional demo family view.</p>
          <div className="mt-4 bg-paper p-4">
            <QRCodeSVG value={invite} size={220} />
          </div>
        </section>
      ) : null}
      <section>
        <h2 className="title-1">Calls and events</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {feed.calls.map((call) => (
            <li key={call.id} className="rounded-2xl border border-line p-3">
              <p className="title-3">{call.purpose} · {call.status}</p>
              <p className="caption-2">{new Date(call.createdAt).toLocaleString()}</p>
              {call.summary ? <p className="body-6">{call.summary}</p> : null}
            </li>
          ))}
          {feed.activity.slice(0, 12).map((item) => (
            <li key={item.id} className="rounded-2xl border border-line p-3">
              <p className="title-3">{item.title}</p>
              <p className="caption-2">{item.source.replaceAll("_", " ")} · {item.status.replaceAll("_", " ")} · {new Date(item.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="title-2">Pharmacy lines for the teammate</h2>
        <p className="body-6 mt-2">This is the seeded scenario to say aloud. It is not injected as a result. The call still has to hear it.</p>
        <p className="body-6 mt-2">The prescribed 500 mg tablet is out of stock. DemoGen acetaminophen 500 mg tablets are available. The price is 4 dollars and 37 cents.</p>
      </section>
    </div>
  );
}
