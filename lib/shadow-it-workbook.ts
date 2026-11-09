import { SHADOW_COLUMNS, isOwnerColumn, NOT_APPLICABLE, type ShadowItRecord } from "@/lib/shadow-it-explorer";
import { buildInventoryWorkbook } from "@/lib/inventory-explorer-workbook";

export function buildShadowItWorkbook(rows: readonly ShadowItRecord[], exportedAt = new Date()): Uint8Array {
  const output = rows.map((row) => {
    const copy = { ...row };
    if (row.discoveryApproach === "IP Scan") {
      for (const { key } of SHADOW_COLUMNS) if (isOwnerColumn(key)) copy[key] = NOT_APPLICABLE;
    }
    return copy;
  });
  const widths = [22, 22, 28, 30, 34, 24, 25, 26, 30, 32, 32, 36];
  return buildInventoryWorkbook(output, SHADOW_COLUMNS.map((column, index) => ({ ...column, width: widths[index],
    date: column.key === "lastDiscoveredDate" || column.key === "endpointLastDiscoveredDate" })), "Shadow IT", exportedAt);
}
