import {
  DEMO,
  administrationInstructions,
  applyProviderEvent,
  assertConfirmedPlan,
  assessSubstitution,
  buildSchedule,
  canAccessPatient,
  canStartCall,
  classifySymptom,
  doseReportSpeech,
  doseStateForUnsuccessfulCall,
  duplicateActiveIngredients,
  type CallStatus,
  evaluateLabel,
  formatStrength,
  hashToken,
  invitationState,
  isAllowedDestination,
  isExplicitClock,
  mapProviderSignal,
  matchForeignLabel,
  matchPill,
  missingFromScan,
  missingItemScript,
  pharmacyCandidate,
  pillReferences,
  prescribedAcetaminophen,
  replacementTaskAction,
  safeEqual,
  type DoseReportState,
  type ExtractedMedication,
} from "@nomi/domain";
import { hasPresenterCookie, readRehearsalActor, setRehearsalActor } from "./cookies";
import {
  database,
  type CallRow,
  type DoseRow,
  type MedRow,
  type PatientRow,
  type ScanRow,
} from "./db";
import { AppError } from "./errors";
import { extractDischarge, extractForeign, extractLabel, extractPill } from "./grok";
import { dialPhone, dispatchAgent, participantToken, readLiveKitWebhook } from "./livekit";
import { allowedNumbers, appUrl, productName, runtimeMode } from "./runtime";
import { createUserClient } from "./supabase";

export type Actor = { id: string; role: "patient" | "family" | "presenter"; name: string };

const SOURCE = {
  report: "patient_report",
  extraction: "document_extraction",
  code: "code_comparison",
  pharmacy: "pharmacist_statement",
  system: "system",
} as const;

function requireMode() {
  const mode = runtimeMode();
  if (mode === "unconfigured") {
    throw new AppError(
      503,
      "unconfigured",
      "This server is not configured. Set APP_MODE=rehearsal for a labeled rehearsal, or add the Supabase keys for live mode. Missing keys do not turn on a silent demo.",
    );
  }
  return mode;
}

export async function currentActor(): Promise<Actor> {
  const mode = requireMode();
  if (mode === "rehearsal") {
    const session = await readRehearsalActor();
    if (!session) throw new AppError(401, "auth_required", "Sign in to continue.");
    if (session.profileId === DEMO.patientProfileId) return { id: session.profileId, role: "patient", name: DEMO.patientName };
    if (session.profileId === DEMO.familyProfileId) return { id: session.profileId, role: "family", name: DEMO.familyName };
    throw new AppError(401, "auth_required", "Sign in to continue.");
  }
  const supabase = await createUserClient();
  const user = await supabase.auth.getUser();
  if (user.error || !user.data.user) throw new AppError(401, "auth_required", "Sign in to continue.");
  const { createServiceClient } = await import("./supabase");
  const profile = await createServiceClient().from("profiles").select("id, role, display_name").eq("id", user.data.user.id).maybeSingle();
  if (!profile.data) throw new AppError(403, "profile_missing", "This account has no profile yet.");
  return { id: profile.data.id as string, role: profile.data.role as Actor["role"], name: profile.data.display_name as string };
}

async function accessiblePatient(actor: Actor, patientId?: string): Promise<PatientRow> {
  const db = database();
  const patients = await db.patients();
  const links = await db.links();
  const allowed = patients.filter((patient) =>
    canAccessPatient(
      { id: actor.id, role: actor.role },
      { id: patient.id, profileId: patient.profileId, isDemo: patient.isDemo },
      links,
    ),
  );
  const patient = patientId ? allowed.find((item) => item.id === patientId) : allowed[0];
  if (!patient) throw new AppError(403, "forbidden", "You cannot open this patient.");
  return patient;
}

async function requirePresenter(): Promise<void> {
  requireMode();
  if (!(await hasPresenterCookie())) throw new AppError(401, "presenter_required", "Enter the presenter access code.");
}

function medsFor(planId: string, medications: MedRow[]): MedRow[] {
  return medications.filter((medication) => medication.planVersionId === planId);
}

