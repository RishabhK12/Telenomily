import {
  compareStrength,
  formatStrength,
  ingredientKey,
  normalizeFormulation,
  normalizeRelease,
  normalizeRoute,
  sameIngredientSet,
  type Ingredient,
} from "./normalize.js";
import { administrationInstructions, type PlanMedication } from "./schedule.js";

export type SpokenOutcome = "on_plan" | "not_on_plan" | "expired" | "missing" | "cant_confirm";
export type PlanMatch = "match" | "not_listed" | "unconfirmed";
export type ExpirationStatus = "not_applicable" | "valid" | "expired" | "unconfirmed";

export type LabelEvidence = {
  imageQuality: "ok" | "blurry" | "incomplete" | "needs_expiry" | "needs_other_side";
  qualityNote: string;
  productName: string | null;
  ingredients: Ingredient[];
  strengthValue: number | null;
  strengthUnit: string | null;
  formulation: string | null;
  release: string | null;
  route: string | null;
  expirationDate: string | null;
  expirationText: string | null;
  expirationReadable: boolean;
  conflicts: string[];
  visibleText: string;
};

export type MedicineEvaluation = {
  outcome: SpokenOutcome;
  planMatch: PlanMatch;
  expirationStatus: ExpirationStatus;
  matchedMedicationId: string | null;
  retake: boolean;
  spokenScript: string;
  detail: string;
};

const RETAKE_COPY: Record<LabelEvidence["imageQuality"], string> = {
  ok: "",
  blurry: "The picture is blurry. Hold the package still and move a little closer.",
  incomplete: "The label is cut off. Show the whole front of the package.",
  needs_expiry: "Show the expiration date as well as the name.",
  needs_other_side: "Turn the package and show the other side of the label.",
};

export function evaluateLabel(evidence: LabelEvidence, plan: PlanMedication[], today: string): MedicineEvaluation {
  const qualityBlocked = evidence.imageQuality !== "ok";
  const unreadable =
    qualityBlocked ||
    evidence.conflicts.length > 0 ||
    (evidence.ingredients.length === 0 && !evidence.productName);

  const expirationStatus = readExpiration(evidence, today);

  if (unreadable) {
    const guidance = qualityBlocked ? RETAKE_COPY[evidence.imageQuality] : evidence.conflicts[0] ?? "The label cannot be confirmed.";
    return {
      outcome: "cant_confirm",
      planMatch: "unconfirmed",
      expirationStatus: expirationStatus === "expired" ? "expired" : evidence.expirationText && !evidence.expirationReadable ? "unconfirmed" : expirationStatus,
      matchedMedicationId: null,
      retake: qualityBlocked,
      spokenScript: `I can't confirm this package. ${guidance} I will not change the prescribed schedule.`,
      detail: guidance,
    };
  }

  if (evidence.expirationText && !evidence.expirationReadable) {
    return {
      outcome: "cant_confirm",
      planMatch: "unconfirmed",
      expirationStatus: "unconfirmed",
      matchedMedicationId: null,
      retake: true,
      spokenScript: "I can't confirm this package. The expiration text is unclear, so I will not guess the date. Show the expiration date again or ask a pharmacist.",
      detail: "Uncertain expiration text.",
    };
  }

  const active = plan.filter((medication) => medication.instructionKind !== "stop");
  const stopped = plan.filter((medication) => medication.instructionKind === "stop");
  const comparison = compareToPlan(evidence, active);

  if (comparison.kind === "unconfirmed") {
    return {
      outcome: "cant_confirm",
      planMatch: "unconfirmed",
      expirationStatus,
      matchedMedicationId: comparison.medication?.id ?? null,
      retake: true,
      spokenScript: `I can't confirm this package. ${comparison.reason} I will not change the prescribed schedule.`,
      detail: comparison.reason,
    };
  }

  if (comparison.kind === "match" && comparison.medication) {
    const medication = comparison.medication;
    if (expirationStatus === "expired") {
      return {
        outcome: "expired",
        planMatch: "match",
        expirationStatus,
        matchedMedicationId: medication.id,
        retake: false,
        spokenScript: `${labelName(evidence)} matches the confirmed plan and the expiration date has passed. Do not use this expired product. Because it is still prescribed, a replacement task can be added once. This is not a full check of whether every medicine is safe together.`,
        detail: "Plan match with a past expiration date.",
      };
    }
    if (expirationStatus === "unconfirmed") {
      return {
        outcome: "cant_confirm",
        planMatch: "match",
        expirationStatus,
        matchedMedicationId: medication.id,
        retake: true,
        spokenScript: `${labelName(evidence)} may match the confirmed plan, but the expiration date is not confirmed. Show the expiration date or ask a pharmacist. I will not change the prescribed schedule.`,
        detail: "Plan details match and expiration is unconfirmed.",
      };
    }
    return {
      outcome: "on_plan",
      planMatch: "match",
      expirationStatus,
      matchedMedicationId: medication.id,
      retake: false,
      spokenScript: `${labelName(evidence)} is on the confirmed plan. ${administrationInstructions(medication)}. This is a plan match. It is not a full check of whether every medicine is safe together.`,
      detail: "Confirmed plan match.",
    };
  }

  const stoppedHit = compareToPlan(evidence, stopped);
  const stoppedNote =
    stoppedHit.kind === "match"
      ? " The discharge sheet says to stop this medicine. Do not restart it unless a doctor tells you to."
      : "";
  if (expirationStatus === "expired") {
    return {
      outcome: "expired",
      planMatch: "not_listed",
      expirationStatus,
      matchedMedicationId: null,
      retake: false,
      spokenScript: `${labelName(evidence)} is expired. Do not use it. It is also not on the confirmed plan. Ask a doctor or pharmacist before adding anything.${stoppedNote}`,
      detail: "Expired product that is not on the active plan.",
    };
  }
  return {
    outcome: "not_on_plan",
    planMatch: "not_listed",
    expirationStatus,
    matchedMedicationId: null,
    retake: false,
    spokenScript: `${labelName(evidence)} is not on the confirmed plan. Ask a doctor or pharmacist before adding it. I will not stop a current medicine or change the plan.${stoppedNote}`,
    detail: comparison.reason,
  };
}

