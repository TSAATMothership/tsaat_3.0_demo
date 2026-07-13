import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import { Suspense } from "react";
import "./globals.css";
import { AuthenticatedSessionGuard } from "@/components/authenticated-session-guard";
import { FilterLoadingOverlay } from "@/components/filter-loading-overlay";
import { MenuNavigation } from "@/components/menu-navigation";
import { SiteFooter } from "@/components/site-footer";
import { APP_NAME } from "@/lib/constants";

const bodyFontClass = "font-['Segoe_UI','Trebuchet_MS','Arial',sans-serif]";
const headingFontClass = "font-['Bahnschrift','Arial_Narrow','Arial',sans-serif]";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Cyberspace situational awareness dashboard for TSAAT posture and risk reporting."
};

const navigation = [
  { href: "/cyber-cop", label: "Cyber COP" },
  { href: "/networks", label: "Networks" },
  { href: "/systems", label: "ICT Systems" }
];

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = headers();
  const pathname = requestHeaders.get("x-tsaat-pathname") ?? "";
  const authenticatedUsername = (requestHeaders.get("x-tsaat-auth-user") ?? "").trim();
  const isLoginRoute = pathname === "/login";

  if (isLoginRoute) {
    return (
      <html lang="en">
        <body className={`${bodyFontClass} antialiased`}>
          <div className="app-bg" />
          <div className="topography-overlay" />
          <main className="mx-auto max-w-[1400px] px-4 py-5 md:px-6 md:py-8">{children}</main>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className={`${bodyFontClass} antialiased`}>
        <div className="app-bg" />
        <div className="topography-overlay" />
        <header className="no-print border-b border-sky-300/15 bg-slate-950/50 backdrop-blur-md">
          <div className="relative left-1/2 w-[min(2100px,calc(100vw-2rem))] -translate-x-1/2 py-4 md:w-[min(2100px,calc(100vw-3rem))]">
            <div className="flex items-center justify-between gap-4">
              <div className="flex shrink-0 items-center gap-3">
                <Image src="/dct-mark.svg" alt="TSAAT mark" width={40} height={40} />
                <div>
                  <p className={`${headingFontClass} text-xl uppercase tracking-[0.14em] text-slate-100`}>TSAAT</p>
                  <p className="text-xs text-slate-300/75">Threat Surface Area Assessment Tool</p>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <Suspense fallback={<div className="h-[38px]" />}>
                  <MenuNavigation items={navigation} authenticatedUsername={authenticatedUsername} />
                </Suspense>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] px-4 py-5 md:px-6 md:py-8">{children}</main>
        <Suspense fallback={null}>
          <AuthenticatedSessionGuard />
        </Suspense>
        <Suspense fallback={null}>
          <FilterLoadingOverlay />
        </Suspense>

        <SiteFooter />
      </body>
    </html>
  );
}
