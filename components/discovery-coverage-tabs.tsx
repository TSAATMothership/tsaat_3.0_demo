"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startRouteLoading } from "@/lib/route-loading";

type DiscoveryCoverageTabId = "summary" | "coverage-by-network" | "tool-settings" | "target-state";

const tabs: Array<{ id: DiscoveryCoverageTabId; label: string }> = [
  { id: "summary", label: "Discovery Tool Coverage" },
  { id: "coverage-by-network", label: "Discovery Tool Coverage - by Network" },
  { id: "tool-settings", label: "Discovery Tools Setting" },
  { id: "target-state", label: "Network Discovery Status" }
];

export function DiscoveryCoverageTabs({ activeTab }: { activeTab: DiscoveryCoverageTabId }) {
  const searchParams = useSearchParams();
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  const onSelectTab = (tab: DiscoveryCoverageTabId) => {
    if (tab === activeTab) {
      return;
    }

    const params = new URLSearchParams((searchParams?.toString() ?? ""));
    params.set("discoveryCoverageTab", tab);
    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    const label = tabs.find((candidate) => candidate.id === tab)?.label ?? "selected tab";
    startRouteLoading({ href, message: `Opening ${label}...` });
    router.replace(href);
  };

  return (
    <>
      <section className="panel overflow-hidden">
        <div className="border-b border-sky-400/15 px-4 py-3">
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
        </div>
      </section>
    </>
  );
}
