"use client";

import { Room, RoomEvent, Track, type TranscriptionSegment } from "livekit-client";
import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "connecting" | "live" | "reconnecting" | "ended" | "blocked";

export function MedicineCall() {
  const roomRef = useRef<Room | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [captionOn, setCaptionOn] = useState(true);
  const [caption, setCaption] = useState("");
  const [speakers, setSpeakers] = useState("Waiting");
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState("");

  useEffect(() => {
    return () => {
      void roomRef.current?.disconnect();
    };
  }, []);

  async function start() {
    setError("");
    setPhase("connecting");
    const response = await fetch("/api/care", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "start-room" }) });
    const payload = (await response.json()) as { error?: string; token?: string; url?: string; roomName?: string };
    if (!response.ok || !payload.token || !payload.url) {
      setPhase("blocked");
      setError(payload.error ?? "The medicine check could not start.");
      return;
    }
    const room = new Room();
    roomRef.current = room;
    room.on(RoomEvent.Reconnecting, () => setPhase("reconnecting"));
    room.on(RoomEvent.Reconnected, () => setPhase("live"));
    room.on(RoomEvent.Disconnected, () => setPhase("ended"));
    room.on(RoomEvent.ActiveSpeakersChanged, (list) => {
      setSpeakers(list.length ? list.map((speaker) => speaker.name || speaker.identity).join(", ") : "Listening");
    });
    room.on(RoomEvent.TranscriptionReceived, (segments: TranscriptionSegment[]) => {
      setCaption(segments.map((segment) => segment.text).join(" "));
    });
    room.on(RoomEvent.DataReceived, (data) => {
      void handleData(room, data);
    });
    try {
      await room.connect(payload.url, payload.token);
      await room.startAudio();
      await room.localParticipant.setMicrophoneEnabled(true);
      await room.localParticipant.setCameraEnabled(true);
      const publication = room.localParticipant.getTrackPublication(Track.Source.Camera);
      if (publication?.track && videoRef.current) publication.track.attach(videoRef.current);
      setPhase("live");
    } catch (cause) {
      setPhase("blocked");
      const name = cause instanceof Error ? cause.name : "";
      setError(name === "NotAllowedError" ? "Camera or microphone permission was denied. Allow both in the browser settings, then start the medicine check again." : "The room could not connect. Check the network and try again.");
    }
  }

  async function handleData(room: Room, data: Uint8Array) {
    const message = JSON.parse(new TextDecoder().decode(data)) as { type?: string; requestId?: string; kind?: string };
    if (message.type !== "capture_request" || !message.requestId) return;
    setProgress("Taking a still frame.");
    const publication = room.localParticipant.getTrackPublication(Track.Source.Camera);
    const media = publication?.track?.mediaStreamTrack;
    if (!media || !videoRef.current) {
      setProgress("The camera is off. Turn it on and show the label.");
      return;
    }
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) return;
    const form = new FormData();
    form.set("action", "check");
    form.set("file", blob, "frame.jpg");
    form.set("requestId", message.requestId);
    form.set("kind", message.kind || "package");
    form.set("capturedAt", new Date().toISOString());
    const response = await fetch("/api/care", { method: "POST", body: form });
    const saved = (await response.json()) as { spokenScript?: string; error?: string };
    setProgress(response.ok ? "Result saved." : saved.error ?? "The check failed.");
    setResult(saved.spokenScript ?? "");
    const packet = new TextEncoder().encode(JSON.stringify({ type: "capture_result", requestId: message.requestId, spokenScript: saved.spokenScript ?? saved.error }));
    await room.localParticipant.publishData(packet, { reliable: true });
  }

  async function switchCamera() {
    const room = roomRef.current;
    if (!room) return;
    const devices = await Room.getLocalDevices("videoinput");
    const current = room.getActiveDevice("videoinput");
    const next = devices.find((device) => device.deviceId !== current) ?? devices[0];
    if (next) await room.switchActiveDevice("videoinput", next.deviceId);
  }

  async function endCall() {
    await fetch("/api/care", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "end-room" }) });
    await roomRef.current?.disconnect();
    setPhase("ended");
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <a href="/patient" className="caption-2">Back to today</a>
      <h1 className="heading-4">Medicine check</h1>
      <p className="body-6">You can talk. You do not need to type. Show one package when asked.</p>
      {phase === "idle" || phase === "blocked" || phase === "ended" ? (
        <button type="button" className="button-xl min-h-16 rounded-2xl bg-forest px-6 py-4 text-paper" onClick={() => void start()}>Start medicine check</button>
      ) : null}
      <p className="title-3" aria-live="polite">{phase === "live" ? speakers : phase === "connecting" ? "Connecting" : phase === "reconnecting" ? "Reconnecting" : phase === "ended" ? "Call ended" : "Ready"}</p>
      {error ? <p className="body-6 text-clay" role="alert">{error}</p> : null}
      {progress ? <p className="body-6">{progress}</p> : null}
      <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full rounded-2xl bg-ink object-cover" />
      {captionOn ? <p className="body-3 min-h-12 rounded-2xl border border-line bg-card p-4">{caption || "Captions appear here when someone speaks."}</p> : null}
      {result ? <p className="body-6">{result}</p> : null}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" className="button-lg min-h-12 rounded-2xl border border-ink" onClick={() => void roomRef.current?.localParticipant.setMicrophoneEnabled(muted).then(() => setMuted((value) => !value))}>{muted ? "Unmute" : "Mute"}</button>
        <button type="button" className="button-lg min-h-12 rounded-2xl border border-ink" onClick={() => void switchCamera()}>Switch camera</button>
        <button type="button" className="button-lg min-h-12 rounded-2xl border border-ink" onClick={() => setCaptionOn((value) => !value)}>{captionOn ? "Hide captions" : "Show captions"}</button>
        <button type="button" className="button-lg min-h-12 rounded-2xl bg-clay text-paper" onClick={() => void endCall()}>End call</button>
      </div>
      <StillCheck />
    </div>
  );
}

