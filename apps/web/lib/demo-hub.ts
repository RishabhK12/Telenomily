import {
  DEMO,
  administrationInstructions,
  assessSubstitution,
  baseLabel,
  classifySymptom,
  demoMedications,
  doseReportSpeech,
  duplicateActiveIngredients,
  evaluateLabel,
  foreignMappings,
  formatStrength,
  matchForeignLabel,
  matchPill,
  missingFromScan,
  missingItemScript,
  pharmacyCandidate,
  pharmacyOutOfStock,
  pillReferences,
  prescribedAcetaminophen,
  replacementTaskAction,
  type PlanMatch,
  type SpokenOutcome,
} from "@nomi/domain";
import { database, type ActivityRow, type DemoCall, type DoseRow, type MedRow, type PharmacyRow, type ScanRow, type SymptomRow, type TaskRow } from "./db";
import { SCENE_IMAGE, SCENE_TITLE, isLaptopScene, type LaptopScene } from "./demo-scenes";
import { productName } from "./runtime";

const SOURCE = "demo_simulation";
const HONESTY = "The phone did not ring. This is not a live Grok video call.";
const SYMPTOM_TEXT = "I feel a little unsteady.";
const DISCHARGE_PDF = "/fixtures/DischargeSample.pdf";

export type LaptopDemoResult = {
  scene: string;
  simulated: true;
  title: string;
  lines: string[];
  image: string | null;
  spokenScript: string;
  pdf?: string;
};

export type PresentedMed = {
  id: string;
  name: string;
  instructionKind: string;
  strengthLabel: string;
  instructions: string;
  sourceText: string;
  timings: string[];
  missingFields: string[];
  frequency: string | null;
  amountPerDose: string | null;
  route: string | null;
  formulation: string | null;
  release: string | null;
  specialInstructions: string | null;
};

export type LaptopFamilyBoard = {
  mode: "rehearsal";
  productName: string;
  viewer: { id: string; role: "family"; name: string };
  patient: { id: string; preferredName: string; phoneLast4: string | null; timeZone: string };
  plan: { id: string; status: string; confirmedAt: string | null; medications: PresentedMed[] } | null;
  draft: { id: string; documentPath: string | null; medications: PresentedMed[] } | null;
  doses: Array<DoseRow & { medicationName: string }>;
  asNeeded: PresentedMed[];
  symptoms: SymptomRow[];
  checks: ScanRow[];
  tasks: TaskRow[];
  pharmacy: PharmacyRow[];
  calls: [];
  activeRoom: { livekitRoom: string; createdAt: string } | null;
  activity: ActivityRow[];
  duplicates: { ingredient: string; products: string[] }[];
  checkIn: { completed: number; scheduled: number; explanation: string };
  alerts: ActivityRow[];
};

type DemoDb = ReturnType<typeof database>;

type DemoContext = {
  db: DemoDb;
  patientId: string;
  timeZone: string;
  today: string;
  planId: string;
  medications: MedRow[];
};

function assertRehearsal() {
  if (process.env.APP_MODE !== "rehearsal") {
    throw new Error(
      "Laptop demo simulation runs only when APP_MODE=rehearsal. It does not pretend a phone rang or a live video room connected.",
    );
  }
}

