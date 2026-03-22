import { NextRequest } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { buildAnalytics } from "@/lib/analytics";
import { loadCurrentDataset, loadDiscoveryToolsSettings, loadMeasuresSettings } from "@/lib/data-loader";
import { addVisualSummaryPage } from "@/lib/report-pdf-visuals";
import { parseFilters } from "@/lib/selectors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function reportFileName(snapshotDate: string): string {
  const safeDate = snapshotDate.replace(/[^0-9-]/g, "");
  return `ict-system-out-of-support-os-${safeDate}.pdf`;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
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
  const systemsById = new Map(dataset.ictSystems.map((system) => [system.id, system]));
  const assetsById = new Map(dataset.assets.map((asset) => [asset.id, asset]));

  const outOfSupportRows = analytics.evaluations
    .filter((evaluation) => evaluation.assetType === "server" && Boolean(evaluation.systemId))
    .map((evaluation) => {
      const spi1 = evaluation.evaluations.find((item) => item.spiId === 1);
      if (!spi1 || spi1.status !== "Non-compliant") {
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
      const reason = spi1.reasons.join(" | ") || "Operating system is non-compliant for SPI 1.";

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
    "This executive brief identifies scoped ICT system server assets that are non-compliant with SPI 1, indicating operating system support posture gaps requiring remediation action."
  );
  lines.push("");
  lines.push("## Audience");
  lines.push("ICT system owners, infrastructure operations, cyber assurance teams, and remediation coordinators.");
  lines.push("");
  lines.push("## Executive Summary");
  lines.push(
    `The current scope contains ${outOfSupportRows.length} server asset(s) across ${affectedSystems.size} ICT system(s) that are non-compliant with SPI 1. These assets represent elevated security and service continuity risk if support and patch posture is not restored.`
  );
  lines.push("");
  lines.push("## Findings Summary Including Impacts");
  lines.push(
    "Out-of-support or unsupported operating systems reduce patchability, increase exploit exposure, and weaken compliance confidence for critical services. Prolonged non-compliance may drive persistent vulnerability backlog and higher operational recovery effort."
  );
  lines.push("");
  lines.push("## Recommendations to Remediate");
  lines.push(
    "Prioritize OS uplift or platform replacement for affected servers, assign accountable owners and target dates, and enforce interim compensating controls until remediation is complete. Validate closure through repeat SPI 1 compliance checks."
  );
  lines.push("");
  lines.push("## Affected Servers (SPI 1 Non-compliant)");
  if (!outOfSupportRows.length) {
    lines.push("- No servers in the current filtered scope are non-compliant with SPI 1.");
  } else {
    for (const row of outOfSupportRows) {
      lines.push(`- ${row.hostname} (${row.assetId})`);
      lines.push(`  - ICT System: ${row.systemName} (${row.systemId})`);
      lines.push(`  - Environment: ${row.environment}`);
      lines.push(`  - OS: ${row.osName} ${row.osVersion}`);
      lines.push(`  - Support Status: ${row.supportStatus}`);
      lines.push(`  - Evidence: ${row.reason}`);
    }
  }
  lines.push("");
  lines.push("## Notes");
  lines.push("- Scope is aligned to active report filters and server assets only.");

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const outOfSupportCount = supportStatusCounts.get("OutOfSupport") ?? 0;
  const unknownSupportCount = supportStatusCounts.get("Unknown") ?? 0;
  const supportedCount = supportStatusCounts.get("Supported") ?? 0;
  const productionCount = environmentCounts.get("Production") ?? 0;

  addVisualSummaryPage({
    pdfDoc,
    pageTitle: "ICT System out of support OS",
    subtitle: "Server OS support posture visualisation for SPI 1 non-compliant assets in the active scope.",
    titleFont: fontBold,
    bodyFont: fontRegular,
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
      `${outOfSupportRows.length} server asset(s) are SPI 1 non-compliant in the filtered scope.`,
      `${affectedSystems.size} ICT system(s) are impacted by OS support posture gaps.`,
      topImpactedSystems.length
        ? `Most impacted systems: ${topImpactedSystems.map((item) => `${item.name} (${item.count})`).join("; ")}.`
        : "No impacted systems in scope.",
      "Use this visual summary to prioritise OS uplift sequencing and owner assignment."
    ]
  });

  const pageTitle = "ICT System out of support OS";
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
