import { describe, expect, it } from "vitest";
import { buildPatchManagementRows, filterPatchRows, parsePatchFilters, patchAssessment } from "@/lib/patch-management-explorer";
import type { Dataset, ServerAsset, ServerPatchRecord } from "@/lib/types";

const date = "2026-04-23";
const verified: ServerPatchRecord = { assessmentDate: "2026-04-22T20:00:00Z", assessmentValidUntil: "2026-04-23", lastPatchedDate: "2026-04-20T12:00:00Z",
  lastRestartedDate: "2026-04-20T13:00:00Z", verifiedDate: "2026-04-20T14:00:00Z", missingUpdates: 0, missingCriticalUpdates: 0,
  restartRequired: false, deploymentStatus: "Succeeded", source: "Patch scanner" };
const asset: ServerAsset = { id: "server-1", name: "Server One", hostname: "server-1", type: "server", networkId: "net-1", securityDomain: "PROTECTED",
  lifecycle: { eolStatus: "Supported", warrantyStatus: "Unknown" }, systemContext: { systemId: "sys-1", environmentType: "Production" },
  operatingSystem: null, installedSoftware: [], vulnerabilities: [], patchManagement: verified };
const dataset: Dataset = { generatedAt: date, snapshotDate: date, managedNetworks: [], ictSystems: [], assets: [asset, { ...asset, id: "server-10", name: "Server Ten", networkId: "net-2" }], spiEvaluations: [] };

describe("patch assessment", () => {
  it("requires affirmative current verification and restart evidence to report patched", () => {
    expect(patchAssessment(verified, date).status).toBe("Patched");
    for (const partial of [null, {}, { installedPatchLevel: "Latest" }, { ...verified, verifiedDate: null }, { ...verified, lastPatchedDate: null },
      { ...verified, restartRequired: null }, { ...verified, missingCriticalUpdates: null }, { ...verified, source: "" }, { ...verified, assessmentValidUntil: null }])
      expect(patchAssessment(partial, date).status).toBe("Unknown");
  });
  it("keeps failed, missing-update, restart and deployment states distinct", () => {
    expect(patchAssessment({ ...verified, missingUpdates: 2, missingCriticalUpdates: 1 }, date).status).toBe("Not patched");
    expect(patchAssessment({ ...verified, restartRequired: true }, date).status).toBe("Restart required");
    expect(patchAssessment({ ...verified, deploymentStatus: "Failed" }, date).status).toBe("Failed");
    expect(patchAssessment({ ...verified, deploymentStatus: "In progress" }, date).status).toBe("In progress");
  });
  it("uses the selected snapshot, rejects future/contradictory evidence and preserves unknown counts", () => {
    expect(patchAssessment(verified, "2026-04-24")).toMatchObject({ status: "Unknown", evidenceStatus: "Stale assessment" });
    for (const patch of [{ assessmentDate: "2026-04-24T00:00:00Z" }, { lastRestartedDate: "2026-04-23T23:00:00Z" },
      { lastPatchedDate: "2026-02-30T00:00:00Z" }, { missingUpdates: -1 }, { missingUpdates: 1, missingCriticalUpdates: 2 },
      { verifiedDate: "2026-04-22T24:00:00Z" }]) {
      expect(patchAssessment({ ...verified, ...patch }, date)).toMatchObject({ status: "Unknown", evidenceStatus: "Invalid or future evidence" });
    }
    expect(patchAssessment({ ...verified, verifiedDate: "2026-04-19T00:00:00Z" }, date).status).toBe("Unknown");
    expect(patchAssessment({}, date)).toMatchObject({ missingUpdates: null, uptimeDays: null, lastRestartedDate: null });
  });
  it("does not hide overdue actions behind exceptions or treat future plans as completed patches", () => {
    const record = { ...verified, missingUpdates: 1, dueDate: "2026-04-20", plannedDate: "2026-04-25", exceptionReason: "Approved maintenance deferral", exceptionExpiresDate: "2026-04-30" };
    expect(patchAssessment(record, date)).toMatchObject({ daysOverdue: 3, exceptionStatus: "Active", status: "Not patched" });
    expect(patchAssessment({ ...record, exceptionExpiresDate: "2026-04-22" }, date).exceptionStatus).toBe("Expired");
    expect(patchAssessment({ ...verified, dueDate: "2026-04-20" }, date).daysOverdue).toBe(0);
  });
});
describe("patch inventory projection and filters", () => {
  it("retains exact scope, one row per server and unknown observations", () => {
    expect(buildPatchManagementRows(dataset, {})).toEqual([]);
    expect(buildPatchManagementRows(dataset, { network: "net-1" }).map(row => row.assetId)).toEqual(["server-1"]);
    expect(buildPatchManagementRows(dataset, { system: "sys-1" })).toHaveLength(2);
    expect(buildPatchManagementRows(dataset, { system: "missing" })).toEqual([]);
    const mixed = { ...dataset, assets: [asset, { ...asset, id: "workstation", type: "workstation" as const }, { ...asset, id: "unknown", patchManagement: null }] };
    expect(buildPatchManagementRows(mixed, { network: "net-1" }).map(row => row.status).sort()).toEqual(["Patched", "Unknown"]);
  });
  it("filters numeric ranges and keeps table-view searches identical to exports", () => {
    const rows = buildPatchManagementRows({ ...dataset, assets: [{ ...asset, patchManagement: { ...verified, missingUpdates: 4, owner: "Maintenance Team" } }] }, { network: "net-1" });
    expect(filterPatchRows(rows, parsePatchFilters({ search: "", columns: {}, ranges: { missingUpdates: { min: 3, max: 5 } } }))).toHaveLength(1);
    expect(filterPatchRows(rows, { search: "Maintenance Team", columns: {} }, "planning")).toHaveLength(1);
    expect(filterPatchRows(rows, { search: "Maintenance Team", columns: {} }, "posture")).toEqual([]);
    for (const input of [{ search: "", columns: { bogus: ["x"] } }, { search: "", columns: {}, ranges: { missingUpdates: { min: -1 } } },
      { search: "", columns: {}, ranges: { daysOverdue: { min: 5, max: 1 } } }]) expect(() => parsePatchFilters(input)).toThrow();
  });
});
