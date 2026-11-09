import { SOFTWARE_COLUMNS, type InstalledSoftwareRecord } from "@/lib/installed-software-explorer";
import { buildInventoryWorkbook } from "@/lib/inventory-explorer-workbook";

export function buildInstalledSoftwareWorkbook(rows: readonly InstalledSoftwareRecord[], exportedAt = new Date()): Uint8Array {
  const widths = [32, 22, 60, 28, 28, 32, 30, 28, 26, 30];
  return buildInventoryWorkbook(rows, SOFTWARE_COLUMNS.map((column, index) => ({ ...column, width: widths[index], date: column.key === "lastDiscoveredDate" })), "Installed Software", exportedAt);
}
