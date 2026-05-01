import { NextRequest, NextResponse } from "next/server";
import { getCoreAppData } from "@/lib/app-data";
import { DiscoveryCoverageValue, evaluateDiscoveryCoverage } from "@/lib/discovery-coverage";
import { filterDiscoveryAssets, sanitizeDiscoverySearchParams } from "@/lib/discovery-filter-scope";
import { Asset } from "@/lib/types";

export const dynamic = "force-dynamic";

interface ToolAssetRow {
  assetId: string;
  hostname: string;
  ipAddress: string;
  assetType: string;
  network: string;
  ictSystem: string;
  environment: string;
  toolValue: DiscoveryCoverageValue;
  coverageCompliance: boolean;
}

function resolveAssetIpAddress(asset: Asset): string {
  const candidate = asset as Asset & {
    ipAddress?: string | null;
    ip?: string | null;
    ipv4?: string | null;
    ipv4Address?: string | null;
    primaryIp?: string | null;
  };
  const value =
    candidate.ipAddress ?? candidate.ip ?? candidate.ipv4 ?? candidate.ipv4Address ?? candidate.primaryIp ?? null;
  if (!value || !String(value).trim()) {
    return "N/A";
  }
  return String(value).trim();
}

function toSearchParamsRecord(
  source: URLSearchParams,
  keysToExclude: Set<string>
): Record<string, string | string[] | undefined> {
  const record: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of source.entries()) {
    if (keysToExclude.has(key)) {
      continue;
    }
    const current = record[key];
    if (typeof current === "undefined") {
      record[key] = value;
      continue;
    }
    if (Array.isArray(current)) {
      current.push(value);
      record[key] = current;
      continue;
    }
    record[key] = [current, value];
  }
  return record;
}

function toPositiveInt(rawValue: string | null, fallback: number, max: number): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}

function matchesSearch(row: ToolAssetRow, searchTerm: string): boolean {
  if (!searchTerm) {
    return true;
  }
  const haystack = [row.hostname, row.assetId, row.ipAddress, row.assetType, row.network, row.ictSystem, row.environment]
    .join(" ")
    .toLowerCase();
  return haystack.includes(searchTerm);
}

export async function GET(request: NextRequest) {
  const toolId = request.nextUrl.searchParams.get("toolId")?.trim();
  if (!toolId) {
    return NextResponse.json({ error: "Missing required query parameter: toolId." }, { status: 400 });
  }

  const searchTerm = request.nextUrl.searchParams.get("toolSearch")?.trim().toLowerCase() ?? "";
  const assetType = request.nextUrl.searchParams.get("toolAssetType")?.trim() ?? "";
  const page = toPositiveInt(request.nextUrl.searchParams.get("page"), 1, 100000);
  const pageSize = toPositiveInt(request.nextUrl.searchParams.get("pageSize"), 200, 5000);

  const requestParams = toSearchParamsRecord(
    request.nextUrl.searchParams,
    new Set(["toolId", "toolSearch", "toolAssetType", "page", "pageSize"])
  );
  const { dataset, analytics, discoveryToolsSettings } = await getCoreAppData(
    sanitizeDiscoverySearchParams(requestParams)
  );
  const allowedToolIds = new Set(discoveryToolsSettings.tools.map((tool) => tool.id));
  if (!allowedToolIds.has(toolId)) {
    return NextResponse.json({ error: `Unknown discovery tool id: ${toolId}` }, { status: 400 });
  }

  const scopedAssetIds = new Set(analytics.evaluations.map((evaluation) => evaluation.assetId));
  const scopedAssets = filterDiscoveryAssets(dataset.assets.filter((asset) => scopedAssetIds.has(asset.id)));
  const networkNameById = new Map(dataset.managedNetworks.map((network) => [network.id, network.name]));
  const systemNameById = new Map(dataset.ictSystems.map((system) => [system.id, system.name]));

  const toolRows: ToolAssetRow[] = [];
  for (const asset of scopedAssets) {
    const coverage = evaluateDiscoveryCoverage(asset, discoveryToolsSettings);
    const toolValue = coverage.toolValues[toolId];
    if (toolValue !== 0) {
      continue;
    }

    toolRows.push({
      assetId: asset.id,
      hostname: asset.hostname,
      ipAddress: resolveAssetIpAddress(asset),
      assetType: asset.type,
      network: networkNameById.get(asset.networkId) ?? asset.networkId,
      ictSystem: asset.systemContext?.systemId
        ? (systemNameById.get(asset.systemContext.systemId) ?? asset.systemContext.systemId)
        : "-",
      environment: asset.systemContext?.environmentType ?? "-",
      toolValue,
      coverageCompliance: coverage.coverageCompliance
    });
  }

  const assetTypeOptions = Array.from(new Set(toolRows.map((row) => row.assetType))).sort((a, b) => a.localeCompare(b));
  const filteredRows = toolRows
    .filter((row) => {
      if (assetType && row.assetType !== assetType) {
        return false;
      }
      return matchesSearch(row, searchTerm);
    })
    .sort((a, b) => a.hostname.localeCompare(b.hostname));

  const totalItems = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const rows = filteredRows.slice(startIndex, startIndex + pageSize);

  return NextResponse.json({
    rows,
    scopeTotal: scopedAssets.length,
    selectedToolTotal: toolRows.length,
    assetTypeOptions,
    pagination: {
      currentPage,
      totalPages,
      pageSize,
      totalItems
    }
  });
}
