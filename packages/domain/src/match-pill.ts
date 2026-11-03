import { normalizeImprint, normalizeName } from "./normalize.js";

export type PillReference = {
  id: string;
  name: string;
  imprintSideA: string;
  imprintSideB: string | null;
  requiresBothSides: boolean;
  shape: string;
  color: string;
  scoring: string | null;
  provenance: string;
};

export type PillObservation = {
  imageQuality: "ok" | "blurry" | "incomplete" | "needs_expiry" | "needs_other_side";
  imprintReadable: boolean;
  imprintSideA: string | null;
  imprintSideB: string | null;
  shape: string | null;
  color: string | null;
  scoring: string | null;
  conflicts: string[];
};

export type PillMatch = {
  outcome: "possible_match" | "cant_confirm";
  referenceId: string | null;
  spokenScript: string;
  reason: string;
};

export function matchPill(observation: PillObservation, references: PillReference[]): PillMatch {
  if (observation.imageQuality === "blurry" || observation.imageQuality === "incomplete") {
    return fail("The picture is not clear enough. Hold the pill still on a plain surface.");
  }
  if (observation.conflicts.length > 0) return fail("The visible markings conflict, so this pill cannot be confirmed.");
  if (!observation.imprintReadable || !normalizeImprint(observation.imprintSideA)) {
    return fail("There is no readable imprint. A pill without a readable imprint cannot be confirmed.");
  }

  const sideA = normalizeImprint(observation.imprintSideA);
  const sideB = normalizeImprint(observation.imprintSideB);
  const imprintHits = references.filter((reference) => normalizeImprint(reference.imprintSideA) === sideA);

  if (imprintHits.length === 0) return fail("No seeded reference has this imprint.");

  const needsSide = imprintHits.filter((reference) => reference.requiresBothSides && !sideB);
  if (needsSide.length === imprintHits.length) {
    return fail("The other side is required before this imprint can be compared.");
  }

  const compared = imprintHits.filter((reference) => {
    if (!reference.requiresBothSides) return true;
    return normalizeImprint(reference.imprintSideB) === sideB;
  });

  if (compared.length === 0) return fail("The other side does not match a seeded reference.");
  if (compared.length > 1) return fail("More than one seeded reference matches this imprint.");

  const reference = compared[0];
  if (!reference) return fail("No seeded reference has this imprint.");
  if (observation.shape && normalizeName(observation.shape) !== normalizeName(reference.shape)) {
    return fail("The shape does not match the only imprint candidate.");
  }
  if (observation.color && normalizeName(observation.color) !== normalizeName(reference.color)) {
    return fail("The color does not match the only imprint candidate.");
  }
  if (
    observation.scoring &&
    reference.scoring &&
    normalizeName(observation.scoring) !== normalizeName(reference.scoring)
  ) {
    return fail("The scoring does not match the only imprint candidate.");
  }

  return {
    outcome: "possible_match",
    referenceId: reference.id,
    reason: "Imprint and observed features agree with one seeded reference.",
    spokenScript: `This may match ${reference.name}. The imprint and the visible shape and color agree with one seeded reference. This is a possible match only. Verify it with a pharmacist before use. A reference match does not prove the pill is authentic, and it does not change any prescribed dose.`,
  };
}

function fail(reason: string): PillMatch {
  return {
    outcome: "cant_confirm",
    referenceId: null,
    reason,
    spokenScript: `I can't confirm this pill. ${reason} I will not add it to the schedule or change a dose.`,
  };
}
