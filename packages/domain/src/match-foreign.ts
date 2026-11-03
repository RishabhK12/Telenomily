import {
  compareStrength,
  ingredientKey,
  normalizeFormulation,
  normalizeName,
  normalizeRelease,
  normalizeRoute,
  sameIngredientSet,
  type Ingredient,
} from "./normalize.js";

export type ForeignMapping = {
  id: string;
  aliases: string[];
  language: string;
  ingredients: Ingredient[];
  strengthValue: number;
  strengthUnit: string;
  formulation: string;
  release: string;
  route: string;
  usCandidateName: string;
  referenceNote: string;
  preverified: boolean;
};

export type ForeignLabel = {
  imageQuality: "ok" | "blurry" | "incomplete" | "needs_expiry" | "needs_other_side";
  originalText: string;
  englishTranslation: string;
  productName: string | null;
  ingredients: Ingredient[];
  strengthValue: number | null;
  strengthUnit: string | null;
  formulation: string | null;
  release: string | null;
  route: string | null;
  conflicts: string[];
};

export type ForeignMatch = {
  outcome: "candidate" | "cant_confirm";
  mappingId: string | null;
  spokenScript: string;
  reason: string;
};

export function matchForeignLabel(label: ForeignLabel, mappings: ForeignMapping[]): ForeignMatch {
  const translation = label.englishTranslation.trim();
  const original = label.originalText.trim();
  if (label.imageQuality !== "ok" || label.conflicts.length > 0 || !original) {
    return {
      outcome: "cant_confirm",
      mappingId: null,
      reason: "The foreign label is not clear enough to match.",
      spokenScript: `I can't confirm a US reference. Original text: ${original || "none readable"}. Show the full label again.`,
    };
  }

  const named = mappings.filter((mapping) => mapping.aliases.some((alias) => namesAlign(label.productName, alias) || originalHas(original, alias)));
  const pool = named.length > 0 ? named : mappings;
  const hits = pool.filter((mapping) => mappingFits(label, mapping));

  if (hits.length === 1 && hits[0]?.preverified) {
    const mapping = hits[0];
    return {
      outcome: "candidate",
      mappingId: mapping.id,
      reason: "Documented demo mapping matches name, ingredients, strength, form, route, and release.",
      spokenScript: `${translation || "Translation unavailable."} A documented demo mapping points to ${mapping.usCandidateName}. ${mapping.referenceNote} A pharmacist must verify this before anyone treats it as a substitute. I will not change the confirmed plan.`,
    };
  }

  const missing = describeMissing(label);
  return {
    outcome: "cant_confirm",
    mappingId: null,
    reason: missing || "No documented mapping matches every required field.",
    spokenScript: `${translation ? `${translation}. ` : ""}I can't confirm a US equivalent. ${missing || "Ingredient equality alone is not enough, and no preverified mapping matches the strength, form, route, and release."} I will not replace a prescribed medicine.`,
  };
}

function mappingFits(label: ForeignLabel, mapping: ForeignMapping): boolean {
  if (!mapping.preverified) return false;
  if (!sameIngredientSet(label.ingredients, mapping.ingredients)) return false;
  if (compareStrength(label.strengthValue, label.strengthUnit, mapping.strengthValue, mapping.strengthUnit) !== "equal") return false;
  if (normalizeFormulation(label.formulation) !== normalizeFormulation(mapping.formulation)) return false;
  if (normalizeRelease(label.release) !== normalizeRelease(mapping.release)) return false;
  if (normalizeRoute(label.route) !== normalizeRoute(mapping.route)) return false;
  return true;
}

function namesAlign(productName: string | null, alias: string): boolean {
  if (!productName) return false;
  return normalizeName(productName) === normalizeName(alias);
}

function originalHas(original: string, alias: string): boolean {
  return normalizeName(original).includes(normalizeName(alias));
}

function describeMissing(label: ForeignLabel): string {
  const missing: string[] = [];
  if (label.ingredients.length === 0) missing.push("active ingredients");
  if (label.strengthValue == null || !label.strengthUnit) missing.push("strength");
  if (!label.formulation) missing.push("formulation");
  if (!label.release) missing.push("release");
  if (!label.route) missing.push("route");
  if (missing.length === 0) return "";
  return `These details are unavailable: ${missing.join(", ")}.`;
}

export function ingredientOnlyIsNotEnough(label: ForeignLabel, mapping: ForeignMapping): boolean {
  return sameIngredientSet(label.ingredients, mapping.ingredients) && !mappingFits(label, mapping);
}

export function sameIngredientKey(left: string, right: string): boolean {
  return ingredientKey(left) === ingredientKey(right);
}