function dayKey(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

function seededMedicine(name: string) {
  const medication = demoMedications.find((item) => item.name.toLowerCase() === name.toLowerCase());
  if (!medication) throw new Error(`${name} is not in the fictional confirmed plan.`);
  return medication;
}

function presentLine(line: string) {
  return line
    .replace(/^Demo simulation\.\s*/i, "")
    .replaceAll(HONESTY, "")
    .replaceAll("This is a scripted laptop simulation.", "")
    .trim();
}

function result(scene: LaptopScene, lines: string[], spokenScript = lines.join("\n")): LaptopDemoResult {
  const cleanLines = lines.map(presentLine).filter((line) => line.length > 0);
  const cleanScript = presentLine(spokenScript) || cleanLines.join(" ");
  const payload: LaptopDemoResult = {
    scene,
    simulated: true,
    title: SCENE_TITLE[scene],
    lines: cleanLines,
    image: SCENE_IMAGE[scene],
    spokenScript: cleanScript,
  };
  if (scene === "discharge") payload.pdf = DISCHARGE_PDF;
  return payload;
}

function fromStoredScript(scene: LaptopScene, spokenScript: string): LaptopDemoResult {
  const lines = spokenScript.split("\n").filter((line) => line.length > 0);
  return result(scene, lines.length > 0 ? lines : [spokenScript], spokenScript);
}

async function loadContext(): Promise<DemoContext> {
  const db = database();
  const patientId = DEMO.patientId;
  const patient = (await db.patients()).find((item) => item.id === patientId);
  if (!patient) throw new Error("Elena's rehearsal record is not loaded.");
  const plan = (await db.plans(patientId)).find((item) => item.status === "confirmed");
  if (!plan) throw new Error("Elena's confirmed plan is not loaded. Reset the rehearsal demo before running the laptop simulation.");
  const medications = (await db.medications(patientId)).filter((medication) => medication.planVersionId === plan.id);
  const timeZone = patient.timeZone || DEMO.timeZone;
  return { db, patientId, timeZone, today: dayKey(new Date().toISOString(), timeZone), planId: plan.id, medications };
}

async function findScan(ctx: DemoContext, requestId: string): Promise<ScanRow | null> {
  const scans = await ctx.db.scans(ctx.patientId);
  return scans.find((scan) => scan.requestId === requestId) ?? null;
}

async function findActivity(ctx: DemoContext, title: string): Promise<ActivityRow | null> {
  const rows = await ctx.db.activity(ctx.patientId);
  return rows.find((row) => row.title === title) ?? null;
}

async function addActivity(ctx: DemoContext, title: string, detail: string, status: string) {
  await ctx.db.insertActivity({
    id: crypto.randomUUID(),
    patientId: ctx.patientId,
    title,
    detail,
    source: SOURCE,
    status,
    createdAt: new Date().toISOString(),
  });
}

async function saveScan(
  ctx: DemoContext,
  row: {
    requestId: string;
    kind: string;
    outcome: string;
    planMatch: string | null;
    expirationStatus: string | null;
    matchedMedicationId: string | null;
    spokenScript: string;
    detail: string;
  },
) {
  const now = new Date().toISOString();
  await ctx.db.insertScan({
    id: crypto.randomUUID(),
    patientId: ctx.patientId,
    planVersionId: ctx.planId,
    requestId: row.requestId,
    capturedAt: now,
    kind: row.kind,
    outcome: row.outcome,
    planMatch: row.planMatch,
    expirationStatus: row.expirationStatus,
    matchedMedicationId: row.matchedMedicationId,
    spokenScript: row.spokenScript,
    detail: row.detail,
    source: SOURCE,
    createdAt: now,
  });
}

function asPlanMatch(value: string | null): PlanMatch {
  if (value === "match" || value === "not_listed" || value === "unconfirmed") return value;
  return "unconfirmed";
}

function asSpokenOutcome(value: string): SpokenOutcome {
  if (value === "on_plan" || value === "not_on_plan" || value === "expired" || value === "missing" || value === "cant_confirm") return value;
  return "cant_confirm";
}

async function openTasks(ctx: DemoContext) {
  return (await ctx.db.tasks(ctx.patientId)).filter((task) => task.status === "open");
}

async function createTask(ctx: DemoContext, medication: MedRow, kind: "replace_expired" | "obtain_missing", patientConfirmedNeed: boolean) {
  const open = await openTasks(ctx);
  const action = replacementTaskAction(
    open.map((task) => ({ medicationKey: task.medicationKey, kind: task.kind })),
    { medicationKey: medication.id, kind, patientConfirmedNeed: patientConfirmedNeed || kind === "replace_expired" },
  );
  if (action !== "create") return action;
  await ctx.db.insertTask({
    id: crypto.randomUUID(),
    patientId: ctx.patientId,
    medicationKey: medication.id,
    kind,
    title: kind === "replace_expired" ? `Replace expired ${medication.name}` : `Obtain ${medication.name}`,
    status: "open",
    createdAt: new Date().toISOString(),
  });
  await addActivity(
    ctx,
    kind === "replace_expired" ? "Demo simulation: replacement task added" : SCENE_TITLE["obtain-cephalexin"],
    `${medication.name}. ${HONESTY}`,
    "open",
  );
  return action;
}

function presentMed(medication: MedRow): PresentedMed {
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
  };
}

