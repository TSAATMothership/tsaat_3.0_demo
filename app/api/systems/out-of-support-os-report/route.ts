import { documentResponse } from "@/lib/documents/server-response";
import type { LegacyNarrativePdfData } from "@/lib/documents/legacy-pdf-data";
import { deviceReportDetails } from "@/lib/device-report";
import { NextRequest } from "next/server";
import { buildAnalytics } from "@/lib/analytics";
import {
  loadDatasetForDate,
  loadDiscoveryToolsSettings,
  loadMeasuresSettings,
  loadSeverityDefinitions,
  loadSpiDefinitions
} from "@/lib/data-loader";
import { parseFilters } from "@/lib/selectors";
import { findEvaluationForSpiFeature, SPI_FEATURE_OUT_OF_SUPPORT_OS_REPORT } from "@/lib/spi-features";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
function reportFileName(snapshotDate: string): string {
  const safeDate = snapshotDate.replace(/[^0-9-]/g, "");
  return `ict-system-out-of-support-os-${safeDate}.pdf`;
}

export async function GET(request: NextRequest) {
  const [dataset, discoveryToolsSettings, spiDefinitions, severityDefinitions] = await Promise.all([
    loadDatasetForDate(request.nextUrl.searchParams.get("dataDate") ?? undefined),
    loadDiscoveryToolsSettings(),
    loadSpiDefinitions(),
    loadSeverityDefinitions()
  ]);
  const measuresSettings = await loadMeasuresSettings(spiDefinitions, severityDefinitions);

  const queryObject = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseFilters(queryObject);
  const analytics = buildAnalytics(dataset, dataset.ictSystems, filters, spiDefinitions, measuresSettings, discoveryToolsSettings);
  const systemsById = new Map(dataset.ictSystems.map((system) => [system.id, system]));
  const assetsById = new Map(dataset.assets.map((asset) => [asset.id, asset]));
  const reportSpiDefinitions = spiDefinitions.filter((definition) =>
    definition.featureBindings.some((binding) => binding.featureKey === SPI_FEATURE_OUT_OF_SUPPORT_OS_REPORT)
  );
  const reportMeasureLabel = reportSpiDefinitions.map((definition) => `SPI ${definition.spiId}`).join(", ") || "configured SPI";
  const reportMeasureDescription =
    reportSpiDefinitions[0]?.description ?? "the configured operating system support measure";

  const outOfSupportRows = analytics.evaluations
    .filter((evaluation) => evaluation.assetType === "server" && Boolean(evaluation.systemId))
    .map((evaluation) => {
      const reportEvaluation = findEvaluationForSpiFeature(
        evaluation.evaluations,
        SPI_FEATURE_OUT_OF_SUPPORT_OS_REPORT,
        spiDefinitions
      );
      if (!reportEvaluation) {
        return null;
      }
      const asset = assetsById.get(evaluation.assetId);
      if (!asset || asset.type !== "server") {
        return null;
      }
      const systemName = (evaluation.systemId && systemsById.get(evaluation.systemId)?.name) ?? evaluation.systemId ?? "-";
      const osName = asset.operatingSystem ? `${asset.operatingSystem.vendor} ${asset.operatingSystem.family}` : "Unknown";
      const osVersion = asset.operatingSystem?.version ?? "Unknown";
      const supportStatus = asset.operatingSystem?.supportStatus ?? "Unknown";
      const reason = reportEvaluation.reasons.join(" | ") || `${reportMeasureDescription} is non-compliant.`;

      return {
        systemId: evaluation.systemId as string,
        systemName,
        assetId: asset.id,
        hostname: asset.hostname,
        environment: evaluation.environmentType ?? "-",
        osName,
        osVersion,
        supportStatus,
        reason
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => {
      const systemDiff = a.systemName.localeCompare(b.systemName);
      if (systemDiff !== 0) {
        return systemDiff;
      }
      return a.hostname.localeCompare(b.hostname);
    });

  const affectedSystems = new Set(outOfSupportRows.map((row) => row.systemId));
  const supportStatusCounts = new Map<string, number>();
  const environmentCounts = new Map<string, number>();
  const impactedSystemCounts = new Map<string, { name: string; count: number }>();
  for (const row of outOfSupportRows) {
    supportStatusCounts.set(row.supportStatus, (supportStatusCounts.get(row.supportStatus) ?? 0) + 1);
    environmentCounts.set(row.environment, (environmentCounts.get(row.environment) ?? 0) + 1);
    const systemSummary = impactedSystemCounts.get(row.systemId) ?? { name: row.systemName, count: 0 };
    systemSummary.count += 1;
    impactedSystemCounts.set(row.systemId, systemSummary);
  }
  const topImpactedSystems = Array.from(impactedSystemCounts.values())
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, 3);
  const generatedAt = new Date().toISOString();

  const lines: string[] = [];
  lines.push("# ICT System out of support OS");
  lines.push("");
  lines.push("## Report Name");
  lines.push("ICT System out of support OS");
  lines.push("");
  lines.push("## Timestamp");
  lines.push(`Generated At: ${generatedAt}`);
  lines.push(`Snapshot Date: ${dataset.snapshotDate}`);
  lines.push("");
  lines.push("## Introduction");
  lines.push(
    `This executive brief identifies scoped ICT system server assets that are non-compliant with ${reportMeasureLabel}, indicating operating system support posture gaps requiring remediation action.`
  );
  lines.push("");
  lines.push("## Audience");
  lines.push("ICT system owners, infrastructure operations, cyber assurance teams, and remediation coordinators.");
  lines.push("");
  lines.push("## Executive Summary");
  lines.push(
    `The current scope contains ${outOfSupportRows.length} server asset(s) across ${affectedSystems.size} ICT system(s) that are non-compliant with ${reportMeasureLabel}. These assets represent elevated security and service continuity risk if support and patch posture is not restored.`
  );
  lines.push("");
  lines.push("## Findings Summary Including Impacts");
  lines.push(
    "Out-of-support or unsupported operating systems reduce patchability, increase exploit exposure, and weaken compliance confidence for critical services. Prolonged non-compliance may drive persistent vulnerability backlog and higher operational recovery effort."
  );
  lines.push("");
  lines.push("## Recommendations to Remediate");
  lines.push(
    `Prioritize OS uplift or platform replacement for affected servers, assign accountable owners and target dates, and enforce interim compensating controls until remediation is complete. Validate closure through repeat ${reportMeasureLabel} compliance checks.`
  );
  lines.push("");
  lines.push(`## Affected Servers (${reportMeasureLabel} Non-compliant)`);
  if (!outOfSupportRows.length) {
    lines.push(`- No servers in the current filtered scope are non-compliant with ${reportMeasureLabel}.`);
  } else {
    lines.push("- Device inventory, OS support status and evidence are listed in the affected-server table following this summary.");
  }
  lines.push("");
  lines.push("## Notes");
  lines.push("- Scope is aligned to active report filters and server assets only.");

    const pageTitle = "ICT System out of support OS";
  const outOfSupportCount = supportStatusCounts.get("OutOfSupport") ?? 0;
  const unknownSupportCount = supportStatusCounts.get("Unknown") ?? 0;
  const supportedCount = supportStatusCounts.get("Supported") ?? 0;
  const productionCount = environmentCounts.get("Production") ?? 0;
  const visual: LegacyNarrativePdfData["visual"] = {
    pageTitle: "ICT System out of support OS",
    subtitle: `Server OS support posture visualisation for ${reportMeasureLabel} non-compliant assets in the active scope.`,
    cards: [
        { label: "Affected Servers", value: `${outOfSupportRows.length}`, tone: "critical" },
        { label: "Affected ICT Systems", value: `${affectedSystems.size}`, tone: "warning" },
        { label: "OutOfSupport OS", value: `${outOfSupportCount}`, tone: "critical" },
        { label: "Production Impacted", value: `${productionCount}`, tone: "warning" }
    ],
    bars: [
        { label: "OutOfSupport", value: outOfSupportCount, color: [0.82, 0.3, 0.29] },
        { label: "Unknown Support", value: unknownSupportCount, color: [0.89, 0.66, 0.28] },
        { label: "Supported (Still NC)", value: supportedCount, color: [0.2, 0.62, 0.42] },
        { label: "Production Environment", value: productionCount, color: [0.2, 0.46, 0.8] }
    ],
    segments: [
        { label: "OutOfSupport", value: outOfSupportCount, color: [0.82, 0.3, 0.29] },
        { label: "Unknown", value: unknownSupportCount, color: [0.89, 0.66, 0.28] },
        { label: "Supported", value: supportedCount, color: [0.2, 0.62, 0.42] }
    ],
    insights: [
        `${outOfSupportRows.length} server asset(s) are ${reportMeasureLabel} non-compliant in the filtered scope.`,
        `${affectedSystems.size} ICT system(s) are impacted by OS support posture gaps.`,
        topImpactedSystems.length
            ? `Most impacted systems: ${topImpactedSystems.map((item) => `${item.name} (${item.count})`).join("; ")}.`
            : "No impacted systems in scope.",
        "Use this visual summary to prioritise OS uplift sequencing and owner assignment."
    ]
};
  const tables: LegacyNarrativePdfData["tables"] = [];
  if (outOfSupportRows.length)
    tables.push({
        sectionTitle: `Affected Servers (${reportMeasureLabel} Non-compliant)`, columns: [{ label: "Device / OS Context", weight: 2.5 }, { label: "Evidence", weight: 2.5 }],
        rows: outOfSupportRows.map(row => ({ device: deviceReportDetails(assetsById.get(row.assetId), row.assetId), details: [
                `CI ID: ${row.assetId}\nHostname: ${row.hostname}\nICT System: ${row.systemName} (${row.systemId})\nEnvironment: ${row.environment}\nOS: ${row.osName} ${row.osVersion}\nSupport: ${row.supportStatus}`, row.reason
            ] })) });
  const filename = reportFileName(dataset.snapshotDate);
  const data: LegacyNarrativePdfData = { snapshotDate: dataset.snapshotDate, pageTitle, lines, visual, tables };
  return documentResponse(request, { version: 1, kind: "pdf-unsupported-os", filename, title: pageTitle, generatedAt, data });
}
