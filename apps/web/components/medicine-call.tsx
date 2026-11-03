"use client";

import { Room, RoomEvent, Track, type TranscriptionSegment } from "livekit-client";
import { useEffect, useRef, useState } from "react";
import { activeFacing, attachCamera, cameraErrorMessage, flipPhoneCamera, prepareVideo, pushCameraFrame, requestPhoneCamera, stopCamera, type CameraFacing } from "./open-camera";

type Phase = "idle" | "connecting" | "live" | "reconnecting" | "ended" | "blocked";

export function MedicineCall() {
  const roomRef = useRef<Room | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const facingRef = useRef<CameraFacing>("environment");
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

  useEffect(() => {
    if (phase !== "live" && phase !== "connecting") return;
    const timer = window.setInterval(() => {
      const video = videoRef.current;
      if (video) pushCameraFrame(video);
    }, 400);
    return () => window.clearInterval(timer);
  }, [phase]);

  function showCamera(facing: CameraFacing) {
    const video = videoRef.current;
    if (video) {
      prepareVideo(video);
      void video.play().catch(() => undefined);
    }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setPhase("blocked");
      setError(cameraErrorMessage(new DOMException("Camera needs a secure page.", "SecurityError")));
      return;
    }
    setError("Asking for your camera...");
    setPhase("connecting");
    const pending = requestPhoneCamera(facing);
    void pending.then((stream) => {
      facingRef.current = facing;
      const video = videoRef.current;
      if (video) attachCamera(video, stream);
      setError("");
      void continueAfterCamera();
    }).catch((cause: unknown) => {
      setPhase("blocked");
      setError(cameraErrorMessage(cause));
    });
  }

  async function start() {
    showCamera(facingRef.current);
  }

  async function continueAfterCamera() {
    const response = await fetch("/api/care", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "start-room" }) });
    const payload = (await response.json()) as { error?: string; token?: string; url?: string; roomName?: string };
    if (!response.ok || !payload.token || !payload.url) {
      if (payload.error?.toLowerCase().includes("rehearsal")) {
        setPhase("live");
        setCaption("Show me a medicine and ask me anything.");
        return;
      }
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
    if (!roomRef.current) {
      const video = videoRef.current;
      if (video) prepareVideo(video);
      try {
        const stream = await flipPhoneCamera();
        facingRef.current = activeFacing();
        if (video) attachCamera(video, stream);
        setError("");
      } catch (cause) {
        setError(cameraErrorMessage(cause));
      }
      return;
    }
    const room = roomRef.current;
    if (!room) return;
    const devices = await Room.getLocalDevices("videoinput");
    const current = room.getActiveDevice("videoinput");
    const next = devices.find((device) => device.deviceId !== current) ?? devices[0];
    if (next) await room.switchActiveDevice("videoinput", next.deviceId);
  }

  async function endCall() {
    await fetch("/api/care", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "end-room" }) });
    stopCamera();
    if (videoRef.current) videoRef.current.srcObject = null;
    await roomRef.current?.disconnect();
    setPhase("ended");
  }

  const status = phase === "connecting" ? "Connecting..." : phase === "reconnecting" ? "Reconnecting..." : progress ? "Reading the label..." : phase === "live" ? (speakers === "Listening" || speakers === "Waiting" ? "I'm listening" : "Speaking") : phase === "ended" ? "Call ended" : "Ready when you are";

  return (
    <div className="relative min-h-dvh bg-night text-white">
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 z-0 h-full w-full bg-black object-cover" />
      <div className="relative z-10 flex min-h-dvh flex-col">
        <header className="flex items-center justify-between px-5 pt-[max(16px,env(safe-area-inset-top))]">
          <p className="rounded-full bg-night/80 px-4 py-2 type-label" aria-live="polite">{status}</p>
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-lavender text-indigo type-small">AI</span>
        </header>
        <div className="mx-auto mt-16 grid h-56 w-56 grid-cols-2 gap-24" aria-hidden>
          <span className="rounded-tl-3xl border-l-4 border-t-4 border-yellow" />
          <span className="rounded-tr-3xl border-r-4 border-t-4 border-yellow" />
          <span className="rounded-bl-3xl border-b-4 border-l-4 border-yellow" />
          <span className="rounded-br-3xl border-b-4 border-r-4 border-yellow" />
        </div>
        <p className="mt-4 text-center type-label">Hold the box here</p>
        <div className="mt-auto camera-fade px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-16">
          {error ? <p className="type-body text-yellow" role="alert">{error}</p> : null}
          {captionOn ? <p className="type-caption max-h-32 overflow-hidden text-white">{caption || result || "Show me a medicine and ask me anything."}</p> : null}
          {phase === "idle" || phase === "blocked" || phase === "ended" ? (
            <button type="button" className="btn-main mt-4" onClick={() => void start()}>Allow camera</button>
          ) : (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <button type="button" className="btn-secondary" aria-label={muted ? "Unmute microphone" : "Mute microphone"} onClick={() => void roomRef.current?.localParticipant.setMicrophoneEnabled(muted).then(() => setMuted((value) => !value))}>{muted ? "Unmute" : "Mute"}</button>
              <button type="button" className="btn-secondary" onClick={() => void switchCamera()}>Flip</button>
              <button type="button" className="btn-danger" onClick={() => void endCall()}>End call</button>
            </div>
          )}
          {phase !== "live" && phase !== "connecting" ? <StillCheck /> : null}
        </div>
      </div>
    </div>
  );
}

function StillCheck() {
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState("package");
  const [missing, setMissing] = useState<{ id: string; name: string }[]>([]);
  return (
    <form
      className="mt-4 flex flex-col gap-3 rounded-3xl bg-white p-4 text-navy"
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
      <h2 className="type-heading">Check a still photo</h2>
      <p className="type-family text-muted">Same saved result as the call. This does not start a phone call.</p>
      <label className="type-label">What are you showing?
        <select className="mt-2 block min-h-14 w-full rounded-full border border-lavender px-4 text-navy" value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="package">Package</option>
          <option value="pill">Loose pill</option>
          <option value="foreign">Foreign language box</option>
        </select>
      </label>
      <input name="file" type="file" accept="image/*" capture="environment" required className="type-family" />
      <button className="btn-secondary">Check this photo</button>
      {message ? <p className="type-body">{message}</p> : null}
      <button
        type="button"
        className="btn-quiet"
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
          className="btn-quiet text-left"
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
    <main id="content" className="relative min-h-dvh bg-night text-white">
      <video ref={videoRef} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />
      <div className="relative z-10 flex min-h-dvh flex-col justify-end camera-fade p-5">
        <a href="/family" className="type-label text-white">Back</a>
        <h1 className="type-heading mt-2">Family call</h1>
        {error ? <p className="type-body text-yellow" role="alert">{error}</p> : null}
        <p className="type-caption mt-4">{caption || "Captions appear when someone speaks."}</p>
      </div>
    </main>
  );
}
