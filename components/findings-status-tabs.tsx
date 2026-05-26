"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startRouteLoading } from "@/lib/route-loading";

export function FindingsStatusTabs({
  activeTab,
  children
}: {
  activeTab: "open" | "closed";
  children?: ReactNode;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  const onSelectTab = (tab: "open" | "closed") => {
    window.dispatchEvent(new Event("tsaat:findings-register-dismiss-overlays"));

    if (tab === activeTab) {
      return;
    }

    const params = new URLSearchParams((searchParams?.toString() ?? ""));
    params.delete("status");
    params.set("findingsTab", tab);
    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    startRouteLoading({ href, message: `Opening ${tab === "closed" ? "Closed Findings" : "Open Findings"}...` });
    router.replace(href);
  };

  const tabs = [
    { id: "open" as const, label: "Open Findings" },
    { id: "closed" as const, label: "Closed Findings" }
  ];

  return (
    <>
      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-[0.13em] transition ${
                  activeTab === tab.id
                    ? "border-sky-200/60 bg-sky-500/20 text-sky-100"
                    : "border-sky-400/20 bg-slate-900/40 text-slate-200 hover:border-sky-300/45 hover:bg-slate-800/70"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {children ? <div className="w-full min-w-0 lg:max-w-[54rem] lg:flex-1">{children}</div> : null}
        </div>
      </section>
    </>
  );
}
