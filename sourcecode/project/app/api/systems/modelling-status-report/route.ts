import { NextRequest } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { loadCurrentDataset } from "@/lib/data-loader";
import { addVisualSummaryPage } from "@/lib/report-pdf-visuals";
import { filterSystems, parseFilters } from "@/lib/selectors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function reportFileName(snapshotDate: string): string {
  const safeDate = snapshotDate.replace(/[^0-9-]/g, "");
  return `ict-system-modelling-status-${safeDate}.pdf`;
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
  const dataset = await loadCurrentDataset();

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

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  addVisualSummaryPage({
    pdfDoc,
    pageTitle: "ICT System Modelling Status",
    subtitle: "DIIS registration versus modelling coverage visualisation for the currently filtered ICT system scope.",
    titleFont: fontBold,
    bodyFont: fontRegular,
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
  });

  const pageTitle = "ICT System Modelling Status";
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
