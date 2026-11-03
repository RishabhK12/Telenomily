import { FamilyLive } from "./family-live";
import { loadLaptopFamilyBoard } from "@/lib/demo-hub";

export const dynamic = "force-dynamic";

export default async function DemoFamilyPage() {
  try {
    const initial = await loadLaptopFamilyBoard();
    return <FamilyLive initial={initial} />;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The family screen is unavailable.";
    return (
      <main id="content" className="min-h-screen bg-[#F6F6FE] px-4 py-8 text-[#0F0E35] [font-family:Nunito,ui-sans-serif,system-ui,sans-serif]">
        <p className="mx-auto max-w-[480px] rounded-3xl bg-white p-5 text-lg">{message}</p>
      </main>
    );
  }
}
