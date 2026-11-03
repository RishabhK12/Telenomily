"use client";

import { House, Scan, VideoCamera } from "@phosphor-icons/react";
import Link from "next/link";

export function PatientNav({ active }: { active: "today" | "scan" | "call" }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[480px] items-end justify-between px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-2" aria-label="Patient">
      <Link href="/patient" className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-lifted" aria-current={active === "today" ? "page" : undefined}>
        <House size={28} weight="fill" color={active === "today" ? "#F9DF77" : "#FFFFFF"} />
        <span className="sr-only">Today</span>
      </Link>
      <Link href="/patient/check" className="-mt-4 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-yellow shadow-high" aria-current={active === "call" ? "page" : undefined}>
        <VideoCamera size={32} weight="fill" color="#2F3273" />
        <span className="sr-only">Video call</span>
      </Link>
      <Link href="/patient/scan" className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-lifted" aria-current={active === "scan" ? "page" : undefined}>
        <Scan size={28} weight="fill" color="#FFFFFF" />
        <span className="sr-only">Scan</span>
      </Link>
    </nav>
  );
}
