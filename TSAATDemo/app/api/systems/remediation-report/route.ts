import { NextRequest } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { buildAnalytics } from "@/lib/analytics";
import { discoveryCoverageByAssetId, discoveryCoverageForAssetId } from "@/lib/discovery-coverage";
import {
  loadCurrentDataset,
  loadDiscoveryToolsSettings,
  loadMeasuresSettings,
  loadSeverityDefinitions,
  loadSpiDefinitions
} from "@/lib/data-loader";
import { addVisualSummaryPage } from "@/lib/report-pdf-visuals";
import { applyAssetFilters, filterSystems, parseFilters } from "@/lib/selectors";
import { Asset, ComplianceStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function complianceScore(statuses: ComplianceStatus[]): number {
  if (!statuses.length) {
    return 0;
  }
  const compliant = statuses.filter((status) => status === "Compliant").length;
  return Number(((compliant / statuses.length) * 100).toFixed(1));
}

function overallStatusFromStatuses(statuses: ComplianceStatus[]): ComplianceStatus {
  if (!statuses.length) {
    return "Unknown";
  }
  if (statuses.some((status) => status === "Non-compliant")) {
    return "Non-compliant";
  }
  if (statuses.some((status) => status === "Unknown")) {
    return "Unknown";
  }
  return "Compliant";
}

function discoveryCoverageForAsset(asset: Asset, coverageByAsset: ReturnType<typeof discoveryCoverageByAssetId>) {
  const coverage = discoveryCoverageForAssetId(asset.id, coverageByAsset);
  return {
    missingTools: coverage.missingToolNames,
    coverageCompliance: coverage.coverageCompliance
  };
}

function reportFileName(snapshotDate: string): string {
  const safeDate = snapshotDate.replace(/[^0-9-]/g, "");
  return `dct-remediation-report-systems-scope-${safeDate}.pdf`;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    const width = font.widthOfTextAtSize(test, size);
    if (width <= maxWidth) {
      line = test;
    } else {
      if (line) {
        lines.push(line);
      }
      line = word;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines.length ? lines : [""];
}

function classifyLine(line: string): {
  text: string;
  font: "bold" | "regular";
  size: number;
  color: { r: number; g: number; b: number };
  indent: number;
  spacingAfter: number;
} {
  if (line.startsWith("# ")) {
    return {
      text: line.slice(2).trim(),
      font: "bold",
      size: 16,
      color: { r: 0.07, g: 0.2, b: 0.31 },
      indent: 0,
      spacingAfter: 8
    };
  }
  if (line.startsWith("## ")) {
    return {
      text: line.slice(3).trim(),
      font: "bold",
      size: 12,
      color: { r: 0.08, g: 0.22, b: 0.34 },
      indent: 0,
      spacingAfter: 4
    };
  }
  if (line.startsWith("  - ")) {
    return {
      text: `- ${line.slice(4).trim()}`,
      font: "regular",
      size: 9,
      color: { r: 0.14, g: 0.17, b: 0.22 },
      indent: 16,
      spacingAfter: 2
    };
  }
  if (line.startsWith("- ")) {
    return {
      text: line,
      font: "regular",
      size: 10,
      color: { r: 0.14, g: 0.17, b: 0.22 },
      indent: 0,
      spacingAfter: 2
    };
  }
  return {
    text: line,
    font: "regular",
    size: 10,
    color: { r: 0.18, g: 0.2, b: 0.25 },
    indent: 0,
    spacingAfter: 2
  };
}

function createPage(pdfDoc: PDFDocument, pageTitle: string, titleFont: PDFFont): { page: PDFPage; yStart: number } {
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: height - 56, width, height: 56, color: rgb(0.04, 0.16, 0.27) });
  page.drawRectangle({ x: 0, y: height - 60, width, height: 4, color: rgb(0.36, 0.75, 0.88) });
  page.drawText(pageTitle, {
    x: 32,
    y: height - 38,
    size: 12,
    font: titleFont,
    color: rgb(0.92, 0.97, 1)
  });
  return { page, yStart: height - 76 };
}

