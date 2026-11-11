import { matchesSecurityDomain } from "@/lib/security-domain.mjs";
import type { Dataset, ServerPatchRecord } from "@/lib/types";
import { scopeIds, type WorkspaceSearchParams } from "@/lib/workspace-navigation";
import { normalizeDataDate } from "@/lib/data-date";
import { prepareExplorerRows, queryExplorerRows, type ExplorerTableFilters } from "@/lib/explorer-table";

export type PatchStatus = "Patched" | "Not patched" | "Restart required" | "Failed" | "In progress" | "Unknown";
const DAY = 86400000;
const text = (value: string | null | undefined) => value?.trim() || null;
const count = (value: number | null | undefined) => Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null;
function instant(value: string | null | undefined): number | null {
  if (!value || !normalizeDataDate(value.slice(0, 10)) || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?$/.test(value)) return null;
  const result = Date.parse(value);
  return Number.isFinite(result) && (value.length === 10 || new Date(result).toISOString().slice(0, 19) === value.slice(0, 19)) ? result : null;
}
export function patchAssessment(record: ServerPatchRecord | null | undefined, snapshotDate: string) {
  const end = Date.parse(snapshotDate + "T23:59:59.999Z");
  const day = Date.parse(snapshotDate);
  const observed = instant(record?.assessmentDate), patched = instant(record?.lastPatchedDate), restarted = instant(record?.lastRestartedDate), verified = instant(record?.verifiedDate);
  const validity = record?.assessmentValidUntil ? normalizeDataDate(record.assessmentValidUntil) : undefined;
  const missing = count(record?.missingUpdates), critical = count(record?.missingCriticalUpdates);
  const invalid = [record?.assessmentDate, record?.lastPatchedDate, record?.lastRestartedDate, record?.verifiedDate]
    .some(value => value != null && (instant(value) === null || Number(instant(value)) > end)) ||
    (missing !== null && critical !== null && critical > missing) ||
    (record?.missingUpdates != null && missing === null) || (record?.missingCriticalUpdates != null && critical === null) ||
    (observed !== null && [patched, restarted, verified].some(value => value !== null && value > observed)) ||
    Boolean(validity && observed !== null && Date.parse(validity) + DAY - 1 < observed);
  const evidenceStatus = invalid ? "Invalid or future evidence" : observed === null || !validity || !text(record?.source)
    ? "Incomplete evidence" : Date.parse(validity) < day ? "Stale assessment" : "Current assessment";
  let status: PatchStatus = "Unknown";
  if (evidenceStatus === "Current assessment") {
    if (record?.deploymentStatus === "Failed") status = "Failed";
    else if (record?.restartRequired === true) status = "Restart required";
    else if (record?.deploymentStatus === "In progress") status = "In progress";
    else if (missing !== null && missing > 0) status = "Not patched";
    else if (missing === 0 && critical === 0 && record?.restartRequired === false && record.deploymentStatus === "Succeeded" &&
      patched !== null && verified !== null && verified >= patched) status = "Patched";
  }
  const historical = (value: string | null | undefined) => instant(value) !== null && Number(instant(value)) <= end ? value! : null;
  const dueDate = normalizeDataDate(record?.dueDate) ?? null;
  const daysOverdue = status !== "Patched" && dueDate ? Math.max(0, Math.floor((day - Date.parse(dueDate)) / DAY)) : 0;
  const exceptionExpiresDate = normalizeDataDate(record?.exceptionExpiresDate) ?? null;
  const exceptionStatus = !text(record?.exceptionReason) ? "None" : !exceptionExpiresDate ? "Missing expiry" : exceptionExpiresDate < snapshotDate ? "Expired" : "Active";
  return { status, evidenceStatus, missingUpdates: missing, missingCriticalUpdates: critical,
    lastPatchedDate: historical(record?.lastPatchedDate), lastRestartedDate: historical(record?.lastRestartedDate),
    assessmentDate: historical(record?.assessmentDate), verifiedDate: historical(record?.verifiedDate),
    assessmentValidUntil: validity ?? null, assessmentAgeDays: observed !== null && observed <= end ? Math.floor((end - observed) / DAY) : null,
    uptimeDays: restarted !== null && restarted <= end ? Math.floor((end - restarted) / DAY) : null,
    dueDate, daysOverdue, exceptionStatus, exceptionExpiresDate };
}

