import { getCoreAppData } from "@/lib/app-data";
import { deriveOverallStatus } from "@/lib/posture";
import { PrintButton } from "@/components/print-button";
import { FilterBar } from "@/components/filter-bar";
import { Criticality, Finding, ICTSystem } from "@/lib/types";

interface NarrativeProfile {
  id: string;
  name: string;
  criticality: Criticality;
  systems: Set<string>;
  nonCompliant: number;
  unknown: number;
  highPriority: number;
  highRisk: number;
  criticalExposure: number;
  productionExceptions: number;
  impactedAssets: Set<string>;
}

function criticalityRank(criticality: Criticality): number {
  if (criticality === "Critical") {
    return 2;
  }
  return 1;
}

function buildNarrativeProfiles(
  systems: ICTSystem[],
  findings: Finding[],
  type: "capability" | "service"
): NarrativeProfile[] {
  const profiles = new Map<string, NarrativeProfile>();
  const systemsById = new Map(systems.map((system) => [system.id, system]));

  for (const system of systems) {
    const items = type === "capability" ? system.missionCapabilities : system.businessServices;
    for (const item of items) {
      const profile =
        profiles.get(item.id) ??
        {
          id: item.id,
          name: item.name,
          criticality: item.criticality,
          systems: new Set<string>(),
          nonCompliant: 0,
          unknown: 0,
          highPriority: 0,
          highRisk: 0,
          criticalExposure: 0,
          productionExceptions: 0,
          impactedAssets: new Set<string>()
        };
      profile.systems.add(system.id);
      profiles.set(item.id, profile);
    }
  }

  for (const finding of findings) {
    if (!finding.scope.systemId) {
      continue;
    }
    const system = systemsById.get(finding.scope.systemId);
    if (!system) {
      continue;
    }

    const items = type === "capability" ? system.missionCapabilities : system.businessServices;
    for (const item of items) {
      const profile = profiles.get(item.id);
      if (!profile) {
        continue;
      }

      if (finding.complianceStatus === "Non-compliant") {
        profile.nonCompliant += 1;
      } else if (finding.complianceStatus === "Unknown") {
        profile.unknown += 1;
      }

      if (finding.priorityRank <= 2) {
        profile.highPriority += 1;
      }
      if (finding.severity === "High Risk") {
        profile.highRisk += 1;
      }
      if (finding.severity === "Critical Exposure") {
        profile.criticalExposure += 1;
      }
      if (finding.scope.environmentType === "Production") {
        profile.productionExceptions += 1;
      }
      profile.impactedAssets.add(finding.scope.assetId);
    }
  }

  return Array.from(profiles.values()).sort((a, b) => {
    if (criticalityRank(b.criticality) !== criticalityRank(a.criticality)) {
      return criticalityRank(b.criticality) - criticalityRank(a.criticality);
    }
    if (b.nonCompliant !== a.nonCompliant) {
      return b.nonCompliant - a.nonCompliant;
    }
    return a.name.localeCompare(b.name);
  });
}

function narrativeRiskLabel(profile: NarrativeProfile): string {
  if (profile.highRisk > 0 || profile.criticalExposure > 0) {
    return "Elevated";
  }
  if (profile.nonCompliant > 0) {
    return "At Risk";
  }
  if (profile.unknown > 0) {
    return "Data Incomplete";
  }
  return "Stable";
}

function importanceHighlight(profile: NarrativeProfile): string {
  if (profile.criticality === "Critical" && (profile.highRisk > 0 || profile.criticalExposure > 0)) {
    return "HIGH IMPORTANCE: Immediate command attention required.";
  }
  if (profile.highRisk > 0 || profile.criticalExposure > 0 || profile.highPriority > 0) {
    return "IMPORTANT: Prioritized remediation and tracking required.";
  }
  if (profile.unknown > 0) {
    return "IMPORTANT: Data quality uplift required to confirm posture confidence.";
  }
  if (profile.criticality === "Critical") {
    return "IMPORTANT: Maintain enhanced monitoring due to critical mission/service designation.";
  }
  return "Routine monitoring and scheduled hardening remain appropriate.";
}

