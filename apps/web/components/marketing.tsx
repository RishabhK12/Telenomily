"use client";

import { useEffect, useRef, useState } from "react";

export function TaglineReveal({ lines }: { lines: string[] }) {
  const words = lines.flatMap((line, lineIndex) => line.split(" ").map((word) => ({ word, lineIndex })));
  const [seen, setSeen] = useState<boolean[]>(() => words.map(() => false));
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce.current) {
      setSeen(words.map(() => true));
      return;
    }
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal-word]"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = Number((entry.target as HTMLElement).dataset.revealWord);
          setSeen((current) => current.map((value, item) => value || item === index));
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.8 },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
    // lines is a stable marketing string list; the word nodes are queried from the DOM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let cursor = 0;
  return (
    <div className="mx-auto max-w-[680px]">
      {lines.map((line) => {
        const parts = line.split(" ");
        const row = (
          <p key={line} className="heading-3">
            {parts.map((word) => {
              const index = cursor;
              cursor += 1;
              return (
                <span
                  key={`${word}-${index}`}
                  data-reveal-word={index}
                  className="ease-soft mr-2 inline-block transition-colors duration-500"
                  style={{ color: seen[index] ? "#131209" : "rgb(19 18 9 / 0.3)" }}
                >
                  {word}
                </span>
              );
            })}
          </p>
        );
        return row;
      })}
    </div>
  );
}

export function SiteNav({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-4 z-20 mx-auto flex w-fit justify-center px-4">
      <nav className="flex items-center gap-4 rounded-full border border-line bg-card/80 px-4 py-2 shadow-sm backdrop-blur">
        <a href="#content" className="title-3">{name}</a>
        <a href="/login" className="button-md rounded-full bg-ink px-3 py-2 text-paper transition duration-300 ease-soft hover:scale-[1.02] active:scale-[0.98]">Sign in</a>
        <button type="button" className="button-md md:hidden" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? "Close" : "Menu"}
        </button>
      </nav>
      {open ? (
        <div className="fixed inset-0 z-30 flex flex-col gap-6 bg-paper/95 p-8 backdrop-blur md:hidden">
          <button type="button" className="button-md self-end" onClick={() => setOpen(false)}>Close</button>
          <a className="heading-5" href="/login">Sign in</a>
          <a className="heading-5" href="/privacy">Privacy</a>
          <a className="heading-5" href="/terms">Terms</a>
        </div>
      ) : null}
    </header>
  );
}
