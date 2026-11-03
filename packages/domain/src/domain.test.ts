import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAccessPatient, canIssueRoomToken, hashToken, invitationState } from "./access.js";
import { applyProviderEvent, canStartCall, doseReportSpeech, doseStateForUnsuccessfulCall, isAllowedDestination, mapProviderSignal, type CallRecord } from "./calls.js";
import { DEMO, baseLabel, demoMedications, foreignMappings, pharmacyCandidate, pillReferences, prescribedAcetaminophen } from "./fixtures.js";
import { duplicateActiveIngredients, evaluateLabel, missingFromScan, missingItemScript } from "./match-medicine.js";
import { ingredientOnlyIsNotEnough, matchForeignLabel } from "./match-foreign.js";
import { matchPill } from "./match-pill.js";
import { assessSubstitution } from "./pharmacy.js";
import { compareStrength } from "./normalize.js";
import { assertConfirmedPlan, buildSchedule } from "./schedule.js";
import { classifySymptom, replacementTaskAction } from "./safety.js";
import { dischargeExtractionSchema } from "./schemas.js";

const today = "2026-11-02";

describe("access and invitations", () => {
  const elena = { id: DEMO.patientId, profileId: DEMO.patientProfileId, isDemo: true };
  const other = { id: "99999999-9999-4999-8999-999999999999", profileId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", isDemo: false };
  const link = [{ patientId: elena.id, familyProfileId: DEMO.familyProfileId, status: "active" }];

  it("separates patients and family links", () => {
    assert.equal(canAccessPatient({ id: DEMO.patientProfileId, role: "patient" }, elena, []), true);
    assert.equal(canAccessPatient({ id: DEMO.patientProfileId, role: "patient" }, other, []), false);
    assert.equal(canAccessPatient({ id: DEMO.familyProfileId, role: "family" }, elena, link), true);
    assert.equal(canAccessPatient({ id: DEMO.familyProfileId, role: "family" }, other, link), false);
    assert.equal(canAccessPatient({ id: DEMO.familyProfileId, role: "family" }, elena, []), false);
    assert.equal(canAccessPatient({ id: "presenter", role: "presenter" }, elena, []), true);
    assert.equal(canAccessPatient({ id: "presenter", role: "presenter" }, other, []), false);
  });

  it("issues room tokens only for an accessible patient", () => {
    const family = { id: DEMO.familyProfileId, role: "family" as const };
    assert.equal(canIssueRoomToken(family, elena, link, elena.id), true);
    assert.equal(canIssueRoomToken(family, elena, link, other.id), false);
  });

  it("accepts an invite once before it expires", () => {
    const now = new Date("2026-11-02T15:00:00Z");
    assert.equal(invitationState(null, now), "missing");
    assert.equal(invitationState({ expiresAt: "2026-11-02T16:00:00Z", usedAt: null }, now), "valid");
    assert.equal(invitationState({ expiresAt: "2026-11-02T14:00:00Z", usedAt: null }, now), "expired");
    assert.equal(invitationState({ expiresAt: "2026-11-02T16:00:00Z", usedAt: "2026-11-02T15:01:00Z" }, now), "used");
    assert.notEqual(hashToken("one"), hashToken("two"));
  });
});

describe("schedules", () => {
  it("keeps drafts out of the confirmed schedule", () => {
    assert.throws(() => assertConfirmedPlan({ status: "draft" }), /draft_plan/);
    assert.doesNotThrow(() => assertConfirmedPlan({ status: "confirmed" }));
  });

  it("schedules stated clock times and leaves as needed and stopped medicines off the dose list", () => {
    const schedule = buildSchedule(demoMedications, { startDate: "2026-11-02", days: 1, timeZone: "America/New_York" });
    const scheduledIds = new Set(schedule.doses.map((dose) => dose.medicationId));
    assert.equal(scheduledIds.has("33333333-3333-4333-8333-333333333301"), true);
    assert.equal(scheduledIds.has("33333333-3333-4333-8333-333333333304"), true);
    assert.equal(scheduledIds.has("33333333-3333-4333-8333-333333333302"), false);
    assert.equal(scheduledIds.has("33333333-3333-4333-8333-333333333305"), false);
    assert.equal(schedule.asNeeded.length, 1);
    assert.equal(schedule.stopped.length, 1);
    assert.equal(schedule.doses.filter((dose) => dose.medicationId.endsWith("301")).length, 1);
    assert.match(schedule.doses[0]?.instructions ?? "", /Take 1/);
  });

  it("does not invent a clock time when none was stated", () => {
    const schedule = buildSchedule(
      [
        {
          ...demoMedications[0],
          id: "gap-med",
          timings: [],
          frequency: "every morning",
        },
      ],
      { startDate: "2026-11-02", days: 2, timeZone: "America/New_York" },
    );
    assert.equal(schedule.doses.length, 0);
    assert.match(schedule.gaps[0]?.message ?? "", /not stated/);
  });
});

describe("cabinet outcomes", () => {
  const plan = demoMedications;

  it("marks a complete plan match as on plan", () => {
    const result = evaluateLabel(
      baseLabel({
        productName: "Lisinopril",
        ingredients: plan[0].ingredients,
        strengthValue: 10,
        strengthUnit: "mg",
        formulation: "tablet",
        release: "immediate",
        route: "by mouth",
        expirationDate: "2027-01-01",
        expirationReadable: true,
        visibleText: "Lisinopril 10 mg tablet",
      }),
      plan,
      today,
    );
    assert.equal(result.outcome, "on_plan");
    assert.equal(result.planMatch, "match");
    assert.match(result.spokenScript, /plan match/i);
    assert.match(result.spokenScript, /not a full check/i);
  });

  it("rejects a wrong strength and a different release", () => {
    const wrongStrength = evaluateLabel(
      baseLabel({
        productName: "Lisinopril",
        ingredients: [{ name: "lisinopril", strengthValue: 20, strengthUnit: "mg" }],
        strengthValue: 20,
        strengthUnit: "mg",
        formulation: "tablet",
        release: "immediate",
        route: "oral",
      }),
      plan,
      today,
    );
    assert.equal(wrongStrength.outcome, "not_on_plan");
    const extended = evaluateLabel(
      baseLabel({
        productName: "Lisinopril",
        ingredients: plan[0].ingredients,
        strengthValue: 10,
        strengthUnit: "mg",
        formulation: "tablet",
        release: "extended release",
        route: "oral",
      }),
      plan,
      today,
    );
    assert.equal(extended.outcome, "not_on_plan");
    assert.equal(compareStrength(1, "g", 1000, "mg"), "equal");
  });

  it("does not treat an unlisted medicine as a plan change", () => {
    const result = evaluateLabel(
      baseLabel({
        productName: "Ibuprofen",
        ingredients: [{ name: "ibuprofen", strengthValue: 200, strengthUnit: "mg" }],
        strengthValue: 200,
        strengthUnit: "mg",
        formulation: "tablet",
        release: "immediate",
        route: "oral",
        expirationDate: "2027-04-01",
        expirationReadable: true,
      }),
      plan,
      today,
    );
    assert.equal(result.outcome, "not_on_plan");
    assert.match(result.spokenScript, /will not stop/i);
  });

  it("prioritizes a past expiration on a prescribed medicine", () => {
    const result = evaluateLabel(
      baseLabel({
        productName: "Cholecalciferol",
        ingredients: plan[2].ingredients,
        strengthValue: 1000,
        strengthUnit: "IU",
        formulation: "capsule",
        release: "immediate",
        route: "oral",
        expirationDate: "2024-03-01",
        expirationText: "EXP 03/2024",
        expirationReadable: true,
      }),
      plan,
      today,
    );
    assert.equal(result.outcome, "expired");
    assert.equal(result.planMatch, "match");
    assert.match(result.spokenScript, /Do not use/i);
  });

  it("does not guess an unclear expiration", () => {
    const result = evaluateLabel(
      baseLabel({
        productName: "Lisinopril",
        ingredients: plan[0].ingredients,
        strengthValue: 10,
        strengthUnit: "mg",
        formulation: "tablet",
        release: "immediate",
        route: "oral",
        expirationText: "EXP smudged",
        expirationReadable: false,
      }),
      plan,
      today,
    );
    assert.equal(result.outcome, "cant_confirm");
    assert.equal(result.expirationStatus, "unconfirmed");
  });

  it("asks for another view when the label is unreadable", () => {
    const result = evaluateLabel(baseLabel({ imageQuality: "blurry", visibleText: "" }), plan, today);
    assert.equal(result.outcome, "cant_confirm");
    assert.equal(result.retake, true);
    assert.match(result.spokenScript, /still/i);
  });

  it("reports missing plan items only after the scan and ignores unreadable results", () => {
    const missing = missingFromScan(plan, [
      { matchedMedicationId: plan[0].id, planMatch: "match", outcome: "on_plan" },
      { matchedMedicationId: plan[2].id, planMatch: "match", outcome: "expired" },
      { matchedMedicationId: null, planMatch: "unconfirmed", outcome: "cant_confirm" },
      { matchedMedicationId: null, planMatch: "not_listed", outcome: "not_on_plan" },
    ]);
    assert.deepEqual(missing.map((item) => item.id), [plan[1].id, plan[3].id]);
    assert.match(missingItemScript(plan[3]), /not found in this scan/);
    assert.equal(replacementTaskAction([], { medicationKey: plan[3].id, kind: "obtain_missing", patientConfirmedNeed: false }), "skip_unconfirmed");
    assert.equal(replacementTaskAction([], { medicationKey: plan[3].id, kind: "obtain_missing", patientConfirmedNeed: true }), "create");
    assert.equal(
      replacementTaskAction([{ medicationKey: plan[3].id, kind: "obtain_missing" }], {
        medicationKey: plan[3].id,
        kind: "obtain_missing",
        patientConfirmedNeed: true,
      }),
      "skip_duplicate",
    );
    assert.equal(replacementTaskAction([], { medicationKey: plan[2].id, kind: "replace_expired", patientConfirmedNeed: false }), "create");
  });

  it("flags duplicate active ingredients without calling itself an interaction checker", () => {
    const duplicates = duplicateActiveIngredients([
      { label: "Acetaminophen bottle", ingredients: plan[1].ingredients },
      { label: "Paracetamol Sol", ingredients: [{ name: "paracetamol", strengthValue: 500, strengthUnit: "mg" }] },
    ]);
    assert.equal(duplicates[0]?.ingredient, "acetaminophen");
    assert.equal(duplicates[0]?.products.length, 2);
  });
});

describe("pills and foreign labels", () => {
  it("matches one seeded pill and refuses unmatched, ambiguous, and one sided examples", () => {
    const match = matchPill(
      {
        imageQuality: "ok",
        imprintReadable: true,
        imprintSideA: "nc-10",
        imprintSideB: "10",
        shape: "round",
        color: "white",
        scoring: "scored",
        conflicts: [],
      },
      pillReferences,
    );
    assert.equal(match.outcome, "possible_match");
    assert.match(match.spokenScript, /possible match/i);

    const blank = matchPill(
      { imageQuality: "ok", imprintReadable: false, imprintSideA: null, imprintSideB: null, shape: "round", color: "white", scoring: null, conflicts: [] },
      pillReferences,
    );
    assert.equal(blank.outcome, "cant_confirm");

    const unknown = matchPill(
      { imageQuality: "ok", imprintReadable: true, imprintSideA: "QQ 0", imprintSideB: null, shape: "oval", color: "green", scoring: null, conflicts: [] },
      pillReferences,
    );
    assert.equal(unknown.outcome, "cant_confirm");

    const ambiguous = matchPill(
      { imageQuality: "ok", imprintReadable: true, imprintSideA: "M 5", imprintSideB: null, shape: "round", color: "white", scoring: null, conflicts: [] },
      pillReferences,
    );
    assert.equal(ambiguous.outcome, "cant_confirm");

    const oneSide = matchPill(
      { imageQuality: "ok", imprintReadable: true, imprintSideA: "NC 10", imprintSideB: null, shape: "round", color: "white", scoring: "scored", conflicts: [] },
      pillReferences,
    );
    assert.equal(oneSide.outcome, "cant_confirm");
    assert.match(oneSide.reason, /other side/i);
  });

  it("maps a documented foreign label and refuses ingredient only matches", () => {
    const mapped = matchForeignLabel(
      {
        imageQuality: "ok",
        originalText: "Paracetamol Sol 500 mg comprimidos",
        englishTranslation: "Paracetamol Sol 500 mg tablets",
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
    assert.equal(mapped.outcome, "candidate");
    assert.match(mapped.spokenScript, /pharmacist/i);
    assert.match(mapped.spokenScript, /Paracetamol Sol 500 mg tablets/);

    const wrongStrength = {
      imageQuality: "ok" as const,
      originalText: "Paracetamol Sol 650 mg comprimidos",
      englishTranslation: "Paracetamol Sol 650 mg tablets",
      productName: "Paracetamol Sol",
      ingredients: [{ name: "paracetamol", strengthValue: 650, strengthUnit: "mg" }],
      strengthValue: 650,
      strengthUnit: "mg",
      formulation: "comprimidos",
      release: "immediate",
      route: "oral",
      conflicts: [],
    };
    assert.equal(matchForeignLabel(wrongStrength, foreignMappings).outcome, "cant_confirm");
    assert.equal(ingredientOnlyIsNotEnough(wrongStrength, foreignMappings[0]), true);
  });
});

describe("calls, doses, and pharmacy review", () => {
  const base = (overrides: Partial<CallRecord>): CallRecord => ({
    id: "call-1",
    purpose: "reminder",
    status: "answered",
    idempotencyKey: "dose-1",
    doseOccurrenceId: "occ-1",
    providerEventIds: [],
    ...overrides,
  });

  it("replays the same call request and blocks a second active call", () => {
    const existing = [base({})];
    assert.equal(canStartCall(existing, { idempotencyKey: "dose-1", purpose: "reminder", doseOccurrenceId: "occ-1" }).ok, true);
    const second = canStartCall(existing, { idempotencyKey: "dose-2", purpose: "reminder", doseOccurrenceId: "occ-1" });
    assert.equal(second.ok, false);
    if (!second.ok) assert.equal(second.reason, "duplicate_active_call");
  });

  it("ignores repeated provider events and does not turn a failed call into a missed dose", () => {
    const first = applyProviderEvent(base({ status: "dialing" }), { id: "evt-1", status: "unanswered" });
    const second = applyProviderEvent(first.call, { id: "evt-1", status: "answered" });
    assert.equal(first.duplicate, false);
    assert.equal(second.duplicate, true);
    assert.equal(second.call.status, "unanswered");
    assert.equal(doseStateForUnsuccessfulCall("unanswered", false), "no_response");
    assert.equal(doseStateForUnsuccessfulCall("unanswered", true), null);
    assert.equal(mapProviderSignal({ sipStatusCode: 486, callStatus: null }), "busy");
    assert.match(doseReportSpeech("unsure", "Lisinopril"), /extra dose/i);
    assert.match(doseReportSpeech("no_response", "Lisinopril"), /not a confirmed missed dose/i);
    assert.equal(isAllowedDestination("+1 (404) 555-0148", ["+14045550148"]), true);
    assert.equal(isAllowedDestination("+14045550199", ["+14045550148"]), false);
  });

  it("keeps pharmacy substitutes off the prescription", () => {
    const accepted = assessSubstitution(prescribedAcetaminophen, pharmacyCandidate, pharmacyCandidate);
    assert.equal(accepted.decision, "preverified_candidate");
    assert.equal(accepted.changesPlan, false);
    const wrong = assessSubstitution(
      prescribedAcetaminophen,
      { ...pharmacyCandidate, strengthValue: 650 },
      { ...pharmacyCandidate, strengthValue: 650 },
    );
    assert.equal(wrong.decision, "rejected");
    assert.equal(wrong.changesPlan, false);
  });

  it("records symptoms without a diagnosis and escalates urgent wording", () => {
    assert.equal(classifySymptom("I feel a little tired").urgent, false);
    assert.match(classifySymptom("I feel a little tired").spokenScript, /cannot diagnose/i);
    assert.equal(classifySymptom("I have chest pain").urgent, true);
    assert.match(classifySymptom("I have chest pain").spokenScript, /not medical care/i);
  });
});

describe("extraction schema", () => {
  it("rejects a dose the model invented without source text structure", () => {
    const parsed = dischargeExtractionSchema.safeParse({
      medications: [
        {
          name: "Lisinopril",
          ingredients: [{ name: "lisinopril", strengthValue: 10, strengthUnit: "mg" }],
          strengthValue: 10,
          strengthUnit: "mg",
          amountPerDose: "Take 1 tablet",
          route: "by mouth",
          formulation: "tablet",
          release: "immediate",
          frequency: "every morning",
          timings: ["08:00"],
          instructionKind: "continue",
          duration: null,
          endDate: null,
          specialInstructions: null,
          sourceText: "Continue lisinopril 10 mg tablet. Take 1 tablet by mouth every morning at 8:00.",
          missingFields: [],
          conflicts: [],
        },
      ],
      unreadableNotes: [],
    });
    assert.equal(parsed.success, true);
    const broken = dischargeExtractionSchema.safeParse({ medications: [{ name: "Mystery" }], unreadableNotes: [] });
    assert.equal(broken.success, false);
  });
});
