import { createHash, timingSafeEqual } from "node:crypto";

export type Actor = { id: string; role: "patient" | "family" | "presenter" };
export type PatientRecord = { id: string; profileId: string; isDemo: boolean };
export type FamilyLink = { patientId: string; familyProfileId: string; status: string };
export type Invitation = { expiresAt: string; usedAt: string | null };

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function invitationState(invite: Invitation | null, now: Date): "missing" | "used" | "expired" | "valid" {
  if (!invite) return "missing";
  if (invite.usedAt) return "used";
  if (new Date(invite.expiresAt).getTime() <= now.getTime()) return "expired";
  return "valid";
}

export function canAccessPatient(actor: Actor, patient: PatientRecord, links: FamilyLink[]): boolean {
  if (actor.role === "patient") return patient.profileId === actor.id;
  if (actor.role === "family") {
    return links.some((link) => link.patientId === patient.id && link.familyProfileId === actor.id && link.status === "active");
  }
  return actor.role === "presenter" && patient.isDemo;
}

export function canIssueRoomToken(actor: Actor, patient: PatientRecord, links: FamilyLink[], roomPatientId: string): boolean {
  return roomPatientId === patient.id && canAccessPatient(actor, patient, links);
}
