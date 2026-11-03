import Link from "next/link";

export default function NotFound() {
  return (
    <main id="content" className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6">
      <h1 className="heading-4">That page is not here</h1>
      <p className="body-3">The link may have expired or the address is wrong.</p>
      <Link href="/" className="button-md inline-flex w-fit rounded-2xl bg-ink px-3 py-2 text-paper">Go to the start</Link>
    </main>
  );
}
