import { NextRequest } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { buildAnalytics } from "@/lib/analytics";
import { evaluateDiscoveryCoverage } from "@/lib/discovery-coverage";
import { loadCurrentDataset, loadDiscoveryToolsSettings, loadMeasuresSettings } from "@/lib/data-loader";
import { DiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
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

function discoveryCoverageForAsset(asset: Asset, discoveryToolsSettings: DiscoveryToolsSettings) {
  const coverage = evaluateDiscoveryCoverage(asset, discoveryToolsSettings);
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
  const [dataset, measuresSettings, discoveryToolsSettings] = await Promise.all([
    loadCurrentDataset(),
    loadMeasuresSettings(),
    loadDiscoveryToolsSettings()
  ]);
  const queryObject = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseFilters(queryObject);
  const analytics = buildAnalytics(dataset, dataset.ictSystems, filters, measuresSettings, discoveryToolsSettings);
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
      const coverage = discoveryCoverageForAsset(asset, discoveryToolsSettings);
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
  const lines: string[] = [];
  lines.push("# ICT System Scope Remediation Report");
  lines.push("");
  lines.push(`Generated At: ${generatedAt}`);
  lines.push(`Snapshot Date: ${dataset.snapshotDate}`);
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
