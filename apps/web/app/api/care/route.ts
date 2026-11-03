import { errorResponse } from "@/lib/errors";
import {
  checkImage,
  confirmDraft,
  createDischargeDraft,
  createJudgeInvite,
  confirmObtain,
  endMedicineRoom,
  finishCabinetForActor,
  joinMedicineRoom,
  loadDashboard,
  placeCall,
  presenterFeed,
  presenterLogin,
  redeemInvite,
  reportDose,
  resetDemo,
  saveDraft,
  signInLive,
  signInRehearsal,
  signUpPatient,
  startMedicineRoom,
} from "@/lib/service";
import { clearRehearsalActor } from "@/lib/cookies";
import { runtimeMode } from "@/lib/runtime";
import { createUserClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await loadDashboard());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const type = request.headers.get("content-type") ?? "";
    if (type.includes("multipart/form-data")) {
      const form = await request.formData();
      const action = String(form.get("action") ?? "");
      if (action === "extract") {
        const files = form.getAll("files").filter((file): file is File => file instanceof File && file.size > 0);
        const result = await createDischargeDraft(await Promise.all(files.map(async (file) => ({ mimeType: file.type || "image/jpeg", bytes: Buffer.from(await file.arrayBuffer()) }))));
        return Response.json(result);
      }
      if (action === "check") {
        const file = form.get("file");
        if (!(file instanceof File)) return Response.json({ error: "Add a photo." }, { status: 400 });
        const result = await checkImage({
          bytes: Buffer.from(await file.arrayBuffer()),
          mimeType: file.type || "image/jpeg",
          requestId: String(form.get("requestId") || crypto.randomUUID()),
          kind: (String(form.get("kind") || "package") as "package" | "pill" | "foreign"),
          capturedAt: String(form.get("capturedAt") || new Date().toISOString()),
        });
        return Response.json(result);
      }
      return Response.json({ error: "Unknown upload." }, { status: 400 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    if (action === "rehearsal") return Response.json(await signInRehearsal(body.role === "family" ? "family" : "patient"));
    if (action === "sign-in") return Response.json(await signInLive(String(body.email ?? ""), String(body.password ?? "")));
    if (action === "sign-up") return Response.json(await signUpPatient(String(body.email ?? ""), String(body.password ?? ""), String(body.displayName ?? ""), String(body.phone ?? "")));
    if (action === "sign-out") {
      if (runtimeMode() === "rehearsal") await clearRehearsalActor();
      else if (runtimeMode() === "live") {
        const supabase = await createUserClient();
        await supabase.auth.signOut();
      }
      return Response.json({ ok: true });
    }
    if (action === "save-draft") return Response.json(await saveDraft(String(body.planId), (body.medications as { id: string; name?: string; instructionKind?: "start" | "continue" | "stop" | "as_needed"; timings?: string[] }[]) ?? []));
    if (action === "confirm") return Response.json(await confirmDraft(String(body.planId)));
    if (action === "report-dose") {
      const state = String(body.state ?? "");
      if (state !== "reported_taken" && state !== "reported_not_taken" && state !== "unsure") {
        return Response.json({ error: "That dose report is not one you can save." }, { status: 400 });
      }
      return Response.json(await reportDose(String(body.occurrenceId ?? ""), state));
    }
    if (action === "start-room") return Response.json(await startMedicineRoom());
    if (action === "join-room") return Response.json(await joinMedicineRoom());
    if (action === "end-room") return Response.json(await endMedicineRoom());
    if (action === "finish-cabinet") return Response.json(await finishCabinetForActor());
    if (action === "confirm-obtain") return Response.json(await confirmObtain(String(body.medicationId ?? "")));
    if (action === "presenter-login") return Response.json(await presenterLogin(String(body.code ?? "")));
    if (action === "reset") return Response.json(await resetDemo());
    if (action === "invite") return Response.json(await createJudgeInvite());
    if (action === "call") return Response.json(await placeCall(body.purpose === "pharmacy" ? "pharmacy" : "reminder", String(body.idempotencyKey ?? crypto.randomUUID())));
    if (action === "feed") return Response.json(await presenterFeed());
    if (action === "redeem") return Response.json(await redeemInvite(String(body.token ?? "")));
    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
