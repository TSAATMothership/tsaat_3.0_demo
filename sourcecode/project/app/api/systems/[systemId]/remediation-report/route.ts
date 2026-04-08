import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { buildAnalytics } from "@/lib/analytics";
import { evaluateDiscoveryCoverage } from "@/lib/discovery-coverage";
import { loadCurrentDataset, loadDiscoveryToolsSettings, loadMeasuresSettings } from "@/lib/data-loader";
import { DiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { Asset, ComplianceStatus, EnvironmentType } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type KpiFilterKey =
  | "nonCompliantServers"
  | "nonCompliantOs"
  | "nonCompliantEnvironments"
  | "p12Findings"
  | "highRiskP12Findings"
  | "outOfWarrantyAssets"
  | "nonCompliantDiscoveryCoverage";

const KPI_FILTER_LABELS: Record<KpiFilterKey, string> = {
  nonCompliantServers: "Total Non-compliant Servers",
  nonCompliantOs: "Total Non-compliant OS",
  nonCompliantEnvironments: "Total Non-compliant Environments",
  p12Findings: "Total P1-P2 Findings",
  highRiskP12Findings: "Total P1-P2 High Risk Findings",
  outOfWarrantyAssets: "Total Physical Assets Out of Warranty",
  nonCompliantDiscoveryCoverage: "Assets non-compliant with discovery coverage"
};

function isKpiFilterKey(value: string | null): value is KpiFilterKey {
  if (!value) {
    return false;
  }
  return value in KPI_FILTER_LABELS;
}

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

function nonCompliantEnvironmentTypesForScope(
  environments: Array<{ type: EnvironmentType }>,
  evaluations: Array<{
    assetId: string;
    environmentType: EnvironmentType | null;
    evaluations: Array<{ status: ComplianceStatus }>;
  }>,
  scopedAssetIds: Set<string>
): Set<EnvironmentType> {
  const nonCompliant = new Set<EnvironmentType>();
  for (const environment of environments) {
    const statuses = evaluations
      .filter(
        (evaluation) => evaluation.environmentType === environment.type && scopedAssetIds.has(evaluation.assetId)
      )
      .flatMap((evaluation) => evaluation.evaluations.map((evaluationItem) => evaluationItem.status));

    if (overallStatusFromStatuses(statuses) === "Non-compliant") {
      nonCompliant.add(environment.type);
    }
  }
  return nonCompliant;
}

function discoveryCoverageForAsset(asset: Asset, discoveryToolsSettings: DiscoveryToolsSettings) {
  const coverage = evaluateDiscoveryCoverage(asset, discoveryToolsSettings);
  return {
    missingTools: coverage.missingToolNames,
    coverageCompliance: coverage.coverageCompliance
  };
}

function reportFileName(systemId: string, snapshotDate: string): string {
  const safeId = systemId.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const safeDate = snapshotDate.replace(/[^0-9-]/g, "");
  return `dct-remediation-report-${safeId}-${safeDate}.pdf`;
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

export async function GET(
  request: NextRequest,
  { params }: { params: { systemId: string } }
) {
  const [dataset, measuresSettings, discoveryToolsSettings] = await Promise.all([
    loadCurrentDataset(),
    loadMeasuresSettings(),
    loadDiscoveryToolsSettings()
  ]);
  const system = dataset.ictSystems.find((item) => item.id === params.systemId);

  if (!system) {
    return NextResponse.json({ error: "ICT System not found." }, { status: 404 });
  }

  const analytics = buildAnalytics(
    dataset,
    dataset.ictSystems,
    { ictSystem: system.id },
    measuresSettings,
    discoveryToolsSettings
  );
  const assets = dataset.assets.filter((asset) => asset.systemContext?.systemId === system.id);
  const assetNameById = new Map(assets.map((asset) => [asset.id, asset.hostname]));
  const evaluationByAssetId = new Map(analytics.evaluations.map((evaluation) => [evaluation.assetId, evaluation]));
  const allFindings = analytics.findings;
  const p12Findings = allFindings.filter((finding) => finding.priorityRank <= 2);

  const requestedEnvironment = request.nextUrl.searchParams.get("environment");
  const selectedEnvironment = system.environments.some((environment) => environment.type === requestedEnvironment)
    ? (requestedEnvironment as EnvironmentType)
    : undefined;
  const requestedKpiFilter = request.nextUrl.searchParams.get("kpiFilter");
  const selectedKpiFilter = isKpiFilterKey(requestedKpiFilter) ? requestedKpiFilter : undefined;
  const serverSearchTerm = request.nextUrl.searchParams.get("serverSearch")?.trim() ?? "";
  const normalizedServerSearchTerm = serverSearchTerm.toLowerCase();

  const searchMatchedAssets = normalizedServerSearchTerm
    ? assets.filter((asset) => {
        if (asset.type !== "server") {
          return false;
        }
        return (
          asset.hostname.toLowerCase().includes(normalizedServerSearchTerm) ||
          asset.id.toLowerCase().includes(normalizedServerSearchTerm)
        );
      })
    : assets;
  const searchMatchedAssetIds = new Set(searchMatchedAssets.map((asset) => asset.id));

  const searchMatchedFindings = p12Findings.filter((finding) => searchMatchedAssetIds.has(finding.scope.assetId));
  const searchMatchedP12AssetIds = new Set(searchMatchedFindings.map((finding) => finding.scope.assetId));
  const searchMatchedHighRiskP12AssetIds = new Set(
    searchMatchedFindings
      .filter((finding) => finding.severity === "High Risk")
      .map((finding) => finding.scope.assetId)
  );

  const nonCompliantEnvironmentTypes = nonCompliantEnvironmentTypesForScope(
    system.environments,
    analytics.evaluations,
    searchMatchedAssetIds
  );

  const matchesSelectedKpiFilter = (asset: Asset): boolean => {
    if (!selectedKpiFilter) {
      return true;
    }

    if (selectedKpiFilter === "nonCompliantServers") {
      if (asset.type !== "server") {
        return false;
      }
      const evaluation = evaluationByAssetId.get(asset.id);
      return evaluation ? evaluation.evaluations.some((item) => item.status === "Non-compliant") : false;
    }

    if (selectedKpiFilter === "nonCompliantOs") {
      if (asset.type !== "server" && asset.type !== "workstation") {
        return false;
      }
      const evaluation = evaluationByAssetId.get(asset.id);
      return evaluation
        ? evaluation.evaluations.some(
            (item) => (item.spiId === 1 || item.spiId === 2) && item.status === "Non-compliant"
          )
        : false;
    }

    if (selectedKpiFilter === "nonCompliantEnvironments") {
      const environmentType = asset.systemContext?.environmentType;
      return environmentType ? nonCompliantEnvironmentTypes.has(environmentType) : false;
    }

    if (selectedKpiFilter === "p12Findings") {
      return searchMatchedP12AssetIds.has(asset.id);
    }

    if (selectedKpiFilter === "highRiskP12Findings") {
      return searchMatchedHighRiskP12AssetIds.has(asset.id);
    }

    if (selectedKpiFilter === "outOfWarrantyAssets") {
      return asset.lifecycle.warrantyStatus === "OutOfWarranty";
    }

    if (selectedKpiFilter === "nonCompliantDiscoveryCoverage") {
      return !discoveryCoverageForAsset(asset, discoveryToolsSettings).coverageCompliance;
    }

    return true;
  };

  const kpiMatchedAssets = selectedKpiFilter
    ? searchMatchedAssets.filter((asset) => matchesSelectedKpiFilter(asset))
    : searchMatchedAssets;

  const filteredAssets = selectedEnvironment
    ? kpiMatchedAssets.filter((asset) => asset.systemContext?.environmentType === selectedEnvironment)
    : kpiMatchedAssets;
  const filteredAssetIds = new Set(filteredAssets.map((asset) => asset.id));

  const scopedStatuses = analytics.evaluations
    .filter((evaluation) => filteredAssetIds.has(evaluation.assetId))
    .filter((evaluation) => !selectedEnvironment || evaluation.environmentType === selectedEnvironment)
    .flatMap((evaluation) => evaluation.evaluations.map((evaluationItem) => evaluationItem.status));
  const scopedComplianceScore = complianceScore(scopedStatuses);
  const scopedPosture = overallStatusFromStatuses(scopedStatuses);

  const scopedFindings = allFindings.filter((finding) => {
    if (!filteredAssetIds.has(finding.scope.assetId)) {
      return false;
    }
    if (selectedEnvironment && finding.scope.environmentType !== selectedEnvironment) {
      return false;
    }
    return true;
  });

  const nonCompliantScopedFindings = scopedFindings.filter((finding) => finding.complianceStatus === "Non-compliant");
  const p12ScopedFindings = scopedFindings.filter((finding) => finding.priorityRank <= 2);
  const highRiskScopedFindings = scopedFindings.filter((finding) => finding.severity === "High Risk");

  const nonCompliantAssetCount = filteredAssets.filter((asset) => {
    const evaluation = evaluationByAssetId.get(asset.id);
    return evaluation ? evaluation.evaluations.some((item) => item.status === "Non-compliant") : false;
  }).length;

  const actionCounts = new Map<string, number>();
  for (const finding of nonCompliantScopedFindings) {
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

  const maxFindingsInReport = 200;
  const findingsForReport = scopedFindings.slice(0, maxFindingsInReport);
  const isFindingsTruncated = scopedFindings.length > findingsForReport.length;

  const generatedAt = new Date().toISOString();
  const lines: string[] = [];
  lines.push("# ICT System Remediation Report");
  lines.push("");
  lines.push(`Generated At: ${generatedAt}`);
  lines.push(`Snapshot Date: ${dataset.snapshotDate}`);
  lines.push("");
  lines.push("## ICT System Summary");
  lines.push(`- ICT System: ${system.name} (${system.id})`);
  lines.push(`- Network: ${system.networkId}`);
  lines.push(`- Compliance Score (Filtered Scope): ${scopedComplianceScore}%`);
  lines.push(`- Overall Posture (Filtered Scope): ${scopedPosture}`);
  lines.push(`- Assets in Scope: ${filteredAssets.length}`);
  lines.push(`- Assets with Non-compliance: ${nonCompliantAssetCount}`);
  lines.push(`- Findings in Scope: ${scopedFindings.length}`);
  lines.push(`- P1-P2 Findings in Scope: ${p12ScopedFindings.length}`);
  lines.push(`- High Risk Findings in Scope: ${highRiskScopedFindings.length}`);
  lines.push("");
  lines.push("## Filters Applied");
  lines.push(`- Environment: ${selectedEnvironment ?? "All Environments"}`);
  lines.push(`- Server Search: ${serverSearchTerm || "None"}`);
  lines.push(`- KPI Filter: ${selectedKpiFilter ? KPI_FILTER_LABELS[selectedKpiFilter] : "None"}`);
  lines.push("");
  lines.push("## Findings Register (Scoped)");

  if (!findingsForReport.length) {
    lines.push("- No findings in the current filtered scope.");
  } else {
    for (const finding of findingsForReport) {
      const assetName = assetNameById.get(finding.scope.assetId) ?? finding.scope.assetId;
      lines.push(
        `- [${finding.id}] P${finding.priorityRank} | SPI ${finding.spiId} | ${finding.severity} | ${finding.complianceStatus} | ${finding.status} | ${finding.timestamp}`
      );
      lines.push(`  - Asset: ${assetName}`);
      lines.push(`  - Environment: ${finding.scope.environmentType ?? "-"}`);
      lines.push(`  - Finding: ${finding.title}`);
      lines.push(`  - Recommended Action: ${finding.recommendedAction}`);
    }
  }

  if (isFindingsTruncated) {
    lines.push(
      `- Report truncated to first ${maxFindingsInReport} findings. Total scoped findings: ${scopedFindings.length}.`
    );
  }

  lines.push("");
  lines.push("## Required Actions to Remediate Non-compliance");
  if (!prioritizedActions.length) {
    lines.push("- No non-compliant findings in the current scope.");
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
  lines.push(
    "- This report is generated from the current ICT System drill-through scope and reflects all active page filters."
  );

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageTitle = `${system.name} Remediation Report`;
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
  const filename = reportFileName(system.id, dataset.snapshotDate);

  return new Response(pdfArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=${filename}`
    }
  });
}