function medsFor(planId: string, medications: MedRow[]) {
  return medications.filter((medication) => medication.planVersionId === planId);
}

async function runLabel(ctx: DemoContext, scene: LaptopScene, evidence: ReturnType<typeof baseLabel>) {
  const requestId = `demo:${scene}`;
  const prior = await findScan(ctx, requestId);
  if (prior) return fromStoredScript(scene, prior.spokenScript);
  const evaluation = evaluateLabel(evidence, ctx.medications, ctx.today);
  if (scene === "check-vitamin" && evaluation.outcome === "expired" && evaluation.planMatch === "match" && evaluation.matchedMedicationId) {
    const medication = ctx.medications.find((item) => item.id === evaluation.matchedMedicationId);
    if (medication && medication.instructionKind !== "stop") await createTask(ctx, medication, "replace_expired", false);
  }
  const lines = [`Demo simulation. ${evaluation.spokenScript}`, HONESTY];
  const spokenScript = lines.join("\n");
  await saveScan(ctx, {
    requestId,
    kind: "package",
    outcome: evaluation.outcome,
    planMatch: evaluation.planMatch,
    expirationStatus: evaluation.expirationStatus,
    matchedMedicationId: evaluation.matchedMedicationId,
    spokenScript,
    detail: `${evaluation.detail} ${HONESTY}`,
  });
  await addActivity(ctx, SCENE_TITLE[scene], spokenScript, evaluation.outcome);
  return result(scene, lines, spokenScript);
}

