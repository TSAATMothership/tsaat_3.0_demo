import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiscoveryOverview } from "@/components/discovery-overview";
import { createAssetTypeRecord } from "@/lib/asset-taxonomy";
import { defaultDiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { buildScopedDiscoveryToolCoverage } from "@/lib/scoped-discovery-tool-coverage";
import { buildDiscoveryOverview, STALE_DISCOVERY_AGES } from "@/lib/discovery-overview";
import { discoveryExplorerHref, initialDiscoveryFilters } from "@/lib/discovery-explorer-links";
import { emptyEndpointFilters, filterEndpointRows, parseEndpointFilters, type EndpointRecord } from "@/lib/endpoint-explorer";
import { emptySoftwareFilters, filterSoftwareRows, parseSoftwareFilters, type InstalledSoftwareRecord } from "@/lib/installed-software-explorer";
import { emptyShadowFilters, filterShadowRows, parseShadowFilters, type ShadowItRecord } from "@/lib/shadow-it-explorer";
import { buildDiscoveryComplianceRows, emptyDiscoveryComplianceFilters, filterDiscoveryComplianceRows, parseDiscoveryComplianceFilters } from "@/lib/discovery-compliance-explorer";
import type { Asset, Dataset, ServerPatchRecord, StoredDiscoveryCoverageEvaluation } from "@/lib/types";
import { buildPatchManagementRows, filterPatchRows, parsePatchFilters } from "@/lib/patch-management-explorer";
import { filterVulnerabilityRows, parseVulnerabilityFilters, type SecurityVulnerabilityRecord } from "@/lib/security-vulnerability-explorer";
import { emptyExplorerTableFilters } from "@/lib/explorer-table";

beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());

const snapshotDate = "2026-10-31";
const assets: Asset[] = ["server", "server", "printer-device"].map((type, index) => ({
  id: `ci-${index}`, name: `CI ${index}`, hostname: `CI ${index}`, networkId: "net-1", type,
  securityDomain: "PROTECTED", lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" }, vulnerabilities: [],
  ...(type === "server" ? { operatingSystem: null, installedSoftware: [] } : {})
} as Asset));
const settings = defaultDiscoveryToolsSettings();
settings.tools = settings.tools.slice(0, 2).map((tool, index) => ({ ...tool,
  assetTypeScope: createAssetTypeRecord((type) => type === "server" || (index === 0 && type === "printer-device") ? "required" : "na")
}));
const evidence: StoredDiscoveryCoverageEvaluation[] = assets.map((asset, index) => ({
  assetId: asset.id, toolValues: Object.fromEntries(settings.tools.map((tool, toolIndex) => [tool.id, index === 0 || (index === 2 && toolIndex === 0) ? 1 : 0])),
  missingToolIds: [], missingToolNames: [], coverageCompliance: true
}));
const coverage = buildScopedDiscoveryToolCoverage(assets, settings, evidence);
const endpoint = (id: number, date: string | null, source: string | null = "UCMDB"): EndpointRecord => ({ securityDomain: "UNKNOWN",
  assetId: `ci-${id}`, name: `CI ${id}`, ciType: "Server", ipAddress: null, macAddress: null, deviceModel: null,
  lastDiscoveredDate: date, discoveredBy: source, managedNetwork: "North"
});
const endpoints = [endpoint(0, "2026-10-01"), endpoint(1, "2026-09-30T23:59:00Z"), endpoint(2, "2026-08-01"), endpoint(3, null), endpoint(4, "2026-11-01"), endpoint(5, "invalid", " ")];
const installation = (id: string, ordinal: number, version: string | null): InstalledSoftwareRecord => ({
  assetId: id, softwareOrdinal: ordinal, softwareName: "Example App", softwareVersion: version, filePath: null,
  lastDiscoveredDate: "2026-09-30", discoveredBy: null, deviceName: id, deviceModel: null, osName: null, osVersion: null, osPatchLevel: null
});
const software = [installation("ci-0", 1, "1.0"), installation("ci-0", 2, null), installation("ci-1", 1, "  ")];
const node = (id: number, approach: "IP Scan" | "ARP Table", owner: string | null): ShadowItRecord => ({
  assetId: `node-${id}`, ownerAssetId: owner, ipAddress: `10.0.0.${id}`, discoveryApproach: approach,
  lastDiscoveredDate: null, discoveredBy: "UCMDB", endpointName: owner, endpointCiType: null,
  endpointIpAddress: null, endpointMacAddress: null, endpointDeviceModel: null, endpointLastDiscoveredDate: null,
  endpointDiscoveredBy: null, endpointManagedNetwork: null
});
const shadow = [node(1, "IP Scan", null), node(2, "ARP Table", "owner-1"), node(3, "ARP Table", "owner-1"), node(4, "ARP Table", null)];
const observation = (id: string, assetId: string, cve: string, severity: string): SecurityVulnerabilityRecord => ({
  vulnerabilityId: id, assetId, cve, severity, cveName: null, softwareName: null, softwareVersion: null, referenceUrl: null,
  description: "Recorded observation", detectedDate: snapshotDate, cveCreatedDate: null, remediationGuidance: "Apply the vendor fix", source: "Scanner",
  deviceName: assetId, deviceModel: null, osName: null, osVersion: null, osPatchLevel: null
});
const vulnerabilities = [observation("v1", "ci-0", "CVE-2026-11111", "Critical"), observation("v2", "ci-1", "CVE-2026-11111", "High"),
  { ...observation("v3", "ci-0", "CVE-2026-11111", "High"), source: "Sample inventory match" },
  { ...observation("v4", "ci-1", "CVE-2026-22222", " "), remediationGuidance: " " }];
