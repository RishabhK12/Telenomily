import { PlanEditor } from "@/components/plan-editor";

export const dynamic = "force-dynamic";

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlanEditor planId={id} />;
}
