import type { Asset, StoredSpiEvaluation, StoredDiscoveryCoverageEvaluation } from "@/lib/types";
import type { SpiDefinition } from "@/lib/spi-definitions";
import { renderSpiOutcomeReason } from "@/lib/spi-definitions";
import type { DiscoveryToolsSettings } from "@/lib/discovery-tools-settings";

export function evaluateSpi(asset: Asset, definition: SpiDefinition): StoredSpiEvaluation {
  const p = definition.ruleParameters;
  const os = "operatingSystem" in asset ? asset.operatingSystem : null;
  const networkOs = "networkOs" in asset ? asset.networkOs : null;
  const software = "installedSoftware" in asset ? asset.installedSoftware : [];
  const patch = "patchState" in asset ? asset.patchState : null;
  const critical = asset.vulnerabilities.filter(v => v.severity === (p.vulnerabilitySeverity ?? "Critical")).length;
  const production = asset.systemContext?.environmentType === (p.environmentType ?? "Production");
  const unsupported = software.filter(s => s.supportStatus === (p.unsupportedStatus ?? "OutOfSupport")).length;
  let outcome: string;
  let evidence: StoredSpiEvaluation["evidence"] = {};
  switch (definition.ruleKey) {
    case "os-support":
      outcome = !os || !os.supportStatus || os.supportStatus === p.unknownSupportStatus ? "missing_os_data" : os.supportStatus === p.unsupportedStatus ? "unsupported" : "supported";
      evidence = { operatingSystem: os ? os.family + " " + os.version : null, supportStatus: os?.supportStatus ?? null }; break;
    case "os-n-minus":
      outcome = os?.nMinus == null ? "missing_n_minus" : os.nMinus <= Number(p.maxNMinus) ? "within_n_minus" : "older_than_n_minus";
      evidence = { operatingSystem: os ? os.family + " " + os.version : null, nMinus: os?.nMinus ?? null, currentMajor: os?.currentSupportedMajor ?? null }; break;
    case "server-critical-vulnerability":
    case "network-device-critical-vulnerability":
      outcome = critical ? "critical_vulnerability_present" : "no_critical_vulnerability";
      evidence = { criticalVulnerabilities: critical }; break;
    case "production-server-critical-unsupported-os":
      outcome = !production ? "not_production_context" : !os || !os.supportStatus || os.supportStatus === p.unknownSupportStatus ? "missing_os_support" : critical && os.supportStatus === p.unsupportedStatus ? "triggered" : "not_triggered";
      evidence = { productionContext: production, criticalVulnerability: critical > 0, osSupportStatus: os?.supportStatus ?? null }; break;
    case "production-server-critical-unsupported-software":
    case "production-workstation-critical-unsupported-software":
      outcome = !production ? "not_production_context" : !software.length ? "missing_software" : critical && unsupported ? "triggered" : "not_triggered";
      evidence = { productionContext: production, criticalVulnerability: critical > 0, outOfSupportSoftwareCount: !production ? 0 : !software.length ? null : unsupported }; break;
    case "network-device-support":
      outcome = !networkOs || !networkOs.supportStatus || networkOs.supportStatus === p.unknownSupportStatus ? "missing_network_os" : networkOs.supportStatus === p.unsupportedStatus ? "unsupported" : "supported";
      evidence = { networkOs: networkOs ? networkOs.family + " " + networkOs.version : null, supportStatus: networkOs?.supportStatus ?? null }; break;
    case "network-device-patch-currency":
      outcome = patch?.isLatest == null ? "missing_patch_state" : patch.isLatest === p.latestPatchRequired ? "current" : "not_current";
      evidence = { isLatestPatch: patch?.isLatest ?? null, lastPatchedDate: patch?.lastPatchedDate ?? null }; break;
    case "asset-lifecycle-currency":
      outcome = asset.lifecycle.eolStatus === p.unknownLifecycleStatus || asset.lifecycle.warrantyStatus === p.unknownLifecycleStatus ? "missing_lifecycle" :
        asset.lifecycle.eolStatus !== p.endOfLifeStatus && asset.lifecycle.warrantyStatus === p.inWarrantyStatus ? "current" : "expired";
      evidence = { eolStatus: asset.lifecycle.eolStatus, warrantyStatus: asset.lifecycle.warrantyStatus }; break;
    default: throw new Error("Unsupported demo SPI rule: " + definition.ruleKey);
  }
  const template = definition.outcomeTemplates.find(t => t.outcomeKey === outcome);
  if (!template) throw new Error("Missing demo SPI outcome: " + outcome);
  const result: StoredSpiEvaluation = { assetId: asset.id, spiId: definition.spiId, status: template.complianceStatus, outcomeKey: outcome, evidence, reasons: [] };
  result.reasons = [renderSpiOutcomeReason(definition, result)];
  return result;
}

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
