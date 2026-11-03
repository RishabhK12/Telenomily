export type Ingredient = {
  name: string;
  strengthValue: number | null;
  strengthUnit: string | null;
};

const UNIT_ALIASES: Record<string, string> = {
  mg: "mg",
  milligram: "mg",
  milligrams: "mg",
  g: "g",
  gram: "g",
  grams: "g",
  mcg: "mcg",
  ug: "mcg",
  microgram: "mcg",
  micrograms: "mcg",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  iu: "iu",
  unit: "unit",
  units: "unit",
};

const FORM_ALIASES: Record<string, string> = {
  tablet: "tablet",
  tablets: "tablet",
  tab: "tablet",
  caplet: "tablet",
  capsule: "capsule",
  capsules: "capsule",
  cap: "capsule",
  solution: "solution",
  syrup: "solution",
  suspension: "suspension",
  cream: "cream",
  ointment: "ointment",
  inhaler: "inhaler",
  patch: "patch",
  drops: "drops",
  comprimide: "tablet",
  comprimido: "tablet",
  comprimidos: "tablet",
  tablette: "tablet",
  tabletten: "tablet",
};

const RELEASE_EXTENDED = new Set([
  "er",
  "xr",
  "xl",
  "extended release",
  "prolonged release",
  "sustained release",
  "sr",
  "cr",
  "controlled release",
]);

/** Explicit INN and USAN pairs. This is not a therapeutic substitution list. */
const INGREDIENT_SYNONYMS: Record<string, string> = {
  paracetamol: "acetaminophen",
  acetaminophen: "acetaminophen",
  "vitamin d": "cholecalciferol",
  "vitamin d3": "cholecalciferol",
  cholecalciferol: "cholecalciferol",
};

export function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeUnit(unit: string | null | undefined): string | null {
  if (!unit) return null;
  const key = normalizeName(unit).replace(/\s/g, "");
  return UNIT_ALIASES[key] ?? null;
}

export function toComparableStrength(
  value: number,
  unit: string,
): { value: number; unit: string } | null {
  const normalized = normalizeUnit(unit);
  if (!normalized || !Number.isFinite(value)) return null;
  if (normalized === "g") return { value: value * 1000, unit: "mg" };
  if (normalized === "mcg") return { value: value / 1000, unit: "mg" };
  return { value, unit: normalized };
}

export type StrengthComparison = "equal" | "different" | "incomplete";

export function compareStrength(
  leftValue: number | null,
  leftUnit: string | null,
  rightValue: number | null,
  rightUnit: string | null,
): StrengthComparison {
  if (leftValue == null || !leftUnit || rightValue == null || !rightUnit) return "incomplete";
  const left = toComparableStrength(leftValue, leftUnit);
  const right = toComparableStrength(rightValue, rightUnit);
  if (!left || !right || left.unit !== right.unit) return left && right ? "different" : "incomplete";
  return Math.abs(left.value - right.value) < 0.001 ? "equal" : "different";
}

export function normalizeFormulation(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const key = normalizeName(value);
  return FORM_ALIASES[key] ?? key;
}

export function normalizeRelease(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const key = normalizeName(value);
  if (RELEASE_EXTENDED.has(key)) return "extended";
  if (key === "dr" || key === "delayed release" || key === "enteric") return "delayed";
  if (key === "ir" || key === "immediate release" || key === "immediate") return "immediate";
  return key;
}

export function normalizeRoute(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const key = normalizeName(value);
  if (["oral", "by mouth", "po", "mouth"].includes(key)) return "oral";
  if (["topical", "on the skin"].includes(key)) return "topical";
  if (["ophthalmic", "eye"].includes(key)) return "ophthalmic";
  return key;
}

export function ingredientKey(name: string): string {
  const key = normalizeName(name);
  return INGREDIENT_SYNONYMS[key] ?? key;
}

export function sameIngredientSet(left: Ingredient[], right: Ingredient[]): boolean {
  const a = [...new Set(left.map((item) => ingredientKey(item.name)).filter(Boolean))].sort();
  const b = [...new Set(right.map((item) => ingredientKey(item.name)).filter(Boolean))].sort();
  if (a.length === 0 || a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

export function normalizeImprint(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function formatStrength(value: number | null, unit: string | null): string {
  if (value == null || !unit) return "strength not stated";
  const rendered = Number.isInteger(value) ? String(value) : String(value);
  return `${rendered} ${normalizeUnit(unit) ?? unit}`;
}