export async function runLaptopDemo(scene: string): Promise<LaptopDemoResult> {
  assertRehearsal();
  if (!isLaptopScene(scene)) throw new Error(`Unknown laptop demo scene: ${scene}.`);
  const ctx = await loadContext();

  if (scene === "discharge") {
    const lines = [
      "Demo simulation. The hospital sheet on this laptop is a blank form. The medication table is empty, so no dose was read from it.",
      "Elena Vasquez's confirmed plan is the fictional schedule already loaded: lisinopril, acetaminophen as needed, cholecalciferol, cephalexin, and stopped aspirin.",
      HONESTY,
    ];
    const prior = await findActivity(ctx, SCENE_TITLE.discharge);
    if (!prior) await addActivity(ctx, SCENE_TITLE.discharge, lines.join(" "), "saved");
    return result(scene, lines);
  }

  if (scene === "check-lisinopril") {
    const medication = seededMedicine("Lisinopril");
    return runLabel(
      ctx,
      scene,
      baseLabel({
        productName: medication.name,
        ingredients: medication.ingredients,
        strengthValue: medication.strengthValue,
        strengthUnit: medication.strengthUnit,
        formulation: "tablet",
        release: "immediate",
        route: "oral",
        expirationDate: "2027-06-01",
        expirationReadable: true,
        imageQuality: "ok",
        visibleText: "Lisinopril 10 mg tablet",
      }),
    );
  }

  if (scene === "check-ibuprofen") {
    return runLabel(
      ctx,
      scene,
      baseLabel({
        productName: "Ibuprofen",
        ingredients: [{ name: "ibuprofen", strengthValue: 200, strengthUnit: "mg" }],
        strengthValue: 200,
        strengthUnit: "mg",
        formulation: "tablet",
        release: "immediate",
        route: "oral",
        expirationDate: "2027-01-01",
        expirationReadable: true,
        imageQuality: "ok",
        visibleText: "Ibuprofen 200 mg tablet",
      }),
    );
  }

  if (scene === "check-vitamin") {
    const medication = seededMedicine("Cholecalciferol");
    return runLabel(
      ctx,
      scene,
      baseLabel({
        productName: medication.name,
        ingredients: medication.ingredients,
        strengthValue: medication.strengthValue,
        strengthUnit: medication.strengthUnit,
        formulation: "capsule",
        release: "immediate",
        route: "oral",
        expirationDate: "2020-01-01",
        expirationReadable: true,
        imageQuality: "ok",
        visibleText: "Cholecalciferol 1000 IU capsule",
      }),
    );
  }

  if (scene === "check-unreadable") {
    return runLabel(ctx, scene, baseLabel({ imageQuality: "blurry", productName: null, ingredients: [], visibleText: "" }));
  }

  if (scene === "check-pill") {
    const requestId = `demo:${scene}`;
    const prior = await findScan(ctx, requestId);
    if (prior) return fromStoredScript(scene, prior.spokenScript);
    const match = matchPill(
      {
        imageQuality: "ok",
        imprintReadable: true,
        imprintSideA: "NC 10",
        imprintSideB: "10",
        shape: "round",
        color: "white",
        scoring: "scored",
        conflicts: [],
      },
      pillReferences,
    );
    const lines = [`Demo simulation. ${match.spokenScript}`, HONESTY];
    const spokenScript = lines.join("\n");
    await saveScan(ctx, {
      requestId,
      kind: "pill",
      outcome: match.outcome,
      planMatch: null,
      expirationStatus: null,
      matchedMedicationId: null,
      spokenScript,
      detail: `${match.reason} ${HONESTY}`,
    });
    await addActivity(ctx, SCENE_TITLE[scene], spokenScript, match.outcome);
    return result(scene, lines, spokenScript);
  }

  if (scene === "check-foreign") {
    const requestId = `demo:${scene}`;
    const prior = await findScan(ctx, requestId);
    if (prior) return fromStoredScript(scene, prior.spokenScript);
    const originalText = "Paracetamol Sol. 500 mg comprimidos. Cada comprimido contiene paracetamol 500 mg. Via oral. Liberacion inmediata.";
    const match = matchForeignLabel(
      {
        imageQuality: "ok",
        originalText,
        englishTranslation: "Paracetamol Sol 500 mg tablets. Each tablet contains paracetamol 500 mg. Oral route. Immediate release.",
        productName: "Paracetamol Sol",
        ingredients: [{ name: "paracetamol", strengthValue: 500, strengthUnit: "mg" }],
        strengthValue: 500,
        strengthUnit: "mg",
        formulation: "comprimidos",
        release: "immediate",
        route: "oral",
        conflicts: [],
      },
      foreignMappings,
    );
    const lines = [`Demo simulation. ${match.spokenScript}`, `Label text from the drawing: ${originalText}`, HONESTY];
    const spokenScript = lines.join("\n");
    await saveScan(ctx, {
      requestId,
      kind: "foreign",
      outcome: match.outcome,
      planMatch: null,
      expirationStatus: null,
      matchedMedicationId: null,
      spokenScript,
      detail: `${match.reason} ${HONESTY}`,
    });
    await addActivity(ctx, SCENE_TITLE[scene], spokenScript, match.outcome);
    return result(scene, lines, spokenScript);
  }

  if (scene === "finish-cabinet") {
    const active = ctx.medications.filter((medication) => medication.instructionKind !== "stop");
    const scans = await ctx.db.scans(ctx.patientId);
    const missing = missingFromScan(
      active,
      scans.map((scan) => ({
        matchedMedicationId: scan.matchedMedicationId,
        planMatch: asPlanMatch(scan.planMatch),
        outcome: asSpokenOutcome(scan.outcome),
      })),
    );
    for (const medication of missing) {
      const requestId = `demo-missing:${ctx.planId}:${medication.id}`;
      if (scans.some((scan) => scan.requestId === requestId)) continue;
      const spokenScript = missingItemScript(medication);
      await saveScan(ctx, {
        requestId,
        kind: "package",
        outcome: "missing",
        planMatch: null,
        expirationStatus: null,
        matchedMedicationId: medication.id,
        spokenScript: `${spokenScript}\n${HONESTY}`,
        detail: `Not found in this scan. ${HONESTY}`,
      });
    }
    const lines = [
      "Demo simulation. Cabinet scan finished.",
      ...(missing.length > 0
        ? missing.map((medication) => missingItemScript(medication))
        : ["Every active medicine on the confirmed plan was found in this scan. Unreadable packages were not counted as matches."]),
      HONESTY,
    ];
    const prior = await findActivity(ctx, SCENE_TITLE["finish-cabinet"]);
    if (!prior) await addActivity(ctx, SCENE_TITLE["finish-cabinet"], lines.join("\n"), "saved");
    return result(scene, lines);
  }

  if (scene === "obtain-cephalexin") {
    const medication = ctx.medications.find((item) => item.name.toLowerCase() === "cephalexin");
    if (!medication || medication.instructionKind === "stop") {
      throw new Error("Cephalexin is not an active medicine on Elena's confirmed plan.");
    }
    const action = await createTask(ctx, medication, "obtain_missing", true);
    const lines =
      action === "create"
        ? ["Demo simulation. I added a task to obtain cephalexin. I did not change the confirmed plan.", HONESTY]
        : action === "skip_duplicate"
          ? ["Demo simulation. I did not add another task. An open task to obtain cephalexin is not duplicated.", HONESTY]
          : ["Demo simulation. I did not add a task. Cephalexin is added only after you confirm it is needed.", HONESTY];
    return result(scene, lines);
  }

  if (scene === "reminder") {
    const prior = await findActivity(ctx, SCENE_TITLE.reminder);
    if (prior) {
      const medication = ctx.medications.find((item) => prior.detail.includes(item.name));
      return result(scene, reminderLines(medication?.name ?? "the medicine", medication ? administrationInstructions(medication) : "Follow the confirmed plan."));
    }
    const doses = (await ctx.db.doses(ctx.patientId))
      .filter((dose) => dose.planVersionId === ctx.planId && dose.state === "pending")
      .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
    const next = doses.find((dose) => dayKey(dose.scheduledFor, ctx.timeZone) === ctx.today) ?? doses[0];
    if (!next) throw new Error("No pending dose is left on Elena's fictional schedule.");
    const medication = ctx.medications.find((item) => item.id === next.medicationId);
    const medicationName = medication?.name ?? "the medicine";
    const instructions = medication ? administrationInstructions(medication) : next.instructions;
    const classified = classifySymptom(SYMPTOM_TEXT);
    await ctx.db.saveDoseState(next.id, "unsure");
    await ctx.db.insertSymptom({
      id: crypto.randomUUID(),
      patientId: ctx.patientId,
      text: SYMPTOM_TEXT,
      urgent: classified.urgent,
      source: SOURCE,
      createdAt: new Date().toISOString(),
      callId: null,
    });
    const lines = reminderLines(medicationName, instructions);
    await addActivity(ctx, SCENE_TITLE.reminder, `Scripted laptop simulation for ${medicationName}. Symptom saved: ${SYMPTOM_TEXT}. ${HONESTY}`, "saved");
    return result(scene, lines);
  }

  if (scene !== "pharmacy") throw new Error(`Unknown laptop demo scene: ${scene}.`);
  const quoted = { name: "DemoGen acetaminophen", strengthValue: 500, strengthUnit: "mg", formulation: "tablet", release: "immediate", route: "oral" };
  const decision = assessSubstitution(prescribedAcetaminophen, quoted, pharmacyCandidate);
  const lines = [
    `Demo simulation. ${pharmacyOutOfStock.statement}`,
    "The price on screen is $4.37 demo data.",
    `Decision: ${decision.decision.replaceAll("_", " ")}. ${decision.reason}`,
    "The plan was not changed.",
    HONESTY,
  ];
  const prior = await findActivity(ctx, SCENE_TITLE.pharmacy);
  if (prior) return result(scene, lines);
  const existing = (await ctx.db.pharmacy(ctx.patientId)).find(
    (row) => row.callId === null && row.priceText === "$4.37 demo data" && row.statement === pharmacyOutOfStock.statement,
  );
  if (!existing) {
    await ctx.db.insertPharmacy({
      id: crypto.randomUUID(),
      patientId: ctx.patientId,
      callId: null,
      inStock: false,
      quotedName: quoted.name,
      quotedStrength: formatStrength(quoted.strengthValue, quoted.strengthUnit),
      priceText: "$4.37 demo data",
      statement: pharmacyOutOfStock.statement,
      decision: decision.decision,
      reason: decision.reason,
      createdAt: new Date().toISOString(),
    });
  }
  await addActivity(ctx, SCENE_TITLE.pharmacy, `${pharmacyOutOfStock.statement} Price is $4.37 demo data. The plan was not changed. ${HONESTY}`, "saved");
  return result(scene, lines);
}