export async function loadDashboard(patientId?: string) {
  const actor = await currentActor();
  const patient = await accessiblePatient(actor, patientId);
  const db = database();
  const [plans, medications, doses, symptoms, scans, tasks, activity, calls, pharmacy, rooms] = await Promise.all([
    db.plans(patient.id),
    db.medications(patient.id),
    db.doses(patient.id),
    db.symptoms(patient.id),
    db.scans(patient.id),
    db.tasks(patient.id),
    db.activity(patient.id),
    db.calls(patient.id),
    db.pharmacy(patient.id),
    db.rooms(patient.id),
  ]);
  const confirmed = plans.find((plan) => plan.status === "confirmed") ?? null;
  const draft = plans.find((plan) => plan.status === "draft") ?? null;
  const confirmedMeds = confirmed ? medsFor(confirmed.id, medications) : [];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todaysDoses = doses.filter((dose) => {
    if (!confirmed || dose.planVersionId !== confirmed.id) return false;
    const when = new Date(dose.scheduledFor);
    return when >= todayStart && when < tomorrow;
  });
  const completed = todaysDoses.filter((dose) => dose.state !== "pending" && dose.state !== "no_response").length;
  const demoCall = await database().demoCall();
  const activeRoom = rooms.find((room) => !room.endedAt && room.purpose === "medicine_check")
    ?? (demoCall ? { id: "demo-call", patientId: patient.id, livekitRoom: "telenomily-demo", purpose: "medicine_check", patientIdentity: "patient", callId: null, createdAt: demoCall.startedAt, endedAt: null } : null);
  return {
    mode: runtimeMode(),
    productName: productName(),
    viewer: actor,
    patient: {
      id: patient.id,
      preferredName: patient.preferredName,
      phoneLast4: patient.phoneE164 ? patient.phoneE164.slice(-4) : null,
      timeZone: patient.timeZone,
    },
    plan: confirmed
      ? {
          id: confirmed.id,
          status: confirmed.status,
          confirmedAt: confirmed.confirmedAt,
          medications: confirmedMeds.map(presentMed),
        }
      : null,
    draft: draft
      ? {
          id: draft.id,
          documentPath: draft.documentPath,
          medications: medsFor(draft.id, medications).map(presentMed),
        }
      : null,
    doses: todaysDoses
      .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
      .map((dose) => ({
        ...dose,
        medicationName: medications.find((medication) => medication.id === dose.medicationId)?.name ?? "Medicine",
      })),
    asNeeded: confirmedMeds.filter((medication) => medication.instructionKind === "as_needed").map(presentMed),
    symptoms,
    checks: scans,
    tasks: tasks.filter((task) => task.status === "open"),
    pharmacy,
    calls,
    activeRoom,
    activity: [...activity].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    duplicates: duplicateActiveIngredients(
      confirmedMeds
        .filter((medication) => medication.instructionKind !== "stop")
        .map((medication) => ({ label: medication.name, ingredients: medication.ingredients })),
    ),
    checkIn: {
      completed,
      scheduled: todaysDoses.length,
      explanation: "This count is completed check ins for today's scheduled doses. It is not a clinical recovery score.",
    },
    alerts: activity.filter((item) => item.status === "urgent" || item.status === "needs_review" || item.status === "cant_confirm").slice(0, 8),
  };
}

function presentMed(medication: MedRow) {
  return {
    id: medication.id,
    name: medication.name,
    instructionKind: medication.instructionKind,
    strengthLabel: formatStrength(medication.strengthValue, medication.strengthUnit),
    instructions: administrationInstructions(medication),
    sourceText: medication.sourceText,
    timings: medication.timings,
    missingFields: medication.missingFields,
    frequency: medication.frequency,
    amountPerDose: medication.amountPerDose,
    route: medication.route,
    formulation: medication.formulation,
    release: medication.release,
    specialInstructions: medication.specialInstructions,
    ingredients: medication.ingredients,
  };
}

export async function reportDose(occurrenceId: string, state: DoseReportState) {
  const actor = await currentActor();
  if (actor.role !== "patient") throw new AppError(403, "patient_only", "The patient reports a dose.");
  const patient = await accessiblePatient(actor);
  const dose = (await database().doses(patient.id)).find((item) => item.id === occurrenceId);
  if (!dose || dose.patientId !== patient.id) throw new AppError(404, "dose_missing", "That dose is not on your plan.");
  if (!["reported_taken", "reported_not_taken", "unsure"].includes(state)) {
    throw new AppError(400, "bad_state", "That dose report is not one you can save.");
  }
  await database().saveDoseState(occurrenceId, state);
  const medication = (await database().medications(patient.id)).find((item) => item.id === dose.medicationId);
  const spokenScript = doseReportSpeech(state, medication?.name ?? "the medicine");
  await database().insertActivity({
    id: crypto.randomUUID(),
    patientId: patient.id,
    title: "Dose reported",
    detail: spokenScript,
    source: SOURCE.report,
    status: state,
    createdAt: new Date().toISOString(),
  });
  return { spokenScript };
}

export async function signInRehearsal(role: "patient" | "family") {
  if (runtimeMode() !== "rehearsal") {
    throw new AppError(403, "rehearsal_only", "Rehearsal sign in is available only when APP_MODE=rehearsal.");
  }
  const profileId = role === "patient" ? DEMO.patientProfileId : DEMO.familyProfileId;
  await setRehearsalActor(profileId, role);
  return { ok: true, redirectTo: role === "patient" ? "/patient" : "/family" };
}

export async function createDischargeDraft(files: { mimeType: string; bytes: Buffer }[]) {
  const actor = await currentActor();
  if (actor.role !== "patient") throw new AppError(403, "patient_only", "Only the patient can confirm a discharge sheet.");
  const patient = await accessiblePatient(actor);
  if (files.length === 0) throw new AppError(400, "file_required", "Add a photo of the discharge sheet.");
  const db = database();
  const stored = [];
  for (const file of files) {
    const id = await db.insertDocument(patient.id, file.mimeType, file.bytes);
    stored.push(id);
  }
  const extracted = await extractDischarge(files.map((file) => ({ mimeType: file.mimeType, base64: file.bytes.toString("base64") })));
  const planId = crypto.randomUUID();
  const now = new Date().toISOString();
  const medications = extracted.extraction.medications.map((medication) => toMed(medication, planId, patient.id));
  await db.insertDraft(
    { id: planId, patientId: patient.id, status: "draft", documentPath: stored[0] ?? null, confirmedAt: null, createdAt: now },
    medications,
  );
  await db.insertActivity({
    id: crypto.randomUUID(),
    patientId: patient.id,
    title: "Discharge draft created",
    detail: `Grok model ${extracted.model} extracted ${medications.length} rows. Nothing is scheduled until you confirm.`,
    source: SOURCE.extraction,
    status: "draft",
    createdAt: now,
  });
  return { planId, model: extracted.model, unreadableNotes: extracted.extraction.unreadableNotes };
}

