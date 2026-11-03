import Link from "next/link";
import { productName } from "@/lib/runtime";

export default function TermsPage() {
  const name = productName();
  return (
    <main id="content" className="family-screen mx-auto min-h-dvh max-w-3xl px-6 py-12">
      <Link href="/" className="type-label text-indigo">Back</Link>
      <h1 className="type-title mt-4">Terms</h1>
      <p className="type-body mt-4">{name} is a demonstration companion for organizing discharge instructions and medication checks. It does not diagnose, treat, or replace a pharmacist, doctor, or emergency service. A family notification is not medical care.</p>
      <p className="type-body mt-4">You are responsible for confirming a plan before relying on a schedule. Expired, unreadable, or unlisted products must be checked with a pharmacist before use.</p>
    </main>
  );
}
