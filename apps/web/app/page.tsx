import { SiteNav, TaglineReveal } from "@/components/marketing";
import { productName } from "@/lib/runtime";

const faqs = [
  ["What does a family get?", "A shared view of today's doses, reported symptoms, medicine checks, pharmacy notes, and an open call. Each family account only opens the patients linked to it."],
  ["Does the app invent a dose?", "No. If a clock time, duration, or instruction is missing, it stays missing until a person confirms a correction."],
  ["Is an as needed medicine scheduled every day?", "No. As needed instructions stay off the mandatory schedule."],
  ["Can a medicine check change the prescription?", "No. A package that is not on the plan is reported that way. Stopped medicines stay stopped."],
  ["What if the label is blurry?", "The call asks for a still view, a closer view, the label, or the expiration date. It does not guess."],
  ["Does a phone call prove a dose was taken?", "No. Answers are saved as patient reports. A busy, rejected, or unanswered call is no response, not a confirmed missed dose."],
  ["Is this medical advice?", "No. Telenomily does not diagnose, change treatment, or replace a pharmacist or doctor."],
  ["Is the demo household real?", "Elena Vasquez and Mateo Vasquez are fictional. The labels in the demo pack are synthetic drawings, not product photos."],
];

export default function HomePage() {
  const name = productName();
  return (
    <div className="atmosphere">
      <SiteNav name={name} />
      <main id="content">
        <section className="mx-auto flex max-w-[720px] flex-col gap-6 px-5 py-16">
          <p className="type-label uppercase text-muted">For families bringing someone home</p>
          <h1 className="type-title text-navy">
            The medication companion
            <br />
            for the first week home
          </h1>
          <p className="type-body max-w-[680px] text-muted">
            {name} turns a photographed discharge sheet into a large daily schedule, then stays on a live video call while the patient shows each medicine.
          </p>
          <div>
            <a href="/login" className="btn-main max-w-xs">Sign in</a>
          </div>
          <p className="type-family text-muted">Fictional demo household: Elena Vasquez and her son Mateo. Not a customer story and not a clinical claim.</p>
          <a href="/demo" className="type-label text-indigo">Open the laptop demo hub</a>
        </section>
        <section className="mx-auto grid max-w-5xl gap-6 px-6 py-12 md:grid-cols-3">
          {[
            ["Today stays readable", "Clock doses use only times written on the confirmed plan."],
            ["The call looks at the real package", "One fresh frame is checked. The app does not stream every video frame."],
            ["Family sees the same day", "Reports, alerts, and the open call update from the saved record."],
          ].map(([title, copy]) => (
            <article key={title} className="card">
              <h2 className="type-heading">{title}</h2>
              <p className="type-family mt-3">{copy}</p>
            </article>
          ))}
        </section>
        <section className="px-6 py-16">
          <TaglineReveal lines={["Show the bottle.", "Hear the plan.", "Keep one shared day."]} />
        </section>
        <section className="mx-auto grid max-w-5xl gap-8 px-6 py-12 md:grid-cols-3">
          {[
            ["1. Photograph the sheet", "Add one page or several. Grok extracts only what is visible."],
            ["2. Confirm the plan", "Source text sits beside each row so a wrong reading can be corrected."],
            ["3. Start a medicine check", "The patient, the voice assistant, and an optional family member share one room."],
          ].map(([title, copy]) => (
            <article key={title}>
              <h2 className="type-heading">{title}</h2>
              <p className="type-family mt-3">{copy}</p>
            </article>
          ))}
        </section>
        <section className="mx-auto max-w-3xl px-6 py-12">
          <h2 className="type-title">Questions</h2>
          <div className="mt-6 flex flex-col gap-4">
            {faqs.map(([question, answer]) => (
              <details key={question} className="card">
                <summary className="type-label cursor-pointer">{question}</summary>
                <p className="type-family mt-3">{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="type-title">Open the demo</h2>
          <p className="type-body mt-4 max-w-[680px]">Sign in for Elena or Mateo, or open the laptop hub.</p>
          <a href="/demo" className="btn-main mt-6 max-w-xs">Open demo hub</a>
        </section>
      </main>
      <footer className="mx-auto flex max-w-5xl flex-wrap gap-4 px-6 py-10">
        <a className="type-label text-indigo" href="/privacy">Privacy</a>
        <a className="type-label text-indigo" href="/terms">Terms</a>
        <p className="type-family text-muted">Not a medical device. Inspired by RxMind and by the Nomi project. No official partnership is claimed.</p>
      </footer>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }) }}
      />
    </div>
  );
}
