import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";

export type InsightsReportKind = "cyber" | "software" | "discovery" | "endpoint" | "vulnerability";
const hex = (value: number) => rgb((value >> 16 & 255) / 255, (value >> 8 & 255) / 255, (value & 255) / 255);
/** Print surfaces retain the Insights page palette while keeping body text legible on paper. */
export const INSIGHTS_PDF_THEME = {
  ink: hex(0x122d40), navy: hex(0x0a1c2d), muted: hex(0x496171), line: hex(0xd4e4e9),
  pale: hex(0xf0f7f9), teal: hex(0x137e83), mint: hex(0x85e9d5), rose: hex(0xbb425a),
  amber: hex(0x94600a), white: rgb(1, 1, 1),
};
const artwork: Record<InsightsReportKind, string> = {
  cyber: "cyber-terrain", software: "software-terrain", discovery: "discovery-terrain",
  endpoint: "endpoint-evidence", vulnerability: "vulnerability-evidence",
};
export interface InsightsPdfAssets {
  logo: PDFImage;
  heroes: Partial<Record<InsightsReportKind, PDFImage>>;
  regular: PDFFont;
  bold: PDFFont;
}

/** Only bundled assets are read: PDF generation never starts a browser or fetches remote images. */
export async function loadInsightsPdfAssets(doc: PDFDocument, kind?: InsightsReportKind): Promise<InsightsPdfAssets> {
  const root = path.join(process.cwd(), "public");
  const logo = await doc.embedPng(Uint8Array.from(await readFile(path.join(root, "tsaat-logo.png"))));
  const kinds = kind ? [kind] : Object.keys(artwork) as InsightsReportKind[];
  const images = await Promise.all(kinds.map(async key => doc.embedPng(Uint8Array.from(await readFile(path.join(root, "insights-report-art", `${artwork[key]}.png`))))));
  const heroes: InsightsPdfAssets["heroes"] = {};
  kinds.forEach((key, index) => { heroes[key] = images[index]; });
  return { logo, heroes, regular: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };
}

