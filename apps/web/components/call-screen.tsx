"use client";

import { useEffect, useRef, useState } from "react";
import { activeFacing, attachCamera, cameraErrorMessage, flipPhoneCamera, liveCamera, prepareVideo, pushCameraFrame, requestPhoneCamera, type CameraFacing } from "./open-camera";

export type LiveCall = {
  phase: "ringing" | "connected";
  startedAt: string;
  ringUntil: string;
  answeredAt: string | null;
  caption: string;
  status: string;
  image: string | null;
};

function useRingtone(active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    const unlock = () => {
      const Ctx = window.AudioContext;
      if (!Ctx) return;
      if (!ctxRef.current) ctxRef.current = new Ctx();
      void ctxRef.current.resume();
    };
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    if (!active) return;
    navigator.vibrate?.([280, 120, 280, 900]);
    const ctx = ctxRef.current;
    if (!ctx || ctx.state !== "running") return;
    let stopped = false;
    let timer = 0;
    const burst = (when: number) => {
      const high = ctx.createOscillator();
      const low = ctx.createOscillator();
      const gain = ctx.createGain();
      high.frequency.value = 480;
      low.frequency.value = 440;
      high.connect(gain);
      low.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(0.07, when + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.35);
      high.start(when);
      low.start(when);
      high.stop(when + 0.36);
      low.stop(when + 0.36);
    };
    const ring = () => {
      if (stopped) return;
      const start = ctx.currentTime + 0.02;
      burst(start);
      burst(start + 0.42);
      timer = window.setTimeout(ring, 2200);
    };
    ring();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [active]);
}