export function buildPatchManagementRows(dataset: Dataset, params: WorkspaceSearchParams) {
  const networks = scopeIds(params.network), systems = scopeIds(params.system);
  return dataset.assets.filter(asset => matchesSecurityDomain(asset.securityDomain, params.securityDomain) && asset.type === "server" && Boolean(networks.length || systems.length) &&
    Boolean(asset.networkId.trim()) && asset.networkId !== "net-unassigned" && (!networks.length || networks.includes(asset.networkId)) &&
    (!systems.length || systems.includes(asset.systemContext?.systemId ?? ""))).map(asset => {
    // Narrow explicitly so patch data never projects onto workstations or unidentified nodes.
    if (asset.type !== "server") throw new Error("Expected a server.");
    const record = asset.patchManagement;
    const assessment = patchAssessment(record, dataset.snapshotDate);
    const system = dataset.ictSystems.find(system => system.id === asset.systemContext?.systemId);
    const knownExploitedCves = new Set(asset.vulnerabilities.filter(v => v.detectedDate.slice(0, 10) <= dataset.snapshotDate && v.exploitability === "Known Exploited").map(v => v.cve)).size;
    const priority = assessment.status === "Unknown" ? "Verify evidence" : assessment.missingCriticalUpdates ? "Critical updates" : assessment.daysOverdue ? "Overdue" : assessment.status === "Failed" ? "Failed deployment"
      : assessment.status === "Restart required" ? "Restart required" : assessment.status === "Patched" ? "Monitor" : "Schedule patching";
    return { assetId: asset.id, serverName: asset.name || asset.hostname || asset.id, hostname: asset.hostname, ipAddress: asset.ipAddress ?? null,
      networkName: dataset.managedNetworks.find(network => network.id === asset.networkId)?.name ?? asset.networkId,
      systemName: system?.name ?? "Unassigned", environment: asset.systemContext?.environmentType ?? "Unassigned",
      osName: asset.operatingSystem?.family ?? null, osVersion: asset.operatingSystem?.version ?? null,
      osSupportStatus: asset.operatingSystem?.supportStatus ?? "Unknown", installedPatchLevel: text(record?.installedPatchLevel) ?? text(asset.operatingSystem?.patchLevel),
      targetPatchLevel: text(record?.targetPatchLevel), ...assessment, priority, knownExploitedCves,
      restartRequired: record?.restartRequired === true ? "Yes" : record?.restartRequired === false ? "No" : "Unknown",
      deploymentStatus: record?.deploymentStatus ?? "Unknown", plannedDate: normalizeDataDate(record?.plannedDate) ?? null,
      owner: text(record?.owner), maintenanceWindow: text(record?.maintenanceWindow), changeReference: text(record?.changeReference),
      exceptionReason: text(record?.exceptionReason), source: text(record?.source), snapshotDate: dataset.snapshotDate };
  }).sort((a,b) => b.daysOverdue - a.daysOverdue || (b.missingCriticalUpdates ?? 0) - (a.missingCriticalUpdates ?? 0) || a.serverName.localeCompare(b.serverName) || a.assetId.localeCompare(b.assetId));
}
export type PatchManagementRow = ReturnType<typeof buildPatchManagementRows>[number];
export interface PatchManagementData { snapshotDate: string; rows: PatchManagementRow[] }

