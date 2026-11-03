import Link from "next/link";
import { productName } from "@/lib/runtime";

export default function PrivacyPage() {
  const name = productName();
  return (
    <main id="content" className="family-screen mx-auto min-h-dvh max-w-3xl px-6 py-12">
      <Link href="/" className="type-label text-indigo">Back</Link>
      <h1 className="type-title mt-4">Privacy</h1>
      <p className="type-body mt-4">{name} stores the account, the discharge images you upload, the confirmed plan, and the reports created during a call. Family members can open only the patients linked to their account. Sign in uses a session cookie. The demo does not run advertising trackers.</p>
      <p className="type-body mt-4">Service keys, phone credentials, and room tokens stay on the server. Room tokens are short lived and limited to one room.</p>
    </main>
  );
}