export function CallScreen({
  call,
  onAnswer,
  onDecline,
  onEnd,
  contained = false,
  camera = false,
}: {
  call: LiveCall;
  onAnswer?: () => void;
  onDecline?: () => void;
  onEnd?: () => void;
  contained?: boolean;
  camera?: boolean;
}) {
  const ringing = call.phase === "ringing";
  const videoRef = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<CameraFacing>("environment");
  const [cameraMessage, setCameraMessage] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [remoteFrame, setRemoteFrame] = useState("");
  useRingtone(ringing);
  const caption = call.caption || (ringing ? "Incoming video call" : "Show me a medicine and ask me anything.");

  function showStream(stream: MediaStream) {
    const video = videoRef.current;
    if (video) attachCamera(video, stream);
    setCameraOn(true);
    setCameraMessage("");
  }

  function allowCamera(nextFacing: CameraFacing = facing) {
    const video = videoRef.current;
    if (video) {
      prepareVideo(video);
      void video.play().catch(() => undefined);
    }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCameraMessage(cameraErrorMessage(new DOMException("Camera needs a secure page.", "SecurityError")));
      return;
    }
    setCameraMessage("Asking for your camera...");
    const pending = requestPhoneCamera(nextFacing);
    void pending.then((stream) => {
      setFacing(nextFacing);
      showStream(stream);
    }).catch((error: unknown) => {
      setCameraOn(false);
      setCameraMessage(cameraErrorMessage(error));
    });
  }

  function flip() {
    const video = videoRef.current;
    if (video) prepareVideo(video);
    setCameraMessage("");
    void flipPhoneCamera().then((stream) => {
      setFacing(activeFacing());
      showStream(stream);
    }).catch((error: unknown) => {
      setCameraMessage(cameraErrorMessage(error));
    });
  }

  useEffect(() => {
    const stream = liveCamera();
    const video = videoRef.current;
    if (!camera || !stream || !video) return;
    attachCamera(video, stream);
    setCameraOn(true);
  }, [camera, cameraOn, ringing]);

  useEffect(() => {
    if (!camera || !cameraOn) return;
    const timer = window.setInterval(() => {
      const video = videoRef.current;
      if (video) pushCameraFrame(video);
    }, 400);
    return () => window.clearInterval(timer);
  }, [camera, cameraOn]);

  useEffect(() => {
    if (camera) return;
    let stopped = false;
    const tick = async () => {
      const response = await fetch(`/api/demo/frame?t=${Date.now()}`, { cache: "no-store" });
      if (stopped || !response.ok || response.status === 204) return;
      const blob = await response.blob();
      if (!blob.size || stopped) return;
      const url = URL.createObjectURL(blob);
      setRemoteFrame((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return url;
      });
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 500);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [camera]);

  function answer() {
    if (camera) allowCamera();
    onAnswer?.();
  }

  return (
    <div className={contained ? "relative flex min-h-[34rem] flex-col overflow-hidden rounded-[32px] bg-night text-white" : "fixed inset-0 z-50 flex min-h-dvh flex-col bg-night text-white"}>
      {camera ? (
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 z-0 h-full w-full object-cover" />
      ) : null}
      {!camera && remoteFrame ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={remoteFrame} alt="" className="absolute inset-0 z-0 h-full w-full object-cover" />
      ) : null}
      {call.image && !ringing && !cameraOn && !remoteFrame ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={call.image} alt="" className="absolute inset-0 h-full w-full object-contain bg-night" />
      ) : null}
      <div className="relative z-10 flex min-h-dvh flex-col">
        <header className="flex items-start justify-between px-5 pt-[max(20px,env(safe-area-inset-top))]">
          <p className="rounded-full bg-night/80 px-4 py-2 type-label" aria-live="polite">
            {ringing ? "Connecting..." : call.status || "I'm listening"}
          </p>
          <span className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-lavender text-indigo">
            <span className="type-label leading-none">AI</span>
          </span>
        </header>

        {ringing ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="relative flex h-48 w-48 items-center justify-center">
              <span className="absolute h-40 w-40 animate-ping rounded-full bg-yellow/30" />
              <span className="absolute h-32 w-32 animate-pulse rounded-full border-4 border-yellow" />
              <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-lavender text-indigo type-heading">T</span>
            </div>
            <h1 className="type-title mt-8">Telenomily</h1>
            <p className="type-body mt-2 text-white">Incoming video call</p>
          </div>
        ) : (
          <>
            <div className="mx-auto mt-10 grid h-56 w-64 grid-cols-2 gap-28" aria-hidden>
              <span className={`rounded-tl-3xl border-l-4 border-t-4 ${call.image ? "border-yellow" : "border-white"}`} />
              <span className={`rounded-tr-3xl border-r-4 border-t-4 ${call.image ? "border-yellow" : "border-white"}`} />
              <span className={`rounded-bl-3xl border-b-4 border-l-4 ${call.image ? "border-yellow" : "border-white"}`} />
              <span className={`rounded-br-3xl border-b-4 border-r-4 ${call.image ? "border-yellow" : "border-white"}`} />
            </div>
            <p className="mt-4 text-center type-label">{call.image ? "Hold the box here" : "Show me a medicine"}</p>
          </>
        )}

        <div className="camera-fade absolute inset-x-0 bottom-0 z-20 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-10">
          <p className="type-caption max-h-32 overflow-hidden text-white" aria-live="polite">{cameraMessage || caption}</p>
          {cameraMessage ? <p className="sr-only" role="alert">{cameraMessage}</p> : null}
          {ringing && onAnswer ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" className="btn-danger" onClick={onDecline}>Decline</button>
              <button type="button" className="btn-main" onClick={answer}>Answer</button>
            </div>
          ) : ringing ? null : (
            <div className="mt-4 flex flex-col gap-3">
              {camera && !cameraOn ? (
                <button type="button" className="btn-main" onClick={() => allowCamera()}>Allow camera</button>
              ) : null}
              <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-3">
                <button type="button" className="btn-secondary" aria-label="Mute microphone">Mute</button>
                <button type="button" className="btn-secondary" aria-label="Flip camera" onClick={flip}>Flip</button>
                <button type="button" className="btn-danger" onClick={onEnd}>End call</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
