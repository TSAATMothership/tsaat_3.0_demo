import { ENDPOINT_COLUMNS, type EndpointRecord } from "@/lib/endpoint-explorer";
import { buildInventoryWorkbook } from "@/lib/inventory-explorer-workbook";
export { INVENTORY_XLSX_TYPE as ENDPOINT_XLSX_TYPE } from "@/lib/inventory-explorer-workbook";

export function buildEndpointWorkbook(rows: readonly EndpointRecord[], exportedAt = new Date()): Buffer {
  const widths = [32, 22, 21, 23, 30, 28, 28, 35];
  return buildInventoryWorkbook(rows, ENDPOINT_COLUMNS.map((column, index) => ({ ...column, width: widths[index], date: column.key === "lastDiscoveredDate" })), "End Points", exportedAt);
}
