export type CameraFacing = "environment" | "user";

let current: MediaStream | null = null;
let currentFacing: CameraFacing = "environment";

export function liveCamera() {
  const track = current?.getVideoTracks().find((item) => item.readyState === "live");
  return track ? current : null;
}

function remember(stream: MediaStream, fallback: CameraFacing) {
  current = stream;
  const track = stream.getVideoTracks()[0];
  const reported = track?.getSettings().facingMode;
  if (reported === "user" || reported === "environment") {
    currentFacing = reported;
    return stream;
  }
  const label = track?.label.toLowerCase() ?? "";
  if (/front|user|face/.test(label)) currentFacing = "user";
  else if (/back|rear|environment/.test(label)) currentFacing = "environment";
  else currentFacing = fallback;
  return stream;
}

function releaseCamera() {
  const previousId = current?.getVideoTracks()[0]?.getSettings().deviceId ?? "";
  current?.getTracks().forEach((track) => track.stop());
  current = null;
  return previousId;
}

export function requestPhoneCamera(facing: CameraFacing = "environment") {
  const existing = liveCamera();
  if (existing && facing === currentFacing) return Promise.resolve(existing);
  const devices = navigator.mediaDevices;
  if (!devices?.getUserMedia) {
    return Promise.reject(new DOMException("This browser has no camera.", "NotSupportedError"));
  }
  if (existing) releaseCamera();
  const pending = devices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: facing } },
  });
  return pending.then((stream) => remember(stream, facing));
}

export function flipPhoneCamera() {
  const devices = navigator.mediaDevices;
  if (!devices?.getUserMedia) {
    return Promise.reject(new DOMException("This browser has no camera.", "NotSupportedError"));
  }
  const next: CameraFacing = currentFacing === "environment" ? "user" : "environment";
  const previousId = releaseCamera();
  const opened = devices.getUserMedia({
    audio: false,
    video: { facingMode: { exact: next } },
  }).catch(async () => {
    const listed = await devices.enumerateDevices();
    const other = listed.find((item) => item.kind === "videoinput" && item.deviceId && item.deviceId !== previousId);
    if (other) {
      return devices.getUserMedia({ audio: false, video: { deviceId: { exact: other.deviceId } } });
    }
    return devices.getUserMedia({ audio: false, video: { facingMode: next } });
  });
  return opened.then((stream) => remember(stream, next));
}

export function activeFacing() {
  return currentFacing;
}

export function prepareVideo(video: HTMLVideoElement) {
  video.muted = true;
  video.defaultMuted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
}

export function attachCamera(video: HTMLVideoElement, stream: MediaStream) {
  prepareVideo(video);
  stream.getVideoTracks().forEach((track) => {
    track.enabled = true;
  });
  if (video.srcObject !== stream) video.srcObject = stream;
  const start = () => {
    const play = video.play();
    if (play) void play.catch(() => undefined);
  };
  if (video.readyState >= 1) start();
  else video.onloadedmetadata = start;
}

export function pushCameraFrame(video: HTMLVideoElement) {
  if (!video.videoWidth || !video.videoHeight) return;
  const width = 480;
  const height = Math.max(1, Math.round((width * video.videoHeight) / video.videoWidth));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.drawImage(video, 0, 0, width, height);
  canvas.toBlob((blob) => {
    if (!blob) return;
    void fetch("/api/demo/frame", { method: "POST", body: blob, headers: { "content-type": "image/jpeg" } });
  }, "image/jpeg", 0.55);
}

export function cameraErrorMessage(error: unknown) {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "I need your camera to see your medicine. This phone address is not secure, so the camera stays off. Open the https link, then tap Allow camera.";
  }
  const name = error instanceof DOMException ? error.name : error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "I need your camera to see your medicine. Tap Allow on the phone prompt. If you already blocked it, open the browser site settings, set Camera to Allow, and tap again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "I can't find a camera on this phone.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "The camera is busy. Close the other app using it, then tap Allow camera again.";
  }
  return "I need your camera to see your medicine. Tap Allow camera again.";
}

export function stopCamera() {
  current?.getTracks().forEach((track) => track.stop());
  current = null;
}
