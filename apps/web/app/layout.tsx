import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { productName } from "@/lib/runtime";

const nunito = Nunito({ subsets: ["latin"], weight: ["500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: `${productName()} | Medication companion`,
  description: "A shared medication companion for the first week home after a hospital stay. Fictional demo. Not medical advice.",
  applicationName: "Telenomily",
  appleWebApp: { capable: true, title: "Telenomily", statusBarStyle: "default" },
  openGraph: {
    title: productName(),
    description: "Turn a discharge sheet into a daily schedule and check medicines on a live call.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4D50A2",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${nunito.className} antialiased`}>
        <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-navy">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
