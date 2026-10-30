import { RouteReadyMarker } from "@/components/route-ready-marker";
import { type SettingsTabId } from "@/components/settings-tabs";
import { SettingsRoutePopup } from "@/components/settings-route-popup";

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

  return (
    <>
      <RouteReadyMarker pathname="/settings" searchParams={searchParams} />
      <SettingsRoutePopup initialTab={activeTab} />
    </>
  );
}
