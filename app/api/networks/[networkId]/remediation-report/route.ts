import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { buildAnalytics } from "@/lib/analytics";
import { loadCurrentDataset, loadMeasuresSettings } from "@/lib/data-loader";
import { Asset, ComplianceStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type KpiFilterKey =
  | "nonCompliantAssets"
  | "nonCompliantServers"
  | "nonCompliantOs"
  | "nonCompliantEnvironments"
  | "p12Findings"
  | "highRiskP12Findings"
  | "outOfWarrantyAssets"
  | "nonCompliantDiscoveryCoverage";

const KPI_FILTER_LABELS: Record<KpiFilterKey, string> = {
  nonCompliantAssets: "Total Non-compliant Assets",
  nonCompliantServers: "Total Non-compliant Servers",
  nonCompliantOs: "Total Non-compliant OS",
  nonCompliantEnvironments: "Total Non-compliant Environments",
  p12Findings: "Total P1-P2 Findings",
  highRiskP12Findings: "Total P1-P2 High Risk Findings",
  outOfWarrantyAssets: "Total Physical Assets Out of Warranty",
  nonCompliantDiscoveryCoverage: "Assets non-compliant with discovery coverage"
};

function isKpiFilterKey(value: string | undefined): value is KpiFilterKey {
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

function discoveryCoverageForAsset(asset: Asset) {
  const ucmdb = asset.systemContext?.systemId ? 1 : 0;
  const tanium = asset.type === "server" || asset.type === "workstation" ? 1 : 0;
  const tenable = asset.vulnerabilities.some((vulnerability) =>
    ["Nessus", "Qualys", "OpenVAS"].includes(vulnerability.source)
  )
    ? 1
    : 0;
  const snow = asset.lifecycle.warrantyStatus !== "Unknown" ? 1 : 0;
  const serviceNow = asset.lifecycle.eolStatus !== "Unknown" ? 1 : 0;
  const coverageCompliance = ucmdb === 1 && tanium === 1 && tenable === 1 && snow === 1 && serviceNow === 1;

  return {
    ucmdb,
    tanium,
    tenable,
    snow,
    serviceNow,
    coverageCompliance
  };
}

function reportFileName(networkId: string, snapshotDate: string): string {
  const safeId = networkId.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const safeDate = snapshotDate.replace(/[^0-9-]/g, "");
  return `dct-remediation-report-network-${safeId}-${safeDate}.pdf`;
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
  { params }: { params: { networkId: string } }
) {
  const [dataset, measuresSettings] = await Promise.all([loadCurrentDataset(), loadMeasuresSettings()]);
  const network = dataset.managedNetworks.find((item) => item.id === params.networkId);

  if (!network) {
    return NextResponse.json({ error: "Managed network not found." }, { status: 404 });
  }

  const analytics = buildAnalytics(dataset, dataset.ictSystems, { managedNetwork: network.id }, measuresSettings);
  const assets = dataset.assets.filter((asset) => asset.networkId === network.id);
  const assetNameById = new Map(assets.map((asset) => [asset.id, asset.hostname]));
  const evaluationByAssetId = new Map(analytics.evaluations.map((evaluation) => [evaluation.assetId, evaluation]));
  const allFindings = analytics.findings;
  const requestedKpiFilter = request.nextUrl.searchParams.get("kpiFilter") ?? undefined;
  const selectedKpiFilter = isKpiFilterKey(requestedKpiFilter) ? requestedKpiFilter : undefined;
  const p12AssetIds = new Set(
    allFindings.filter((finding) => finding.priorityRank <= 2).map((finding) => finding.scope.assetId)
  );
  const highRiskP12AssetIds = new Set(
    allFindings
      .filter((finding) => finding.priorityRank <= 2 && finding.severity === "High Risk")
      .map((finding) => finding.scope.assetId)
  );
  const nonCompliantEnvironmentTypes = new Set(
    (["Production", "Development", "UAT", "Test"] as const).filter((environmentType) => {
      const statuses = analytics.evaluations
        .filter((evaluation) => evaluation.environmentType === environmentType)
        .flatMap((evaluation) => evaluation.evaluations.map((evaluationItem) => evaluationItem.status));
      return overallStatusFromStatuses(statuses) === "Non-compliant";
    })
  );

  const matchesSelectedKpiFilter = (asset: (typeof assets)[number]): boolean => {
    if (!selectedKpiFilter) {
      return true;
    }
    if (selectedKpiFilter === "nonCompliantAssets") {
      const evaluation = evaluationByAssetId.get(asset.id);
      if (!evaluation) {
        return false;
      }
      return evaluation.evaluations.some((evaluationItem) => evaluationItem.status === "Non-compliant");
    }
    if (selectedKpiFilter === "nonCompliantServers") {
      if (asset.type !== "server") {
        return false;
      }
      const evaluation = evaluationByAssetId.get(asset.id);
      if (!evaluation) {
        return false;
      }
      return evaluation.evaluations.some((evaluationItem) => evaluationItem.status === "Non-compliant");
    }
    if (selectedKpiFilter === "nonCompliantOs") {
      if (asset.type !== "server" && asset.type !== "workstation") {
        return false;
      }
      const evaluation = evaluationByAssetId.get(asset.id);
      if (!evaluation) {
        return false;
      }
      return evaluation.evaluations.some(
        (evaluationItem) =>
          (evaluationItem.spiId === 1 || evaluationItem.spiId === 2) && evaluationItem.status === "Non-compliant"
      );
    }
    if (selectedKpiFilter === "nonCompliantEnvironments") {
      const environmentType = asset.systemContext?.environmentType;
      return environmentType ? nonCompliantEnvironmentTypes.has(environmentType) : false;
    }
    if (selectedKpiFilter === "p12Findings") {
      return p12AssetIds.has(asset.id);
    }
    if (selectedKpiFilter === "highRiskP12Findings") {
      return highRiskP12AssetIds.has(asset.id);
    }
    if (selectedKpiFilter === "outOfWarrantyAssets") {
      return asset.lifecycle.warrantyStatus === "OutOfWarranty";
    }
    if (selectedKpiFilter === "nonCompliantDiscoveryCoverage") {
      return !discoveryCoverageForAsset(asset).coverageCompliance;
    }
    return true;
  };

  const scopedAssets = selectedKpiFilter ? assets.filter((asset) => matchesSelectedKpiFilter(asset)) : assets;
  const scopedAssetIds = new Set(scopedAssets.map((asset) => asset.id));
  const findings = allFindings.filter((finding) => scopedAssetIds.has(finding.scope.assetId));
  const p12Findings = findings.filter((finding) => finding.priorityRank <= 2);
  const highRiskFindings = findings.filter((finding) => finding.severity === "High Risk");
  const nonCompliantFindings = findings.filter((finding) => finding.complianceStatus === "Non-compliant");

  const scopedStatuses = analytics.evaluations
    .filter((evaluation) => scopedAssetIds.has(evaluation.assetId))
    .flatMap((evaluation) => evaluation.evaluations.map((evaluationItem) => evaluationItem.status));
  const scopedComplianceScore = complianceScore(scopedStatuses);
  const scopedPosture = overallStatusFromStatuses(scopedStatuses);

  const nonCompliantAssetCount = scopedAssets.filter((asset) => {
    const evaluation = evaluationByAssetId.get(asset.id);
    return evaluation ? evaluation.evaluations.some((item) => item.status === "Non-compliant") : false;
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

  const discoveryCoverageServerGaps = scopedAssets
    .filter((asset) => asset.type === "server")
    .map((asset) => {
      const coverage = discoveryCoverageForAsset(asset);
      const missingTools: string[] = [];
      if (coverage.ucmdb === 0) {
        missingTools.push("UCMDB");
      }
      if (coverage.tanium === 0) {
        missingTools.push("Tanium");
      }
      if (coverage.tenable === 0) {
        missingTools.push("Tenable");
      }
      if (coverage.snow === 0) {
        missingTools.push("SNOW");
      }
      if (coverage.serviceNow === 0) {
        missingTools.push("ServiceNow");
      }
      return {
        assetId: asset.id,
        hostname: asset.hostname,
        missingTools
      };
    })
    .filter((item) => item.missingTools.length > 0)
    .sort((a, b) => a.hostname.localeCompare(b.hostname));

  const maxFindingsInReport = 200;
  const findingsForReport = findings.slice(0, maxFindingsInReport);
  const isFindingsTruncated = findings.length > findingsForReport.length;

  const generatedAt = new Date().toISOString();
  const lines: string[] = [];
  lines.push("# Network Remediation Report");
  lines.push("");
  lines.push(`Generated At: ${generatedAt}`);
  lines.push(`Snapshot Date: ${dataset.snapshotDate}`);
  lines.push("");
  lines.push("## Network Summary");
  lines.push(`- Network: ${network.name} (${network.id})`);
  lines.push(`- Classification: ${network.classification ?? "Unspecified"}`);
  lines.push(`- Compliance Score (Scoped): ${scopedComplianceScore}%`);
  lines.push(`- Overall Posture (Scoped): ${scopedPosture}`);
  lines.push(`- Assets in Scope: ${scopedAssets.length}`);
  lines.push(`- Assets with Non-compliance: ${nonCompliantAssetCount}`);
  lines.push(`- Findings in Scope: ${findings.length}`);
  lines.push(`- P1-P2 Findings in Scope: ${p12Findings.length}`);
  lines.push(`- High Risk Findings in Scope: ${highRiskFindings.length}`);
  lines.push("");
  lines.push("## Filters Applied");
  lines.push(`- Network: ${network.name} (${network.id})`);
  lines.push(`- KPI Filter: ${selectedKpiFilter ? KPI_FILTER_LABELS[selectedKpiFilter] : "None"}`);
  lines.push("- Drill-through Context: Network scope");
  lines.push("");
  lines.push("## Findings Register (Scoped)");

  if (!findingsForReport.length) {
    lines.push("- No findings in the current scope.");
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
  lines.push("- This report is generated from the current network drill-through scope.");

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageTitle = `${network.name} Remediation Report`;
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
  const filename = reportFileName(network.id, dataset.snapshotDate);

  return new Response(pdfArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=${filename}`
    }
  });
}
