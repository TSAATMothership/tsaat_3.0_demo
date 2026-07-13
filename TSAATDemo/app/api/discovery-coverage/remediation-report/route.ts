import { NextRequest } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { buildAnalytics } from "@/lib/analytics";
import { discoveryCoverageByAssetId, discoveryCoverageForAssetId } from "@/lib/discovery-coverage";
import { filterDiscoveryAssets, sanitizeDiscoverySearchParams } from "@/lib/discovery-filter-scope";
import {
  loadCurrentDataset,
  loadDiscoveryToolsSettings,
  loadMeasuresSettings,
  loadSeverityDefinitions,
  loadSpiDefinitions
} from "@/lib/data-loader";
import { addVisualSummaryPage } from "@/lib/report-pdf-visuals";
import { parseFilters } from "@/lib/selectors";
import { Asset } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

function reportFileName(snapshotDate: string): string {
  const safeDate = snapshotDate.replace(/[^0-9-]/g, "");
  return `tsaat-discovery-coverage-remediation-report-${safeDate}.pdf`;
}

function toSearchTerm(value: string | null): string {
  return value?.trim() ?? "";
}

function includesSearch(
  text: string,
  term: string
): boolean {
  if (!term) {
    return true;
  }
  return text.toLowerCase().includes(term.toLowerCase());
}

