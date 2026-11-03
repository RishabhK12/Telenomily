import { AuthForm } from "@/components/auth-form";
import { Logo } from "@/components/logo";
import { productName, runtimeMode } from "@/lib/runtime";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const mode = runtimeMode();
  return (
    <main id="content" className="atmosphere flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-[480px]">
        <Logo />
        <h1 className="type-title mt-8">Sign in to {productName()}</h1>
        <p className="type-body mt-3 text-muted">Patients see large controls. Family members see only the people linked to them.</p>
        <div className="card mt-6">
          <AuthForm mode={mode} />
        </div>
        <Link href="/" className="mt-6 inline-block type-label text-indigo">Back</Link>
      </div>
    </main>
  );
}