function StillCheck() {
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState("package");
  const [missing, setMissing] = useState<{ id: string; name: string }[]>([]);
  return (
    <form
      className="mt-6 flex flex-col gap-3 rounded-2xl border border-line bg-card p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        form.set("action", "check");
        form.set("kind", kind);
        form.set("requestId", crypto.randomUUID());
        const response = await fetch("/api/care", { method: "POST", body: form });
        const payload = (await response.json()) as { spokenScript?: string; error?: string };
        setMessage(payload.spokenScript ?? payload.error ?? "The check failed.");
      }}
    >
      <h2 className="title-2">Check a still photo</h2>
      <p className="caption-2">This uses the same saved result as the call. It does not start a phone call. Speech happens when the live room is open.</p>
      <label className="title-3">What are you showing?
        <select className="mt-2 block min-h-12 w-full rounded-xl border border-line px-3" value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="package">Package</option>
          <option value="pill">Loose pill</option>
          <option value="foreign">Foreign language box</option>
        </select>
      </label>
      <input name="file" type="file" accept="image/*" capture="environment" required className="body-6" />
      <button className="button-lg min-h-12 rounded-2xl bg-ink px-4 py-3 text-paper">Check this photo</button>
      {message ? <p className="body-6">{message}</p> : null}
      <button
        type="button"
        className="button-lg min-h-12 rounded-2xl border border-ink px-4 py-3"
        onClick={async () => {
          const response = await fetch("/api/care", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "finish-cabinet" }) });
          const payload = (await response.json()) as { spokenScript?: string; error?: string; missing?: { id: string; name: string }[] };
          setMessage(payload.spokenScript ?? payload.error ?? "The cabinet scan could not be finished.");
          setMissing(payload.missing ?? []);
        }}
      >
        Finish cabinet scan
      </button>
      {missing.map((item) => (
        <button
          key={item.id}
          type="button"
          className="button-md min-h-12 rounded-2xl border border-ink px-3 py-2 text-left"
          onClick={async () => {
            const response = await fetch("/api/care", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "confirm-obtain", medicationId: item.id }) });
            const payload = (await response.json()) as { spokenScript?: string; error?: string };
            setMessage(payload.spokenScript ?? payload.error ?? "The task could not be saved.");
          }}
        >
          I need to obtain {item.name}
        </button>
      ))}
    </form>
  );
}

export function FamilyCall({ initial }: { initial: { token: string; url: string } | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(initial ? "" : "Join from the family dashboard when a call is open.");
  const [caption, setCaption] = useState("");
  useEffect(() => {
    if (!initial) return;
    const room = new Room();
    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Video && videoRef.current) track.attach(videoRef.current);
    });
    room.on(RoomEvent.TranscriptionReceived, (segments: TranscriptionSegment[]) => setCaption(segments.map((segment) => segment.text).join(" ")));
    void room.connect(initial.url, initial.token).then(() => room.startAudio()).catch(() => setError("The call could not connect. Allow microphone access and try Join again."));
    void room.localParticipant.setMicrophoneEnabled(true);
    return () => {
      void room.disconnect();
    };
  }, [initial]);
  return (
    <main id="content" className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <a href="/family" className="caption-2">Back to the dashboard</a>
      <h1 className="heading-5">Family call</h1>
      {error ? <p className="body-6 text-clay" role="alert">{error}</p> : null}
      <video ref={videoRef} autoPlay playsInline className="aspect-video w-full rounded-2xl bg-ink" />
      <p className="body-6 min-h-12 rounded-2xl border border-line bg-card p-4">{caption || "Captions appear when the room sends them."}</p>
    </main>
  );
}
