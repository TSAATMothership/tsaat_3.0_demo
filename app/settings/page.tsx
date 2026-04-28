import { DatabaseSettingsPanel } from "@/components/database-settings-panel";
import { PasswordSettingsPanel } from "@/components/password-settings-panel";
import { SettingsTabs, type SettingsTabId } from "@/components/settings-tabs";
import { loadDatabaseSettingsDefaults } from "@/lib/database-settings";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function resolveActiveTab(value: string | undefined): SettingsTabId {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "password-settings") {
    return "password-settings";
  }
  if (normalized === "placeholder-2") {
    return "placeholder-2";
  }

  return "database-settings";
}

export default async function SettingsPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const activeTab = resolveActiveTab(firstParam(searchParams.settingsTab));
  const initialDatabaseSettings = await loadDatabaseSettingsDefaults();
  const tabContentClass = "h-[min(calc(100vh-20rem),1040px)] overflow-auto pr-1 md:h-[min(calc(100vh-24rem),1040px)]";

  return (
    <div className="relative left-1/2 w-[min(2100px,calc(100vw-2rem))] -translate-x-1/2 space-y-3 md:w-[min(2100px,calc(100vw-3rem))]">
      <section className="panel p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-300/70">Application Configuration</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-100">Settings</h1>
        <p className="mt-2 max-w-4xl text-sm text-slate-300/85">
          Configure runtime options for TSAAT. Database connection and SSL settings are read from and written to
          encrypted `DB_config`.
        </p>
      </section>

      <SettingsTabs activeTab={activeTab} />

      <div className={tabContentClass}>
        {activeTab === "database-settings" ? (
          <DatabaseSettingsPanel initialSettings={initialDatabaseSettings} />
        ) : activeTab === "password-settings" ? (
          <PasswordSettingsPanel />
        ) : (
          <section className="panel p-4">
            <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">placeholder 2</h2>
            <p className="mt-2 text-sm text-slate-300/85">Reserved for future settings.</p>
          </section>
        )}
      </div>
    </div>
  );
}