function reminderLines(medicationName: string, instructions: string): string[] {
  const classified = classifySymptom(SYMPTOM_TEXT);
  return [
    "Demo simulation. This is a scripted laptop simulation. The phone did not ring. This is not a live Grok video call.",
    doseReportSpeech("unsure", medicationName),
    instructions,
    `Saved symptom: ${SYMPTOM_TEXT}`,
    classified.spokenScript,
  ];
}

export async function loadLaptopFamilyBoard(): Promise<LaptopFamilyBoard> {
  assertRehearsal();
  const db = database();
  const patient = (await db.patients()).find((item) => item.id === DEMO.patientId);
  if (!patient) throw new Error("Elena's rehearsal record is not loaded.");
  const [plans, medications, doses, symptoms, scans, tasks, activity] = await Promise.all([
    db.plans(patient.id),
    db.medications(patient.id),
    db.doses(patient.id),
    db.symptoms(patient.id),
    db.scans(patient.id),
    db.tasks(patient.id),
    db.activity(patient.id),
  ]);
  const pharmacy = await db.pharmacy(patient.id);
  const confirmed = plans.find((plan) => plan.status === "confirmed") ?? null;
  const draft = plans.find((plan) => plan.status === "draft") ?? null;
  const confirmedMeds = confirmed ? medsFor(confirmed.id, medications) : [];
  const today = dayKey(new Date().toISOString(), patient.timeZone || DEMO.timeZone);
  const todaysDoses = doses.filter((dose) => {
    if (!confirmed || dose.planVersionId !== confirmed.id) return false;
    return dayKey(dose.scheduledFor, patient.timeZone || DEMO.timeZone) === today;
  });
  const completed = todaysDoses.filter((dose) => dose.state !== "pending" && dose.state !== "no_response").length;
  const sortedActivity = [...activity].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const demoCall = await db.demoCall();
  return {
    mode: "rehearsal",
    productName: productName(),
    viewer: { id: DEMO.familyProfileId, role: "family", name: DEMO.familyName },
    patient: {
      id: patient.id,
      preferredName: patient.preferredName,
      phoneLast4: patient.phoneE164 ? patient.phoneE164.slice(-4) : null,
      timeZone: patient.timeZone,
    },
    plan: confirmed
      ? { id: confirmed.id, status: confirmed.status, confirmedAt: confirmed.confirmedAt, medications: confirmedMeds.map(presentMed) }
      : null,
    draft: draft
      ? { id: draft.id, documentPath: draft.documentPath, medications: medsFor(draft.id, medications).map(presentMed) }
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
    calls: [],
    activeRoom: demoCall ? { livekitRoom: "telenomily-demo", createdAt: demoCall.startedAt } : null,
    activity: sortedActivity,
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
    alerts: sortedActivity.filter((item) => item.status === "urgent" || item.status === "needs_review" || item.status === "cant_confirm").slice(0, 8),
  };
}