export const PATCH_COLUMNS = [
  { key: "serverName", label: "Server" }, { key: "status", label: "Patch Status" }, { key: "priority", label: "Next Focus" },
  { key: "lastPatchedDate", label: "Last Patched (UTC)", date: true }, { key: "installedPatchLevel", label: "Installed Patch Level" },
  { key: "targetPatchLevel", label: "Target Patch Level" }, { key: "missingUpdates", label: "Missing Security Updates", numeric: true },
  { key: "missingCriticalUpdates", label: "Missing Critical Updates", numeric: true }, { key: "dueDate", label: "Patch Due Date", date: true },
  { key: "daysOverdue", label: "Days Overdue", numeric: true }, { key: "restartRequired", label: "Restart Required" },
  { key: "lastRestartedDate", label: "Last Restarted (UTC)", date: true }, { key: "evidenceStatus", label: "Evidence" },
  { key: "assessmentDate", label: "Last Assessed (UTC)", date: true }, { key: "osName", label: "Operating System" },
  { key: "osSupportStatus", label: "OS Support" }, { key: "environment", label: "Environment" }, { key: "owner", label: "Patch Owner" },
  { key: "networkName", label: "Network" }, { key: "systemName", label: "ICT System" },
  { key: "plannedDate", label: "Planned Patch Date", date: true }, { key: "maintenanceWindow", label: "Maintenance Window" },
  { key: "changeReference", label: "Change Reference" }, { key: "exceptionStatus", label: "Exception" },
  { key: "exceptionExpiresDate", label: "Exception Expires", date: true }, { key: "source", label: "Evidence Source" },
  { key: "verifiedDate", label: "Verified After Install (UTC)", date: true }, { key: "uptimeDays", label: "Uptime (Days)", numeric: true },
  { key: "assessmentAgeDays", label: "Assessment Age (Days)", numeric: true }, { key: "assessmentValidUntil", label: "Assessment Valid Until", date: true },
  { key: "exceptionReason", label: "Exception Reason" }, { key: "knownExploitedCves", label: "Known-Exploited CVE Observations", numeric: true }
] as const;
export type PatchColumn = typeof PATCH_COLUMNS[number]["key"];
export function patchSearchText(row: PatchManagementRow): string { return [row.assetId, row.hostname, row.ipAddress ?? ""].join(" "); }
export const PATCH_VIEWS = [ { id: "posture", label: "Patch posture" }, { id: "restarts", label: "Restart & evidence" }, { id: "planning", label: "Planning & ownership" } ] as const;
export type PatchView = typeof PATCH_VIEWS[number]["id"];
const viewKeys: Record<PatchView, readonly PatchColumn[]> = {
  posture: ["serverName", "status", "priority", "osName", "installedPatchLevel", "targetPatchLevel", "missingUpdates", "missingCriticalUpdates", "lastPatchedDate", "dueDate", "daysOverdue", "osSupportStatus", "environment"],
  restarts: ["serverName", "status", "restartRequired", "lastRestartedDate", "uptimeDays", "verifiedDate", "assessmentDate", "assessmentValidUntil", "assessmentAgeDays", "evidenceStatus", "source"],
  planning: ["serverName", "status", "networkName", "systemName", "owner", "plannedDate", "dueDate", "maintenanceWindow", "changeReference", "exceptionStatus", "exceptionReason", "exceptionExpiresDate", "knownExploitedCves"]
};
export function patchValue(row: PatchManagementRow, key: PatchColumn): string { const value = row[key]; return value == null || value === "" ? "Not recorded" : String(value); }
export const patchTableColumns = PATCH_COLUMNS.map(column => ({ key: column.key, label: column.label,
  value: (row: PatchManagementRow) => patchValue(row, column.key),
  ...("numeric" in column ? { range: { value: (row: PatchManagementRow) => row[column.key], unit: column.key.toLowerCase().includes("days") ? "days" : column.key === "knownExploitedCves" ? "CVEs" : "updates", min: 0, step: 1, sortable: true } } : {}) }));
export function patchColumnsForView(view: PatchView) { return viewKeys[view].map(key => patchTableColumns.find(column => column.key === key)!); }
export function filterPatchRows(rows: PatchManagementRow[], filters: ExplorerTableFilters, view: PatchView = "posture") {
  const columns = patchColumnsForView(view);
  return queryExplorerRows(prepareExplorerRows(rows, columns, patchSearchText), columns, filters).filtered;
}
export function parsePatchFilters(value: unknown): ExplorerTableFilters {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid patch filters.");
  const input = value as Record<string, unknown>;
  if (typeof input.search !== "string" || input.search.length > 500 || !input.columns || typeof input.columns !== "object" || Array.isArray(input.columns)) throw new Error("Invalid patch search or columns.");
  const columns: Record<string, string[]> = {};
  for (const [key, values] of Object.entries(input.columns)) {
    if (!PATCH_COLUMNS.some(column => column.key === key) || !Array.isArray(values) || values.length > 10000 || !values.every((item): item is string => typeof item === "string" && item.length <= 32767)) throw new Error("Invalid patch column selection.");
    columns[key] = [...new Set(values)];
  }
  const ranges: NonNullable<ExplorerTableFilters["ranges"]> = {};
  if (input.ranges !== undefined) {
    if (!input.ranges || typeof input.ranges !== "object" || Array.isArray(input.ranges)) throw new Error("Invalid patch ranges.");
    for (const [key, range] of Object.entries(input.ranges)) {
      if (!PATCH_COLUMNS.some(column => column.key === key && "numeric" in column) || !range || typeof range !== "object" || Array.isArray(range)) throw new Error("Invalid patch range.");
      const bounds = range as Record<string, unknown>;
      if (Object.keys(bounds).some(key => key !== "min" && key !== "max") || [bounds.min, bounds.max].some(value => value !== undefined && value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0))) throw new Error("Invalid range bounds.");
      const min = typeof bounds.min === "number" ? bounds.min : undefined, max = typeof bounds.max === "number" ? bounds.max : undefined;
      if (min !== undefined && max !== undefined && min > max) throw new Error("Invalid range order.");
      ranges[key] = { min, max };
    }
  }
  return { search: input.search, columns, ranges };
}
