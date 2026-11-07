import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { insightsSnapshotTimestamp } from "@/lib/governance-insights-pdf";
import type { SoftwareInsightsReportData } from "@/lib/software-insights-report-data";

const LEFT = 36, WIDTH = 523.28, BOTTOM = 58;
const ink = rgb(.055, .16, .23), muted = rgb(.33, .42, .48), teal = rgb(.035, .46, .43);
const mint = rgb(.50, .88, .77), pale = rgb(.95, .975, .98), line = rgb(.82, .88, .90), white = rgb(1, 1, 1);
const number = (value: number) => value.toLocaleString("en-AU");
const percent = (value: number | null) => value === null ? "N/A" : `${number(value)}%`;

/** Vector-only A4 briefing: no browser, remote assets or additional inventory rules. */
class SoftwarePdf {
  page!: PDFPage;
  y = 0;
  chapter = "";
  constructor(readonly doc: PDFDocument, readonly regular: PDFFont, readonly bold: PDFFont, readonly data: SoftwareInsightsReportData) {}
  safe(value: string) {
    return Array.from(value.normalize("NFKC").replace(/[\u2010-\u2015]/g, "-").replace(/[\r\n\t]/g, " "))
      .map(char => { try { this.regular.encodeText(char); return char; } catch { return "?"; } }).join("");
  }
  wrap(value: string, width: number, size: number, font = this.regular) {
    const rows: string[] = []; let current = "";
    for (const word of this.safe(value).split(/\s+/).filter(Boolean)) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) { current = next; continue; }
      if (current) rows.push(current); current = "";
      for (const char of word) {
        if (current && font.widthOfTextAtSize(current + char, size) > width) { rows.push(current); current = ""; }
        current += char;
      }
    }
    if (current) rows.push(current);
    return rows.length ? rows : [""];
  }
  text(value: string, x: number, y: number, size = 10, bold = false, color = ink) {
    this.page.drawText(this.safe(value), { x, y, size, font: bold ? this.bold : this.regular, color });
  }
  pageFor(chapter: string, continued = false) {
    this.chapter = chapter; this.page = this.doc.addPage([595.28, 841.89]);
    this.text("TSAAT", LEFT, 806, 14, true, teal);
    this.text("DISCOVERY / SOFTWARE INSIGHTS", LEFT, 790, 7, true, muted);
    const stamp = `Snapshot ${this.data.model.snapshotDate}`;
    this.text(stamp, LEFT + WIDTH - this.regular.widthOfTextAtSize(stamp, 8), 803, 8, false, muted);
    this.page.drawLine({ start: { x: LEFT, y: 779 }, end: { x: LEFT + WIDTH, y: 779 }, thickness: .7, color: line });
    this.y = 754;
    this.paragraph(chapter + (continued ? " - continued" : ""), 18, true, ink);
  }
  ensure(height: number) { if (this.y - height < BOTTOM) this.pageFor(this.chapter, true); }
  paragraph(value: string, size = 10, bold = false, color = muted) {
    for (const row of this.wrap(value, WIDTH, size, bold ? this.bold : this.regular)) {
      this.ensure(size + 6); this.text(row, LEFT, this.y, size, bold, color); this.y -= size + 4;
    }
    this.y -= 9;
  }
  heading(value: string) { this.ensure(65); this.paragraph(value, 13, true, teal); }
  metrics(items: Array<{ label: string; value: string; detail: string }>) {
    const width = (WIDTH - 12) / 2;
    for (let offset = 0; offset < items.length; offset += 2) {
      const group = items.slice(offset, offset + 2);
      const height = 78 + Math.max(...group.map(item => this.wrap(item.detail, width - 24, 9).length * 13));
      this.ensure(height + 14);
      group.forEach((item, index) => {
        const x = LEFT + index * (width + 12);
        this.page.drawRectangle({ x, y: this.y - height, width, height, color: pale, borderColor: line, borderWidth: .6 });
        this.page.drawRectangle({ x, y: this.y - height, width: 3, height, color: teal });
        this.text(item.label, x + 12, this.y - 18, 9, true, muted);
        const size = Math.min(28, 28 * (width - 24) / Math.max(1, this.bold.widthOfTextAtSize(item.value, 28)));
        this.text(item.value, x + 12, this.y - 52, size, true, teal);
        this.wrap(item.detail, width - 24, 9).forEach((row, i) => this.text(row, x + 12, this.y - 74 - i * 13, 9, false, muted));
      });
      this.y -= height + 14;
    }
  }
  bars(rows: Array<{ value: string; count: number }>, total: number) {
    if (!rows.length) { this.paragraph("No named products in this selection."); return; }
    for (const row of rows) {
      // Paragraph flow also handles labels longer than a whole page.
      this.ensure(60); this.paragraph(row.value, 10, true, ink); this.ensure(35);
      const label = `${number(row.count)} installations / ${percent(total ? Math.round(row.count / total * 100) : null)}`;
      this.text(label, LEFT, this.y, 9, false, muted);
      this.page.drawRectangle({ x: LEFT, y: this.y - 15, width: WIDTH, height: 7, color: line });
      if (total && row.count) this.page.drawRectangle({ x: LEFT, y: this.y - 15, width: WIDTH * Math.min(1, row.count / total), height: 7, color: teal });
      this.y -= 38;
    }
  }
  hero() {
    this.ensure(174); const top = this.y;
    this.page.drawRectangle({ x: LEFT, y: top - 164, width: WIDTH, height: 164, color: ink });
    this.text("Software", LEFT + 20, top - 45, 32, true, white);
    this.text("Insights.", LEFT + 20, top - 87, 39, true, mint);
    this.text("Know the footprint. Strengthen the evidence.", LEFT + 22, top - 119, 10, false, white);
    this.text("DISCOVER / UNDERSTAND / VERIFY", LEFT + 22, top - 143, 7, true, mint);
    const cx = LEFT + WIDTH - 80;
    for (let index = 0; index < 3; index++) {
      const cy = top - 49 - index * 26, w = 32 + index * 12;
      const points = [{ x: cx, y: cy + 19 }, { x: cx + w, y: cy }, { x: cx, y: cy - 19 }, { x: cx - w, y: cy }, { x: cx, y: cy + 19 }];
      for (let i = 1; i < points.length; i++) this.page.drawLine({ start: points[i - 1], end: points[i], color: mint, thickness: 1 });
    }
    this.y -= 185;
  }
  versionRing() {
    this.ensure(145); const model = this.data.model, cx = LEFT + 66, cy = this.y - 60, radius = 43;
    this.page.drawCircle({ x: cx, y: cy, size: radius, borderWidth: 7, borderColor: line });
    for (let i = 0; i < Math.round((model.versionPercent ?? 0) / 100 * 120); i++) {
      const from = Math.PI / 2 - i / 120 * Math.PI * 2, to = Math.PI / 2 - (i + 1) / 120 * Math.PI * 2;
      this.page.drawLine({ start: { x: cx + radius * Math.cos(from), y: cy + radius * Math.sin(from) }, end: { x: cx + radius * Math.cos(to), y: cy + radius * Math.sin(to) }, color: teal, thickness: 7 });
    }
    const value = percent(model.versionPercent);
    this.text(value, cx - this.bold.widthOfTextAtSize(value, 23) / 2, cy - 7, 23, true, teal);
    this.text("Version evidence", LEFT + 143, this.y - 40, 18, true);
    this.text(`${number(model.knownVersion)} of ${number(model.total)} installations have a recorded version.`, LEFT + 143, this.y - 65, 10, false, muted);
    this.text("Completeness is evidence quality, not version currency.", LEFT + 143, this.y - 86, 9, false, muted);
    this.y -= 133;
  }
  footer() {
    const pages = this.doc.getPages();
    pages.forEach((page, index) => {
      this.page = page;
      page.drawLine({ start: { x: LEFT, y: 43 }, end: { x: LEFT + WIDTH, y: 43 }, thickness: .6, color: line });
      this.text(`Snapshot timestamp: ${insightsSnapshotTimestamp(this.data.snapshotGeneratedAt)}`, LEFT, 29, 7, false, muted);
      const label = `${index + 1} / ${pages.length}`;
      this.text(label, LEFT + WIDTH - this.regular.widthOfTextAtSize(label, 8), 29, 8, false, muted);
    });
  }
}

