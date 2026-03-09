import type { Metadata } from "next";
import Image from "next/image";
import { Exo_2, Rajdhani } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { FilterLoadingOverlay } from "@/components/filter-loading-overlay";
import { MenuNavigation } from "@/components/menu-navigation";
import { SiteFooter } from "@/components/site-footer";
import { APP_NAME } from "@/lib/constants";

const heading = Rajdhani({ subsets: ["latin"], weight: ["500", "600", "700"] });
const body = Exo_2({ subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Cyberspace situational awareness dashboard for TSAAT posture and risk reporting."
};

const navigation = [
  { href: "/cyber-cop", label: "Cyber COP" },
  { href: "/networks", label: "Networks" },
  { href: "/systems", label: "ICT Systems" },
  { href: "/discovery-coverage", label: "Discovery Coverage" },
  { href: "/findings", label: "Findings Register" },
  { href: "/measures", label: "Measures" },
  { href: "/report", label: "Briefs & Reports" }
];

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${body.className} antialiased`}>
        <div className="app-bg" />
        <div className="topography-overlay" />
        <header className="no-print border-b border-sky-300/15 bg-slate-950/50 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="flex items-center gap-3">
              <Image src="/dct-mark.svg" alt="TSAAT mark" width={40} height={40} />
              <div>
                <p className={`${heading.className} text-xl uppercase tracking-[0.14em] text-slate-100`}>
                  TSAAT
                </p>
                <p className="text-xs text-slate-300/75">Threat Surface Area Assessment Tool</p>
              </div>
            </div>
            <MenuNavigation items={navigation} />
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] px-4 py-5 md:px-6 md:py-8">{children}</main>
        <Suspense fallback={null}>
          <FilterLoadingOverlay />
        </Suspense>

        <SiteFooter />
      </body>
    </html>
  );
}
