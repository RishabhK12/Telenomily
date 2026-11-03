export const ACTIVE_CALL_STATES = ["queued", "dialing", "ringing", "answered"] as const;

export type CallStatus =
  | "queued"
  | "dialing"
  | "ringing"
  | "answered"
  | "busy"
  | "rejected"
  | "unanswered"
  | "disconnected"
  | "provider_error"
  | "completed";

export type CallRecord = {
  id: string;
  purpose: string;
  status: CallStatus;
  idempotencyKey: string;
  doseOccurrenceId: string | null;
  providerEventIds: string[];
};

export function canStartCall(
  existing: CallRecord[],
  request: { idempotencyKey: string; purpose: string; doseOccurrenceId: string | null },
): { ok: true; existingId?: string } | { ok: false; reason: "duplicate_active_call"; existingId: string } {
  const replay = existing.find((call) => call.idempotencyKey === request.idempotencyKey);
  if (replay) return { ok: true, existingId: replay.id };
  const active = existing.find(
    (call) =>
      call.purpose === request.purpose &&
      call.doseOccurrenceId === request.doseOccurrenceId &&
      ACTIVE_CALL_STATES.includes(call.status as (typeof ACTIVE_CALL_STATES)[number]),
  );
  if (active) return { ok: false, reason: "duplicate_active_call", existingId: active.id };
  return { ok: true };
}

export function mapProviderSignal(input: { sipStatusCode?: number | null; callStatus?: string | null }): CallStatus {
  const status = (input.callStatus ?? "").toLowerCase();
  if (status === "active" || status === "answered" || status === "in-progress") return "answered";
  if (status === "ringing") return "ringing";
  if (status === "dialing" || status === "trying") return "dialing";
  if (status === "busy") return "busy";
  if (status === "rejected" || status === "declined") return "rejected";
  if (status === "no-answer" || status === "unanswered" || status === "noanswer") return "unanswered";
  if (status === "disconnected" || status === "hangup" || status === "completed") return "disconnected";
  const code = input.sipStatusCode ?? null;
  if (code === 486) return "busy";
  if (code === 603 || code === 403) return "rejected";
  if (code === 408 || code === 480 || code === 487) return "unanswered";
  if (code != null && code >= 400) return "provider_error";
  if (status === "error" || status === "failed") return "provider_error";
  return "provider_error";
}

export function applyProviderEvent(call: CallRecord, event: { id: string; status: CallStatus }): { call: CallRecord; duplicate: boolean } {
  if (call.providerEventIds.includes(event.id)) return { call, duplicate: true };
  const terminal = new Set<CallStatus>(["busy", "rejected", "unanswered", "disconnected", "provider_error", "completed"]);
  const nextStatus = terminal.has(call.status) && !terminal.has(event.status) ? call.status : event.status;
  return {
    duplicate: false,
    call: { ...call, status: nextStatus, providerEventIds: [...call.providerEventIds, event.id] },
  };
}

type DoseReportState = "reported_taken" | "reported_not_taken" | "unsure" | "no_response";

export function doseStateForUnsuccessfulCall(status: CallStatus, alreadyReported: boolean): DoseReportState | null {
  if (alreadyReported) return null;
  if (status === "busy" || status === "rejected" || status === "unanswered" || status === "provider_error" || status === "disconnected") {
    return "no_response";
  }
  return null;
}

export function doseReportSpeech(state: DoseReportState, medicationName: string): string {
  if (state === "reported_taken") {
    return `I saved that you reported taking ${medicationName}. This is your report, not an independent verification.`;
  }
  if (state === "reported_not_taken") {
    return `I saved that you reported not taking ${medicationName}. Follow the confirmed plan instructions. I will not tell you to take an extra dose.`;
  }
  if (state === "unsure") {
    return `I saved that you are unsure whether you already took ${medicationName}. Do not take an extra dose until a pharmacist or doctor tells you what to do.`;
  }
  return `There was no answer about ${medicationName}. I saved no response. That is not a confirmed missed dose.`;
}

export function isAllowedDestination(phone: string, allowlist: string[]): boolean {
  const normalized = phone.replace(/[^\d+]/g, "");
  return allowlist.map((item) => item.replace(/[^\d+]/g, "")).includes(normalized);
}
