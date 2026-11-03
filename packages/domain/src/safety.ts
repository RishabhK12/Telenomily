const URGENT_PHRASES = [
  "chest pain",
  "trouble breathing",
  "cannot breathe",
  "can't breathe",
  "shortness of breath",
  "face swelling",
  "swelling of the face",
  "throat closing",
  "throat swelling",
  "suicidal",
  "want to die",
  "one sided weakness",
  "uncontrolled bleeding",
  "coughing blood",
  "passed out",
  "fainted",
  "severe allergic",
];

export function classifySymptom(text: string): { urgent: boolean; spokenScript: string } {
  const normalized = text.toLowerCase();
  const urgent = URGENT_PHRASES.some((phrase) => normalized.includes(phrase));
  if (urgent) {
    return {
      urgent: true,
      spokenScript:
        "That needs urgent help. Contact emergency services now. I will also leave a message for your family. A family message is not medical care, and I cannot tell you this symptom is harmless.",
    };
  }
  return {
    urgent: false,
    spokenScript:
      "I saved that symptom report with the time you said it. I cannot diagnose it, change treatment, or tell you it is harmless. If you feel worse, contact a doctor, a pharmacist, or emergency services.",
  };
}

export type ShoppingKind = "replace_expired" | "obtain_missing";

export function replacementTaskAction(
  existingOpen: { medicationKey: string; kind: ShoppingKind }[],
  next: { medicationKey: string; kind: ShoppingKind; patientConfirmedNeed: boolean },
): "create" | "skip_duplicate" | "skip_unconfirmed" {
  if (next.kind === "obtain_missing" && !next.patientConfirmedNeed) return "skip_unconfirmed";
  if (existingOpen.some((task) => task.medicationKey === next.medicationKey && task.kind === next.kind)) {
    return "skip_duplicate";
  }
  return "create";
}
