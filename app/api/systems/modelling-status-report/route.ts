import { documentResponse } from "@/lib/documents/server-response";
import type { LegacyNarrativePdfData } from "@/lib/documents/legacy-pdf-data";
import { NextRequest } from "next/server";
import { loadDatasetForDate } from "@/lib/data-loader";
import { filterSystems, parseFilters } from "@/lib/selectors";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
function reportFileName(snapshotDate: string): string {
  const safeDate = snapshotDate.replace(/[^0-9-]/g, "");
  return `ict-system-modelling-status-${safeDate}.pdf`;
}

export async function GET(request: NextRequest) {
  const dataset = await loadDatasetForDate(request.nextUrl.searchParams.get("dataDate") ?? undefined);

  const queryObject = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseFilters(queryObject);
  const scopedSystems = filterSystems(dataset.ictSystems, filters);

  const diisRegisteredSystems = scopedSystems.filter((system) => system.diisDefined);
  const modelledDiisSystems = diisRegisteredSystems.filter((system) => system.modellingStatus);
  const unmodelledSystems = diisRegisteredSystems
    .filter((system) => !system.modellingStatus)
    .sort((a, b) => a.name.localeCompare(b.name));

  const registeredCount = diisRegisteredSystems.length;
  const modelledCount = modelledDiisSystems.length;
  const unmodelledCount = unmodelledSystems.length;
  const notDiisRegisteredCount = Math.max(scopedSystems.length - registeredCount, 0);
  const criticalUnmodelledCount = unmodelledSystems.filter((system) => system.criticality === "Critical").length;
  const modelledPercent = registeredCount ? Number(((modelledCount / registeredCount) * 100).toFixed(1)) : 0;

  const generatedAt = new Date().toISOString();

  const lines: string[] = [];
  lines.push("# ICT System Modelling Status Report");
  lines.push("");
  lines.push("## Report Name");
  lines.push("ICT System Modelling Status");
  lines.push("");
  lines.push("## Timestamp");
  lines.push(`Generated At: ${generatedAt}`);
  lines.push(`Snapshot Date: ${dataset.snapshotDate}`);
  lines.push("");
  lines.push("## Introduction");
  lines.push(
    "This report summarises DIIS ICT system modelling coverage for the current scope and identifies DIIS-registered systems that are not yet modelled."
  );
  lines.push("");
  lines.push("## Audience");
  lines.push("ICT system owners, DIIS operations, architecture governance, and cyber assurance teams.");
  lines.push("");
  lines.push("## Executive Summary");
  lines.push(
    `DIIS registered ICT systems in scope: ${registeredCount}. DIIS ICT systems modelled: ${modelledCount}. Current modelling coverage is ${modelledPercent}%, leaving ${unmodelledCount} DIIS-registered ICT system(s) not modelled.`
  );
  lines.push("");
  lines.push("## Findings Summary Including Impacts");
  lines.push(
    "Unmodelled DIIS systems reduce confidence in coverage and traceability, and can obscure risk ownership, remediation planning, and assurance reporting quality."
  );
  lines.push("");
  lines.push("## Recommendations to Remediate");
  lines.push(
    "Prioritise modelling of DIIS-registered systems with named owners and delivery dates, then reconcile DIIS and TSAAT scope weekly until full modelling coverage is achieved."
  );
  lines.push("");
  lines.push("## Scope Summary");
  lines.push(`- ICT Systems in Scope: ${scopedSystems.length}`);
  lines.push(`- DIIS Registered ICT Systems: ${registeredCount}`);
  lines.push(`- DIIS ICT Systems Modelled: ${modelledCount}`);
  lines.push(`- DIIS ICT Systems Not Modelled: ${unmodelledCount}`);
  lines.push(`- Modelling Coverage: ${modelledPercent}%`);
  lines.push("");
  lines.push("## Filters Applied");
  lines.push(`- Managed Network: ${filters.managedNetwork ?? "All"}`);
  lines.push(`- ICT System: ${filters.ictSystem ?? "All"}`);
  lines.push(`- Criticality: ${filters.systemCriticality ?? "All"}`);
  lines.push(`- Security Domain: ${filters.securityDomain ?? "All"}`);
  lines.push(`- Environment: ${filters.environment ?? "All"}`);
  lines.push(`- Asset Type: ${filters.assetType ?? "All"}`);
  lines.push(`- Severity: ${filters.severity ?? "All"}`);
  lines.push(`- Mission Capability: ${filters.missionCapability ?? "All"}`);
  lines.push(`- Business Service: ${filters.businessService ?? "All"}`);
  lines.push("");
  lines.push("## ICT Systems Not Modelled");
  if (!unmodelledSystems.length) {
    lines.push("- No DIIS-registered ICT systems are unmodelled in the current filtered scope.");
  } else {
    for (const system of unmodelledSystems) {
      lines.push(`- ${system.name} (${system.id})`);
      lines.push(`  - Description: ${system.description?.trim() || "No description provided."}`);
      lines.push(`  - Criticality: ${system.criticality}`);
      lines.push(
        `  - Owner Details: ${system.owner?.trim() || "Not assigned"}${
          system.supportEmail?.trim() ? ` | ${system.supportEmail.trim()}` : ""
        }`
      );
    }
  }
  lines.push("");
  lines.push("## Notes");
  lines.push("- Counts compare DIIS-registered systems against DIIS-registered systems modelled within the active report filters.");

    const pageTitle = "ICT System Modelling Status";
  const visual: LegacyNarrativePdfData["visual"] = {
    pageTitle: "ICT System Modelling Status",
    subtitle: "DIIS registration versus modelling coverage visualisation for the currently filtered ICT system scope.",
    cards: [
        { label: "Systems in Scope", value: `${scopedSystems.length}`, tone: "neutral" },
        { label: "DIIS Registered", value: `${registeredCount}`, tone: "neutral" },
        { label: "Modelled", value: `${modelledCount}`, tone: "good" },
        { label: "Not Modelled", value: `${unmodelledCount}`, tone: "critical" }
    ],
    bars: [
        { label: "Modelled DIIS Systems", value: modelledCount, color: [0.2, 0.62, 0.42] },
        { label: "Unmodelled DIIS Systems", value: unmodelledCount, color: [0.82, 0.3, 0.29] },
        { label: "Not DIIS Registered", value: notDiisRegisteredCount, color: [0.48, 0.48, 0.56] },
        { label: "Critical Unmodelled", value: criticalUnmodelledCount, color: [0.86, 0.51, 0.2] }
    ],
    segments: [
        { label: "Modelled", value: modelledCount, color: [0.2, 0.62, 0.42] },
        { label: "Not Modelled", value: unmodelledCount, color: [0.82, 0.3, 0.29] }
    ],
    insights: [
        `Current DIIS modelling coverage is ${modelledPercent}% (${modelledCount}/${registeredCount || 0}).`,
        `${unmodelledCount} DIIS-registered ICT system(s) remain unmodelled in this scope.`,
        `${criticalUnmodelledCount} of the unmodelled DIIS systems are marked Critical.`,
        "Prioritise critical unmodelled systems first, then sequence remaining systems by ownership readiness."
    ]
};
  const tables: LegacyNarrativePdfData["tables"] = [];
  const filename = reportFileName(dataset.snapshotDate);
  const data: LegacyNarrativePdfData = { snapshotDate: dataset.snapshotDate, pageTitle, lines, visual, tables };
  return documentResponse(request, { version: 1, kind: "pdf-modelling-status", filename, title: pageTitle, generatedAt, data });
}
