import { z } from "zod";

export const ingredientSchema = z.object({
  name: z.string().min(1),
  strengthValue: z.number().nullable(),
  strengthUnit: z.string().nullable(),
});

export const instructionKindSchema = z.enum(["start", "continue", "stop", "as_needed"]);

export const extractedMedicationSchema = z.object({
  name: z.string().nullable(),
  ingredients: z.array(ingredientSchema),
  strengthValue: z.number().nullable(),
  strengthUnit: z.string().nullable(),
  amountPerDose: z.string().nullable(),
  route: z.string().nullable(),
  formulation: z.string().nullable(),
  release: z.string().nullable(),
  frequency: z.string().nullable(),
  timings: z.array(z.string()),
  instructionKind: instructionKindSchema.nullable(),
  duration: z.string().nullable(),
  endDate: z.string().nullable(),
  specialInstructions: z.string().nullable(),
  sourceText: z.string(),
  missingFields: z.array(z.string()),
  conflicts: z.array(z.string()),
});

export const dischargeExtractionSchema = z.object({
  medications: z.array(extractedMedicationSchema),
  unreadableNotes: z.array(z.string()),
});

export const imageQualitySchema = z.enum([
  "ok",
  "blurry",
  "incomplete",
  "needs_expiry",
  "needs_other_side",
]);

export const labelExtractionSchema = z.object({
  imageQuality: imageQualitySchema,
  qualityNote: z.string(),
  productName: z.string().nullable(),
  ingredients: z.array(ingredientSchema),
  strengthValue: z.number().nullable(),
  strengthUnit: z.string().nullable(),
  formulation: z.string().nullable(),
  release: z.string().nullable(),
  route: z.string().nullable(),
  expirationDate: z.string().nullable(),
  expirationText: z.string().nullable(),
  expirationReadable: z.boolean(),
  conflicts: z.array(z.string()),
  visibleText: z.string(),
});

export const pillExtractionSchema = z.object({
  imageQuality: imageQualitySchema,
  qualityNote: z.string(),
  imprintReadable: z.boolean(),
  imprintSideA: z.string().nullable(),
  imprintSideB: z.string().nullable(),
  askedForOtherSide: z.boolean(),
  shape: z.string().nullable(),
  color: z.string().nullable(),
  scoring: z.string().nullable(),
  otherMarkings: z.string().nullable(),
  conflicts: z.array(z.string()),
});

export const foreignExtractionSchema = z.object({
  imageQuality: imageQualitySchema,
  qualityNote: z.string(),
  originalText: z.string(),
  language: z.string().nullable(),
  englishTranslation: z.string(),
  productName: z.string().nullable(),
  ingredients: z.array(ingredientSchema),
  strengthValue: z.number().nullable(),
  strengthUnit: z.string().nullable(),
  formulation: z.string().nullable(),
  release: z.string().nullable(),
  route: z.string().nullable(),
  conflicts: z.array(z.string()),
});

export const doseReportStateSchema = z.enum([
  "reported_taken",
  "reported_not_taken",
  "unsure",
  "no_response",
]);

export const symptomReportSchema = z.object({
  text: z.string().min(1).max(2000),
  idempotencyKey: z.string().min(8).max(200),
});

export const toolRequestSchema = z.object({
  tool: z.enum([
    "read_plan",
    "check_medicine",
    "check_pill",
    "check_foreign_label",
    "record_dose",
    "record_symptom",
    "finish_cabinet",
    "add_replacement",
    "record_pharmacy",
    "end_call",
  ]),
  roomName: z.string().min(1),
  idempotencyKey: z.string().min(8).max(200),
  args: z.record(z.string(), z.unknown()).default({}),
});

export type DischargeExtraction = z.infer<typeof dischargeExtractionSchema>;
export type ExtractedMedication = z.infer<typeof extractedMedicationSchema>;
export type LabelExtraction = z.infer<typeof labelExtractionSchema>;
export type PillExtraction = z.infer<typeof pillExtractionSchema>;
export type ForeignExtraction = z.infer<typeof foreignExtractionSchema>;
export type DoseReportState = z.infer<typeof doseReportStateSchema>;
export type ToolRequest = z.infer<typeof toolRequestSchema>;
