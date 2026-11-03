import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEMO, buildSchedule, demoMedications, type PlanMedication } from "@nomi/domain";
import { createServiceClient } from "./supabase";

export type PatientRow = {
  id: string;
  profileId: string;
  preferredName: string;
  phoneE164: string | null;
  timeZone: string;
  isDemo: boolean;
};

export type PlanRow = {
  id: string;
  patientId: string;
  status: "draft" | "confirmed" | "archived";
  documentPath: string | null;
  confirmedAt: string | null;
  createdAt: string;
};

export type MedRow = PlanMedication & { planVersionId: string; patientId: string };
export type DoseRow = {
  id: string;
  patientId: string;
  planVersionId: string;
  medicationId: string;
  scheduledFor: string;
  instructions: string;
  state: "pending" | "reported_taken" | "reported_not_taken" | "unsure" | "no_response";
};
export type SymptomRow = { id: string; patientId: string; text: string; urgent: boolean; source: string; createdAt: string; callId: string | null };
export type ScanRow = {
  id: string;
  patientId: string;
  planVersionId: string | null;
  requestId: string;
  capturedAt: string;
  kind: string;
  outcome: string;
  planMatch: string | null;
  expirationStatus: string | null;
  matchedMedicationId: string | null;
  spokenScript: string;
  detail: string;
  source: string;
  createdAt: string;
};
export type TaskRow = { id: string; patientId: string; medicationKey: string; kind: "replace_expired" | "obtain_missing"; title: string; status: "open" | "done"; createdAt: string };
export type ActivityRow = { id: string; patientId: string; title: string; detail: string; source: string; status: string; createdAt: string };
export type CallRow = {
  id: string;
  patientId: string;
  purpose: "reminder" | "pharmacy" | "medicine_check";
  status: string;
  idempotencyKey: string;
  doseOccurrenceId: string | null;
  roomName: string | null;
  openingScript: string | null;
  summary: string | null;
  providerEventIds: string[];
  createdAt: string;
};
export type PharmacyRow = {
  id: string;
  patientId: string;
  callId: string | null;
  inStock: boolean | null;
  quotedName: string | null;
  quotedStrength: string | null;
  priceText: string | null;
  statement: string;
  decision: string;
  reason: string;
  createdAt: string;
};
export type RoomRow = { id: string; patientId: string; livekitRoom: string; purpose: string; patientIdentity: string; callId: string | null; createdAt: string; endedAt: string | null };
export type InviteRow = { id: string; patientId: string; tokenHash: string; purpose: "family_link" | "demo_family_session"; expiresAt: string; usedAt: string | null; usedBy: string | null };
export type LinkRow = { patientId: string; familyProfileId: string; status: string };

type State = {
  patients: PatientRow[];
  links: LinkRow[];
  plans: PlanRow[];
  medications: MedRow[];
  doses: DoseRow[];
  symptoms: SymptomRow[];
  scans: ScanRow[];
  tasks: TaskRow[];
  activity: ActivityRow[];
  calls: CallRow[];
  pharmacy: PharmacyRow[];
  rooms: RoomRow[];
  invites: InviteRow[];
  idempotency: Record<string, unknown>;
  documents: { path: string; patientId: string; mimeType: string }[];
};

const root = path.join(process.cwd(), ".rehearsal");