function freshCall(phase: "ringing" | "connected"): DemoCall {
  const now = Date.now();
  return {
    phase,
    startedAt: new Date(now).toISOString(),
    ringUntil: new Date(now + (phase === "ringing" ? 4500 : 0)).toISOString(),
    answeredAt: phase === "connected" ? new Date(now).toISOString() : null,
    caption: phase === "connected" ? "Show me a medicine and ask me anything." : "",
    status: phase === "ringing" ? "Connecting..." : "I'm listening",
    image: null,
  };
}

export async function currentDemoCall() {
  assertRehearsal();
  return database().demoCall();
}

export async function startDemoCall() {
  assertRehearsal();
  const call = freshCall("ringing");
  await database().setDemoCall(call);
  return call;
}

export async function answerDemoCall() {
  assertRehearsal();
  const current = (await database().demoCall()) ?? freshCall("connected");
  const call = {
    ...current,
    phase: "connected" as const,
    answeredAt: new Date().toISOString(),
    status: current.image ? "Reading the label..." : current.caption ? "Speaking" : "I'm listening",
    caption: current.caption || "Show me a medicine and ask me anything.",
  };
  await database().setDemoCall(call);
  return call;
}

export async function showOnDemoCall(input: { caption?: string; image?: string | null; status?: string }) {
  assertRehearsal();
  const current = (await database().demoCall()) ?? freshCall("connected");
  const caption = presentLine(input.caption ?? current.caption);
  const call = {
    ...current,
    caption: caption || current.caption,
    image: input.image === undefined ? current.image : input.image,
    status: input.status || (input.image ? "Reading the label..." : "Speaking"),
  };
  await database().setDemoCall(call);
  return call;
}

export async function endDemoCall() {
  assertRehearsal();
  await database().setDemoCall(null);
  return null;
}
