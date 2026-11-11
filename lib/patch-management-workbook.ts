import { PATCH_COLUMNS, type PatchManagementRow } from "@/lib/patch-management-explorer";
import { buildInventoryWorkbook } from "@/lib/inventory-explorer-workbook";

export function buildPatchManagementWorkbook(rows: readonly PatchManagementRow[], exportedAt = new Date()) {
  return buildInventoryWorkbook(rows, [
    { key: "assetId", label: "Asset ID", width: 24 },
    { key: "snapshotDate", label: "Snapshot Date", date: true },
    ...PATCH_COLUMNS.map(column => ({ ...column, width: 30 })),
    { key: "hostname", label: "Hostname" }, { key: "ipAddress", label: "IP Address" }, { key: "osVersion", label: "OS Version" }
  ], "Patch Management", exportedAt);
}