const verifiedPatch: ServerPatchRecord = { assessmentDate: "2026-10-28T00:00:00Z", assessmentValidUntil: snapshotDate,
  lastPatchedDate: "2026-10-26T00:00:00Z", verifiedDate: "2026-10-27T00:00:00Z", missingUpdates: 0, missingCriticalUpdates: 0,
  deploymentStatus: "Succeeded", restartRequired: false, source: "Scanner" };
const patchRecords: Array<ServerPatchRecord | null> = [verifiedPatch,
  { ...verifiedPatch, restartRequired: true, dueDate: "2026-10-30", exceptionReason: "Deferred", exceptionExpiresDate: "2026-11-10" },
  { ...verifiedPatch, assessmentValidUntil: "2026-10-29", dueDate: "2026-10-25" }, null,
  { ...verifiedPatch, deploymentStatus: "Failed", dueDate: "2026-10-30" },
  { ...verifiedPatch, missingUpdates: 3, missingCriticalUpdates: 1, source: "Sample patch-management observation" },
  { ...verifiedPatch, deploymentStatus: "In progress" }];
const patchDataset: Dataset = { snapshotDate, generatedAt: snapshotDate, managedNetworks: [], ictSystems: [], spiEvaluations: [],
  assets: patchRecords.map((patchManagement, index) => ({ ...assets[0], id: `patch-${index}`, type: "server", operatingSystem: null, installedSoftware: [], patchManagement })) };
const patches = buildPatchManagementRows(patchDataset, { network: "net-1" });
const input = { coverage, endpoints, software, shadow, vulnerabilities, patches, snapshotDate };
const scope = { network: ["net-2,net-1", "net-1"], system: ["system-1"], assetType: "server", discoveryFilters: "obsolete", dataDate: "latest" };
const linkFilters = (href: string) => new URL(href, "http://localhost").searchParams.get("discoveryFilters") ?? undefined;

