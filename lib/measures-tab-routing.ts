export type MeasuresTabId = "summary" | "measures-kpi" | "measures-spi" | "spi-settings";

export const MEASURES_TABS: Array<{ id: MeasuresTabId; label: string }> = [
  { id: "summary", label: "Measures Summary" },
  { id: "measures-kpi", label: "Measures-KPI" },
  { id: "measures-spi", label: "Measures-SPI" },
  { id: "spi-settings", label: "SPI-Settings" }
];

export function resolveMeasuresTab(requestedTab: string | undefined): MeasuresTabId {
  const normalized = requestedTab?.trim().toLowerCase();
  if (normalized === "measures-kpi" || normalized === "measures-spi" || normalized === "spi-settings") {
    return normalized;
  }
  if (normalized === "settings") {
    return "spi-settings";
  }
  return "summary";
}

export function measuresTabLoadingLabel(tab: MeasuresTabId | null): string {
  if (tab === "measures-kpi") {
    return "Measures-KPI";
  }
  if (tab === "measures-spi") {
    return "Measures-SPI";
  }
  if (tab === "spi-settings") {
    return "SPI-Settings";
  }
  return "Measures Summary";
}