export default async function ReportPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { dataset, analytics, networks, systems, filters, filterOptions } = await getCoreAppData(searchParams);

  const topRisks = analytics.findings.slice(0, 10);
  const productionExceptions = analytics.findings.filter(
    (finding) => finding.scope.environmentType === "Production" || finding.severity === "High Risk"
  );
  const missionCapabilityNarratives = buildNarrativeProfiles(systems, analytics.findings, "capability");
  const businessServiceNarratives = buildNarrativeProfiles(systems, analytics.findings, "service");

  const unknownCounts = {
    findings: analytics.findings.filter((finding) => finding.complianceStatus === "Unknown").length,
    checks: analytics.statusTotals.unknown
  };

  return (
    <div className="space-y-4">
      <section className="panel p-5 no-print">
        <h1 className="text-3xl font-semibold text-slate-100">Written Brief Generator</h1>
        <p className="mt-2 text-sm text-slate-300/85">
          Printable briefing optimized for command update packs. Use browser print dialog to download as PDF.
        </p>
        <PrintButton />
      </section>

      <FilterBar options={filterOptions} filters={filters} hiddenFields={["systemCriticality"]} enableLoadingOverlay />

      <article className="panel space-y-6 p-6 text-sm text-slate-100 print:bg-white print:text-black">
        <header className="border-b border-sky-400/20 pb-4 print:border-gray-300">
          <h1 className="text-2xl font-semibold">TSAAT - Threat Surface Area Assessment Tool Brief</h1>
          <p className="mt-1 text-xs text-slate-300/80 print:text-gray-600">Snapshot Date: {dataset.snapshotDate}</p>
        </header>

        <section>
          <h2 className="text-base font-semibold">Executive Summary</h2>
          <p className="mt-2 text-slate-200/90 print:text-gray-800">
            Overall SPI compliance is {analytics.overallCompliancePercent}% with {analytics.statusTotals.nonCompliant}{" "}
            non-compliant checks. High-risk conditions remain concentrated in production-linked server and workstation assets,
            where critical vulnerabilities intersect with unsupported operating environments and software components.
          </p>
          <p className="mt-2 text-slate-200/90 print:text-gray-800">
            Immediate response should focus on the highest-ranked findings and production critical exposures. Medium-horizon
            remediation planning should target N-2 uplift, network patch lag, and lifecycle renewal (EOL/out-of-warranty) to
            reduce sustained mission/service risk across networks.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Top 10 Risks</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            {topRisks.map((risk) => (
              <li key={risk.id}>
                [P{risk.priorityRank}] SPI {risk.spiId} ({risk.severity}) - {risk.scope.assetId} - {risk.title}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">Posture by Network</h2>
          <table className="mt-2 min-w-full border border-sky-400/20 text-xs print:border-gray-300">
            <thead>
              <tr className="bg-slate-900/45 print:bg-gray-100">
                <th className="border border-sky-400/15 px-2 py-1 text-left print:border-gray-300">Network</th>
                <th className="border border-sky-400/15 px-2 py-1 text-left print:border-gray-300">Criticality</th>
                <th className="border border-sky-400/15 px-2 py-1 text-left print:border-gray-300">Classification</th>
                <th className="border border-sky-400/15 px-2 py-1 text-left print:border-gray-300">Assets</th>
                <th className="border border-sky-400/15 px-2 py-1 text-left print:border-gray-300">Posture</th>
              </tr>
            </thead>
            <tbody>
              {networks.map((network) => {
                const rollups = analytics.networkRollups.filter(
                  (rollup) => rollup.scopeType === "network" && rollup.scopeId === network.id
                );
                return (
                  <tr key={network.id}>
                    <td className="border border-sky-400/15 px-2 py-1 print:border-gray-300">{network.name}</td>
                    <td className="border border-sky-400/15 px-2 py-1 print:border-gray-300">{network.criticality}</td>
                    <td className="border border-sky-400/15 px-2 py-1 print:border-gray-300">{network.classification}</td>
                    <td className="border border-sky-400/15 px-2 py-1 print:border-gray-300">{network.assetIds.length}</td>
                    <td className="border border-sky-400/15 px-2 py-1 print:border-gray-300">{deriveOverallStatus(rollups)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="text-base font-semibold">Posture by ICT System</h2>
          <table className="mt-2 min-w-full border border-sky-400/20 text-xs print:border-gray-300">
            <thead>
              <tr className="bg-slate-900/45 print:bg-gray-100">
                <th className="border border-sky-400/15 px-2 py-1 text-left print:border-gray-300">System</th>
                <th className="border border-sky-400/15 px-2 py-1 text-left print:border-gray-300">Mission Context</th>
                <th className="border border-sky-400/15 px-2 py-1 text-left print:border-gray-300">Service Context</th>
                <th className="border border-sky-400/15 px-2 py-1 text-left print:border-gray-300">Overall</th>
                <th className="border border-sky-400/15 px-2 py-1 text-left print:border-gray-300">Production</th>
              </tr>
            </thead>
            <tbody>
              {systems.map((system) => {
                const rollups = analytics.systemRollups.filter(
                  (rollup) => rollup.scopeType === "system" && rollup.scopeId === system.id
                );
                const production = analytics.environmentRollups.filter(
                  (rollup) =>
                    rollup.scopeType === "environment" && rollup.scopeId === `${system.id}::Production`
                );
                return (
                  <tr key={system.id}>
                    <td className="border border-sky-400/15 px-2 py-1 print:border-gray-300">{system.name}</td>
                    <td className="border border-sky-400/15 px-2 py-1 print:border-gray-300">
                      {system.missionCapabilities.map((capability) => `${capability.name} (${capability.criticality})`).join(", ")}
                    </td>
                    <td className="border border-sky-400/15 px-2 py-1 print:border-gray-300">
                      {system.businessServices.map((service) => `${service.name} (${service.criticality})`).join(", ")}
                    </td>
                    <td className="border border-sky-400/15 px-2 py-1 print:border-gray-300">{deriveOverallStatus(rollups)}</td>
                    <td className="border border-sky-400/15 px-2 py-1 print:border-gray-300">
                      {deriveOverallStatus(production)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="text-base font-semibold">Mission Capability Cyber Posture Narrative</h2>
          <div className="mt-2 space-y-3">
            {missionCapabilityNarratives.map((profile) => (
              <p key={profile.id} className="text-slate-200/90 print:text-gray-800">
                <strong>{profile.name}</strong> (Criticality: {profile.criticality}) posture is{" "}
                <strong>{narrativeRiskLabel(profile)}</strong>. In current scope this capability is linked to{" "}
                {profile.systems.size} ICT system(s), with {profile.nonCompliant} non-compliant findings and{" "}
                {profile.unknown} unknown/data-gap findings across {profile.impactedAssets.size} impacted asset(s).
                High-priority backlog count is {profile.highPriority}, including {profile.highRisk} High Risk trigger(s),{" "}
                {profile.criticalExposure} Critical Exposure item(s), and {profile.productionExceptions} production-specific
                exception(s). <strong>{importanceHighlight(profile)}</strong>
              </p>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold">Business Service Cyber Posture Narrative</h2>
          <div className="mt-2 space-y-3">
            {businessServiceNarratives.map((profile) => (
              <p key={profile.id} className="text-slate-200/90 print:text-gray-800">
                <strong>{profile.name}</strong> (Criticality: {profile.criticality}) posture is{" "}
                <strong>{narrativeRiskLabel(profile)}</strong>. In current scope this service is linked to{" "}
                {profile.systems.size} ICT system(s), with {profile.nonCompliant} non-compliant findings and{" "}
                {profile.unknown} unknown/data-gap findings across {profile.impactedAssets.size} impacted asset(s).
                High-priority backlog count is {profile.highPriority}, including {profile.highRisk} High Risk trigger(s),{" "}
                {profile.criticalExposure} Critical Exposure item(s), and {profile.productionExceptions} production-specific
                exception(s). <strong>{importanceHighlight(profile)}</strong>
              </p>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold">Production Exceptions and High-Risk Items</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            {productionExceptions.slice(0, 30).map((item) => (
              <li key={item.id}>
                {item.severity} | SPI {item.spiId} | {item.scope.systemId ?? "Network"} / {item.scope.assetId}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">Appendix: Assumptions and Data Quality</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Local seeded JSON dataset only, no external feeds.</li>
            <li>Roll-up precedence: Non-compliant over Unknown over Compliant.</li>
            <li>Production context inferred from ICT system environment linkage.</li>
            <li>Unknown data counts: {unknownCounts.checks} unknown checks, {unknownCounts.findings} unknown findings.</li>
            <li>
              Active filters in this report:{" "}
              {Object.entries(filters)
                .filter(([, value]) => value)
                .map(([key, value]) => `${key}=${value}`)
                .join(", ") || "None"}
            </li>
          </ul>
        </section>
      </article>
    </div>
  );
}
