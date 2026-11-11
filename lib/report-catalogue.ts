import type { ExplorerColumn } from "@/lib/explorer-table";
import { SPI_FEATURE_OUT_OF_SUPPORT_OS_REPORT } from "@/lib/spi-features";
import type { SpiDefinition } from "@/lib/spi-definitions";
import type { Filters } from "@/lib/types";

export const REPORT_CATEGORIES = [
  { label: "Briefings", description: "Posture, risks and exceptions", tone: "cyan" },
  { label: "Remediation", description: "Findings and actions to take", tone: "amber" },
  { label: "Assurance", description: "Support and modelling coverage", tone: "violet" }
] as const;

export interface CatalogueReport {
  id: string;
  name: string;
  description: string;
  audience: string;
  category: typeof REPORT_CATEGORIES[number]["label"];
  href: string;
}

export const REPORT_COLUMNS: ExplorerColumn<CatalogueReport>[] = [
  { key: "name", label: "Report", value: row => row.name },
  { key: "category", label: "Category", value: row => row.category },
  { key: "description", label: "Description", value: row => row.description },
  { key: "audience", label: "Audience", value: row => row.audience }
];

/** Every report uses the same selected scope and the actual loaded snapshot. */
export function buildReportCatalogue(filters: Filters, snapshotDate: string, spiDefinitions: SpiDefinition[]): CatalogueReport[] {
  const params = new URLSearchParams({ dataDate: snapshotDate });
  for (const [field, key] of [
    ["managedNetwork", "network"], ["ictSystem", "system"], ["systemCriticality", "criticality"],
    ["securityDomain", "securityDomain"], ["environment", "environment"], ["assetType", "assetType"],
    ["severity", "severity"], ["missionCapability", "mission"], ["businessService", "service"]
  ] as const) {
    if (filters[field]) params.set(key, filters[field]!);
  }
  const href = (path: string, pdf = false) => {
    const query = new URLSearchParams(params);
    if (pdf) query.set("format", "pdf");
    return `${path}?${query}`;
  };
  const osMeasures = spiDefinitions.filter(definition => definition.featureBindings.some(binding =>
    binding.featureKey === SPI_FEATURE_OUT_OF_SUPPORT_OS_REPORT)).map(definition => `SPI-${definition.spiId}`).join(", ") || "the configured SPI";
  return [
    { id: "posture-summary", name: "Cyber Posture Summary", category: "Briefings",
      description: "Compliance counts, top risks and production exceptions for the selected scope.",
      audience: "Executives, risk analysts, integration tooling", href: href("/api/report/summary", true) },
    { id: "networks-remediation", name: "Network Scope Remediation", category: "Remediation",
      description: "Network remediation priorities, findings and actions to close discovery and tooling gaps.",
      audience: "Network owners, remediation teams, cyber operations", href: href("/api/networks/remediation-report") },
    { id: "systems-remediation", name: "ICT System Scope Remediation", category: "Remediation",
      description: "ICT system posture, scoped findings and a prioritised remediation action plan.",
      audience: "System owners, service delivery teams, security governance", href: href("/api/systems/remediation-report") },
    { id: "systems-out-of-support-os", name: "ICT Systems with Unsupported OS", category: "Assurance",
      description: `Servers that do not meet ${osMeasures} operating system support requirements, with supporting evidence.`,
      audience: "System owners, infrastructure operations, cyber assurance", href: href("/api/systems/out-of-support-os-report") },
    { id: "systems-modelling-status", name: "ICT System Modelling Status", category: "Assurance",
      description: "DIIS registration and modelling coverage, including registered ICT systems that are not yet modelled.",
      audience: "System owners, DIIS operations, architecture governance", href: href("/api/systems/modelling-status-report") },
    { id: "discovery-remediation", name: "Discovery Coverage Remediation", category: "Remediation",
      description: "Discovery coverage exceptions, missing tools and prioritised actions to close the gaps.",
      audience: "Discovery tool owners, CMDB teams, architecture and assurance", href: href("/api/discovery-coverage/remediation-report") }
  ];
}
