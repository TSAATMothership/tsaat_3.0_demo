import { Criticality, Dataset, Finding } from "@/lib/types";

export interface ImpactProfile {
  id: string;
  name: string;
  criticality: Criticality;
  findings: number;
  highPriority: number;
  impactedAssets: number;
}

export interface MissionServiceImpact {
  capabilities: ImpactProfile[];
  services: ImpactProfile[];
}

export function buildMissionServiceImpact(dataset: Dataset, findings: Finding[]): MissionServiceImpact {
  const systemsById = new Map(dataset.ictSystems.map((system) => [system.id, system]));

  const capabilityMap = new Map<string, ImpactProfile & { assetSet: Set<string> }>();
  const serviceMap = new Map<string, ImpactProfile & { assetSet: Set<string> }>();

  for (const finding of findings) {
    if (finding.complianceStatus !== "Non-compliant" || !finding.scope.systemId) {
      continue;
    }

    const system = systemsById.get(finding.scope.systemId);
    if (!system) {
      continue;
    }

    for (const capability of system.missionCapabilities) {
      const profile =
        capabilityMap.get(capability.id) ??
        {
          id: capability.id,
          name: capability.name,
          criticality: capability.criticality,
          findings: 0,
          highPriority: 0,
          impactedAssets: 0,
          assetSet: new Set<string>()
        };

      profile.findings += 1;
      if (finding.priorityRank <= 2) {
        profile.highPriority += 1;
      }
      profile.assetSet.add(finding.scope.assetId);
      profile.impactedAssets = profile.assetSet.size;
      capabilityMap.set(capability.id, profile);
    }

    for (const service of system.businessServices) {
      const profile =
        serviceMap.get(service.id) ??
        {
          id: service.id,
          name: service.name,
          criticality: service.criticality,
          findings: 0,
          highPriority: 0,
          impactedAssets: 0,
          assetSet: new Set<string>()
        };

      profile.findings += 1;
      if (finding.priorityRank <= 2) {
        profile.highPriority += 1;
      }
      profile.assetSet.add(finding.scope.assetId);
      profile.impactedAssets = profile.assetSet.size;
      serviceMap.set(service.id, profile);
    }
  }

  const sortProfiles = (profiles: ImpactProfile[]) =>
    profiles.sort((a, b) => {
      if (b.findings !== a.findings) {
        return b.findings - a.findings;
      }
      if (b.highPriority !== a.highPriority) {
        return b.highPriority - a.highPriority;
      }
      return a.name.localeCompare(b.name);
    });

  return {
    capabilities: sortProfiles(
      Array.from(capabilityMap.values()).map(({ assetSet, ...profile }) => ({ ...profile }))
    ),
    services: sortProfiles(Array.from(serviceMap.values()).map(({ assetSet, ...profile }) => ({ ...profile })))
  };
}