export async function createSoftwareInsightsPdf(data: SoftwareInsightsReportData, generatedAt = new Date()): Promise<Uint8Array> {
  if (!Number.isFinite(generatedAt.getTime())) throw new Error("Invalid PDF generation timestamp");
  const doc = await PDFDocument.create(), regular = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle("Software Insights"); doc.setAuthor("TSAAT"); doc.setProducer("TSAAT executive reporting");
  doc.setCreationDate(generatedAt); doc.setModificationDate(generatedAt);
  doc.setSubject(`Snapshot ${data.model.snapshotDate}; snapshot timestamp ${insightsSnapshotTimestamp(data.snapshotGeneratedAt)}`);
  const pdf = new SoftwarePdf(doc, regular, bold, data), model = data.model;
  pdf.pageFor("Inventory intelligence briefing"); pdf.hero();
  if (!model.total) pdf.paragraph("No software evidence is available in this selection.", 12, true, ink);
  if (data.scopeLabels.networks.length) pdf.paragraph("Managed networks: " + data.scopeLabels.networks.join("; "), 9);
  if (data.scopeLabels.systems.length) pdf.paragraph("ICT systems: " + data.scopeLabels.systems.join("; "), 9);
  pdf.paragraph("Security domains: " + (data.scopeLabels.domains.join(", ") || "None selected"), 9);
  pdf.paragraph(`Snapshot timestamp: ${insightsSnapshotTimestamp(data.snapshotGeneratedAt)}`, 9);
  pdf.paragraph(`PDF generated: ${generatedAt.toISOString().replace("T", " ").replace("Z", " UTC")}`, 9);
  pdf.heading("01 / Understand the footprint");
  pdf.metrics([{ label: "Recorded installations", value: number(model.total), detail: "Software / endpoint entries" },
    { label: "Named products", value: number(model.products.length), detail: `${number(model.unnamed)} installations have no product name` },
    { label: "Endpoints represented", value: number(model.endpoints), detail: "Endpoints with software records" },
    { label: "Version recorded", value: percent(model.versionPercent), detail: `${number(model.knownVersion)} of ${number(model.total)} installations` }]);
  pdf.paragraph("One product can have many installations across endpoints. Endpoints without software records are outside this footprint.", 9);

  pdf.pageFor("Product concentration & version variation");
  pdf.heading("02 / See where installations concentrate");
  pdf.metrics([{ label: "Top three named products", value: percent(model.total ? Math.round(model.topThree / model.total * 100) : null), detail: `${number(model.topThree)} of ${number(model.total)} installations` },
    { label: "Other or unnamed installations", value: number(model.total - model.topThree), detail: "Records outside the three largest named products" }]);
  pdf.bars(model.products.slice(0, 3), model.total);
  pdf.paragraph("Shares use all installations, including unnamed records. Concentration describes the inventory, not licence or business criticality.", 9);
  pdf.heading("03 / Make version variation visible");
  pdf.paragraph(`${number(model.versionSpread.length)} named products have multiple recorded versions. Variation alone does not prove that a version is outdated or vulnerable.`, 11, true, ink);
  if (!model.versionSpread.length) pdf.paragraph("No named products with multiple recorded versions in this selection.");
  for (const row of model.versionSpread.slice(0, 3)) {
    pdf.ensure(64); pdf.paragraph(row.value, 11, true, teal);
    pdf.paragraph(`${number(row.versions)} versions / ${number(row.count)} installations / ${number(row.endpoints)} endpoints`, 9);
  }
  pdf.paragraph("Showing up to three products ranked by distinct known versions, then installations and name. Missing versions do not count as a distinct version.", 9);

  pdf.pageFor("Evidence priorities");
  pdf.heading("04 / Strengthen the evidence before acting"); pdf.versionRing();
  pdf.metrics([
    { label: "Identify the version", value: number(model.missingVersion), detail: "Installations with no version recorded" },
    { label: "Refresh older observations", value: number(model.stale), detail: "Discoveries over 30 days old at this snapshot" },
    { label: "Restore discovery dates", value: number(model.undated), detail: "Installations with missing or invalid dates" },
    { label: "Check future-dated evidence", value: number(model.afterSnapshot), detail: "Discovery dates after the selected snapshot" },
    { label: "Record the source", value: number(model.missingSource), detail: "Installations with no discovery source recorded" },
    { label: "Locate the installation", value: number(model.missingPath), detail: "Installations with no file path recorded" }
  ]);
  pdf.paragraph("Evidence priorities overlap: an installation can appear in more than one count. Discovery age is relative to the selected snapshot, not the export date.", 9);
  pdf.paragraph("How to read these insights", 11, true, ink);
  pdf.paragraph("Counts use recorded product/version values without merging spelling or case variants. This briefing describes inventory evidence; it does not assert licence compliance, support status, version currency or CVE exposure. N/A means no installation denominator. Use Installed Software Explorer to inspect the underlying records.", 9);
  pdf.footer(); return doc.save();
}