describe("discovery overview findings", () => {
  it("weights coverage by applicable tool-to-CI checks and counts a CI with several gaps once", () => {
    const model = buildDiscoveryOverview(input);
    expect(model.coverage).toMatchObject({ total: 3, gaps: 1, compliant: 2, applicableChecks: 5, coveredChecks: 3, missingChecks: 2, percent: 60 });
    expect(model.coverage.tools.map((tool) => tool.applicable).sort()).toEqual([2, 3]);
    expect(model.coverage.ciTypes.map((row) => row.inScope).sort()).toEqual([1, 2]);
  });
  it("changes applicability, gaps and tool visibility when saved mappings change", () => {
    const changed = { ...settings, tools: settings.tools.map((tool) => ({ ...tool, assetTypeScope: createAssetTypeRecord(() => "na" as const) })) };
    const result = buildDiscoveryOverview({ ...input, coverage: buildScopedDiscoveryToolCoverage(assets, changed, evidence) });
    expect(result.coverage).toMatchObject({ tools: [], total: 3, gaps: 0, compliant: 3, unmapped: 3, percent: null });
  });
  it("keeps empty scopes distinct from 100% coverage and does not invent inventory", () => {
    const result = buildDiscoveryOverview({ coverage: buildScopedDiscoveryToolCoverage([], settings), endpoints: [], software: [], shadow: [], vulnerabilities: [], patches: [], snapshotDate });
    expect(result.coverage.percent).toBeNull();
    expect([result.coverage.gaps, result.endpoints.stale, result.software.products, result.shadow.total]).toEqual([0, 0, 0, 0]);
    expect(result.vulnerabilities).toMatchObject({ total: 0, distinctCves: 0, affectedEndpoints: 0, criticalHigh: 0 });
    expect(result.patches).toMatchObject({ total: 0, verifiedPercent: null, unknown: 0, overdue: 0 });
  });
  it("uses snapshot-relative age, excludes exactly 30 days, and separates missing and future dates", () => {
    expect(buildDiscoveryOverview(input).endpoints).toMatchObject({ total: 6, stale: 2, undated: 2, afterSnapshot: 1, missingSource: 1 });
    expect(buildDiscoveryOverview({ ...input, snapshotDate: "2026-10-30" }).endpoints.stale).toBe(1);
  });
  it("counts installations separately from products and unique endpoints", () => {
    expect(buildDiscoveryOverview(input).software).toMatchObject({ total: 3, products: 1, endpoints: 2, missingVersion: 2, stale: 3, missingSource: 3 });
  });
  it("keeps IP nodes, approaches and distinct ARP owners separate", () => {
    expect(buildDiscoveryOverview(input).shadow).toMatchObject({ total: 4, ipScan: 1, arp: 3, owners: 1, undated: 4 });
  });
  it("separates observations, distinct CVEs and affected endpoints, retaining unknown severity and sample provenance", () => {
    expect(buildDiscoveryOverview(input).vulnerabilities).toMatchObject({ total: 4, distinctCves: 2, affectedEndpoints: 2,
      criticalHigh: 3, missingRemediation: 1, sampleObservations: 1,
      severities: [{ severity: "Critical", count: 1 }, { severity: "High", count: 2 }, { severity: "Not recorded", count: 1 }] });
  });
  it("uses explorer patch states, includes unknown servers in the verified percentage and retains overdue exceptions", () => {
    const result = buildDiscoveryOverview(input).patches;
    expect(result).toMatchObject({ total: 7, patched: 1, verifiedPercent: 14.3, overdue: 3, unknown: 2, sampleObservations: 1 });
    expect(result.statuses.reduce((total, row) => total + row.count, 0)).toBe(7);
    expect(result.statuses.find(row => row.status === "Restart required")?.count).toBe(1);
    const stale = buildPatchManagementRows({ ...patchDataset, snapshotDate: "2026-11-01" }, { network: "net-1" });
    expect(buildDiscoveryOverview({ ...input, patches: stale, snapshotDate: "2026-11-01" }).patches).toMatchObject({ patched: 0, verifiedPercent: 0, unknown: 7 });
  });
});

