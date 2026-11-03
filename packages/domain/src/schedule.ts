import type { Ingredient } from "./normalize.js";

export type InstructionKind = "start" | "continue" | "stop" | "as_needed";

export type PlanMedication = {
  id: string;
  name: string;
  ingredients: Ingredient[];
  strengthValue: number | null;
  strengthUnit: string | null;
  amountPerDose: string | null;
  route: string | null;
  formulation: string | null;
  release: string | null;
  frequency: string | null;
  timings: string[];
  instructionKind: InstructionKind;
  duration: string | null;
  endDate: string | null;
  specialInstructions: string | null;
  sourceText: string;
  missingFields: string[];
};

export type DraftDose = {
  medicationId: string;
  scheduledFor: string;
  instructions: string;
};

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isExplicitClock(value: string): boolean {
  return CLOCK.test(value);
}

export function administrationInstructions(medication: PlanMedication): string {
  const parts = [
    medication.amountPerDose,
    medication.route,
    medication.frequency,
    medication.specialInstructions,
  ].filter((part): part is string => Boolean(part && part.trim()));
  if (parts.length === 0) return "No administration instructions were stated on the confirmed plan.";
  return parts.join(". ");
}

/**
 * Build clock doses from a confirmed plan.
 * Stopped medicines are excluded. As needed medicines stay off the mandatory schedule.
 * Clock times are used only when the plan already states them.
 */
export function buildSchedule(
  medications: PlanMedication[],
  options: { startDate: string; days: number; timeZone: string },
): {
  doses: DraftDose[];
  asNeeded: PlanMedication[];
  stopped: PlanMedication[];
  gaps: { medicationId: string; message: string }[];
} {
  const doses: DraftDose[] = [];
  const asNeeded: PlanMedication[] = [];
  const stopped: PlanMedication[] = [];
  const gaps: { medicationId: string; message: string }[] = [];

  for (const medication of medications) {
    if (medication.instructionKind === "stop") {
      stopped.push(medication);
      continue;
    }
    if (medication.instructionKind === "as_needed") {
      asNeeded.push(medication);
      continue;
    }
    const clocks = medication.timings.filter(isExplicitClock);
    if (clocks.length === 0) {
      gaps.push({
        medicationId: medication.id,
        message: "Timing was not stated, so no clock dose was created.",
      });
      continue;
    }
    for (let day = 0; day < options.days; day += 1) {
      const date = addDays(options.startDate, day);
      if (medication.endDate && date > medication.endDate) continue;
      for (const clock of clocks) {
        const [hour, minute] = clock.split(":").map(Number);
        const [year, month, dayOfMonth] = date.split("-").map(Number);
        doses.push({
          medicationId: medication.id,
          scheduledFor: zonedTimeToUtc(year, month, dayOfMonth, hour, minute, options.timeZone).toISOString(),
          instructions: administrationInstructions(medication),
        });
      }
    }
  }

  doses.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  return { doses, asNeeded, stopped, gaps };
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(utcGuess);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  let renderedHour = read("hour");
  if (renderedHour === 24) renderedHour = 0;
  const rendered = Date.UTC(read("year"), read("month") - 1, read("day"), renderedHour, read("minute"), read("second"));
  const offset = rendered - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offset);
}

export function assertConfirmedPlan(plan: { status: string }): void {
  if (plan.status !== "confirmed") {
    throw new Error("draft_plan");
  }
}
