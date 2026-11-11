import type { DiscoveryOverviewModel } from "@/lib/discovery-overview";
import { impactCounts, serviceImpactRows, type ServiceImpactModel } from "@/lib/service-impact";
import { securityDomainFilter } from "@/lib/security-domain.mjs";
import { scopeIds, type WorkspaceSearchParams } from "@/lib/workspace-navigation";

/** Presentation rollups of the existing scoped models; no new risk or compliance score. */
export function buildGovernanceInsights(discovery: DiscoveryOverviewModel, impact: ServiceImpactModel) {
  const findings = [...new Map(impact.findings.map(row => [row.id, row])).values()];
  const counts = impactCounts(findings);
  const priorityFindings = findings.filter(row => row.severity === "Critical Exposure" || row.severity === "High Risk");
  const services = serviceImpactRows(impact.business, findings);
  const capabilities = serviceImpactRows(impact.mission, findings);
  const systems = serviceImpactRows(impact.systems.map(system => ({ ...system, systemIds: [system.id] })), findings);
  const priority = counts.critical + counts.high;
  const severityLabels = new Map(impact.severities.map(row => [row.key, row.label]));
  const severityKeys = [...new Set([...severityLabels.keys(), ...Object.keys(counts.severities)])];
  const actions = [
    { key: "exposure", count: priority, title: "Prioritise service-linked exposure", detail: `${priority} critical/high findings are linked to ${new Set(priorityFindings.map(row => row.systemId)).size} ICT systems. Confirm accountable owners and remediation sequencing.`, destination: "impact" },
    { key: "patch", count: discovery.patches.overdue, title: "Resolve overdue patch work", detail: `${discovery.patches.overdue} servers are past their recorded patch due date. Agree maintenance windows and verify completion.`, destination: "patch-management" },
    { key: "coverage", count: discovery.coverage.gaps, title: "Close the visibility gaps", detail: `${discovery.coverage.gaps} CIs do not meet their configured discovery coverage requirements. Confirm collection and tool ownership.`, destination: "tools" },
    { key: "cve", count: discovery.vulnerabilities.criticalHigh, title: "Validate high-severity CVE exposure", detail: `${discovery.vulnerabilities.criticalHigh} critical/high CVE observations need validation against software, configuration and remediation evidence.`, destination: "security-vulnerabilities" },
    { key: "patch-unknown", count: discovery.patches.unknown, title: "Establish patch assurance", detail: `${discovery.patches.unknown} servers have an Unknown patch status. Obtain assessment, installation and verification evidence.`, destination: "patch-management" },
    { key: "shadow", count: discovery.shadow.total, title: "Identify the unknown terrain", detail: `${discovery.shadow.total} unidentified IP nodes need investigation using IP scan and ARP evidence.`, destination: "shadow-it" },
    { key: "freshness", count: discovery.endpoints.stale + discovery.endpoints.undated, title: "Refresh discovery evidence", detail: `${discovery.endpoints.stale} endpoints have discovery evidence over 30 days old and ${discovery.endpoints.undated} have no discovery date.`, destination: "endpoints" }
  ].filter(action => action.count > 0);
  return {
    counts, priority, priorityCis: new Set(priorityFindings.map(row => row.assetId)).size, prioritySystems: new Set(priorityFindings.map(row => row.systemId)).size,
    services, capabilities, systems,
    exposedServices: services.filter(row => row.critical + row.high > 0).length,
    exposedCapabilities: capabilities.filter(row => row.critical + row.high > 0).length,
    severities: severityKeys.map(key => ({ key, label: severityLabels.get(key) ?? key, count: counts.severities[key] ?? 0 })),
    actions: actions.slice(0, 3),
    hasEvidence: impact.systems.length > 0 || discovery.endpoints.total > 0 || discovery.shadow.total > 0 || discovery.coverage.total > 0 || counts.findings > 0 || discovery.vulnerabilities.total > 0 || discovery.patches.total > 0,
    headline: priority > 0 ? "Focus on the services behind the exposure."
      : discovery.vulnerabilities.criticalHigh > 0 ? "Validate the highest-severity vulnerability exposure."
      : discovery.patches.overdue > 0 ? "Close overdue patch work to strengthen assurance."
      : discovery.coverage.gaps > 0 || discovery.patches.unknown > 0 ? "Strengthen the evidence behind the posture."
      : "Keep the terrain visible. Keep assurance current."
  };
}

export function insightsHref(scope: WorkspaceSearchParams, pathname: string, view?: { key: string; value: string }) {
  const params = new URLSearchParams();
  for (const key of ["network", "system"] as const) {
    const ids = scopeIds(scope[key]); if (ids.length) params.set(key, ids.join(","));
  }
  const domain = securityDomainFilter(scope.securityDomain); if (domain) params.set("securityDomain", domain);
  const date = Array.isArray(scope.dataDate) ? scope.dataDate[0] : scope.dataDate;
  if (date) params.set("dataDate", date);
  if (view) params.set(view.key, view.value);
  return pathname + (params.size ? `?${params}` : "");
}

export type GovernanceInsightsModel = ReturnType<typeof buildGovernanceInsights>;
