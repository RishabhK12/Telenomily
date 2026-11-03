import { Board, type BoardData } from "@/components/board";
import { loadDashboard } from "@/lib/service";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function FamilyPage() {
  try {
    const data = (await loadDashboard()) as BoardData;
    if (data.viewer.role === "patient") redirect("/patient");
    return (
      <main id="content">
        <Board initial={data} audience="family" />
      </main>
    );
  } catch {
    redirect("/login");
  }
}
