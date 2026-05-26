"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startRouteLoading } from "@/lib/route-loading";

export type SettingsTabId = "database-settings" | "password-settings" | "placeholder-2";

const SETTINGS_TABS: Array<{ id: SettingsTabId; label: string }> = [
  { id: "database-settings", label: "Database Settings" },
  { id: "password-settings", label: "Password Settings" },
  { id: "placeholder-2", label: "placeholder 2" }
];

function tabLabel(tabId: SettingsTabId | null): string {
  if (!tabId) {
    return "Settings";
  }

  const match = SETTINGS_TABS.find((tab) => tab.id === tabId);
  return match?.label ?? "Settings";
}

export function SettingsTabs({ activeTab }: { activeTab: SettingsTabId }) {
  const searchParams = useSearchParams();
  const pathname = usePathname() ?? "/settings";
  const router = useRouter();

  const onSelectTab = (tab: SettingsTabId) => {
    if (tab === activeTab) {
      return;
    }

    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("settingsTab", tab);
    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    startRouteLoading({ href, message: `Opening ${tabLabel(tab)}...` });
    router.replace(href);
  };

  return (
    <>
      <section className="panel overflow-hidden">
        <div className="border-b border-sky-400/15 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {SETTINGS_TABS.map((tab) => (
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