describe("overview explorer drill-through", () => {
  it("renders vulnerability and patch links whose filtered rows exactly match every displayed count", () => {
    const html = renderToStaticMarkup(React.createElement(DiscoveryOverview, { model: buildDiscoveryOverview(input), scope }));
    let checked = 0;
    for (const match of html.matchAll(/<a\b([^>]+)>/g)) {
      const href = match[1].match(/href="([^"]+)"/)?.[1].replaceAll("&amp;", "&");
      const count = match[1].match(/data-overview-count="(\d+)"/)?.[1];
      if (!href || count === undefined) continue;
      const url = new URL(href, "http://localhost"), view = url.searchParams.get("discoveryView");
      if (view !== "security-vulnerabilities" && view !== "patch-management") continue;
      expect(url.searchParams.get("dataDate")).toBe(snapshotDate);
      expect(url.searchParams.get("network")).toBe("net-1,net-2");
      expect(url.searchParams.has("assetType")).toBe(false);
      const raw = url.searchParams.get("discoveryFilters") ?? undefined;
      const matching = view === "security-vulnerabilities"
        ? filterVulnerabilityRows(vulnerabilities, initialDiscoveryFilters(raw, parseVulnerabilityFilters, emptyExplorerTableFilters))
        : filterPatchRows(patches, initialDiscoveryFilters(raw, parsePatchFilters, emptyExplorerTableFilters));
      expect(matching.length, href).toBe(Number(count)); checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(13);
    expect(html).not.toContain("labelled sample observations"); expect(html).not.toContain("labelled sample patch records");
    expect(html).not.toContain("these five checks");
  });
  it("pins the actual snapshot and carries only the shared network and system scope", () => {
    const url = new URL(discoveryExplorerHref("tools", scope, snapshotDate), "http://localhost");
    expect(Object.fromEntries(url.searchParams)).toEqual({ discoveryView: "tools", dataDate: snapshotDate, network: "net-1,net-2", system: "system-1" });
  });
  it("opens exactly the stale endpoints counted in the overview", () => {
    const href = discoveryExplorerHref("endpoints", scope, snapshotDate, { search: "", columns: {}, recency: STALE_DISCOVERY_AGES });
    const filters = initialDiscoveryFilters(linkFilters(href), parseEndpointFilters, emptyEndpointFilters);
    expect(filterEndpointRows(endpoints, filters, snapshotDate)).toHaveLength(buildDiscoveryOverview(input).endpoints.stale);
  });
  it("opens the matching installation and Shadow IT findings", () => {
    const swHref = discoveryExplorerHref("installed-software", scope, snapshotDate, { search: "", columns: { softwareVersion: ["Not recorded"] }, recency: [] });
    expect(filterSoftwareRows(software, initialDiscoveryFilters(linkFilters(swHref), parseSoftwareFilters, emptySoftwareFilters), snapshotDate)).toHaveLength(buildDiscoveryOverview(input).software.missingVersion);
    const shadowHref = discoveryExplorerHref("shadow-it", scope, snapshotDate, { search: "", columns: { discoveryApproach: ["ARP Table"] }, recency: [] });
    expect(filterShadowRows(shadow, initialDiscoveryFilters(linkFilters(shadowHref), parseShadowFilters, emptyShadowFilters), snapshotDate)).toHaveLength(buildDiscoveryOverview(input).shadow.arp);
  });
  it("opens gap and tool-specific compliance findings using the existing filter rules", () => {
    const rows = buildDiscoveryComplianceRows(assets, coverage.assetCoverageById, { managedNetworks: [], ictSystems: [] });
    const href = discoveryExplorerHref("compliance", scope, snapshotDate, { search: "", columns: { compliant: ["Coverage gaps"] } });
    expect(filterDiscoveryComplianceRows(rows, initialDiscoveryFilters(linkFilters(href), parseDiscoveryComplianceFilters, emptyDiscoveryComplianceFilters))).toHaveLength(buildDiscoveryOverview(input).coverage.gaps);
    for (const tool of coverage.toolCards) {
      const toolHref = discoveryExplorerHref("compliance", scope, snapshotDate, { search: "", columns: { missingTools: [tool.label] } });
      expect(filterDiscoveryComplianceRows(rows, initialDiscoveryFilters(linkFilters(toolHref), parseDiscoveryComplianceFilters, emptyDiscoveryComplianceFilters))).toHaveLength(tool.missing);
    }
  });
  it("ignores malformed, unknown or oversized filter payloads", () => {
    for (const raw of [undefined, "{", 'null', JSON.stringify({ search: "", columns: { unknown: ["x"] }, recency: [] }), JSON.stringify({ search: "", columns: {}, recency: ["invalid"] }), "x".repeat(12001)]) {
      expect(initialDiscoveryFilters(raw, parseEndpointFilters, emptyEndpointFilters)).toEqual(emptyEndpointFilters());
    }
    for (const raw of [undefined, "{", "null", JSON.stringify({ search: "", columns: { unknown: ["x"] } }),
      JSON.stringify({ search: "", columns: {}, ranges: { daysOverdue: { min: -1 } } }), "x".repeat(12001)])
      expect(initialDiscoveryFilters(raw, parsePatchFilters, emptyExplorerTableFilters)).toEqual(emptyExplorerTableFilters());
  });
});