export async function GET(request: NextRequest) {
  const [dataset, discoveryToolsSettings, spiDefinitions, severityDefinitions] = await Promise.all([
    loadCurrentDataset(),
    loadDiscoveryToolsSettings(),
    loadSpiDefinitions(),
    loadSeverityDefinitions()
  ]);
  const storedDiscoveryCoverageByAsset = discoveryCoverageByAssetId(dataset.discoveryCoverageEvaluations);
  const measuresSettings = await loadMeasuresSettings(spiDefinitions, severityDefinitions);
  const queryObject = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseFilters(queryObject);
  const analytics = buildAnalytics(dataset, dataset.ictSystems, filters, spiDefinitions, measuresSettings, discoveryToolsSettings);
  const systems = filterSystems(dataset.ictSystems, filters);
  const scopedSystemIds = new Set(systems.map((system) => system.id));

  const findings = analytics.findings.filter(
    (finding) => Boolean(finding.scope.systemId) && scopedSystemIds.has(finding.scope.systemId as string)
  );
  const p12Findings = findings.filter((finding) => finding.priorityRank <= 2);
  const highRiskFindings = findings.filter((finding) => finding.severity === "High Risk");
  const nonCompliantFindings = findings.filter((finding) => finding.complianceStatus === "Non-compliant");

  const scopedStatuses = analytics.evaluations
    .filter((evaluation) => Boolean(evaluation.systemId) && scopedSystemIds.has(evaluation.systemId as string))
    .flatMap((evaluation) => evaluation.evaluations.map((evaluationItem) => evaluationItem.status));
  const compliantStatusCount = scopedStatuses.filter((status) => status === "Compliant").length;
  const nonCompliantStatusCount = scopedStatuses.filter((status) => status === "Non-compliant").length;
  const unknownStatusCount = scopedStatuses.filter((status) => status === "Unknown").length;
  const scopedComplianceScore = complianceScore(scopedStatuses);
  const scopedPosture = overallStatusFromStatuses(scopedStatuses);

  const filteredAssets: Asset[] = applyAssetFilters(dataset.assets, systems, filters).filter((asset) => {
    const systemId = asset.systemContext?.systemId;
    return Boolean(systemId) && scopedSystemIds.has(systemId as string);
  });

  const evaluationByAssetId = new Map(analytics.evaluations.map((evaluation) => [evaluation.assetId, evaluation]));
  const nonCompliantAssetCount = filteredAssets.filter((asset) => {
    const evaluation = evaluationByAssetId.get(asset.id);
    return evaluation ? evaluation.evaluations.some((evaluationItem) => evaluationItem.status === "Non-compliant") : false;
  }).length;

  const actionCounts = new Map<string, number>();
  for (const finding of nonCompliantFindings) {
    const action = finding.recommendedAction.trim() || "Review finding details and assign remediation owner.";
    actionCounts.set(action, (actionCounts.get(action) ?? 0) + 1);
  }
  const prioritizedActions = Array.from(actionCounts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return a[0].localeCompare(b[0]);
  });

  const discoveryCoverageServerGaps = filteredAssets
    .filter((asset) => asset.type === "server")
    .map((asset) => {
      const coverage = discoveryCoverageForAsset(asset, storedDiscoveryCoverageByAsset);
      return {
        assetId: asset.id,
        hostname: asset.hostname,
        missingTools: coverage.missingTools
      };
    })
    .filter((item) => item.missingTools.length > 0)
    .sort((a, b) => a.hostname.localeCompare(b.hostname));

  const systemNameById = new Map(dataset.ictSystems.map((system) => [system.id, system.name]));
  const assetNameById = new Map(dataset.assets.map((asset) => [asset.id, asset.hostname]));
  const maxFindingsInReport = 300;
  const findingsForReport = findings.slice(0, maxFindingsInReport);
  const isFindingsTruncated = findings.length > findingsForReport.length;

  const generatedAt = new Date().toISOString();
  const topActionSummary = prioritizedActions
    .slice(0, 3)
    .map(([action, count]) => `${count}x ${action}`)
    .join("; ");
  const lines: string[] = [];
  lines.push("# ICT System Scope Remediation Report");
  lines.push("");
  lines.push("## Report Name");
  lines.push("ICT System Scope Remediation Report");
  lines.push("");
  lines.push("## Timestamp");
  lines.push(`Generated At: ${generatedAt}`);
  lines.push(`Snapshot Date: ${dataset.snapshotDate}`);
  lines.push("");
  lines.push("## Introduction");
  lines.push(
    "This executive brief provides a concise remediation view of cyber posture across the currently scoped ICT systems, aligned to active filters."
  );
  lines.push("");
  lines.push("## Audience");
  lines.push(
    "ICT system owners, service managers, cyber assurance stakeholders, and remediation delivery teams."
  );
  lines.push("");
  lines.push("## Executive Summary");
  lines.push(
    `Current scoped posture is ${scopedPosture} with a compliance score of ${scopedComplianceScore}%. The scope includes ${systems.length} ICT system(s), ${filteredAssets.length} asset(s), and ${findings.length} total finding(s), including ${p12Findings.length} P1-P2 and ${highRiskFindings.length} High Risk finding(s).`
  );
  lines.push("");
  lines.push("## Findings Summary Including Impacts");
  lines.push(
    `Non-compliance currently affects ${nonCompliantAssetCount} asset(s), creating elevated service and assurance risk where unresolved findings intersect with production and mission-critical operations. Discovery coverage review identifies ${discoveryCoverageServerGaps.length} server(s) with tool coverage gaps that may reduce visibility and delay response prioritization.`
  );
  lines.push("");
  lines.push("## Recommendations to Remediate");
  lines.push(
    prioritizedActions.length
      ? `Prioritize closure of repeated non-compliance actions with named ownership and due dates. Immediate attention should be given to: ${topActionSummary}. Concurrently remediate discovery coverage gaps to strengthen control verification and reporting confidence.`
      : "Maintain current control posture, continue scheduled assurance cycles, and enforce governance controls to sustain compliance outcomes."
  );
  lines.push("");
  lines.push("## Scope Summary");
  lines.push(`- ICT Systems in Scope: ${systems.length}`);
  lines.push(`- Assets in Scope: ${filteredAssets.length}`);
  lines.push(`- Assets with Non-compliance: ${nonCompliantAssetCount}`);
  lines.push(`- Findings in Scope: ${findings.length}`);
  lines.push(`- P1-P2 Findings in Scope: ${p12Findings.length}`);
  lines.push(`- High Risk Findings in Scope: ${highRiskFindings.length}`);
  lines.push(`- Compliance Score (Scoped): ${scopedComplianceScore}%`);
  lines.push(`- Overall Posture (Scoped): ${scopedPosture}`);
  lines.push("");
  lines.push("## Filters Applied");
  lines.push(`- ICT System: ${filters.ictSystem ?? "All"}`);
  lines.push(`- Criticality: ${filters.systemCriticality ?? "All"}`);
  lines.push(`- Security Domain: ${filters.securityDomain ?? "All"}`);
  lines.push(`- Environment: ${filters.environment ?? "All"}`);
  lines.push(`- Asset Type: ${filters.assetType ?? "All"}`);
  lines.push(`- Severity: ${filters.severity ?? "All"}`);
  lines.push(`- Mission Capability: ${filters.missionCapability ?? "All"}`);
  lines.push(`- Business Service: ${filters.businessService ?? "All"}`);
  lines.push("");
  lines.push("## ICT Systems in Scope");
  if (!systems.length) {
    lines.push("- No ICT systems in the current scope.");
  } else {
    for (const system of systems.sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`- ${system.name} (${system.id})`);
    }
  }

  lines.push("");
  lines.push("## Findings Register (Scoped)");
  if (!findingsForReport.length) {
    lines.push("- No findings in the current scope.");
  } else {
    for (const finding of findingsForReport) {
      const assetName = assetNameById.get(finding.scope.assetId) ?? finding.scope.assetId;
      const systemName = systemNameById.get(finding.scope.systemId as string) ?? (finding.scope.systemId as string);
      lines.push(
        `- [${finding.id}] P${finding.priorityRank} | SPI ${finding.spiId} | ${finding.severity} | ${finding.complianceStatus} | ${finding.status} | ${finding.timestamp}`
      );
      lines.push(`  - Asset: ${assetName}`);
      lines.push(`  - ICT System: ${systemName}`);
      lines.push(`  - Environment: ${finding.scope.environmentType ?? "-"}`);
      lines.push(`  - Finding: ${finding.title}`);
      lines.push(`  - Recommended Action: ${finding.recommendedAction}`);
    }
  }
  if (isFindingsTruncated) {
    lines.push(`- Report truncated to first ${maxFindingsInReport} findings. Total scoped findings: ${findings.length}.`);
  }

  lines.push("");
  lines.push("## Required Actions to Remediate Non-compliance");
  if (!prioritizedActions.length) {
    lines.push("- No non-compliant findings in scope.");
  } else {
    for (const [action, count] of prioritizedActions) {
      lines.push(`- (${count}) ${action}`);
    }
  }

  lines.push("");
  lines.push("## Discovery Coverage Gap Remediation Plan");
  if (!discoveryCoverageServerGaps.length) {
    lines.push("- All servers in scope are discovery coverage compliant.");
  } else {
    lines.push(`- Servers requiring discovery tool deployment: ${discoveryCoverageServerGaps.length}`);
    for (const gap of discoveryCoverageServerGaps) {
      lines.push(`- ${gap.hostname} (${gap.assetId})`);
      lines.push(`  - Deploy/Integrate: ${gap.missingTools.join(", ")}`);
    }
  }

  lines.push("");
  lines.push("## Notes");
  lines.push("- This report is generated from the ICT Systems page and reflects the active filter scope.");

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const topAction = prioritizedActions[0];

  addVisualSummaryPage({
    pdfDoc,
    pageTitle: "ICT Systems Remediation Report",
    subtitle: "Visualisation of scoped ICT system compliance, finding concentrations, and discovery coverage pressure.",
    titleFont: fontBold,
    bodyFont: fontRegular,
    cards: [
      { label: "Compliance Score", value: `${scopedComplianceScore}%`, tone: "good" },
      { label: "Systems in Scope", value: `${systems.length}`, tone: "neutral" },
      { label: "Assets in Scope", value: `${filteredAssets.length}`, tone: "neutral" },
      { label: "Findings in Scope", value: `${findings.length}`, tone: "warning" }
    ],
    bars: [
      { label: "Non-compliant Assets", value: nonCompliantAssetCount, color: [0.82, 0.3, 0.29] },
      { label: "P1-P2 Findings", value: p12Findings.length, color: [0.17, 0.47, 0.77] },
      { label: "High Risk Findings", value: highRiskFindings.length, color: [0.86, 0.51, 0.2] },
      { label: "Discovery Gap Servers", value: discoveryCoverageServerGaps.length, color: [0.55, 0.38, 0.79] },
      { label: "Top Action Frequency", value: topAction?.[1] ?? 0, color: [0.35, 0.59, 0.83] }
    ],
    segments: [
      { label: "Compliant", value: compliantStatusCount, color: [0.2, 0.62, 0.42] },
      { label: "Non-compliant", value: nonCompliantStatusCount, color: [0.82, 0.3, 0.29] },
      { label: "Unknown", value: unknownStatusCount, color: [0.89, 0.66, 0.28] }
    ],
    insights: [
      `Scoped posture is ${scopedPosture} at ${scopedComplianceScore}% compliance.`,
      `${nonCompliantAssetCount} asset(s) in the current ICT system scope are non-compliant.`,
      `${discoveryCoverageServerGaps.length} server(s) have discovery tool coverage gaps.`,
      topAction ? `Most frequent remediation action: ${topAction[0]} (${topAction[1]} occurrence(s)).` : "No recurring remediation action pattern in current scope."
    ]
  });

  const pageTitle = "ICT Systems Remediation Report";
  let pageState = createPage(pdfDoc, pageTitle, fontBold);
  let page = pageState.page;
  let y = pageState.yStart;

  const leftMargin = 32;
  const rightMargin = 32;
  const bottomMargin = 32;

  const startNewPage = () => {
    pageState = createPage(pdfDoc, pageTitle, fontBold);
    page = pageState.page;
    y = pageState.yStart;
  };

  for (const line of lines) {
    if (!line.trim()) {
      y -= 6;
      if (y < bottomMargin) {
        startNewPage();
      }
      continue;
    }

    const style = classifyLine(line);
    const font = style.font === "bold" ? fontBold : fontRegular;
    const lineHeight = style.size + 3;
    const pageWidth = page.getSize().width;
    const maxWidth = pageWidth - leftMargin - rightMargin - style.indent;
    const wrappedLines = wrapText(style.text, font, style.size, maxWidth);
    const blockHeight = wrappedLines.length * lineHeight + style.spacingAfter;

    if (y - blockHeight < bottomMargin) {
      startNewPage();
    }

    for (const wrappedLine of wrappedLines) {
      page.drawText(wrappedLine, {
        x: leftMargin + style.indent,
        y,
        size: style.size,
        font,
        color: rgb(style.color.r, style.color.g, style.color.b)
      });
      y -= lineHeight;
    }

    y -= style.spacingAfter;
  }

  const pdfBytes = await pdfDoc.save();
  const pdfArrayBuffer = Uint8Array.from(pdfBytes).buffer;
  const filename = reportFileName(dataset.snapshotDate);

  return new Response(pdfArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=${filename}`
    }
  });
}
