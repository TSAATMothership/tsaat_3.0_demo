import { Asset, AssetType } from "@/lib/types";
import { DiscoveryToolSetting, DiscoveryToolsSettings } from "@/lib/discovery-tools-settings";

export type DiscoveryCoverageValue = 1 | 0 | null;

export interface DiscoveryCoverageResult {
  toolValues: Record<string, DiscoveryCoverageValue>;
  missingToolIds: string[];
  missingToolNames: string[];
  coverageCompliance: boolean;
}

function normalizeToolSelector(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function detectToolCoverage(tool: DiscoveryToolSetting, asset: Asset): 0 | 1 {
  const id = normalizeToolSelector(tool.id);
  const name = normalizeToolSelector(tool.name);
  const selector = id || name;

  if (selector === "ucmdb") {
    return asset.systemContext?.systemId ? 1 : 0;
  }
  if (selector === "tanium") {
    return asset.type === "server" || asset.type === "workstation" ? 1 : 0;
  }
  if (selector === "tenable") {
    return asset.vulnerabilities.some((vulnerability) => ["Nessus", "Qualys", "OpenVAS"].includes(vulnerability.source))
      ? 1
      : 0;
  }
  if (selector === "snow") {
    return asset.lifecycle.warrantyStatus !== "Unknown" ? 1 : 0;
  }
  if (selector === "servicenow" || selector === "service-now") {
    return asset.lifecycle.eolStatus !== "Unknown" ? 1 : 0;
  }
  if (selector === "dsoc-siem" || selector === "siem") {
    return asset.vulnerabilities.length > 0 ? 1 : 0;
  }
  if (selector === "elastic") {
    return asset.type === "server" || asset.type === "workstation" ? 1 : 0;
  }

  if (name.includes("service") && name.includes("now")) {
    return asset.lifecycle.eolStatus !== "Unknown" ? 1 : 0;
  }
  if (name.includes("siem") || name.includes("dsoc")) {
    return asset.vulnerabilities.length > 0 ? 1 : 0;
  }

  return 0;
}

function isToolRequiredForAssetType(tool: DiscoveryToolSetting, assetType: AssetType): boolean {
  return tool.assetTypeScope[assetType] !== "na";
}

export function evaluateDiscoveryCoverage(asset: Asset, settings: DiscoveryToolsSettings): DiscoveryCoverageResult {
  const toolValues: Record<string, DiscoveryCoverageValue> = {};
  const missingToolIds: string[] = [];
  const missingToolNames: string[] = [];

  for (const tool of settings.tools) {
    if (!isToolRequiredForAssetType(tool, asset.type)) {
      toolValues[tool.id] = null;
      continue;
    }

    const toolValue = detectToolCoverage(tool, asset);
    toolValues[tool.id] = toolValue;
    if (toolValue === 0) {
      missingToolIds.push(tool.id);
      missingToolNames.push(tool.name);
    }
  }

  return {
    toolValues,
    missingToolIds,
    missingToolNames,
    coverageCompliance: missingToolIds.length === 0
  };
}

