import type { Ingredient } from "./normalize.js";
import type { PlanMedication } from "./schedule.js";
import type { PillReference } from "./match-pill.js";
import type { ForeignMapping } from "./match-foreign.js";
import type { PreverifiedCandidate, QuotedProduct } from "./pharmacy.js";

export const DEMO = {
  patientId: "11111111-1111-4111-8111-111111111111",
  patientProfileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  familyProfileId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  planVersionId: "22222222-2222-4222-8222-222222222222",
  patientName: "Elena Vasquez",
  familyName: "Mateo Vasquez",
  timeZone: "America/New_York",
} as const;

const lisinoprilIngredients: Ingredient[] = [{ name: "lisinopril", strengthValue: 10, strengthUnit: "mg" }];
const acetaminophenIngredients: Ingredient[] = [{ name: "acetaminophen", strengthValue: 500, strengthUnit: "mg" }];
const vitaminIngredients: Ingredient[] = [{ name: "cholecalciferol", strengthValue: 1000, strengthUnit: "IU" }];
const cephalexinIngredients: Ingredient[] = [{ name: "cephalexin", strengthValue: 500, strengthUnit: "mg" }];
const aspirinIngredients: Ingredient[] = [{ name: "aspirin", strengthValue: 81, strengthUnit: "mg" }];
const ibuprofenIngredients: Ingredient[] = [{ name: "ibuprofen", strengthValue: 200, strengthUnit: "mg" }];

export const demoMedications: PlanMedication[] = [
  {
    id: "33333333-3333-4333-8333-333333333301",
    name: "Lisinopril",
    ingredients: lisinoprilIngredients,
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
    specialInstructions: "Continue the home blood pressure tablet.",
    sourceText: "Continue lisinopril 10 mg tablet. Take 1 tablet by mouth every morning at 8:00.",
    missingFields: [],
  },
  {
    id: "33333333-3333-4333-8333-333333333302",
    name: "Acetaminophen",
    ingredients: acetaminophenIngredients,
    strengthValue: 500,
    strengthUnit: "mg",
    amountPerDose: "Take 1 tablet",
    route: "by mouth",
    formulation: "tablet",
    release: "immediate",
    frequency: "every 8 hours as needed for pain",
    timings: [],
    instructionKind: "as_needed",
    duration: null,
    endDate: null,
    specialInstructions: "As needed for pain. Do not exceed the amount written on the discharge sheet.",
    sourceText: "Acetaminophen 500 mg tablet. Take 1 tablet by mouth every 8 hours as needed for pain.",
    missingFields: [],
  },
  {
    id: "33333333-3333-4333-8333-333333333303",
    name: "Cholecalciferol",
    ingredients: vitaminIngredients,
    strengthValue: 1000,
    strengthUnit: "IU",
    amountPerDose: "Take 1 capsule",
    route: "by mouth",
    formulation: "capsule",
    release: "immediate",
    frequency: "once daily",
    timings: ["08:00"],
    instructionKind: "continue",
    duration: null,
    endDate: null,
    specialInstructions: "Continue vitamin D3.",
    sourceText: "Continue cholecalciferol 1000 IU capsule. Take 1 capsule by mouth once daily at 8:00.",
    missingFields: [],
  },
  {
    id: "33333333-3333-4333-8333-333333333304",
    name: "Cephalexin",
    ingredients: cephalexinIngredients,
    strengthValue: 500,
    strengthUnit: "mg",
    amountPerDose: "Take 1 capsule",
    route: "by mouth",
    formulation: "capsule",
    release: "immediate",
    frequency: "every 6 hours",
    timings: ["08:00", "14:00", "20:00", "02:00"],
    instructionKind: "start",
    duration: "7 days",
    endDate: null,
    specialInstructions: "Start this antibiotic. Finish the stated course unless a doctor says otherwise.",
    sourceText: "Start cephalexin 500 mg capsule. Take 1 capsule by mouth every 6 hours at 8:00, 14:00, 20:00, and 2:00 for 7 days.",
    missingFields: [],
  },
  {
    id: "33333333-3333-4333-8333-333333333305",
    name: "Aspirin",
    ingredients: aspirinIngredients,
    strengthValue: 81,
    strengthUnit: "mg",
    amountPerDose: null,
    route: "by mouth",
    formulation: "tablet",
    release: "delayed",
    frequency: null,
    timings: [],
    instructionKind: "stop",
    duration: null,
    endDate: null,
    specialInstructions: "Stop aspirin unless a doctor restarts it.",
    sourceText: "Stop aspirin 81 mg delayed release tablet.",
    missingFields: [],
  },
];

