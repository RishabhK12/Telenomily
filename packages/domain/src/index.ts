export * from "./access.js";
export * from "./calls.js";
export * from "./fixtures.js";
export * from "./match-foreign.js";
export * from "./match-medicine.js";
export * from "./match-pill.js";
export * from "./normalize.js";
export * from "./pharmacy.js";
export * from "./safety.js";
export * from "./schedule.js";
export * from "./schemas.js";

export const productNameFromEnv = (value: string | undefined): string => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Telenomily";
};
