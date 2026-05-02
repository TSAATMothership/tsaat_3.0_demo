import { ICTSystem, RollupResult } from "@/lib/types";
import { deriveOverallStatus } from "@/lib/posture";
import { SystemsTableClient, type SystemTableRow } from "@/components/systems-table-client";

function fallbackDescription(system: ICTSystem): string {
  if (system.description?.trim()) {
    return system.description.trim();
  }

  const missionSummary =
    system.missionCapabilities.map((capability) => capability.name).join(", ") || "assigned mission capabilities";
  const serviceSummary =
    system.businessServices.map((service) => service.name).join(", ") || "assigned business services";

  return `${system.name} is a ${system.criticality.toLowerCase()} ICT system in the ${system.securityDomain} domain supporting ${missionSummary} and ${serviceSummary}.`;
}

function fallbackOwner(system: ICTSystem): string {
  if (system.owner?.trim()) {
    return system.owner.trim();
  }

  return `${system.name} Operations Team`;
}

function fallbackDiisId(system: ICTSystem): string {
  if (system.diisId?.trim()) {
    return system.diisId.trim();
  }

  const normalizedId = system.id.replace(/[^a-z0-9]+/gi, "-").toUpperCase();
  return `DIIS-${normalizedId}`;
}

function fallbackSupportEmail(system: ICTSystem): string {
  if (system.supportEmail?.trim()) {
    return system.supportEmail.trim();
  }

  const normalizedId = system.id.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return `ict-support+${normalizedId}@tsaat.local`;
}

function fallbackServiceCatalogueUrl(system: ICTSystem): string {
  if (system.serviceCatalogueUrl?.trim()) {
    return system.serviceCatalogueUrl.trim();
  }

  return `/systems/${system.id}`;
}

function fallbackAtoNumber(system: ICTSystem): string {
  if (system.atoNumber?.trim()) {
    return system.atoNumber.trim();
  }

  const normalizedId = system.id.replace(/[^a-z0-9]+/gi, "-").toUpperCase();
  return `ATO-${normalizedId}`;
}

function fallbackDiisUrl(system: ICTSystem): string {
  if (system.diisUrl?.trim()) {
    return system.diisUrl.trim();
  }

  return `https://diis.defence.gov.au/systems/${encodeURIComponent(system.id)}`;
}

function fallbackGrcUrl(system: ICTSystem, atoNumber: string): string {
  if (system.grcUrl?.trim()) {
    return system.grcUrl.trim();
  }

  return `https://grc.defence.gov.au/ato/${encodeURIComponent(atoNumber)}`;
}

function fallbackApmNumber(system: ICTSystem): string {
  if (system.apmNumber?.trim()) {
    return system.apmNumber.trim();
  }

  const normalizedId = system.id.replace(/[^a-z0-9]+/gi, "-").toUpperCase();
  return `APM-${normalizedId}`;
}

function fallbackApmUrl(system: ICTSystem, apmNumber: string): string {
  return `https://apm.defence.gov.au/applications/${encodeURIComponent(apmNumber)}`;
}

export function SystemsTable({
  systems,
  systemRollups,
  environmentRollups,
  findingsBySystem,
  complianceScoreBySystem,
  discoveryComplianceScoreBySystem,
  scrollable = false
}: {
  systems: ICTSystem[];
  systemRollups: RollupResult[];
  environmentRollups: RollupResult[];
  findingsBySystem: Map<string, number>;
  complianceScoreBySystem: Map<string, number>;
  discoveryComplianceScoreBySystem: Map<string, number>;
  scrollable?: boolean;
}) {
  const rows: SystemTableRow[] = systems.map((system) => {
    const rollups = systemRollups.filter(
      (rollup) => rollup.scopeType === "system" && rollup.scopeId === system.id
    );
    const productionRollups = environmentRollups.filter(
      (rollup) => rollup.scopeType === "environment" && rollup.scopeId === `${system.id}::Production`
    );

    const atoNumber = fallbackAtoNumber(system);
    const diisId = fallbackDiisId(system);
    const apmNumber = fallbackApmNumber(system);

    return {
      id: system.id,
      name: system.name,
      missionCapabilities: system.missionCapabilities.map((capability) => capability.name).join(", ") || "-",
      businessServices: system.businessServices.map((service) => service.name).join(", ") || "-",
      overallPosture: deriveOverallStatus(rollups),
      productionPosture: deriveOverallStatus(productionRollups),
      complianceScore: complianceScoreBySystem.get(system.id) ?? 0,
      discoveryComplianceScore: discoveryComplianceScoreBySystem.get(system.id) ?? 0,
      openFindings: findingsBySystem.get(system.id) ?? 0,
      description: fallbackDescription(system),
      owner: fallbackOwner(system),
      supportEmail: fallbackSupportEmail(system),
      serviceCatalogueUrl: fallbackServiceCatalogueUrl(system),
      atoNumber,
      diisId,
      diisUrl: fallbackDiisUrl(system),
      grcUrl: fallbackGrcUrl(system, atoNumber),
      apmNumber,
      apmUrl: fallbackApmUrl(system, apmNumber)
    };
  });

  return <SystemsTableClient rows={rows} scrollable={scrollable} />;
}