export async function GET(request: NextRequest) {
  const [dataset, discoveryToolsSettings, spiDefinitions, severityDefinitions] = await Promise.all([
    loadCurrentDataset(),
    loadDiscoveryToolsSettings(),
    loadSpiDefinitions(),
    loadSeverityDefinitions()
  ]);
  const measuresSettings = await loadMeasuresSettings(spiDefinitions, severityDefinitions);
  const storedDiscoveryCoverageByAsset = discoveryCoverageByAssetId(dataset.discoveryCoverageEvaluations);
  const queryObject = sanitizeDiscoverySearchParams(Object.fromEntries(request.nextUrl.searchParams.entries()));
  const filters = parseFilters(queryObject);
  const analytics = buildAnalytics(dataset, dataset.ictSystems, filters, spiDefinitions, measuresSettings, discoveryToolsSettings);

  const networkNameById = new Map(dataset.managedNetworks.map((network) => [network.id, network.name]));
  const systemNameById = new Map(dataset.ictSystems.map((system) => [system.id, system.name]));

  const gapSearch = toSearchTerm(request.nextUrl.searchParams.get("gapSearch"));
  const matrixSearch = toSearchTerm(request.nextUrl.searchParams.get("matrixSearch"));

  const scopedAssetIds = new Set(analytics.evaluations.map((evaluation) => evaluation.assetId));
  const scopedRows = filterDiscoveryAssets(dataset.assets.filter((asset) => scopedAssetIds.has(asset.id)))
    .map((asset) => {
      const discoveryCoverage = discoveryCoverageForAssetId(asset.id, storedDiscoveryCoverageByAsset);
      const networkName = networkNameById.get(asset.networkId) ?? asset.networkId;
      const systemId = asset.systemContext?.systemId ?? null;
      const systemName = systemId ? (systemNameById.get(systemId) ?? systemId) : "-";
      const environment = asset.systemContext?.environmentType ?? "-";

      return {
        assetId: asset.id,
        hostname: asset.hostname,
        assetType: asset.type,
        networkName,
        systemName,
        environment,
        coverage: {
          missingTools: discoveryCoverage.missingToolNames,
          coverageCompliance: discoveryCoverage.coverageCompliance
        }
      };
    })
    .sort((a, b) => a.hostname.localeCompare(b.hostname));

  const matrixFilteredRows = scopedRows.filter((row) =>
    includesSearch(
      [row.hostname, row.assetId, row.assetType, row.networkName, row.systemName, row.environment].join(" "),
      matrixSearch
    )
  );

  const coverageGapRows = matrixFilteredRows
    .filter((row) => !row.coverage.coverageCompliance)
    .filter((row) =>
      includesSearch(
        [row.hostname, row.assetId, row.assetType, row.networkName, row.systemName, row.environment, row.coverage.missingTools.join(" ")].join(
          " "
        ),
        gapSearch
      )
    );

  const serverCoverageGapRows = coverageGapRows.filter((row) => row.assetType === "server");
  const toolMissingCounts = new Map<string, number>();
  for (const row of coverageGapRows) {
    for (const tool of row.coverage.missingTools) {
      toolMissingCounts.set(tool, (toolMissingCounts.get(tool) ?? 0) + 1);
    }
  }

  const prioritizedToolActions = Array.from(toolMissingCounts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return a[0].localeCompare(b[0]);
  });

  const compliancePercent = matrixFilteredRows.length
    ? Number((((matrixFilteredRows.length - coverageGapRows.length) / matrixFilteredRows.length) * 100).toFixed(1))
    : 0;

  const generatedAt = new Date().toISOString();
  const topToolActionSummary = prioritizedToolActions
    .slice(0, 3)
    .map(([tool, count]) => `${count}x ${tool}`)
    .join("; ");
  const lines: string[] = [];
  lines.push("# Discovery Coverage Remediation Report");
  lines.push("");
  lines.push("## Report Name");
  lines.push("Discovery Coverage Remediation Report");
  lines.push("");
  lines.push("## Timestamp");
  lines.push(`Generated At: ${generatedAt}`);
  lines.push(`Snapshot Date: ${dataset.snapshotDate}`);
  lines.push("");
  lines.push("## Introduction");
  lines.push(
    "This executive brief provides a concise view of discovery coverage posture for the currently scoped assets and highlights remediation priorities for visibility gaps."
  );
  lines.push("");
  lines.push("## Audience");
  lines.push(
    "Discovery tool owners, CMDB and asset management teams, architecture governance, and cyber operations leadership."
  );
  lines.push("");
  lines.push("## Executive Summary");
  lines.push(
    `Current discovery coverage compliance is ${compliancePercent}% across ${matrixFilteredRows.length} scoped asset(s). ${coverageGapRows.length} asset(s) remain non-compliant for discovery coverage, including ${serverCoverageGapRows.length} server(s), creating material visibility and assurance risk.`
  );
  lines.push("");
  lines.push("## Findings Summary Including Impacts");
  lines.push(
    `Coverage gaps reduce confidence in detection completeness, increase the likelihood of delayed remediation triage, and can mask vulnerable assets from operational workflows. Concentrated missing-tool patterns indicate integration and onboarding bottlenecks that require coordinated resolution.`
  );
  lines.push("");
  lines.push("## Recommendations to Remediate");
  lines.push(
    prioritizedToolActions.length
      ? `Prioritize deployment and integration of the most frequently missing tools on affected assets. Immediate focus should be placed on: ${topToolActionSummary}. Track closure progress against accountable teams and validate coverage uplift in the next reporting cycle.`
      : "Maintain current discovery coverage controls and continue routine validation to prevent regression."
  );
  lines.push("");
  lines.push("## Scope Summary");
  lines.push(`- Assets in Scope: ${matrixFilteredRows.length}`);
  lines.push(`- Coverage Compliant Assets: ${matrixFilteredRows.length - coverageGapRows.length}`);
  lines.push(`- Assets with Coverage Gaps: ${coverageGapRows.length}`);
  lines.push(`- Coverage Compliance Score: ${compliancePercent}%`);
  lines.push(`- Servers with Coverage Gaps: ${serverCoverageGapRows.length}`);
  lines.push("");
  lines.push("## Filters Applied");
  lines.push(`- Network: ${filters.managedNetwork ?? "All"}`);
  lines.push(`- ICT System: ${filters.ictSystem ?? "All"}`);
  lines.push(`- Criticality: ${filters.systemCriticality ?? "All"}`);
  lines.push(`- Security Domain: ${filters.securityDomain ?? "All"}`);
  lines.push(`- Environment: ${filters.environment ?? "All"}`);
  lines.push(`- Asset Type: ${filters.assetType ?? "All"}`);
  lines.push(`- Coverage Gaps Search: ${gapSearch || "None"}`);
  lines.push(`- Matrix Search: ${matrixSearch || "None"}`);
  lines.push("");
  lines.push("## Discovery Coverage Findings Register");

  if (!coverageGapRows.length) {
    lines.push("- No discovery coverage gaps in this filtered scope.");
  } else {
    for (const row of coverageGapRows) {
      lines.push(`- ${row.hostname} (${row.assetId})`);
      lines.push(`  - Type/Environment: ${row.assetType} / ${row.environment}`);
      lines.push(`  - Network/System: ${row.networkName} / ${row.systemName}`);
      lines.push(`  - Missing Tools: ${row.coverage.missingTools.join(", ")}`);
    }
  }

  lines.push("");
  lines.push("## Required Actions to Remediate Non-compliance");
  if (!prioritizedToolActions.length) {
    lines.push("- No remediation actions required for discovery coverage in this scope.");
  } else {
    for (const [tool, count] of prioritizedToolActions) {
      lines.push(`- (${count}) Deploy or integrate ${tool} on affected assets.`);
    }
  }

  lines.push("");
  lines.push("## Server Coverage Gaps");
  if (!serverCoverageGapRows.length) {
    lines.push("- No servers in scope are missing discovery tools.");
  } else {
    for (const row of serverCoverageGapRows) {
      lines.push(`- ${row.hostname} (${row.assetId})`);
      lines.push(`  - Missing Tools: ${row.coverage.missingTools.join(", ")}`);
    }
  }

  lines.push("");
  lines.push("## Notes");
  lines.push(
    "- This report is generated from the Discovery Coverage page and reflects the active filter and text-search scope."
  );

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const topMissingTools = prioritizedToolActions.slice(0, 5).map(([tool, count]) => ({
    label: tool,
    value: count,
    color: [0.21, 0.49, 0.81] as [number, number, number]
  }));

  addVisualSummaryPage({
    pdfDoc,
    pageTitle: "Discovery Coverage Remediation Report",
    subtitle: "Coverage compliance visualisation showing gap concentration, missing tools, and remediation focus areas.",
    titleFont: fontBold,
    bodyFont: fontRegular,
    cards: [
      { label: "Coverage Score", value: `${compliancePercent}%`, tone: "good" },
      { label: "Assets in Scope", value: `${matrixFilteredRows.length}`, tone: "neutral" },
      { label: "Coverage Gaps", value: `${coverageGapRows.length}`, tone: "critical" },
      { label: "Server Gaps", value: `${serverCoverageGapRows.length}`, tone: "warning" }
    ],
    bars: [
      { label: "Coverage Compliant", value: matrixFilteredRows.length - coverageGapRows.length, color: [0.2, 0.62, 0.42] },
      { label: "Coverage Non-compliant", value: coverageGapRows.length, color: [0.82, 0.3, 0.29] },
      ...topMissingTools
    ],
    segments: [
      { label: "Compliant", value: matrixFilteredRows.length - coverageGapRows.length, color: [0.2, 0.62, 0.42] },
      { label: "Non-compliant", value: coverageGapRows.length, color: [0.82, 0.3, 0.29] }
    ],
    insights: [
      `${coverageGapRows.length} asset(s) are non-compliant for discovery coverage in the filtered scope.`,
      `${serverCoverageGapRows.length} server(s) currently have missing discovery tool alignment.`,
      topToolActionSummary ? `Primary missing tool concentration: ${topToolActionSummary}.` : "No missing tool concentration in current scope.",
      "Use these visuals to prioritise tool onboarding and integration sequencing."
    ]
  });

  const pageTitle = "Discovery Coverage Remediation Report";
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
