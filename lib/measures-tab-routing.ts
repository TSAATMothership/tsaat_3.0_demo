export type MeasuresTabId =
  | "summary"
  | "measures-kpi"
  | "measures-spi"
  | "spi-settings";

export const MEASURES_TABS: Array<{ id: MeasuresTabId; label: string }> = [
  { id: "summary", label: "Measures Summary" },
  { id: "measures-kpi", label: "Key Performance Indicators (KPIs)" },
  { id: "measures-spi", label: "Security Posture Indicators (SPIs)" },
  { id: "spi-settings", label: "SPI Risk Matrix" }
];

export function resolveMeasuresTab(requestedTab: string | undefined): MeasuresTabId {
  const normalized = requestedTab?.trim().toLowerCase();
  if (
    normalized === "measures-kpi" ||
    normalized === "measures-spi" ||
    normalized === "spi-settings"
  ) {
    return normalized;
  }
  if (normalized === "settings") {
    return "spi-settings";
  }
  return "summary";
}

export function measuresTabLoadingLabel(tab: MeasuresTabId | null): string {
  if (tab === "measures-kpi") {
    return "Key Performance Indicators (KPIs)";
  }
  if (tab === "measures-spi") {
    return "Security Posture Indicators (SPIs)";
  }
  if (tab === "spi-settings") {
    return "SPI Risk Matrix";
  }
  return "Measures Summary";
}