function toMed(medication: ExtractedMedication, planId: string, patientId: string): MedRow {
  return {
    id: crypto.randomUUID(),
    planVersionId: planId,
    patientId,
    name: medication.name ?? "Unreadable medicine",
    ingredients: medication.ingredients,
    strengthValue: medication.strengthValue,
    strengthUnit: medication.strengthUnit,
    amountPerDose: medication.amountPerDose,
    route: medication.route,
    formulation: medication.formulation,
    release: medication.release,
    frequency: medication.frequency,
    timings: medication.timings.filter(isExplicitClock),
    instructionKind: medication.instructionKind ?? "continue",
    duration: medication.duration,
    endDate: medication.endDate,
    specialInstructions: medication.specialInstructions,
    sourceText: medication.sourceText,
    missingFields: medication.missingFields,
  };
}

export async function saveDraft(planId: string, edits: { id: string; name?: string; instructionKind?: MedRow["instructionKind"]; timings?: string[] }[]) {
  const actor = await currentActor();
  const patient = await accessiblePatient(actor);
  const db = database();
  const plans = await db.plans(patient.id);
  const plan = plans.find((item) => item.id === planId && item.status === "draft");
  if (!plan) throw new AppError(404, "draft_missing", "That draft is not open.");
  const existing = (await db.medications(patient.id)).filter((medication) => medication.planVersionId === planId);
  const cleaned = existing.map((medication) => {
    const edit = edits.find((item) => item.id === medication.id);
    if (!edit) return medication;
    const kind = edit.instructionKind ?? medication.instructionKind;
    return {
      ...medication,
      name: edit.name?.trim() || medication.name,
      instructionKind: kind,
      timings: (edit.timings ?? medication.timings).filter(isExplicitClock),
    };
  });
  await db.updateDraftMeds(planId, cleaned);
  return { ok: true };
}

