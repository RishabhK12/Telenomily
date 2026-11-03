import { PresenterPanel } from "@/components/presenter-panel";
import { integrationReadiness, productName } from "@/lib/runtime";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function PresenterPage() {
  return (
    <main id="content" className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <Link href="/" className="caption-2">Back</Link>
      <h1 className="heading-4">{productName()} presenter</h1>
      <p className="body-6">Demo controls use the same routes as the product. A missing provider returns an error instead of a success screen.</p>
      <PresenterPanel readiness={integrationReadiness()} />
    </main>
  );
}
