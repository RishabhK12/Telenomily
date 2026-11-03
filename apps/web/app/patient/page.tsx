import { Board, type BoardData } from "@/components/board";
import { loadDashboard } from "@/lib/service";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PatientPage() {
  try {
    const data = (await loadDashboard()) as BoardData;
    if (data.viewer.role === "family") redirect("/family");
    return <Board initial={data} audience="patient" />;
  } catch {
    redirect("/login");
  }
}
