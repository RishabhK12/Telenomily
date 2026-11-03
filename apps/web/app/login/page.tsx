import { AuthForm } from "@/components/auth-form";
import { productName, runtimeMode } from "@/lib/runtime";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const mode = runtimeMode();
  return (
    <main id="content" className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-6 py-12">
      <Link href="/" className="caption-2">Back</Link>
      <h1 className="heading-4">Sign in to {productName()}</h1>
      <p className="body-6">Patients see large controls. Family members see only the people linked to them.</p>
      <AuthForm mode={mode} />
    </main>
  );
}
