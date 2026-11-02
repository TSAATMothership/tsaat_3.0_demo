import "server-only";
import type { Asset, StoredDiscoveryCoverageEvaluation } from "@/lib/types";
import type { DiscoveryToolsSettings } from "@/lib/discovery-tools-settings";

export { evaluateSpi } from "@/lib/spi-evaluation";

export interface DetectionRule { toolId: string; conditionKey: string; values?: string[]; enabled: boolean }
export function evaluateDiscovery(asset: Asset, settings: DiscoveryToolsSettings, rules: DetectionRule[]): StoredDiscoveryCoverageEvaluation {
  function matches(rule: DetectionRule) {
    switch (rule.conditionKey) {
      case "has-system-context": return Boolean(asset.systemContext);
      case "asset-type-in": return rule.values?.includes(asset.type) ?? false;
      case "vulnerability-source-in": return asset.vulnerabilities.some(v => rule.values?.includes(v.source));
      case "warranty-status-known": return asset.lifecycle.warrantyStatus !== "Unknown";
      case "eol-status-known": return asset.lifecycle.eolStatus !== "Unknown";
      case "has-vulnerability": return asset.vulnerabilities.length > 0;
      default: throw new Error("Unsupported discovery rule: " + rule.conditionKey);
    }
  }
  const toolValues: StoredDiscoveryCoverageEvaluation["toolValues"] = {};
  for (const tool of settings.tools) {
    toolValues[tool.id] = tool.assetTypeScope[asset.type] === "na" ? null : rules.filter(r => r.toolId === tool.id && r.enabled).some(matches) ? 1 : 0;
  }
  const missing = settings.tools.filter(tool => toolValues[tool.id] === 0);
  return { assetId: asset.id, toolValues, missingToolIds: missing.map(t => t.id), missingToolNames: missing.map(t => t.name), coverageCompliance: !missing.length };
}
