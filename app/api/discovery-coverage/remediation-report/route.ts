import { NextRequest } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { buildAnalytics } from "@/lib/analytics";
import { loadCurrentDataset, loadMeasuresSettings } from "@/lib/data-loader";
import { parseFilters } from "@/lib/selectors";
import { Asset } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  const dsocSiem = asset.vulnerabilities.length > 0 ? 1 : 0;
  const elastic = asset.type === "server" || asset.type === "workstation" ? 1 : 0;

  const missingTools: string[] = [];
  if (ucmdb === 0) {
    missingTools.push("UCMDB");
  }
  if (tanium === 0) {
    missingTools.push("Tanium");
  }
  if (tenable === 0) {
    missingTools.push("Tenable");
  }
  if (snow === 0) {
    missingTools.push("SNOW");
  }
  if (serviceNow === 0) {
    missingTools.push("ServiceNow");
  }
  if (dsocSiem === 0) {
    missingTools.push("DSOC SIEM");
  }
  if (elastic === 0) {
    missingTools.push("Elastic");
  }

  return {
    missingTools,
    coverageCompliance: missingTools.length === 0
  };
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
  const [dataset, measuresSettings] = await Promise.all([loadCurrentDataset(), loadMeasuresSettings()]);
  const queryObject = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseFilters(queryObject);
  const analytics = buildAnalytics(dataset, dataset.ictSystems, filters, measuresSettings);

  const networkNameById = new Map(dataset.managedNetworks.map((network) => [network.id, network.name]));
  const systemNameById = new Map(dataset.ictSystems.map((system) => [system.id, system.name]));

  const gapSearch = toSearchTerm(request.nextUrl.searchParams.get("gapSearch"));
  const matrixSearch = toSearchTerm(request.nextUrl.searchParams.get("matrixSearch"));

  const scopedAssetIds = new Set(analytics.evaluations.map((evaluation) => evaluation.assetId));
  const scopedRows = dataset.assets
    .filter((asset) => scopedAssetIds.has(asset.id))
    .map((asset) => {
      const coverage = discoveryCoverageForAsset(asset);
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
        coverage
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
  const lines: string[] = [];
  lines.push("# Discovery Coverage Remediation Report");
  lines.push("");
  lines.push(`Generated At: ${generatedAt}`);
  lines.push(`Snapshot Date: ${dataset.snapshotDate}`);
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
