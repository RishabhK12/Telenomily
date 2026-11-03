import { createClient } from "@supabase/supabase-js";
import { DEMO, buildSchedule, demoMedications } from "@nomi/domain";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log("Supabase service role is not set. Create the project, run the migration, then set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. No users were created.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function ensureUser(email: string, password: string, role: "patient" | "family", name: string) {
  const existing = await supabase.auth.admin.listUsers();
  const found = existing.data.users.find((user) => user.email === email);
  const user = found ?? (await supabase.auth.admin.createUser({ email, password, email_confirm: true })).data.user;
  if (!user) throw new Error(`Could not create ${email}`);
  await supabase.from("profiles").upsert({ id: user.id, role, display_name: name, phone_e164: role === "patient" ? process.env.DEMO_PATIENT_PHONE || null : null });
  return user.id;
}

const patientEmail = process.env.DEMO_PATIENT_EMAIL;
const patientPassword = process.env.DEMO_PATIENT_PASSWORD;
const familyEmail = process.env.DEMO_FAMILY_EMAIL;
const familyPassword = process.env.DEMO_FAMILY_PASSWORD;
if (!patientEmail || !patientPassword || !familyEmail || !familyPassword) {
  console.log("Set DEMO_PATIENT_EMAIL, DEMO_PATIENT_PASSWORD, DEMO_FAMILY_EMAIL, and DEMO_FAMILY_PASSWORD in the environment. They are not stored in git.");
  process.exit(1);
}

const patientProfileId = await ensureUser(patientEmail, patientPassword, "patient", DEMO.patientName);
const familyProfileId = await ensureUser(familyEmail, familyPassword, "family", DEMO.familyName);

await supabase.from("patients").upsert({
  id: DEMO.patientId,
  profile_id: patientProfileId,
  preferred_name: DEMO.patientName,
  phone_e164: process.env.DEMO_PATIENT_PHONE || null,
  time_zone: DEMO.timeZone,
  is_demo: true,
});
await supabase.from("family_links").upsert({ patient_id: DEMO.patientId, family_profile_id: familyProfileId, status: "active" });

const start = new Intl.DateTimeFormat("en-CA", { timeZone: DEMO.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const schedule = buildSchedule(demoMedications, { startDate: start, days: 2, timeZone: DEMO.timeZone });
await supabase.from("plan_versions").upsert({
  id: DEMO.planVersionId,
  patient_id: DEMO.patientId,
  status: "confirmed",
  confirmed_at: new Date().toISOString(),
});
await supabase.from("medications").upsert(
  demoMedications.map((medication) => ({
    id: medication.id,
    plan_version_id: DEMO.planVersionId,
    patient_id: DEMO.patientId,
    name: medication.name,
    ingredients: medication.ingredients,
    strength_value: medication.strengthValue,
    strength_unit: medication.strengthUnit,
    amount_per_dose: medication.amountPerDose,
    route: medication.route,
    formulation: medication.formulation,
    release_type: medication.release,
    frequency: medication.frequency,
    timings: medication.timings,
    instruction_kind: medication.instructionKind,
    duration: medication.duration,
    end_date: medication.endDate,
    special_instructions: medication.specialInstructions,
    source_text: medication.sourceText,
    missing_fields: medication.missingFields,
  })),
);
if (schedule.doses.length) {
  await supabase.from("dose_occurrences").upsert(
    schedule.doses.map((dose) => ({
      patient_id: DEMO.patientId,
      plan_version_id: DEMO.planVersionId,
      medication_id: dose.medicationId,
      scheduled_for: dose.scheduledFor,
      instructions: dose.instructions,
      state: "pending",
    })),
    { onConflict: "medication_id,scheduled_for" },
  );
}
console.log("Demo patient and family are ready. Passwords stayed in the environment.");
