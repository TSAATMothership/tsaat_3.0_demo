"use client";

export type SettingsTabId = "database-settings" | "password-settings" | "discovery-tools-settings" | "spi-risk-matrix";

const SETTINGS_TABS: Array<{ id: SettingsTabId; label: string }> = [
  { id: "database-settings", label: "Database Settings" },
  { id: "password-settings", label: "Password Settings" },
  { id: "discovery-tools-settings", label: "Discovery Tools Settings" },
  { id: "spi-risk-matrix", label: "SPI Risk Matrix" }
];

export function SettingsTabs({ activeTab, onSelect }: {
  activeTab: SettingsTabId;
  onSelect: (tab: SettingsTabId) => void;
}) {

  return (
    <>
      <section className="panel overflow-hidden">
        <div className="border-b border-sky-400/15 px-4 py-3">
          <div role="tablist" aria-label="Settings sections" className="flex flex-wrap gap-2">
            {SETTINGS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`settings-tab-${tab.id}`}
                aria-controls={`settings-panel-${tab.id}`}
                aria-selected={activeTab === tab.id}
                tabIndex={activeTab === tab.id ? 0 : -1}
                onClick={() => onSelect(tab.id)}
                onKeyDown={(event) => {
                  const index = SETTINGS_TABS.findIndex((item) => item.id === tab.id);
                  const next = event.key === "ArrowRight" ? (index + 1) % SETTINGS_TABS.length
                    : event.key === "ArrowLeft" ? (index + SETTINGS_TABS.length - 1) % SETTINGS_TABS.length
                    : event.key === "Home" ? 0 : event.key === "End" ? SETTINGS_TABS.length - 1 : -1;
                  if (next < 0) return;
                  event.preventDefault();
                  onSelect(SETTINGS_TABS[next].id);
                  document.getElementById(`settings-tab-${SETTINGS_TABS[next].id}`)?.focus();
                }}
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
