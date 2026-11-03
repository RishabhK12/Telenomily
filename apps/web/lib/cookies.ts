import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const REHEARSAL = "nc_rehearsal";
const PRESENTER = "nc_presenter";

function secret(): string {
  return process.env.REHEARSAL_COOKIE_SECRET || "rehearsal-only-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function pack(body: Record<string, string>): string {
  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function unpack(value: string | undefined): Record<string, string> | null {
  if (!value) return null;
  const [payload, mac] = value.split(".");
  if (!payload || !mac) return null;
  const expected = sign(payload);
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, string>;
  } catch {
    return null;
  }
}

export async function readRehearsalActor(): Promise<{ profileId: string; role: "patient" | "family" } | null> {
  const store = await cookies();
  const body = unpack(store.get(REHEARSAL)?.value);
  if (!body?.profileId || (body.role !== "patient" && body.role !== "family")) return null;
  if (body.mode !== "rehearsal") return null;
  return { profileId: body.profileId, role: body.role };
}

export async function setRehearsalActor(profileId: string, role: "patient" | "family"): Promise<void> {
  const store = await cookies();
  store.set(REHEARSAL, pack({ profileId, role, mode: "rehearsal" }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearRehearsalActor(): Promise<void> {
  const store = await cookies();
  store.delete(REHEARSAL);
}

export async function setPresenterCookie(): Promise<void> {
  const store = await cookies();
  store.set(PRESENTER, pack({ role: "presenter", ok: "yes" }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function hasPresenterCookie(): Promise<boolean> {
  const store = await cookies();
  const body = unpack(store.get(PRESENTER)?.value);
  return body?.role === "presenter" && body.ok === "yes";
}
