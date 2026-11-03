import { compareStrength, normalizeFormulation, normalizeRelease, normalizeRoute } from "./normalize.js";

export type QuotedProduct = {
  name: string;
  strengthValue: number | null;
  strengthUnit: string | null;
  formulation: string | null;
  release: string | null;
  route: string | null;
};

export type PreverifiedCandidate = QuotedProduct & {
  id: string;
  preverified: boolean;
  referenceNote: string;
};

export type SubstitutionDecision = {
  decision: "preverified_candidate" | "needs_review" | "rejected";
  reason: string;
  changesPlan: false;
};

export function assessSubstitution(
  prescribed: QuotedProduct,
  quoted: QuotedProduct,
  candidate: PreverifiedCandidate | null,
): SubstitutionDecision {
  const strength = compareStrength(quoted.strengthValue, quoted.strengthUnit, prescribed.strengthValue, prescribed.strengthUnit);
  const form = normalizeFormulation(quoted.formulation);
  const prescribedForm = normalizeFormulation(prescribed.formulation);
  const release = normalizeRelease(quoted.release);
  const prescribedRelease = normalizeRelease(prescribed.release);
  const route = normalizeRoute(quoted.route);
  const prescribedRoute = normalizeRoute(prescribed.route);

  if (strength === "different" || (form && prescribedForm && form !== prescribedForm) || (release && prescribedRelease && release !== prescribedRelease)) {
    return {
      decision: "rejected",
      reason: "The quoted product differs in strength, formulation, or release. It is not an automatic substitute.",
      changesPlan: false,
    };
  }
  if (route && prescribedRoute && route !== prescribedRoute) {
    return {
      decision: "rejected",
      reason: "The quoted route does not match the prescription.",
      changesPlan: false,
    };
  }
  if (!candidate || !candidate.preverified) {
    return {
      decision: "needs_review",
      reason: "No preverified candidate was quoted. A clinician or pharmacist must review any substitution.",
      changesPlan: false,
    };
  }
  const candidateStrength = compareStrength(candidate.strengthValue, candidate.strengthUnit, prescribed.strengthValue, prescribed.strengthUnit);
  const candidateAligns =
    candidateStrength === "equal" &&
    normalizeFormulation(candidate.formulation) === prescribedForm &&
    normalizeRelease(candidate.release) === prescribedRelease &&
    normalizeRoute(candidate.route) === prescribedRoute &&
    compareStrength(quoted.strengthValue, quoted.strengthUnit, candidate.strengthValue, candidate.strengthUnit) === "equal";
  if (!candidateAligns) {
    return {
      decision: "needs_review",
      reason: "The quoted product does not match the preverified candidate on every required detail.",
      changesPlan: false,
    };
  }
  return {
    decision: "preverified_candidate",
    reason: candidate.referenceNote,
    changesPlan: false,
  };
}