function today(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function freshDemoState(): State {
  const now = new Date().toISOString();
  const planId = DEMO.planVersionId;
  const medications: MedRow[] = demoMedications.map((medication) => ({ ...medication, planVersionId: planId, patientId: DEMO.patientId }));
  const schedule = buildSchedule(demoMedications, { startDate: today(DEMO.timeZone), days: 2, timeZone: DEMO.timeZone });
  return {
    patients: [
      {
        id: DEMO.patientId,
        profileId: DEMO.patientProfileId,
        preferredName: DEMO.patientName,
        phoneE164: process.env.DEMO_PATIENT_PHONE?.trim() || null,
        timeZone: DEMO.timeZone,
        isDemo: true,
      },
    ],
    links: [{ patientId: DEMO.patientId, familyProfileId: DEMO.familyProfileId, status: "active" }],
    plans: [{ id: planId, patientId: DEMO.patientId, status: "confirmed", documentPath: null, confirmedAt: now, createdAt: now }],
    medications,
    doses: schedule.doses.map((dose) => ({
      id: crypto.randomUUID(),
      patientId: DEMO.patientId,
      planVersionId: planId,
      medicationId: dose.medicationId,
      scheduledFor: dose.scheduledFor,
      instructions: dose.instructions,
      state: "pending" as const,
    })),
    symptoms: [],
    scans: [],
    tasks: [],
    activity: [
      {
        id: crypto.randomUUID(),
        patientId: DEMO.patientId,
        title: "Demo plan is ready",
        detail: "Fictional discharge plan for Elena Vasquez. Source text is synthetic.",
        source: "system",
        status: "confirmed",
        createdAt: now,
      },
    ],
    calls: [],
    pharmacy: [],
    rooms: [],
    invites: [],
    idempotency: {},
    documents: [],
  };
}

let queue: Promise<unknown> = Promise.resolve();

async function withState<T>(mutate: (state: State) => Promise<T> | T): Promise<T> {
  const run = queue.then(async () => {
    await mkdir(root, { recursive: true });
    const file = path.join(root, "state.json");
    let state: State;
    try {
      state = JSON.parse(await readFile(file, "utf8")) as State;
    } catch {
      state = freshDemoState();
    }
    const result = await mutate(state);
    await writeFile(file, JSON.stringify(state));
    return result;
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export const rehearsalDb = {
  patients: () => withState((state) => state.patients),
  links: () => withState((state) => state.links),
  plans: (patientId: string) => withState((state) => state.plans.filter((plan) => plan.patientId === patientId)),
  medications: (patientId: string) => withState((state) => state.medications.filter((medication) => medication.patientId === patientId)),
  doses: (patientId: string) => withState((state) => state.doses.filter((dose) => dose.patientId === patientId)),
  symptoms: (patientId: string) => withState((state) => state.symptoms.filter((row) => row.patientId === patientId)),
  scans: (patientId: string) => withState((state) => state.scans.filter((row) => row.patientId === patientId)),
  tasks: (patientId: string) => withState((state) => state.tasks.filter((row) => row.patientId === patientId)),
  activity: (patientId: string) => withState((state) => state.activity.filter((row) => row.patientId === patientId)),
  calls: (patientId: string) => withState((state) => state.calls.filter((row) => row.patientId === patientId)),
  pharmacy: (patientId: string) => withState((state) => state.pharmacy.filter((row) => row.patientId === patientId)),
  rooms: (patientId: string) => withState((state) => state.rooms.filter((row) => row.patientId === patientId)),
  roomByName: (name: string) => withState((state) => state.rooms.find((room) => room.livekitRoom === name) ?? null),
  async remember<T>(key: string, create: () => Promise<T>): Promise<T> {
    const existing = await withState((state) => (key in state.idempotency ? (state.idempotency[key] as T) : null));
    if (existing) return existing;
    const created = await create();
    await withState((state) => {
      state.idempotency[key] = created;
    });
    return created;
  },
  async insertDocument(patientId: string, mimeType: string, bytes: Buffer): Promise<string> {
    const id = crypto.randomUUID();
    const filePath = path.join(root, "files", id);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, bytes);
    await withState((state) => {
      state.documents.push({ path: id, patientId, mimeType });
    });
    return id;
  },
  async readDocument(patientId: string, documentPath: string): Promise<{ mimeType: string; bytes: Buffer } | null> {
    const meta = await withState((state) => state.documents.find((document) => document.path === documentPath && document.patientId === patientId) ?? null);
    if (!meta) return null;
    const bytes = await readFile(path.join(root, "files", documentPath));
    return { mimeType: meta.mimeType, bytes };
  },
  insertDraft: (plan: PlanRow, medications: MedRow[]) =>
    withState((state) => {
      state.plans.push(plan);
      state.medications.push(...medications);
    }),
  updateDraftMeds: (planId: string, medications: MedRow[]) =>
    withState((state) => {
      state.medications = state.medications.filter((medication) => medication.planVersionId !== planId);
      state.medications.push(...medications);
    }),
  confirmPlan: (planId: string, doses: DoseRow[]) =>
    withState((state) => {
      const plan = state.plans.find((item) => item.id === planId);
      if (!plan) return;
      state.plans.forEach((item) => {
        if (item.patientId === plan.patientId && item.status === "confirmed") item.status = "archived";
      });
      plan.status = "confirmed";
      plan.confirmedAt = new Date().toISOString();
      state.doses.push(...doses);
    }),
  insertScan: (row: ScanRow) => withState((state) => state.scans.push(row)),
  insertTask: (row: TaskRow) => withState((state) => state.tasks.push(row)),
  insertActivity: (row: ActivityRow) => withState((state) => state.activity.push(row)),
  insertSymptom: (row: SymptomRow) => withState((state) => state.symptoms.push(row)),
  saveDoseState: (occurrenceId: string, doseState: DoseRow["state"]) =>
    withState((state) => {
      const dose = state.doses.find((item) => item.id === occurrenceId);
      if (dose) dose.state = doseState;
    }),
  insertCall: (row: CallRow) => withState((state) => state.calls.push(row)),
  patchCall: (id: string, patch: Partial<CallRow>) =>
    withState((state) => {
      const call = state.calls.find((item) => item.id === id);
      if (call) Object.assign(call, patch);
    }),
  insertPharmacy: (row: PharmacyRow) => withState((state) => state.pharmacy.push(row)),
  insertRoom: (row: RoomRow) => withState((state) => state.rooms.push(row)),
  endRoom: (roomName: string) =>
    withState((state) => {
      const room = state.rooms.find((item) => item.livekitRoom === roomName);
      if (room) room.endedAt = new Date().toISOString();
    }),
  insertInvite: (row: InviteRow) => withState((state) => state.invites.push(row)),
  consumeInvite: (hash: string) =>
    withState((state) => {
      const invite = state.invites.find((item) => item.tokenHash === hash);
      if (!invite || invite.usedAt || new Date(invite.expiresAt).getTime() <= Date.now()) return null;
      invite.usedAt = new Date().toISOString();
      return invite;
    }),
  findInvite: (hash: string) => withState((state) => state.invites.find((item) => item.tokenHash === hash) ?? null),
  resetDemo: () => withState((state) => Object.assign(state, freshDemoState())),
};

function db() {
  return createServiceClient();
}

function must<T>(result: { data: T; error: { message: string } | null }, label: string): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

export const liveDb = {
  async patients(): Promise<PatientRow[]> {
    const data = must(await db().from("patients").select("id, profile_id, preferred_name, phone_e164, time_zone, is_demo"), "patients");
    return (data ?? []).map((row) => ({
      id: row.id as string,
      profileId: row.profile_id as string,
      preferredName: row.preferred_name as string,
      phoneE164: (row.phone_e164 as string | null) ?? null,
      timeZone: row.time_zone as string,
      isDemo: Boolean(row.is_demo),
    }));
  },
  async links(): Promise<LinkRow[]> {
    const data = must(await db().from("family_links").select("patient_id, family_profile_id, status"), "links");
    return (data ?? []).map((row) => ({ patientId: row.patient_id as string, familyProfileId: row.family_profile_id as string, status: row.status as string }));
  },
  async plans(patientId: string): Promise<PlanRow[]> {
    const data = must(
      await db().from("plan_versions").select("id, patient_id, status, source_document_id, confirmed_at, created_at").eq("patient_id", patientId),
      "plans",
    );
    return (data ?? []).map((row) => ({
      id: row.id as string,
      patientId: row.patient_id as string,
      status: row.status as PlanRow["status"],
      documentPath: (row.source_document_id as string | null) ?? null,
      confirmedAt: (row.confirmed_at as string | null) ?? null,
      createdAt: row.created_at as string,
    }));
  },
  async medications(patientId: string): Promise<MedRow[]> {
    const data = must(await db().from("medications").select("*").eq("patient_id", patientId).order("sort_order"), "medications");
    return (data ?? []).map(medFromRow);
  },
  async doses(patientId: string): Promise<DoseRow[]> {
    const data = must(await db().from("dose_occurrences").select("*").eq("patient_id", patientId), "doses");
    return (data ?? []).map((row) => ({
      id: row.id as string,
      patientId: row.patient_id as string,
      planVersionId: row.plan_version_id as string,
      medicationId: row.medication_id as string,
      scheduledFor: row.scheduled_for as string,
      instructions: row.instructions as string,
      state: row.state as DoseRow["state"],
    }));
  },
  async symptoms(patientId: string): Promise<SymptomRow[]> {
    const data = must(await db().from("symptom_reports").select("*").eq("patient_id", patientId), "symptoms");
    return (data ?? []).map((row) => ({
      id: row.id as string,
      patientId: row.patient_id as string,
      text: row.text as string,
      urgent: Boolean(row.urgent),
      source: row.source as string,
      createdAt: row.created_at as string,
      callId: (row.call_id as string | null) ?? null,
    }));
  },
  async scans(patientId: string): Promise<ScanRow[]> {
    const data = must(await db().from("scan_results").select("*").eq("patient_id", patientId), "scans");
    return (data ?? []).map((row) => ({
      id: row.id as string,
      patientId: row.patient_id as string,
      planVersionId: (row.plan_version_id as string | null) ?? null,
      requestId: row.request_id as string,
      capturedAt: row.captured_at as string,
      kind: row.kind as string,
      outcome: row.outcome as string,
      planMatch: (row.plan_match as string | null) ?? null,
      expirationStatus: (row.expiration_status as string | null) ?? null,
      matchedMedicationId: (row.matched_medication_id as string | null) ?? null,
      spokenScript: row.spoken_script as string,
      detail: row.detail as string,
      source: row.source as string,
      createdAt: row.created_at as string,
    }));
  },
  async tasks(patientId: string): Promise<TaskRow[]> {
    const data = must(await db().from("shopping_tasks").select("*").eq("patient_id", patientId), "tasks");
    return (data ?? []).map((row) => ({
      id: row.id as string,
      patientId: row.patient_id as string,
      medicationKey: row.medication_key as string,
      kind: row.kind as TaskRow["kind"],
      title: row.title as string,
      status: row.status as TaskRow["status"],
      createdAt: row.created_at as string,
    }));
  },
  async activity(patientId: string): Promise<ActivityRow[]> {
    const data = must(await db().from("activity_events").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(80), "activity");
    return (data ?? []).map((row) => ({
      id: row.id as string,
      patientId: row.patient_id as string,
      title: row.title as string,
      detail: (row.detail as string) ?? "",
      source: row.source as string,
      status: row.status as string,
      createdAt: row.created_at as string,
    }));
  },
  async calls(patientId: string): Promise<CallRow[]> {
    const data = must(await db().from("calls").select("*").eq("patient_id", patientId), "calls");
    return (data ?? []).map(callFromRow);
  },
  async pharmacy(patientId: string): Promise<PharmacyRow[]> {
    const data = must(await db().from("pharmacy_updates").select("*").eq("patient_id", patientId), "pharmacy");
    return (data ?? []).map((row) => ({
      id: row.id as string,
      patientId: row.patient_id as string,
      callId: (row.call_id as string | null) ?? null,
      inStock: (row.in_stock as boolean | null) ?? null,
      quotedName: (row.quoted_name as string | null) ?? null,
      quotedStrength: (row.quoted_strength as string | null) ?? null,
      priceText: (row.price_text as string | null) ?? null,
      statement: row.statement as string,
      decision: row.decision as string,
      reason: row.reason as string,
      createdAt: row.created_at as string,
    }));
  },
  async rooms(patientId: string): Promise<RoomRow[]> {
    const data = must(await db().from("rooms").select("*").eq("patient_id", patientId), "rooms");
    return (data ?? []).map(roomFromRow);
  },
  async roomByName(name: string): Promise<RoomRow | null> {
    const result = await db().from("rooms").select("*").eq("livekit_room", name).maybeSingle();
    if (result.error) throw new Error(result.error.message);
    return result.data ? roomFromRow(result.data) : null;
  },
  async remember<T>(key: string, create: () => Promise<T>): Promise<T> {
    const existing = await db().from("idempotency_keys").select("response").eq("key", key).maybeSingle();
    if (existing.data?.response) return existing.data.response as T;
    const created = await create();
    await db().from("idempotency_keys").insert({ key, scope: "tool", response: created });
    return created;
  },
  async insertDocument(patientId: string, mimeType: string, bytes: Buffer): Promise<string> {
    const id = crypto.randomUUID();
    const storagePath = `${patientId}/${id}`;
    const upload = await db().storage.from("documents").upload(storagePath, bytes, { contentType: mimeType, upsert: false });
    if (upload.error) throw new Error(upload.error.message);
    must(await db().from("documents").insert({ id, patient_id: patientId, storage_path: storagePath, mime_type: mimeType }), "document");
    return id;
  },
  async readDocument(patientId: string, documentPath: string): Promise<{ mimeType: string; bytes: Buffer } | null> {
    const doc = await db().from("documents").select("storage_path, mime_type").eq("id", documentPath).eq("patient_id", patientId).maybeSingle();
    if (!doc.data) return null;
    const file = await db().storage.from("documents").download(doc.data.storage_path as string);
    if (file.error || !file.data) return null;
    const bytes = Buffer.from(await file.data.arrayBuffer());
    return { mimeType: doc.data.mime_type as string, bytes };
  },
  async insertDraft(plan: PlanRow, medications: MedRow[]) {
    must(
      await db().from("plan_versions").insert({
        id: plan.id,
        patient_id: plan.patientId,
        status: "draft",
        source_document_id: plan.documentPath,
        created_at: plan.createdAt,
      }),
      "draft",
    );
    if (medications.length) must(await db().from("medications").insert(medications.map(medToRow)), "draft meds");
  },
  async updateDraftMeds(planId: string, medications: MedRow[]) {
    must(await db().from("medications").delete().eq("plan_version_id", planId), "clear meds");
    if (medications.length) must(await db().from("medications").insert(medications.map(medToRow)), "update meds");
  },
  async confirmPlan(planId: string, doses: DoseRow[]) {
    const plan = must(await db().from("plan_versions").select("patient_id").eq("id", planId).single(), "plan");
    if (!plan) throw new Error("plan missing");
    await db().from("plan_versions").update({ status: "archived" }).eq("patient_id", plan.patient_id).eq("status", "confirmed");
    must(await db().from("plan_versions").update({ status: "confirmed", confirmed_at: new Date().toISOString() }).eq("id", planId), "confirm");
    if (doses.length) {
      must(
        await db().from("dose_occurrences").insert(
          doses.map((dose) => ({
            id: dose.id,
            patient_id: dose.patientId,
            plan_version_id: dose.planVersionId,
            medication_id: dose.medicationId,
            scheduled_for: dose.scheduledFor,
            instructions: dose.instructions,
            state: dose.state,
          })),
        ),
        "doses",
      );
    }
  },
  async insertScan(row: ScanRow) {
    must(
      await db().from("scan_results").insert({
        id: row.id,
        patient_id: row.patientId,
        plan_version_id: row.planVersionId,
        request_id: row.requestId,
        captured_at: row.capturedAt,
        kind: row.kind,
        outcome: row.outcome,
        plan_match: row.planMatch,
        expiration_status: row.expirationStatus,
        matched_medication_id: row.matchedMedicationId,
        spoken_script: row.spokenScript,
        detail: row.detail,
        source: row.source,
        idempotency_key: row.requestId,
        evidence: { kind: row.kind, outcome: row.outcome },
      }),
      "scan",
    );
  },
  async insertTask(row: TaskRow) {
    const result = await db().from("shopping_tasks").insert({
      id: row.id,
      patient_id: row.patientId,
      medication_key: row.medicationKey,
      kind: row.kind,
      title: row.title,
      status: row.status,
    });
    if (result.error && !result.error.message.toLowerCase().includes("duplicate")) throw new Error(result.error.message);
  },
  async insertActivity(row: ActivityRow) {
    must(
      await db().from("activity_events").insert({
        id: row.id,
        patient_id: row.patientId,
        title: row.title,
        detail: row.detail,
        source: row.source,
        status: row.status,
      }),
      "activity",
    );
  },
  async insertSymptom(row: SymptomRow) {
    must(
      await db().from("symptom_reports").insert({
        id: row.id,
        patient_id: row.patientId,
        text: row.text,
        urgent: row.urgent,
        source: row.source,
        call_id: row.callId,
        idempotency_key: row.id,
      }),
      "symptom",
    );
  },
  async saveDoseState(occurrenceId: string, doseState: DoseRow["state"]) {
    must(await db().from("dose_occurrences").update({ state: doseState }).eq("id", occurrenceId), "dose state");
  },
  async insertCall(row: CallRow) {
    must(
      await db().from("calls").insert({
        id: row.id,
        patient_id: row.patientId,
        purpose: row.purpose,
        status: row.status,
        idempotency_key: row.idempotencyKey,
        dose_occurrence_id: row.doseOccurrenceId,
        room_name: row.roomName,
        opening_script: row.openingScript,
        summary: row.summary,
        provider_event_ids: row.providerEventIds,
      }),
      "call",
    );
  },
  async patchCall(id: string, patch: Partial<CallRow>) {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.status) update.status = patch.status;
    if (patch.summary !== undefined) update.summary = patch.summary;
    if (patch.providerEventIds) update.provider_event_ids = patch.providerEventIds;
    if (patch.roomName) update.room_name = patch.roomName;
    must(await db().from("calls").update(update).eq("id", id), "patch call");
  },
  async insertPharmacy(row: PharmacyRow) {
    must(
      await db().from("pharmacy_updates").insert({
        id: row.id,
        patient_id: row.patientId,
        call_id: row.callId,
        in_stock: row.inStock,
        quoted_name: row.quotedName,
        quoted_strength: row.quotedStrength,
        price_text: row.priceText,
        statement: row.statement,
        decision: row.decision === "recorded" ? "recorded" : row.decision,
        reason: row.reason,
        changes_plan: false,
        idempotency_key: row.id,
      }),
      "pharmacy",
    );
  },
  async insertRoom(row: RoomRow) {
    must(
      await db().from("rooms").insert({
        id: row.id,
        patient_id: row.patientId,
        livekit_room: row.livekitRoom,
        purpose: row.purpose,
        patient_identity: row.patientIdentity,
        call_id: row.callId,
      }),
      "room",
    );
  },
  async endRoom(roomName: string) {
    await db().from("rooms").update({ ended_at: new Date().toISOString() }).eq("livekit_room", roomName);
  },
  async insertInvite(row: InviteRow) {
    must(
      await db().from("invitations").insert({
        id: row.id,
        patient_id: row.patientId,
        token_hash: row.tokenHash,
        purpose: row.purpose,
        expires_at: row.expiresAt,
      }),
      "invite",
    );
  },
  async findInvite(hash: string): Promise<InviteRow | null> {
    const result = await db().from("invitations").select("*").eq("token_hash", hash).maybeSingle();
    if (!result.data) return null;
    return {
      id: result.data.id as string,
      patientId: result.data.patient_id as string,
      tokenHash: result.data.token_hash as string,
      purpose: result.data.purpose as InviteRow["purpose"],
      expiresAt: result.data.expires_at as string,
      usedAt: (result.data.used_at as string | null) ?? null,
      usedBy: (result.data.used_by as string | null) ?? null,
    };
  },
  async consumeInvite(hash: string): Promise<InviteRow | null> {
    const invite = await this.findInvite(hash);
    if (!invite || invite.usedAt || new Date(invite.expiresAt).getTime() <= Date.now()) return null;
    const updated = await db().from("invitations").update({ used_at: new Date().toISOString() }).eq("id", invite.id).is("used_at", null).select("*");
    if (!updated.data?.length) return null;
    return { ...invite, usedAt: new Date().toISOString() };
  },
  async resetDemo() {
    const client = db();
    const patientId = DEMO.patientId;
    const existing = await client.from("patients").select("id").eq("id", patientId).maybeSingle();
    if (!existing.data) {
      throw new Error("Demo patient is missing. Run npm run seed after creating the Supabase users.");
    }
    for (const table of ["rooms", "dose_reports", "symptom_reports", "pharmacy_updates", "shopping_tasks", "scan_results", "scan_sessions", "calls", "dose_occurrences", "medications", "activity_events", "extractions", "plan_versions", "documents", "invitations"]) {
      await client.from(table).delete().eq("patient_id", patientId);
    }
    const fresh = freshDemoState();
    const plan = fresh.plans[0];
    if (!plan) return;
    await client.from("patients").update({ phone_e164: fresh.patients[0]?.phoneE164 ?? null }).eq("id", patientId);
    await this.insertDraft(plan, fresh.medications);
    await this.confirmPlan(plan.id, fresh.doses);
    for (const item of fresh.activity) await this.insertActivity(item);
  },
};

function medFromRow(row: Record<string, unknown>): MedRow {
  return {
    id: String(row.id),
    planVersionId: String(row.plan_version_id),
    patientId: String(row.patient_id),
    name: String(row.name),
    ingredients: (row.ingredients as MedRow["ingredients"]) ?? [],
    strengthValue: row.strength_value == null ? null : Number(row.strength_value),
    strengthUnit: (row.strength_unit as string | null) ?? null,
    amountPerDose: (row.amount_per_dose as string | null) ?? null,
    route: (row.route as string | null) ?? null,
    formulation: (row.formulation as string | null) ?? null,
    release: (row.release_type as string | null) ?? null,
    frequency: (row.frequency as string | null) ?? null,
    timings: (row.timings as string[]) ?? [],
    instructionKind: row.instruction_kind as MedRow["instructionKind"],
    duration: (row.duration as string | null) ?? null,
    endDate: row.end_date ? String(row.end_date) : null,
    specialInstructions: (row.special_instructions as string | null) ?? null,
    sourceText: String(row.source_text ?? ""),
    missingFields: (row.missing_fields as string[]) ?? [],
  };
}

function medToRow(medication: MedRow) {
  return {
    id: medication.id,
    plan_version_id: medication.planVersionId,
    patient_id: medication.patientId,
    name: medication.name,
    ingredients: medication.ingredients,
    strength_value: medication.strengthValue,
    strength_unit: medication.strengthUnit,
    amount_per_dose: medication.amountPerDose,
    route: medication.route,
    formulation: medication.formulation,
    release_type: medication.release,
    frequency: medication.frequency,
    timings: medication.timings,
    instruction_kind: medication.instructionKind,
    duration: medication.duration,
    end_date: medication.endDate,
    special_instructions: medication.specialInstructions,
    source_text: medication.sourceText,
    missing_fields: medication.missingFields,
  };
}

function callFromRow(row: Record<string, unknown>): CallRow {
  return {
    id: String(row.id),
    patientId: String(row.patient_id),
    purpose: row.purpose as CallRow["purpose"],
    status: String(row.status),
    idempotencyKey: String(row.idempotency_key),
    doseOccurrenceId: (row.dose_occurrence_id as string | null) ?? null,
    roomName: (row.room_name as string | null) ?? null,
    openingScript: (row.opening_script as string | null) ?? null,
    summary: (row.summary as string | null) ?? null,
    providerEventIds: (row.provider_event_ids as string[]) ?? [],
    createdAt: String(row.created_at),
  };
}

function roomFromRow(row: Record<string, unknown>): RoomRow {
  return {
    id: String(row.id),
    patientId: String(row.patient_id),
    livekitRoom: String(row.livekit_room),
    purpose: String(row.purpose),
    patientIdentity: String(row.patient_identity),
    callId: (row.call_id as string | null) ?? null,
    createdAt: String(row.created_at),
    endedAt: (row.ended_at as string | null) ?? null,
  };
}

export function database() {
  return process.env.APP_MODE === "rehearsal" ? rehearsalDb : liveDb;
}
