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
import {
  filterRealNetworkAssets,
  filterRealNetworkEvaluations,
  filterRealNetworkFindings,
  filterRealNetworks
} from "@/lib/network-scope";
import { addVisualSummaryPage } from "@/lib/report-pdf-visuals";
import { parseFilters } from "@/lib/selectors";
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
  return `dct-remediation-report-networks-scope-${safeDate}.pdf`;
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

  const scopedEvaluations = filterRealNetworkEvaluations(analytics.evaluations);
  const scopedAssetIds = new Set(scopedEvaluations.map((evaluation) => evaluation.assetId));
  const scopedAssets = filterRealNetworkAssets(dataset.assets.filter((asset) => scopedAssetIds.has(asset.id)));
  const scopedNetworkIds = new Set(scopedAssets.map((asset) => asset.networkId));
  const scopedNetworks = filterRealNetworks(dataset.managedNetworks)
    .filter((network) => scopedNetworkIds.has(network.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const findings = filterRealNetworkFindings(analytics.findings);
  const p12Findings = findings.filter((finding) => finding.priorityRank <= 2);
  const highRiskFindings = findings.filter((finding) => finding.severity === "High Risk");
  const nonCompliantFindings = findings.filter((finding) => finding.complianceStatus === "Non-compliant");

  const scopedStatuses = scopedEvaluations.flatMap((evaluation) =>
    evaluation.evaluations.map((evaluationItem) => evaluationItem.status)
  );
  const compliantStatusCount = scopedStatuses.filter((status) => status === "Compliant").length;
  const nonCompliantStatusCount = scopedStatuses.filter((status) => status === "Non-compliant").length;
  const unknownStatusCount = scopedStatuses.filter((status) => status === "Unknown").length;
  const scopedComplianceScore = complianceScore(scopedStatuses);
  const scopedPosture = overallStatusFromStatuses(scopedStatuses);

  const nonCompliantAssetCount = scopedEvaluations.filter((evaluation) =>
    evaluation.evaluations.some((evaluationItem) => evaluationItem.status === "Non-compliant")
  ).length;

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

  const discoveryCoverageServerGaps = scopedAssets
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

  const networkNameById = new Map(filterRealNetworks(dataset.managedNetworks).map((network) => [network.id, network.name]));
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
  lines.push("# Network Scope Remediation Report");
  lines.push("");
  lines.push("## Report Name");
  lines.push("Network Scope Remediation Report");
  lines.push("");
  lines.push("## Timestamp");
  lines.push(`Generated At: ${generatedAt}`);
  lines.push(`Snapshot Date: ${dataset.snapshotDate}`);
  lines.push("");
  lines.push("## Introduction");
  lines.push(
    "This executive brief provides a concise remediation view of cyber posture across the currently scoped managed networks, aligned to active filters."
  );
  lines.push("");
  lines.push("## Audience");
  lines.push(
    "Senior responsible owners, network operations leadership, cyber security governance, and remediation delivery teams."
  );
  lines.push("");
  lines.push("## Executive Summary");
  lines.push(
    `Current scoped posture is ${scopedPosture} with a compliance score of ${scopedComplianceScore}%. The scope includes ${scopedNetworks.length} network(s), ${scopedAssets.length} asset(s), and ${findings.length} total finding(s), including ${p12Findings.length} P1-P2 and ${highRiskFindings.length} High Risk finding(s).`
  );
  lines.push("");
  lines.push("## Findings Summary Including Impacts");
  lines.push(
    `Non-compliance currently affects ${nonCompliantAssetCount} asset(s) and presents operational risk to service continuity, cyber resilience, and patch/remediation throughput. Discovery coverage review shows ${discoveryCoverageServerGaps.length} server(s) with missing discovery tool alignment, which may reduce visibility confidence for timely risk triage.`
  );
  lines.push("");
  lines.push("## Recommendations to Remediate");
  lines.push(
    prioritizedActions.length
      ? `Prioritize closure of recurrent non-compliance actions with accountable owners and delivery dates. Immediate focus should be placed on: ${topActionSummary}. In parallel, close discovery tooling gaps on affected servers to improve detection confidence and remediation tracking.`
      : "Maintain current control posture, continue scheduled assurance activities, and enforce governance checks to prevent regression."
  );
  lines.push("");
  lines.push("## Scope Summary");
  lines.push(`- Networks in Scope: ${scopedNetworks.length}`);
  lines.push(`- Assets in Scope: ${scopedAssets.length}`);
  lines.push(`- Assets with Non-compliance: ${nonCompliantAssetCount}`);
  lines.push(`- Findings in Scope: ${findings.length}`);
  lines.push(`- P1-P2 Findings in Scope: ${p12Findings.length}`);
  lines.push(`- High Risk Findings in Scope: ${highRiskFindings.length}`);
  lines.push(`- Compliance Score (Scoped): ${scopedComplianceScore}%`);
  lines.push(`- Overall Posture (Scoped): ${scopedPosture}`);
  lines.push("");
  lines.push("## Filters Applied");
  lines.push(`- Network: ${filters.managedNetwork ?? "All"}`);
  lines.push(`- ICT System: ${filters.ictSystem ?? "All"}`);
  lines.push(`- Criticality: ${filters.systemCriticality ?? "All"}`);
  lines.push(`- Security Domain: ${filters.securityDomain ?? "All"}`);
  lines.push(`- Environment: ${filters.environment ?? "All"}`);
  lines.push(`- Asset Type: ${filters.assetType ?? "All"}`);
  lines.push(`- Severity: ${filters.severity ?? "All"}`);
  lines.push(`- Mission Capability: ${filters.missionCapability ?? "All"}`);
  lines.push(`- Business Service: ${filters.businessService ?? "All"}`);
  lines.push("");
  lines.push("## Networks in Scope");
  if (!scopedNetworks.length) {
    lines.push("- No networks in the current scope.");
  } else {
    for (const network of scopedNetworks) {
      lines.push(`- ${network.name} (${network.id})`);
    }
  }

  lines.push("");
  lines.push("## Findings Register (Scoped)");
  if (!findingsForReport.length) {
    lines.push("- No findings in the current scope.");
  } else {
    for (const finding of findingsForReport) {
      const assetName = assetNameById.get(finding.scope.assetId) ?? finding.scope.assetId;
      const networkName = networkNameById.get(finding.scope.networkId) ?? finding.scope.networkId;
      lines.push(
        `- [${finding.id}] P${finding.priorityRank} | SPI ${finding.spiId} | ${finding.severity} | ${finding.complianceStatus} | ${finding.status} | ${finding.timestamp}`
      );
      lines.push(`  - Asset: ${assetName}`);
      lines.push(`  - Network: ${networkName}`);
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
  lines.push("- This report is generated from the Networks page and reflects the active filter scope.");

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const topAction = prioritizedActions[0];

  addVisualSummaryPage({
    pdfDoc,
    pageTitle: "Networks Remediation Report",
    subtitle: "At-a-glance network posture visualisation with compliance mix, finding pressure, and coverage gaps.",
    titleFont: fontBold,
    bodyFont: fontRegular,
    cards: [
      { label: "Compliance Score", value: `${scopedComplianceScore}%`, tone: "good" },
      { label: "Networks in Scope", value: `${scopedNetworks.length}`, tone: "neutral" },
      { label: "Assets in Scope", value: `${scopedAssets.length}`, tone: "neutral" },
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
      `${nonCompliantAssetCount} asset(s) currently carry non-compliance conditions requiring action.`,
      `${discoveryCoverageServerGaps.length} server(s) have discovery tool gaps that may reduce detection confidence.`,
      topAction ? `Most frequent remediation action: ${topAction[0]} (${topAction[1]} occurrence(s)).` : "No recurring remediation action pattern in current scope."
    ]
  });

  const pageTitle = "Networks Remediation Report";
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
