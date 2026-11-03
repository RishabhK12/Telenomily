import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { productName } from "@/lib/runtime";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: `${productName()} | Medication companion`,
  description: "A shared medication companion for the first week home after a hospital stay. Fictional demo. Not medical advice.",
  openGraph: {
    title: productName(),
    description: "Turn a discharge sheet into a daily schedule and check medicines on a live call.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${manrope.className} bg-paper text-ink antialiased`}>
        <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-card focus:px-3 focus:py-2">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
