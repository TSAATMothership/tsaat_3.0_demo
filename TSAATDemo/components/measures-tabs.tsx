"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MEASURES_TABS, MeasuresTabId, measuresTabLoadingLabel } from "@/lib/measures-tab-routing";
import { startRouteLoading } from "@/lib/route-loading";

export function MeasuresTabs({ activeTab }: { activeTab: MeasuresTabId }) {
  const searchParams = useSearchParams();
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  const onSelectTab = (tab: MeasuresTabId) => {
    if (tab === activeTab) {
      return;
    }

    const params = new URLSearchParams((searchParams?.toString() ?? ""));
    params.set("measuresTab", tab);
    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    startRouteLoading({ href, message: `Opening ${measuresTabLoadingLabel(tab)}...` });
    router.replace(href);
  };

  return (
    <>
      <section className="panel overflow-hidden">
        <div className="border-b border-sky-400/15 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {MEASURES_TABS.map((tab) => (
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
