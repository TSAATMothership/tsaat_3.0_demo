import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { insightsSnapshotTimestamp } from "@/lib/governance-insights-pdf";
import { drawInsightsIcon, drawInsightsOpeningPage, drawInsightsPageFrame, drawInsightsRingArc, INSIGHTS_PDF_THEME, loadInsightsPdfAssets, type InsightsPdfAssets, type InsightsPdfRenderOptions } from "@/lib/insights-pdf-theme";
import type { SoftwareInsightsReportData } from "@/lib/software-insights-report-data";

const LEFT = 36, WIDTH = 523.28, BOTTOM = 58;
const { ink, muted, teal, mint, pale, line, navy } = INSIGHTS_PDF_THEME;
const number = (value: number) => value.toLocaleString("en-AU");
const count = (value: number, noun: string) => `${number(value)} ${noun}${value === 1 ? "" : "s"}`;
const percent = (value: number | null) => value === null ? "N/A" : `${number(value)}%`;

/** Local branded A4 briefing with vector evidence charts and the page's conceptual artwork. */
class SoftwarePdf {
  page!: PDFPage;
  y = 0;
  chapter = "";
  constructor(readonly doc: PDFDocument, readonly regular: PDFFont, readonly bold: PDFFont, readonly data: SoftwareInsightsReportData, readonly assets: InsightsPdfAssets) {}
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
    this.y = drawInsightsPageFrame(this.page, this.assets, { kind: "software", title: "Installed Software Insights", snapshotDate: this.data.model.snapshotDate, section: chapter, continued });
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
      const label = `${count(row.count, "installation")} / ${percent(total ? Math.round(row.count / total * 100) : null)}`;
      this.text(label, LEFT, this.y, 9, false, muted);
      this.page.drawRectangle({ x: LEFT, y: this.y - 15, width: WIDTH, height: 7, color: line });
      if (total && row.count) this.page.drawRectangle({ x: LEFT, y: this.y - 15, width: WIDTH * Math.min(1, row.count / total), height: 7, color: teal });
      this.y -= 38;
    }
  }
  footprint() {
    this.ensure(120); const top = this.y, width = WIDTH / 3;
    this.page.drawRectangle({ x: LEFT, y: top - 108, width: WIDTH, height: 108, color: navy });
    const model = this.data.model;
    [{ value: model.products.length, label: "named software products", icon: "package" },
      { value: model.total, label: "recorded installations", icon: "layers" },
      { value: model.endpoints, label: "endpoints represented", icon: "endpoint" }].forEach((item, index) => {
      const cx = LEFT + width * (index + .5);
      this.footprintIcon(item.icon, cx - 10, top - 30);
      const value = number(item.value), size = Math.min(28, 28 * (width - 30) / Math.max(1, this.bold.widthOfTextAtSize(value, 28)));
      this.text(value, cx - this.bold.widthOfTextAtSize(value, size) / 2, top - 65, size, true, mint);
      this.text(item.label, cx - this.regular.widthOfTextAtSize(item.label, 8) / 2, top - 88, 8, false, mint);
      if (index < 2) this.text(">", LEFT + width * (index + 1) - 3, top - 60, 15, false, mint);
    });
    this.y -= 125;
  }
  footprintIcon(kind: string, x: number, y: number) {
    if (kind === "package") { drawInsightsIcon(this.page, "software", x, y, 20, mint); return; }
    const paths = kind === "layers"
      ? [[[12, 3], [22, 8], [12, 13], [2, 8], [12, 3]], [[2, 12], [12, 17], [22, 12]], [[2, 16], [12, 21], [22, 16]]]
      : [[[3, 3], [21, 3], [21, 16], [3, 16], [3, 3]], [[8, 21], [16, 21]], [[12, 16], [12, 21]], [[7, 7], [17, 7]], [[7, 11], [13, 11]]];
    for (const points of paths) for (let index = 1; index < points.length; index++) this.page.drawLine({
      start: { x: x + points[index - 1][0] * 20 / 24, y: y + (24 - points[index - 1][1]) * 20 / 24 },
      end: { x: x + points[index][0] * 20 / 24, y: y + (24 - points[index][1]) * 20 / 24 }, color: mint, thickness: 1.3 });
  }
  actions(items: Array<{ label: string; count: number; narrative: string }>) {
    const width = (WIDTH - 12) / 2;
    for (let offset = 0; offset < items.length; offset += 2) {
      const group = items.slice(offset, offset + 2);
      const height = 61 + Math.max(...group.map(item => this.wrap(item.narrative, width - 24, 8.5).length * 11.5));
      this.ensure(height + 12);
      group.forEach((item, index) => {
        const x = LEFT + index * (width + 12);
        this.page.drawRectangle({ x, y: this.y - height, width, height, color: pale, borderColor: line, borderWidth: .6 });
        this.page.drawRectangle({ x, y: this.y - height, width: 3, height, color: teal });
        this.text(item.label, x + 12, this.y - 17, 9, true, ink);
        this.text(number(item.count), x + 12, this.y - 44, 24, true, teal);
        this.wrap(item.narrative, width - 24, 8.5).forEach((row, rowIndex) => this.text(row, x + 12, this.y - 61 - rowIndex * 11.5, 8.5));
      });
      this.y -= height + 12;
    }
  }
  versionRing() {
    this.ensure(145); const model = this.data.model, cx = LEFT + 66, cy = this.y - 60, radius = 43;
    this.page.drawCircle({ x: cx, y: cy, size: radius, borderWidth: 7, borderColor: line });
    drawInsightsRingArc(this.page, { x: cx, y: cy, radius, fraction: (model.versionPercent ?? 0) / 100, color: teal, thickness: 7 });
    const value = percent(model.versionPercent);
    this.text(value, cx - this.bold.widthOfTextAtSize(value, 23) / 2, cy - 7, 23, true, teal);
    this.text("Version evidence", LEFT + 143, this.y - 40, 18, true);
    this.text(`Recorded versions: ${number(model.knownVersion)} of ${count(model.total, "installation")}.`, LEFT + 143, this.y - 65, 10, false, muted);
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

export async function createSoftwareInsightsPdf(data: SoftwareInsightsReportData, generatedAt = new Date(), options: InsightsPdfRenderOptions = {}): Promise<Uint8Array> {
  if (!Number.isFinite(generatedAt.getTime())) throw new Error("Invalid PDF generation timestamp");
  const doc = await PDFDocument.create(), regular = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle("Software Insights"); doc.setAuthor("TSAAT"); doc.setProducer("TSAAT executive reporting");
  doc.setCreationDate(generatedAt); doc.setModificationDate(generatedAt);
  doc.setSubject(`Snapshot ${data.model.snapshotDate}; snapshot timestamp ${insightsSnapshotTimestamp(data.snapshotGeneratedAt)}`);
  const assets = await loadInsightsPdfAssets(doc, "software", options), pdf = new SoftwarePdf(doc, regular, bold, data, assets), model = data.model;
  const scopeLines = [
    ...(data.scopeLabels.networks.length ? ["Managed networks: " + data.scopeLabels.networks.join("; ")] : []),
    ...(data.scopeLabels.systems.length ? ["ICT systems: " + data.scopeLabels.systems.join("; ")] : []),
    "Security domains: " + (data.scopeLabels.domains.join(", ") || "None selected")
  ];
  drawInsightsOpeningPage(doc, assets, {
    kind: "software", title: "Installed Software Insights", snapshotDate: model.snapshotDate, generatedAt, scopeLines,
    summary: [
      model.total
        ? `The selected software evidence contains ${count(model.total, "recorded installation")}, ${count(model.products.length, "named product")} and ${count(model.endpoints, "represented endpoint")}. The three largest named products account for ${percent(Math.round(model.topThree / model.total * 100))} of all installations. These figures describe the recorded footprint; endpoints without software records are outside this view.`
        : "No software evidence is available in this selection. Product and endpoint counts are zero and percentages are N/A because there is no installation denominator. This does not establish that no software is installed.",
      `Version evidence is present for ${number(model.knownVersion)} of ${count(model.total, "installation")}; ${count(model.versionSpread.length, "named product")} ${model.versionSpread.length === 1 ? "has" : "have"} multiple recorded versions. Product names are missing from ${count(model.unnamed, "installation")}. Version variation and missing metadata identify review questions, not confirmed vulnerabilities, unsupported products or licence issues.`
    ],
    recommendations: [
      model.total
        ? `Begin with the widely installed products and review the ${count(model.versionSpread.length, "product")} with recorded version variation. Confirm owners, deployment purpose and compatibility before proposing a common version or an inventory change.`
        : "Confirm the selected scope and snapshot, then verify software collection in Installed Software Explorer. Establish installation evidence before drawing conclusions about coverage, concentration or software consistency.",
      `Review ${count(model.missingVersion, "missing version")} and ${count(model.unnamed, "unnamed installation")}. Validate ${count(model.stale, "observation")} older than 30 days, ${count(model.undated, "missing or invalid date")} and ${count(model.afterSnapshot, "future-dated record")} against the selected snapshot.`,
      `Check ${count(model.missingSource, "missing discovery source")} and ${count(model.missingPath, "missing path")} with the collection owners. Preserve zero counts as evidence of no recorded gap in this selection. Priorities overlap; do not add them into a total of affected installations.`
    ]
  });

  pdf.pageFor("01 / The software footprint");
  if (!model.total) pdf.paragraph("No software evidence is available in this selection.", 12, true, ink);
  scopeLines.forEach(scope => pdf.paragraph(scope, 9));
  pdf.paragraph(`Snapshot timestamp: ${insightsSnapshotTimestamp(data.snapshotGeneratedAt)}`, 9);
  pdf.paragraph(`PDF generated: ${generatedAt.toISOString().replace("T", " ").replace("Z", " UTC")}`, 9);
  pdf.heading("01 / Understand the footprint");
  pdf.paragraph(`One inventory contains ${count(model.products.length, "named product")} across ${count(model.total, "installation record")} and ${count(model.endpoints, "endpoint")}. A product can appear on many endpoints, and multiple installations on one endpoint remain separate records. The flow shows these different units, not a measured topology.`);
  pdf.footprint();
  pdf.metrics([
    { label: "Product identity", value: number(model.unnamed), detail: `${count(model.unnamed, "installation")} ${model.unnamed === 1 ? "has" : "have"} no product name` },
    { label: "Version recorded", value: percent(model.versionPercent), detail: `${number(model.knownVersion)} of ${count(model.total, "installation")}` }]);
  pdf.paragraph(`The footprint follows the evidence. Endpoints without software records are outside this view, so these counts do not measure overall endpoint coverage. ${model.unnamed ? "Unnamed installations remain in the installation total, but cannot contribute to named-product counts, concentration or version variation." : "No unnamed installations are recorded in this selection; product names still represent recorded values rather than a verified catalogue."}`, 9);

  pdf.pageFor("02 / Product concentration");
  pdf.heading("02 / See where installations concentrate");
  pdf.paragraph(`The three largest named products account for ${number(model.topThree)} of ${count(model.total, "installation")}, or all named products if fewer than three are recorded. Their combined share is ${percent(model.total ? Math.round(model.topThree / model.total * 100) : null)}. Widely installed products are a useful starting point for owner-led reviews because a change can affect many installations.`);
  pdf.metrics([{ label: "Top three named products", value: percent(model.total ? Math.round(model.topThree / model.total * 100) : null), detail: `${number(model.topThree)} of ${number(model.total)} installations` },
    { label: "Other or unnamed installations", value: number(model.total - model.topThree), detail: "Records outside the three largest named products" }]);
  pdf.heading("Leading products");
  pdf.paragraph(`The ranked bars show ${Math.min(3, model.products.length)} of ${count(model.products.length, "named product")}. Each bar uses all ${count(model.total, "installation record")} as its denominator. Records outside these leading named products: ${number(model.total - model.topThree)}.`, 9);
  pdf.bars(model.products.slice(0, 3), model.total);
  pdf.paragraph("Shares use all installations, including unnamed records. Concentration describes the inventory, not licence or business criticality.", 9);

  pdf.pageFor("03 / Version consistency");
  pdf.heading("03 / Make version variation visible");
  pdf.paragraph(`${count(model.versionSpread.length, "named product")} ${model.versionSpread.length === 1 ? "has" : "have"} multiple recorded versions. Variation alone does not prove that a version is outdated or vulnerable.`, 11, true, ink);
  pdf.paragraph("Each product in this list has at least two distinct, non-missing versions. Compare deployment purpose, ownership and compatibility before deciding whether a common version is appropriate. The recorded differences direct the review; they do not establish its outcome.");
  pdf.heading("Follow the recorded differences");
  if (!model.versionSpread.length) pdf.paragraph("No named products with multiple recorded versions in this selection.");
  for (const row of model.versionSpread.slice(0, 3)) {
    pdf.ensure(64); pdf.paragraph(row.value, 11, true, teal);
    pdf.paragraph(`${count(row.versions, "version")} / ${count(row.count, "installation")} / ${count(row.endpoints, "endpoint")}`, 9);
  }
  pdf.paragraph("Showing up to three products ranked by distinct known versions, then installations and name. Missing versions do not count as a distinct version.", 9);
  pdf.heading("How to read these insights");
  pdf.paragraph("Counts use recorded product/version values without merging spelling or case variants. Missing names are excluded from named-product analysis while their installations remain in the total. This briefing describes inventory evidence; it does not assert licence compliance, support status, version currency or CVE exposure. N/A means no installation denominator.", 9);
  pdf.paragraph("Use Installed Software Explorer at the same scope and snapshot to inspect the underlying records. The report's local software terrain artwork is the page's conceptual illustration, not a measured dependency or impact map.", 9);

  pdf.pageFor("04 / Evidence priorities");
  pdf.heading("04 / Strengthen the evidence before acting");
  pdf.paragraph(`Version evidence is present for ${number(model.knownVersion)} of ${count(model.total, "installation")}. ${model.missingVersion ? "Missing versions limit precise software matching." : model.total ? "Every recorded installation has a version." : "No installation denominator is available."} A version entry alone does not establish currency, support or absence of vulnerabilities.`, 9);
  pdf.versionRing();
  pdf.actions([
    { label: "Identify the version", count: model.missingVersion, narrative: model.missingVersion ? "Installations lack a version. Complete version evidence before precise software matching." : "No missing versions are recorded. Maintain version collection to support precise software matching." },
    { label: "Refresh older observations", count: model.stale, narrative: model.stale ? "Discoveries are over 30 days old. Confirm the inventory still reflects the endpoint." : "No discoveries are over 30 days old. Continue checking dates against each selected snapshot." },
    { label: "Restore discovery dates", count: model.undated, narrative: model.undated ? "Dates are missing or invalid. Establish when each installation was observed." : "No missing or invalid dates are recorded. Preserve observation dates when refreshing evidence." },
    { label: "Check future-dated evidence", count: model.afterSnapshot, narrative: model.afterSnapshot ? "Dates fall after this snapshot. Review collection timestamps and snapshot alignment." : "No dates fall after this snapshot. Retain timestamp and snapshot alignment during updates." },
    { label: "Record the source", count: model.missingSource, narrative: model.missingSource ? "Installations lack a discovery source. Confirm which collection tool supplied each record." : "No discovery sources are missing. Retain provenance when combining collection outputs." },
    { label: "Locate the installation", count: model.missingPath, narrative: model.missingPath ? "Installations lack a file path. Add location evidence where the collection tool can supply it." : "No file paths are missing. Preserve location evidence where supported by the discovery tool." }
  ]);
  pdf.paragraph("Evidence priorities overlap: an installation can appear in more than one count. Discovery age is relative to the selected snapshot, not the export date.", 9);
  pdf.footer(); return doc.save();
}