function labelName(evidence: LabelEvidence): string {
  const name = evidence.productName ?? evidence.ingredients.map((item) => item.name).join(" and ");
  const strength = formatStrength(evidence.strengthValue, evidence.strengthUnit);
  return strength === "strength not stated" ? name : `${name} ${strength}`;
}

function readExpiration(evidence: LabelEvidence, today: string): ExpirationStatus {
  if (evidence.expirationText && !evidence.expirationReadable) return "unconfirmed";
  if (!evidence.expirationDate) return "not_applicable";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(evidence.expirationDate)) return "unconfirmed";
  return evidence.expirationDate < today ? "expired" : "valid";
}

type Comparison =
  | { kind: "match"; medication: PlanMedication; reason: string }
  | { kind: "not_listed"; medication: null; reason: string }
  | { kind: "unconfirmed"; medication: PlanMedication | null; reason: string };

function compareToPlan(evidence: LabelEvidence, medications: PlanMedication[]): Comparison {
  let partial: { medication: PlanMedication; reason: string } | null = null;
  let mismatch: string | null = null;
  for (const medication of medications) {
    const ingredientsAlign = sameIngredientSet(evidence.ingredients, medication.ingredients);
    if (!ingredientsAlign && !looseName(evidence, medication)) continue;
    if (!ingredientsAlign) {
      partial = { medication, reason: "The ingredient list is incomplete or does not match the confirmed plan." };
      continue;
    }
    const strength = compareStrength(
      evidence.strengthValue,
      evidence.strengthUnit,
      medication.strengthValue,
      medication.strengthUnit,
    );
    if (strength === "different") {
      mismatch = "The strength does not match the confirmed plan.";
      continue;
    }
    if (strength === "incomplete" && (medication.strengthValue != null || evidence.strengthValue != null)) {
      return { kind: "unconfirmed", medication, reason: "The strength could not be confirmed." };
    }
    const form = compareOptional(normalizeFormulation(evidence.formulation), normalizeFormulation(medication.formulation), "formulation");
    if (form === "different") {
      mismatch = "The formulation does not match the confirmed plan.";
      continue;
    }
    if (form === "incomplete" && medication.formulation) {
      return { kind: "unconfirmed", medication, reason: "The formulation could not be confirmed." };
    }
    const release = compareOptional(normalizeRelease(evidence.release), normalizeRelease(medication.release), "release");
    if (release === "different") {
      mismatch = "The release type does not match the confirmed plan.";
      continue;
    }
    if (release === "incomplete" && medication.release) {
      return { kind: "unconfirmed", medication, reason: "The release type could not be confirmed." };
    }
    const route = compareOptional(normalizeRoute(evidence.route), normalizeRoute(medication.route), "route");
    if (route === "different") {
      mismatch = "The route does not match the confirmed plan.";
      continue;
    }
    return { kind: "match", medication, reason: "Required details match." };
  }
  if (partial) return { kind: "unconfirmed", medication: partial.medication, reason: partial.reason };
  return { kind: "not_listed", medication: null, reason: mismatch ?? "No confirmed plan item matches this package." };
}

function looseName(evidence: LabelEvidence, medication: PlanMedication): boolean {
  if (!evidence.productName) return false;
  const product = ingredientKey(evidence.productName);
  const planName = ingredientKey(medication.name);
  return product.length > 0 && (planName.includes(product) || product.includes(planName));
}

function compareOptional(left: string | null, right: string | null, _field: string): "equal" | "different" | "incomplete" | "either_missing" {
  if (!left && !right) return "either_missing";
  if (!left || !right) return "incomplete";
  return left === right ? "equal" : "different";
}

export function missingFromScan(
  plan: PlanMedication[],
  results: { matchedMedicationId: string | null; planMatch: PlanMatch; outcome: SpokenOutcome }[],
): PlanMedication[] {
  const found = new Set(
    results
      .filter((result) => result.planMatch === "match" && result.outcome !== "cant_confirm")
      .map((result) => result.matchedMedicationId)
      .filter((id): id is string => Boolean(id)),
  );
  return plan.filter((medication) => medication.instructionKind !== "stop" && !found.has(medication.id));
}

export function duplicateActiveIngredients(
  products: { label: string; ingredients: Ingredient[] }[],
): { ingredient: string; products: string[] }[] {
  const grouped = new Map<string, string[]>();
  for (const product of products) {
    const seen = new Set<string>();
    for (const ingredient of product.ingredients) {
      const key = ingredientKey(ingredient.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      grouped.set(key, [...(grouped.get(key) ?? []), product.label]);
    }
  }
  return [...grouped.entries()]
    .filter(([, labels]) => new Set(labels).size > 1)
    .map(([ingredient, products]) => ({ ingredient, products: [...new Set(products)] }));
}

export function missingItemScript(medication: PlanMedication): string {
  return `${medication.name} was not found in this scan. Do you already have it, have you not shown it yet, or do you need to obtain it?`;
}