function safe(value: string, font: PDFFont) {
  return Array.from(value.normalize("NFKC").replace(/[\u2010-\u2015]/g, "-").replace(/[\r\n\t]/g, " "))
    .map(char => { try { font.encodeText(char); return char; } catch { return "?"; } }).join("");
}
function wrap(value: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = []; let line = "";
  for (const word of safe(value, font).split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue; }
    if (line) lines.push(line); line = "";
    for (const char of word) {
      if (line && font.widthOfTextAtSize(line + char, size) > width) { lines.push(line); line = ""; }
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines;
}
function text(page: PDFPage, font: PDFFont, value: string, x: number, y: number, size: number, color: RGB) {
  page.drawText(safe(value, font), { x, y, size, font, color });
}

/** Equivalent line symbols to the web briefings, drawn as vectors at print resolution. */
export function drawInsightsIcon(page: PDFPage, kind: InsightsReportKind, x: number, y: number, size: number, color = INSIGHTS_PDF_THEME.mint) {
  const paths: Record<InsightsReportKind, string> = {
    cyber: "M12 2 L21 6 L21 12 C21 18 12 22 12 22 C12 22 3 18 3 12 L3 6 Z M8 12 L11 15 L16 9",
    software: "M12 2 L22 7 L22 17 L12 22 L2 17 L2 7 Z M2 7 L12 12 L22 7 M12 12 L12 22 M7 4.5 L17 9.5",
    discovery: "M12 2 A10 10 0 1 0 22 12 M12 7 A5 5 0 1 0 17 12 M12 12 L21 3 M12 2 L12 4 M2 12 L4 12 M12 20 L12 22",
    endpoint: "M3 3 L21 3 L21 16 L3 16 Z M12 16 L12 21 M7 21 L17 21 M6 7 L18 7",
    vulnerability: "M12 2 L21 6 L21 12 C21 18 12 22 12 22 C12 22 3 18 3 12 L3 6 Z M12 7 L12 13 M12 16 L12 17",
  };
  page.drawSvgPath(paths[kind], { x, y: y + size, scale: size / 24, borderColor: color, borderWidth: 1.6 });
}

export function drawInsightsHero(page: PDFPage, assets: InsightsPdfAssets, kind: InsightsReportKind, box: { x: number; y: number; width: number; height: number }) {
  const image = assets.heroes[kind];
  if (!image) throw new Error(`Missing bundled illustration for ${kind} Insights.`);
  const scale = Math.min(box.width / image.width, box.height / image.height);
  const width = image.width * scale, height = image.height * scale;
  page.drawImage(image, { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height });
}

/** A single stroked path prevents print-renderer seams between separate arc segments. */
export function drawInsightsRingArc(page: PDFPage, options: { x: number; y: number; radius: number; fraction: number; thickness: number; color: RGB }) {
  const fraction=Math.max(0,Math.min(1,options.fraction)),segments=120;
  if(fraction<=0) return;
  const path=Array.from({length:Math.ceil(fraction*segments)+1},(_,index)=>{
    const angle=Math.PI/2-Math.min(index/segments,fraction)*Math.PI*2;
    return (index ? "L" : "M")+(Math.cos(angle)*options.radius)+" "+(-Math.sin(angle)*options.radius);
  }).join(" ");
  page.drawSvgPath(path,{x:options.x,y:options.y,borderColor:options.color,borderWidth:options.thickness});
}

interface FrameOptions { kind: InsightsReportKind; title: string; snapshotDate: string; section?: string; continued?: boolean }
export function drawInsightsPageFrame(page: PDFPage, assets: InsightsPdfAssets, options: FrameOptions): number {
  const t = INSIGHTS_PDF_THEME;
  page.drawRectangle({ x: 0, y: 688, width: 595.28, height: 153.89, color: t.navy });
  page.drawRectangle({ x: 0, y: 685, width: 595.28, height: 3, color: t.mint });
  const logo = assets.logo.scaleToFit(34, 34);
  page.drawImage(assets.logo, { x: 36, y: 788, ...logo });
  text(page, assets.bold, "TSAAT", 80, 807, 12, t.white);
  text(page, assets.regular, "GOVERNANCE / INSIGHTS", 80, 792, 7.4, t.mint);
  const stamp = `Snapshot ${options.snapshotDate}`;
  text(page, assets.regular, stamp, 559 - assets.regular.widthOfTextAtSize(stamp, 8), 807, 8, t.white);
  drawInsightsHero(page, assets, options.kind, { x: 419, y: 696, width: 140, height: 102 });
  const title = options.title.replace(/ Report$/, "");
  wrap(title, assets.bold, 23, 363).forEach((row, index) => text(page, assets.bold, row, 36, 755 - index * 28, 23, index ? t.mint : t.white));
  text(page, assets.regular, "Evidence-led decisions. A clearer picture.", 36, 703, 8.4, t.mint);
  let y = 657;
  if (options.section) {
    drawInsightsIcon(page, options.kind, 36, y - 2, 20, t.teal);
    for (const row of wrap(options.section + (options.continued ? " - continued" : ""), assets.bold, 15, 492)) {
      text(page, assets.bold, row, 67, y, 15, t.ink); y -= 20;
    }
    y -= 10;
  }
  return y;
}

interface OpeningOptions extends Omit<FrameOptions, "section" | "continued"> {
  generatedAt: Date;
  scopeLines: string[];
  summary: string[];
  recommendations: string[];
}
export function drawInsightsOpeningPage(doc: PDFDocument, assets: InsightsPdfAssets, options: OpeningOptions): void {
  const page = doc.addPage([595.28, 841.89]), t = INSIGHTS_PDF_THEME;
  const top = drawInsightsPageFrame(page, assets, { ...options, section: undefined });
  const bottom = 62, gap = 18, height = (top - bottom - gap) / 2, width = 523.28;
  const panel = (title: string, paragraphs: string[], panelTop: number, recommendation: boolean) => {
    page.drawRectangle({ x: 36, y: panelTop - height, width, height, color: t.pale, borderColor: t.line, borderWidth: .7 });
    page.drawRectangle({ x: 36, y: panelTop - height, width: 4, height, color: recommendation ? t.teal : t.mint });
    drawInsightsIcon(page, options.kind, 50, panelTop - 38, 22, t.teal);
    text(page, assets.bold, title, 83, panelTop - 30, 16, t.ink);
    let y = panelTop - 55;
    if (!recommendation) {
      const scope = options.scopeLines.join(" | ");
      const scopeRows = wrap(scope || "Applied scope details follow.", assets.regular, 8, width - 32);
      const line = scopeRows.length > 1 ? "Applied scope and security domains are detailed on the following page." : scopeRows[0];
      text(page, assets.regular, line, 52, y, 8, t.muted); y -= 18;
    }
    const available = y - (panelTop - height + 16);
    let size = 10.5;
    const needed = (fontSize: number) => paragraphs.reduce((sum, p) => sum + wrap(p, assets.regular, fontSize, width - 32).length * (fontSize + 4) + 9, 0);
    while (needed(size) > available && size > 8.5) size -= .25;
    if (needed(size) > available) throw new Error(`Insights ${title.toLowerCase()} exceeds its half-page narrative space.`);
    for (const paragraph of paragraphs) {
      for (const line of wrap(paragraph, assets.regular, size, width - 32)) {
        text(page, assets.regular, line, 52, y, size, t.ink); y -= size + 4;
      }
      y -= 9;
    }
  };
  panel("Executive summary", options.summary, top, false);
  panel("Recommendations", options.recommendations, top - height - gap, true);
  text(page, assets.regular, `PDF generated: ${options.generatedAt.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC")}`, 36, 47, 7.2, t.muted);
}