export async function confirmDraft(planId: string) {
  const actor = await currentActor();
  if (actor.role !== "patient") throw new AppError(403, "patient_only", "Only the patient can activate a schedule.");
  const patient = await accessiblePatient(actor);
  const db = database();
  const plans = await db.plans(patient.id);
  const plan = plans.find((item) => item.id === planId);
  if (!plan || plan.status === "archived") throw new AppError(404, "draft_missing", "That draft is not open.");
  if (plan.status === "confirmed") return { ok: true };
  const medications = (await db.medications(patient.id)).filter((medication) => medication.planVersionId === planId);
  const startDate = new Intl.DateTimeFormat("en-CA", { timeZone: patient.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const schedule = buildSchedule(medications, { startDate, days: 7, timeZone: patient.timeZone });
  const doses: DoseRow[] = schedule.doses.map((dose) => ({
    id: crypto.randomUUID(),
    patientId: patient.id,
    planVersionId: planId,
    medicationId: dose.medicationId,
    scheduledFor: dose.scheduledFor,
    instructions: dose.instructions,
    state: "pending",
  }));
  await db.confirmPlan(planId, doses);
  await db.insertActivity({
    id: crypto.randomUUID(),
    patientId: patient.id,
    title: "Schedule confirmed",
    detail: `${doses.length} clock doses were created. As needed and stopped medicines were left off the timed schedule.`,
    source: SOURCE.system,
    status: "confirmed",
    createdAt: new Date().toISOString(),
  });
  return { ok: true, doseCount: doses.length, gaps: schedule.gaps };
}

async function confirmedMedications(patientId: string) {
  const db = database();
  const plans = await db.plans(patientId);
  const plan = plans.find((item) => item.status === "confirmed");
  if (!plan) throw new AppError(409, "plan_required", "Confirm a schedule before checking medicines.");
  assertConfirmedPlan(plan);
  const medications = (await db.medications(patientId)).filter((medication) => medication.planVersionId === plan.id);
  return { plan, medications };
}

export async function checkImage(input: { bytes: Buffer; mimeType: string; requestId: string; kind: "package" | "pill" | "foreign"; capturedAt?: string }) {
  const actor = await currentActor();
  if (actor.role !== "patient") throw new AppError(403, "patient_only", "Medicine frames are taken from the patient camera.");
  const patient = await accessiblePatient(actor);
  const db = database();
  const prior = (await db.scans(patient.id)).find((scan) => scan.requestId === input.requestId);
  if (prior) return prior;
  const { plan, medications } = await confirmedMedications(patient.id);
  const image = { mimeType: input.mimeType, base64: input.bytes.toString("base64") };
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: patient.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  let outcome = "cant_confirm";
  let spokenScript = "I can't confirm this image.";
  let detail = "";
  let planMatch: string | null = null;
  let expirationStatus: string | null = null;
  let matchedMedicationId: string | null = null;
  let model = "";
  if (input.kind === "package") {
    const extracted = await extractLabel(image);
    model = extracted.model;
    const evaluation = evaluateLabel(extracted.extraction, medications, today);
    outcome = evaluation.outcome;
    spokenScript = evaluation.spokenScript;
    detail = evaluation.detail;
    planMatch = evaluation.planMatch;
    expirationStatus = evaluation.expirationStatus;
    matchedMedicationId = evaluation.matchedMedicationId;
    if (evaluation.outcome === "expired" && evaluation.planMatch === "match" && evaluation.matchedMedicationId) {
      await maybeTask(patient.id, evaluation.matchedMedicationId, "replace_expired", false);
    }
  } else if (input.kind === "pill") {
    const extracted = await extractPill(image);
    model = extracted.model;
    const match = matchPill(extracted.extraction, pillReferences);
    outcome = match.outcome;
    spokenScript = match.spokenScript;
    detail = match.reason;
  } else {
    const extracted = await extractForeign(image);
    model = extracted.model;
    const { foreignMappings } = await import("@nomi/domain");
    const match = matchForeignLabel(extracted.extraction, foreignMappings);
    outcome = match.outcome;
    spokenScript = `${extracted.extraction.originalText}\n${match.spokenScript}`;
    detail = match.reason;
  }
  const row: ScanRow = {
    id: crypto.randomUUID(),
    patientId: patient.id,
    planVersionId: plan.id,
    requestId: input.requestId,
    capturedAt,
    kind: input.kind,
    outcome,
    planMatch,
    expirationStatus,
    matchedMedicationId,
    spokenScript,
    detail,
    source: SOURCE.code,
    createdAt: new Date().toISOString(),
  };
  await db.insertScan(row);
  await db.insertActivity({
    id: crypto.randomUUID(),
    patientId: patient.id,
    title: `Medicine check: ${outcome.replaceAll("_", " ")}`,
    detail: spokenScript,
    source: SOURCE.code,
    status: outcome,
    createdAt: row.createdAt,
  });
  return { ...row, model };
}

async function recordCabinetFinish(patientId: string) {
  const { medications, plan } = await confirmedMedications(patientId);
  const db = database();
  const scans = await db.scans(patientId);
  const missing = missingFromScan(
    medications,
    scans.map((scan) => ({
      matchedMedicationId: scan.matchedMedicationId,
      planMatch: (scan.planMatch as "match" | "not_listed" | "unconfirmed" | null) ?? "unconfirmed",
      outcome: scan.outcome as "on_plan",
    })),
  );
  const now = new Date().toISOString();
  for (const medication of missing) {
    const requestId = `missing:${plan.id}:${medication.id}`;
    if (scans.some((scan) => scan.requestId === requestId)) continue;
    await db.insertScan({
      id: crypto.randomUUID(),
      patientId,
      planVersionId: plan.id,
      requestId,
      capturedAt: now,
      kind: "package",
      outcome: "missing",
      planMatch: null,
      expirationStatus: null,
      matchedMedicationId: medication.id,
      spokenScript: missingItemScript(medication),
      detail: "Not found in this scan.",
      source: SOURCE.code,
      createdAt: now,
    });
  }
  const spokenScript = missing.length
    ? missing.map((medication) => missingItemScript(medication)).join(" ")
    : "Every active medicine on the confirmed plan was found in this scan. Unreadable packages were not counted as matches.";
  await db.insertActivity({
    id: crypto.randomUUID(),
    patientId,
    title: "Cabinet scan finished",
    detail: spokenScript,
    source: SOURCE.code,
    status: missing.length ? "missing" : "complete",
    createdAt: now,
  });
  return { spokenScript, missing: missing.map((medication) => ({ id: medication.id, name: medication.name })) };
}

export async function finishCabinetForActor() {
  const actor = await currentActor();
  if (actor.role !== "patient") throw new AppError(403, "patient_only", "The patient finishes the cabinet scan.");
  const patient = await accessiblePatient(actor);
  return recordCabinetFinish(patient.id);
}

export async function confirmObtain(medicationId: string) {
  const actor = await currentActor();
  if (actor.role !== "patient") throw new AppError(403, "patient_only", "The patient confirms a medicine is needed.");
  const patient = await accessiblePatient(actor);
  const result = await maybeTask(patient.id, medicationId, "obtain_missing", true);
  return {
    created: Boolean(result.created),
    spokenScript: result.created
      ? "I added a task to obtain that medicine. I did not change the confirmed plan."
      : "I did not add a task. A missing medicine is added only after you confirm it is needed, and an open task is not duplicated.",
  };
}

async function maybeTask(patientId: string, medicationId: string, kind: "replace_expired" | "obtain_missing", confirmed: boolean) {
  const db = database();
  const medications = await db.medications(patientId);
  const medication = medications.find((item) => item.id === medicationId);
  if (!medication || medication.instructionKind === "stop") return { created: false };
  const open = (await db.tasks(patientId)).filter((task) => task.status === "open");
  const action = replacementTaskAction(open, { medicationKey: medicationId, kind, patientConfirmedNeed: confirmed || kind === "replace_expired" });
  if (action !== "create") return { created: false, action };
  await db.insertTask({
    id: crypto.randomUUID(),
    patientId,
    medicationKey: medicationId,
    kind,
    title: kind === "replace_expired" ? `Replace expired ${medication.name}` : `Obtain ${medication.name}`,
    status: "open",
    createdAt: new Date().toISOString(),
  });
  await db.insertActivity({
    id: crypto.randomUUID(),
    patientId,
    title: kind === "replace_expired" ? "Replacement task added" : "Shopping task added",
    detail: medication.name,
    source: SOURCE.system,
    status: "open",
    createdAt: new Date().toISOString(),
  });
  return { created: true };
}

export async function startMedicineRoom() {
  const actor = await currentActor();
  if (actor.role !== "patient") throw new AppError(403, "patient_only", "The patient starts the medicine check.");
  const patient = await accessiblePatient(actor);
  await confirmedMedications(patient.id);
  if (runtimeMode() === "rehearsal") {
    throw new AppError(409, "rehearsal_blocked", "Rehearsal mode did not open a LiveKit room and did not pretend a call succeeded. Add LiveKit keys and turn off APP_MODE=rehearsal.");
  }
  const db = database();
  const identity = `patient:${actor.id}`;
  const roomName = `telenomily-${patient.id}-${crypto.randomUUID()}`;
  const room = {
    id: crypto.randomUUID(),
    patientId: patient.id,
    livekitRoom: roomName,
    purpose: "medicine_check",
    patientIdentity: identity,
    callId: null,
    createdAt: new Date().toISOString(),
    endedAt: null,
  };
  await db.insertRoom(room);
  await dispatchAgent(roomName, { purpose: "medicine_check", roomName, patientIdentity: identity });
  const token = await participantToken(identity, roomName, patient.preferredName);
  await db.insertActivity({
    id: crypto.randomUUID(),
    patientId: patient.id,
    title: "Medicine check started",
    detail: "A live room is open.",
    source: SOURCE.system,
    status: "live",
    createdAt: room.createdAt,
  });
  return { token, url: process.env.NEXT_PUBLIC_LIVEKIT_URL, roomName };
}

export async function joinMedicineRoom() {
  const actor = await currentActor();
  const patient = await accessiblePatient(actor);
  const room = (await database().rooms(patient.id)).find((item) => item.purpose === "medicine_check" && !item.endedAt);
  if (!room) throw new AppError(404, "no_room", "There is no active medicine check to join.");
  if (runtimeMode() === "rehearsal") {
    throw new AppError(409, "rehearsal_blocked", "Rehearsal mode cannot join a live room.");
  }
  const token = await participantToken(`family:${actor.id}`, room.livekitRoom, actor.name);
  return { token, url: process.env.NEXT_PUBLIC_LIVEKIT_URL, roomName: room.livekitRoom };
}

export async function endMedicineRoom() {
  const actor = await currentActor();
  const patient = await accessiblePatient(actor);
  const room = (await database().rooms(patient.id)).find((item) => item.purpose === "medicine_check" && !item.endedAt);
  if (room) await database().endRoom(room.livekitRoom);
  return { ok: true };
}

export async function placeCall(purpose: "reminder" | "pharmacy", idempotencyKey: string) {
  await requirePresenter();
  const mode = requireMode();
  const db = database();
  const patient = (await db.patients()).find((item) => item.isDemo && item.id === DEMO.patientId);
  if (!patient) throw new AppError(404, "demo_missing", "The demo patient is not loaded. Run the seed or reset the rehearsal data.");
  if (mode === "rehearsal") {
    await db.insertActivity({
      id: crypto.randomUUID(),
      patientId: patient.id,
      title: "Call was not placed",
      detail: "Rehearsal mode does not dial a phone and does not mark the dose as taken or missed.",
      source: SOURCE.system,
      status: "blocked",
      createdAt: new Date().toISOString(),
    });
    throw new AppError(409, "rehearsal_blocked", "Rehearsal mode did not dial. The phone did not ring.");
  }
  const phone = purpose === "pharmacy" ? process.env.DEMO_PHARMACY_PHONE?.trim() : patient.phoneE164;
  if (!phone) {
    throw new AppError(503, "phone_unconfigured", purpose === "pharmacy" ? "Set DEMO_PHARMACY_PHONE." : "Set the demo patient phone, and keep it on ALLOWED_CALL_NUMBERS.");
  }
  if (!isAllowedDestination(phone, allowedNumbers())) {
    throw new AppError(403, "number_not_allowed", "That number is not on ALLOWED_CALL_NUMBERS. The server will not dial anything else.");
  }
  const existing = await db.calls(patient.id);
  const doses = await db.doses(patient.id);
  const dose = purpose === "reminder" ? doses.find((item) => item.state === "pending") ?? null : null;
  const decision = canStartCall(
    existing.map((call) => ({
      id: call.id,
      purpose: call.purpose,
      status: call.status as CallStatus,
      idempotencyKey: call.idempotencyKey,
      doseOccurrenceId: call.doseOccurrenceId,
      providerEventIds: call.providerEventIds,
    })),
    { idempotencyKey, purpose, doseOccurrenceId: dose?.id ?? null },
  );
  if (!decision.ok) throw new AppError(409, decision.reason, "A call for this dose is already active.");
  if (decision.existingId) return { callId: decision.existingId, replayed: true };
  const { plan, medications } = await confirmedMedications(patient.id);
  const medication = medications.find((item) => item.id === dose?.medicationId);
  const opening =
    purpose === "reminder"
      ? `Introduce yourself as an automated medication assistant from ${productName()}. Say you are calling about ${medication?.name ?? "the scheduled medicine"}. The confirmed instruction is: ${dose?.instructions ?? "No clock dose is pending."} Ask whether they already took this scheduled dose. Then ask how they feel. Read back an unclear answer before saving it. If they are unsure, tell them not to take an extra dose.`
      : "Introduce yourself as an automated medication assistant calling about a prescription. Ask whether the exact prescribed product and strength are in stock. The demo prescription is acetaminophen 500 mg immediate release oral tablets. If it is out of stock, ask whether the preverified generic candidate DemoGen acetaminophen 500 mg tablets is available. Ask for the quoted price and repeat the statement back before saving it. Do not change the patient's plan.";
  const call: CallRow = {
    id: crypto.randomUUID(),
    patientId: patient.id,
    purpose,
    status: "dialing",
    idempotencyKey,
    doseOccurrenceId: dose?.id ?? null,
    roomName: `telenomily-call-${crypto.randomUUID()}`,
    openingScript: opening,
    summary: null,
    providerEventIds: [],
    createdAt: new Date().toISOString(),
  };
  await db.insertCall(call);
  await db.insertRoom({
    id: crypto.randomUUID(),
    patientId: patient.id,
    livekitRoom: call.roomName!,
    purpose,
    patientIdentity: `sip:${purpose}`,
    callId: call.id,
    createdAt: call.createdAt,
    endedAt: null,
  });
  try {
    await dispatchAgent(call.roomName!, { purpose, roomName: call.roomName!, patientIdentity: `sip:${purpose}` });
    await dialPhone(call.roomName!, phone, `sip:${purpose}`, purpose === "pharmacy" ? "Pharmacy" : patient.preferredName);
  } catch (error) {
    await db.patchCall(call.id, { status: "provider_error", summary: error instanceof Error ? error.message : "Call failed." });
    throw error;
  }
  await db.insertActivity({
    id: crypto.randomUUID(),
    patientId: patient.id,
    title: purpose === "pharmacy" ? "Pharmacy call dialing" : "Reminder call dialing",
    detail: "The call is real. The result will appear when someone answers.",
    source: SOURCE.system,
    status: "dialing",
    createdAt: call.createdAt,
  });
  return { callId: call.id, roomName: call.roomName, planId: plan.id };
}

export async function agentContext(secret: string, roomName: string) {
  assertAgent(secret);
  const room = await database().roomByName(roomName);
  if (!room) throw new AppError(404, "room_missing", "That room is not registered.");
  const patient = (await database().patients()).find((item) => item.id === room.patientId);
  const call = room.callId ? (await database().calls(room.patientId)).find((item) => item.id === room.callId) : null;
  return {
    purpose: room.purpose,
    patientName: patient?.preferredName ?? "the patient",
    patientIdentity: room.patientIdentity,
    openingScript: call?.openingScript ?? `You are the automated medication assistant for ${productName()}.`,
    productName: productName(),
  };
}

function assertAgent(secret: string) {
  const expected = process.env.AGENT_SHARED_SECRET?.trim();
  if (!expected || !safeEqual(secret, expected)) throw new AppError(401, "agent_unauthorized", "The agent secret was rejected.");
}

export async function runAgentTool(secret: string, body: { tool: string; roomName: string; idempotencyKey: string; args: Record<string, unknown> }) {
  assertAgent(secret);
  const db = database();
  const room = await db.roomByName(body.roomName);
  if (!room || room.endedAt) throw new AppError(404, "room_missing", "That room is not active.");
  const patientId = room.patientId;
  return db.remember(`tool:${body.idempotencyKey}`, async () => {
    if (body.tool === "read_plan") {
      const { medications } = await confirmedMedications(patientId);
      const doses = await db.doses(patientId);
      return {
        spokenScript: "Here is the confirmed plan.",
        medications: medications.map((medication) => ({
          id: medication.id,
          name: medication.name,
          kind: medication.instructionKind,
          instructions: administrationInstructions(medication),
          sourceText: medication.sourceText,
        })),
        doses: doses.filter((dose) => dose.state === "pending").slice(0, 8),
      };
    }
    if (body.tool === "record_dose") {
      const occurrenceId = String(body.args.occurrenceId ?? "");
      const state = String(body.args.state ?? "") as DoseReportState;
      if (!["reported_taken", "reported_not_taken", "unsure", "no_response"].includes(state)) {
        throw new AppError(400, "bad_state", "That dose report state is not valid.");
      }
      const dose = (await db.doses(patientId)).find((item) => item.id === occurrenceId);
      if (!dose) throw new AppError(404, "dose_missing", "That dose is not on this patient's plan.");
      await db.saveDoseState(occurrenceId, state);
      const medication = (await db.medications(patientId)).find((item) => item.id === dose.medicationId);
      const spokenScript = doseReportSpeech(state, medication?.name ?? "the medicine");
      await db.insertActivity({
        id: crypto.randomUUID(),
        patientId,
        title: "Dose reported",
        detail: spokenScript,
        source: SOURCE.report,
        status: state,
        createdAt: new Date().toISOString(),
      });
      return { spokenScript };
    }
    if (body.tool === "record_symptom") {
      const text = String(body.args.text ?? "").slice(0, 2000);
      if (!text) throw new AppError(400, "symptom_required", "There is no symptom text to save.");
      const classified = classifySymptom(text);
      await db.insertSymptom({
        id: crypto.randomUUID(),
        patientId,
        text,
        urgent: classified.urgent,
        source: SOURCE.report,
        createdAt: new Date().toISOString(),
        callId: room.callId,
      });
      await db.insertActivity({
        id: crypto.randomUUID(),
        patientId,
        title: classified.urgent ? "Urgent symptom reported" : "Symptom reported",
        detail: text,
        source: SOURCE.report,
        status: classified.urgent ? "urgent" : "saved",
        createdAt: new Date().toISOString(),
      });
      return { spokenScript: classified.spokenScript };
    }
    if (body.tool === "finish_cabinet") return recordCabinetFinish(patientId);
    if (body.tool === "add_replacement") {
      const medicationId = String(body.args.medicationId ?? "");
      const confirmed = body.args.patientConfirmedNeed === true;
      const result = await maybeTask(patientId, medicationId, "obtain_missing", confirmed);
      return {
        spokenScript: result.created
          ? "I added a task to obtain that medicine. I did not change the confirmed plan."
          : "I did not add a task. A missing medicine is added only after you confirm it is needed, and an open task is not duplicated.",
      };
    }
    if (body.tool === "record_pharmacy") {
      const quoted = {
        name: String(body.args.quotedName ?? ""),
        strengthValue: typeof body.args.strengthValue === "number" ? body.args.strengthValue : null,
        strengthUnit: typeof body.args.strengthUnit === "string" ? body.args.strengthUnit : null,
        formulation: typeof body.args.formulation === "string" ? body.args.formulation : null,
        release: typeof body.args.release === "string" ? body.args.release : null,
        route: typeof body.args.route === "string" ? body.args.route : "oral",
      };
      const decision = assessSubstitution(prescribedAcetaminophen, quoted, quoted.name.toLowerCase().includes("demogen") ? pharmacyCandidate : null);
      const statement = String(body.args.statement ?? "");
      const price = body.args.priceText ? String(body.args.priceText) : null;
      await db.insertPharmacy({
        id: crypto.randomUUID(),
        patientId,
        callId: room.callId,
        inStock: body.args.inStock === true,
        quotedName: quoted.name,
        quotedStrength: formatStrength(quoted.strengthValue, quoted.strengthUnit),
        priceText: price,
        statement,
        decision: decision.decision,
        reason: decision.reason,
        createdAt: new Date().toISOString(),
      });
      const spokenScript = `I saved the pharmacy statement. Decision: ${decision.decision.replaceAll("_", " ")}. ${decision.reason} This does not change the confirmed plan.`;
      await db.insertActivity({
        id: crypto.randomUUID(),
        patientId,
        title: "Pharmacy update",
        detail: `${statement} ${spokenScript}`,
        source: SOURCE.pharmacy,
        status: decision.decision,
        createdAt: new Date().toISOString(),
      });
      return { spokenScript, decision: decision.decision };
    }
    if (body.tool === "end_call") {
      await db.endRoom(room.livekitRoom);
      if (room.callId) {
        const summary = String(body.args.summary ?? "Call ended.");
        await db.patchCall(room.callId, { status: "completed", summary });
      }
      return { spokenScript: "Goodbye." };
    }
    throw new AppError(400, "unknown_tool", "That tool is not available.");
  });
}

export async function applyWebhook(body: string, authorization: string | null) {
  const event = await readLiveKitWebhook(body, authorization);
  if (!event.roomName) return { ok: true };
  const db = database();
  const room = await db.roomByName(event.roomName);
  if (!room?.callId) return { ok: true };
  const call = (await db.calls(room.patientId)).find((item) => item.id === room.callId);
  if (!call) return { ok: true };
  const status = mapProviderSignal({ callStatus: event.callStatus ?? (event.event === "room_finished" ? "disconnected" : null) });
  const applied = applyProviderEvent(
    { ...call, providerEventIds: call.providerEventIds, status: call.status as "dialing" },
    { id: event.id, status },
  );
  if (applied.duplicate) return { ok: true, duplicate: true };
  await db.patchCall(call.id, { status: applied.call.status, providerEventIds: applied.call.providerEventIds });
  const doseState = doseStateForUnsuccessfulCall(applied.call.status as "busy", false);
  if (doseState && call.doseOccurrenceId) {
    const dose = (await db.doses(room.patientId)).find((item) => item.id === call.doseOccurrenceId);
    if (dose && dose.state === "pending") await db.saveDoseState(dose.id, doseState);
  }
  await db.insertActivity({
    id: crypto.randomUUID(),
    patientId: room.patientId,
    title: `Call ${applied.call.status.replaceAll("_", " ")}`,
    detail: "Provider status update. An unanswered call is not a confirmed missed dose.",
    source: SOURCE.system,
    status: applied.call.status,
    createdAt: new Date().toISOString(),
  });
  return { ok: true };
}

export async function createJudgeInvite() {
  await requirePresenter();
  const db = database();
  const patient = (await db.patients()).find((item) => item.id === DEMO.patientId && item.isDemo);
  if (!patient) throw new AppError(404, "demo_missing", "Reset the demo before creating a judge link.");
  const token = Buffer.from(crypto.randomUUID() + crypto.randomUUID()).toString("base64url");
  const row = {
    id: crypto.randomUUID(),
    patientId: patient.id,
    tokenHash: hashToken(token),
    purpose: "demo_family_session" as const,
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    usedAt: null,
    usedBy: null,
  };
  await db.insertInvite(row);
  return { url: `${appUrl()}/join/${token}`, expiresAt: row.expiresAt };
}

export async function redeemInvite(token: string) {
  const mode = requireMode();
  const db = database();
  const invite = await db.findInvite(hashToken(token));
  const state = invitationState(invite ? { expiresAt: invite.expiresAt, usedAt: invite.usedAt } : null, new Date());
  if (state !== "valid" || !invite) throw new AppError(410, state, state === "used" ? "This invite was already used." : "This invite is not valid.");
  if (invite.purpose !== "demo_family_session") throw new AppError(400, "wrong_purpose", "Use the family account flow for this invite.");
  if (mode === "rehearsal") {
    const consumed = await db.consumeInvite(hashToken(token));
    if (!consumed) throw new AppError(410, "used", "This invite was already used.");
    await setRehearsalActor(DEMO.familyProfileId, "family");
    return { redirectTo: "/family" };
  }
  const email = process.env.DEMO_FAMILY_EMAIL?.trim();
  const password = process.env.DEMO_FAMILY_PASSWORD?.trim();
  if (!email || !password) {
    throw new AppError(503, "demo_family_unconfigured", "Set DEMO_FAMILY_EMAIL and DEMO_FAMILY_PASSWORD.");
  }
  const supabase = await createUserClient();
  const signed = await supabase.auth.signInWithPassword({ email, password });
  if (signed.error) throw new AppError(401, "demo_sign_in_failed", "The demo family account could not sign in. Check the seed password.");
  const consumed = await db.consumeInvite(hashToken(token));
  if (!consumed) throw new AppError(410, "used", "This invite was already used.");
  return { redirectTo: "/family" };
}

export async function presenterLogin(code: string) {
  requireMode();
  const expected = process.env.PRESENTER_ACCESS_CODE?.trim();
  if (!expected) throw new AppError(503, "presenter_unconfigured", "Set PRESENTER_ACCESS_CODE before opening the presenter panel.");
  if (!safeEqual(code, expected)) throw new AppError(401, "presenter_rejected", "That presenter code was not accepted.");
  const { setPresenterCookie } = await import("./cookies");
  await setPresenterCookie();
  return { ok: true };
}

export async function presenterFeed() {
  await requirePresenter();
  const db = database();
  const patient = (await db.patients()).find((item) => item.id === DEMO.patientId);
  if (!patient) return { calls: [], activity: [], rooms: [] };
  const [calls, activity, rooms] = await Promise.all([db.calls(patient.id), db.activity(patient.id), db.rooms(patient.id)]);
  return { calls, activity: activity.slice(0, 30), rooms };
}

export async function resetDemo() {
  await requirePresenter();
  await database().resetDemo();
  return { ok: true };
}

export async function signInLive(email: string, password: string) {
  if (runtimeMode() !== "live") throw new AppError(409, "live_only", "Password sign in needs Supabase. Rehearsal mode uses the labeled rehearsal buttons.");
  const supabase = await createUserClient();
  const result = await supabase.auth.signInWithPassword({ email, password });
  if (result.error) throw new AppError(401, "sign_in_failed", "That email or password was not accepted.");
  const actor = await currentActor();
  return { redirectTo: actor.role === "patient" ? "/patient" : actor.role === "family" ? "/family" : "/presenter" };
}

export async function signUpPatient(email: string, password: string, displayName: string, phone: string) {
  if (runtimeMode() !== "live") throw new AppError(409, "live_only", "Creating an account needs Supabase.");
  const supabase = await createUserClient();
  const created = await supabase.auth.signUp({ email, password });
  if (created.error || !created.data.user) throw new AppError(400, "sign_up_failed", created.error?.message ?? "Sign up failed.");
  const profile = await supabase.rpc("create_patient_profile", { display_name: displayName, phone });
  if (profile.error) throw new AppError(400, "profile_failed", profile.error.message);
  return { ok: true };
}
