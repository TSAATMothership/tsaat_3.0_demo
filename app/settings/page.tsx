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
  if (normalized === "spi-risk-matrix") return "spi-risk-matrix";
  if (normalized === "password-settings") {
    return "password-settings";
  }
  if (normalized === "discovery-tools-settings" || normalized === "placeholder-2") {
    return "discovery-tools-settings";
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
