"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startRouteLoading } from "@/lib/route-loading";

type NetworksTabId = "overview" | "posture";

const tabs: Array<{ id: NetworksTabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "posture", label: "Networks Roll-Up Posture Summary" }
];

export function NetworksTabs({ activeTab }: { activeTab: NetworksTabId }) {
  const searchParams = useSearchParams();
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  const onSelectTab = (tab: NetworksTabId) => {
    if (tab === activeTab) {
      return;
    }

    const params = new URLSearchParams((searchParams?.toString() ?? ""));
    params.set("networksTab", tab);
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
