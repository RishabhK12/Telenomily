import { productNameFromEnv } from "@nomi/domain";

export type RuntimeMode = "live" | "rehearsal" | "unconfigured";

export function runtimeMode(): RuntimeMode {
  if (process.env.APP_MODE === "rehearsal") return "rehearsal";
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return "live";
  }
  return "unconfigured";
}

export function productName(): string {
  return productNameFromEnv(process.env.NEXT_PUBLIC_PRODUCT_NAME);
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function requireLiveCredentials(names: string[]): void {
  const missing = names.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`missing:${missing.join(",")}`);
  }
}

export function integrationReadiness(): { name: string; ready: boolean; missing: string[] }[] {
  const groups: { name: string; keys: string[] }[] = [
    { name: "Supabase", keys: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] },
    { name: "Grok", keys: ["XAI_API_KEY"] },
    { name: "LiveKit", keys: ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "NEXT_PUBLIC_LIVEKIT_URL"] },
    { name: "Phone calls", keys: ["LIVEKIT_SIP_TRUNK_ID", "DEMO_PATIENT_PHONE", "DEMO_PHARMACY_PHONE", "ALLOWED_CALL_NUMBERS"] },
    { name: "Demo family sign in", keys: ["DEMO_FAMILY_EMAIL", "DEMO_FAMILY_PASSWORD"] },
    { name: "Presenter", keys: ["PRESENTER_ACCESS_CODE"] },
  ];
  return groups.map((group) => {
    const missing = group.keys.filter((key) => !process.env[key]?.trim());
    return { name: group.name, ready: missing.length === 0, missing };
  });
}

export function allowedNumbers(): string[] {
  return (process.env.ALLOWED_CALL_NUMBERS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