export const pillReferences: PillReference[] = [
  {
    id: "pill-nc-10",
    name: "Demo Relief acetaminophen 500 mg",
    imprintSideA: "NC 10",
    imprintSideB: "10",
    requiresBothSides: true,
    shape: "round",
    color: "white",
    scoring: "scored",
    provenance: "Synthetic demo imprint created for Telenomily. It is not a photograph of a marketed tablet and it is not an FDA identification.",
  },
  {
    id: "pill-m5-white",
    name: "Ambiguous demo tablet M5 white",
    imprintSideA: "M 5",
    imprintSideB: null,
    requiresBothSides: false,
    shape: "round",
    color: "white",
    scoring: null,
    provenance: "Synthetic negative example so one imprint can hit more than one reference.",
  },
  {
    id: "pill-m5-white-b",
    name: "Ambiguous demo tablet M5 second white",
    imprintSideA: "M 5",
    imprintSideB: null,
    requiresBothSides: false,
    shape: "round",
    color: "white",
    scoring: null,
    provenance: "Synthetic negative example with the same imprint, shape, and color as the other M5 card, so the matcher must refuse to guess.",
  },
];

export const foreignMappings: ForeignMapping[] = [
  {
    id: "map-paracetamol-sol",
    aliases: ["Paracetamol Sol"],
    language: "es",
    ingredients: [{ name: "paracetamol", strengthValue: 500, strengthUnit: "mg" }],
    strengthValue: 500,
    strengthUnit: "mg",
    formulation: "comprimidos",
    release: "immediate",
    route: "oral",
    usCandidateName: "Demo Relief acetaminophen 500 mg oral tablet",
    referenceNote:
      "Demo mapping only. Paracetamol is the INN and acetaminophen is the USAN for the same active ingredient. Strength, oral tablet, and immediate release match this seeded card. This is not an FDA Orange Book rating and it does not establish interchangeability.",
    preverified: true,
  },
];

export const prescribedAcetaminophen: QuotedProduct = {
  name: "Acetaminophen",
  strengthValue: 500,
  strengthUnit: "mg",
  formulation: "tablet",
  release: "immediate",
  route: "oral",
};

export const pharmacyCandidate: PreverifiedCandidate = {
  id: "generic-demogen-apap-500",
  name: "DemoGen acetaminophen",
  strengthValue: 500,
  strengthUnit: "mg",
  formulation: "tablet",
  release: "immediate",
  route: "oral",
  preverified: true,
  referenceNote:
    "Fictional pharmacy scenario. DemoGen is a seeded generic candidate with the same active ingredient, 500 mg strength, oral tablet, and immediate release as the confirmed plan. It is not a real wholesaler quote and it does not change the prescription.",
};

export const pharmacyOutOfStock = {
  product: "Acetaminophen 500 mg tablet",
  inStock: false,
  quotedPriceUsd: 4.37,
  statement: "The prescribed 500 mg tablet is out of stock today. DemoGen acetaminophen 500 mg tablets are on the shelf.",
  candidateId: pharmacyCandidate.id,
};

export function baseLabel(overrides: Partial<{
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
  imageQuality: "ok" | "blurry" | "incomplete" | "needs_expiry" | "needs_other_side";
  conflicts: string[];
  visibleText: string;
}> = {}) {
  return {
    imageQuality: overrides.imageQuality ?? "ok",
    qualityNote: "",
    productName: overrides.productName ?? null,
    ingredients: overrides.ingredients ?? [],
    strengthValue: overrides.strengthValue ?? null,
    strengthUnit: overrides.strengthUnit ?? null,
    formulation: overrides.formulation ?? null,
    release: overrides.release ?? null,
    route: overrides.route ?? null,
    expirationDate: overrides.expirationDate ?? null,
    expirationText: overrides.expirationText ?? null,
    expirationReadable: overrides.expirationReadable ?? false,
    conflicts: overrides.conflicts ?? [],
    visibleText: overrides.visibleText ?? "",
  };
}
