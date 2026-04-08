import { Asset, HighRiskCveDetail, Vulnerability, VulnerabilityExploitability } from "@/lib/types";

const HIGH_RISK_EXPLOITABILITY: VulnerabilityExploitability[] = ["Exploitable", "Known Exploited"];

export function isHighRiskCve(vulnerability: Vulnerability): boolean {
  const isCritical = vulnerability.criticality === "Critical" || vulnerability.severity === "Critical";
  const isCriticalExploitable =
    isCritical && HIGH_RISK_EXPLOITABILITY.includes(vulnerability.exploitability);
  return isCritical || isCriticalExploitable;
}

function compareCapturedAtDescending(a: HighRiskCveDetail, b: HighRiskCveDetail): number {
  const aTime = new Date(a.capturedAt).getTime();
  const bTime = new Date(b.capturedAt).getTime();
  if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
    return a.cve.localeCompare(b.cve);
  }
  if (Number.isNaN(aTime)) {
    return 1;
  }
  if (Number.isNaN(bTime)) {
    return -1;
  }
  return bTime - aTime;
}

export function buildHighRiskCveIndexByAssetId(assets: Asset[]): Record<string, HighRiskCveDetail[]> {
  const byAssetId: Record<string, HighRiskCveDetail[]> = {};

  for (const asset of assets) {
    const highRiskCves = asset.vulnerabilities
      .filter(isHighRiskCve)
      .map((vulnerability) => ({
        cve: vulnerability.cve,
        description: vulnerability.description,
        remediationGuidance: vulnerability.remediationGuidance,
        criticality: vulnerability.criticality,
        exploitability: vulnerability.exploitability,
        capturedAt: vulnerability.capturedAt
      }))
      .sort(compareCapturedAtDescending);

    if (highRiskCves.length > 0) {
      byAssetId[asset.id] = highRiskCves;
    }
  }

  return byAssetId;
}
