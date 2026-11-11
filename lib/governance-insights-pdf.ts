import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { formatAssetTypeLabel } from "@/lib/asset-taxonomy";
import type { CyberInsightsDocumentData as GovernanceInsightsData } from "@/lib/documents/insights";
import { drawInsightsHero, drawInsightsOpeningPage, drawInsightsPageFrame, drawInsightsRingArc, INSIGHTS_PDF_THEME, loadInsightsPdfAssets, type InsightsPdfAssets, type InsightsPdfRenderOptions } from "@/lib/insights-pdf-theme";

const LEFT = 36, WIDTH = 523.28, BOTTOM = 57;
const { ink, muted, line, teal, rose, amber, pale } = INSIGHTS_PDF_THEME;
const grey = rgb(.47, .55, .61);
const number = (value: number) => value.toLocaleString("en-AU");
const percent = (value: number | null) => value === null ? "N/A" : `${number(value)}%`;

/** Do not invent a clock time from a date-only or timezone-less source value. */
export function insightsSnapshotTimestamp(value: string | null | undefined): string {
  if (!value || !/T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return "Not recorded";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().replace("T", " ").replace("Z", " UTC") : "Not recorded";
}

type Metric = { label: string; value: string; detail?: string; color?: RGB };
class InsightsPdf {
  page!: PDFPage;
  y = 0;
  chapter = "";
  chapterNumber = "";
  constructor(readonly doc: PDFDocument, readonly regular: PDFFont, readonly bold: PDFFont, readonly data: GovernanceInsightsData, readonly assets: InsightsPdfAssets) {}
  safe(value: string) {
    return Array.from(value.normalize("NFKC").replace(/[\u2010-\u2015]/g, "-").replace(/[\r\n\t]/g, " "))
      .map(char => { try { this.regular.encodeText(char); return char; } catch { return "?"; } }).join("");
  }
  wrap(value: string, width: number, size = 10, font = this.regular): string[] {
    const result: string[] = []; let current = "";
    for (const word of this.safe(value).split(/\s+/).filter(Boolean)) {
      const next = current ? current + " " + word : word;
      if (font.widthOfTextAtSize(next, size) <= width) { current = next; continue; }
      if (current) result.push(current); current = "";
      for (const char of word) {
        if (current && font.widthOfTextAtSize(current + char, size) > width) { result.push(current); current = ""; }
        current += char;
      }
    }
    if (current) result.push(current);
    return result.length ? result : [""];
  }
  text(value: string, x: number, y: number, size = 10, bold = false, color = ink) {
    this.page.drawText(this.safe(value), { x, y, size, font: bold ? this.bold : this.regular, color });
  }
  block(value: string, x: number, top: number, width: number, size = 10, bold = false, color = muted) {
    const rows = this.wrap(value, width, size, bold ? this.bold : this.regular);
    rows.forEach((row, index) => this.text(row, x, top - index * (size + 4), size, bold, color));
    return rows.length * (size + 4);
  }
  pageFor(chapter: string, index = "", continued = false) {
    this.chapter = chapter; this.chapterNumber = index;
    this.page = this.doc.addPage([595.28, 841.89]);
    this.y = drawInsightsPageFrame(this.page, this.assets, {
      kind: "cyber", title: "Cyber Terrain Insights", snapshotDate: this.data.model.snapshotDate,
      section: (index ? `${index} / ` : "") + chapter, continued
    });
  }
  ensure(height: number) { if (this.y - height < BOTTOM) this.pageFor(this.chapter, this.chapterNumber, true); }
  paragraph(value: string, size = 10, color = muted, bold = false) {
    for (const row of this.wrap(value, WIDTH, size, bold ? this.bold : this.regular)) {
      this.ensure(size + 6); this.text(row, LEFT, this.y, size, bold, color); this.y -= size + 4;
    }
    this.y -= 9;
  }
  heading(value: string) { this.ensure(62); this.paragraph(value, 12, ink, true); }
  metrics(items: Metric[], columns = 2) {
    const gap = 12, width = (WIDTH - (columns - 1) * gap) / columns;
    for (let offset = 0; offset < items.length; offset += columns) {
      const group = items.slice(offset, offset + columns);
      const height = Math.max(...group.map(item => 67 + this.wrap(item.label, width - 24, 8, this.bold).length * 11
        + (item.detail ? this.wrap(item.detail, width - 24, 8).length * 11 : 0)));
      this.ensure(height + 14);
      group.forEach((item, index) => {
        const x = LEFT + index * (width + gap), color = item.color ?? teal;
        this.page.drawRectangle({ x, y: this.y - height, width, height, color: pale, borderColor: line, borderWidth: .6 });
        this.page.drawRectangle({ x, y: this.y - height, width: 3, height, color });
        const labelHeight = this.block(item.label, x + 12, this.y - 17, width - 24, 8, true, muted);
        const valueSize = Math.min(29, 29 * (width - 24) / Math.max(1, this.bold.widthOfTextAtSize(this.safe(item.value), 29)));
        this.text(item.value, x + 12, this.y - 24 - labelHeight - valueSize, valueSize, true, color);
        if (item.detail) this.block(item.detail, x + 12, this.y - 38 - labelHeight - valueSize, width - 24, 8);
      });
      this.y -= height + 14;
    }
  }
  bars(rows: Array<{ label: string; count: number; color?: RGB }>, total: number) {
    if (!rows.length) { this.paragraph("No records in this selection."); return; }
    for (const row of rows) {
      // Full labels flow above the bar, including long configured severity names.
      const labels = this.wrap(row.label, WIDTH - 70, 9);
      if (labels.length > 30) { this.paragraph(row.label, 9, ink); this.ensure(35); }
      else { this.ensure(labels.length * 13 + 25); this.block(row.label, LEFT, this.y, WIDTH - 70, 9, false, ink); this.y -= (labels.length - 1) * 13; }
      const count = number(row.count);
      this.text(count, LEFT + WIDTH - this.bold.widthOfTextAtSize(count, 9), this.y, 9, true, row.color ?? teal);
      this.page.drawRectangle({ x: LEFT, y: this.y - 15, width: WIDTH, height: 6, color: line });
      if (total > 0 && row.count > 0) this.page.drawRectangle({ x: LEFT, y: this.y - 15, width: WIDTH * Math.min(1, row.count / total), height: 6, color: row.color ?? teal });
      this.y -= 26;
    }
    this.y -= 6;
  }
  coverageRing() {
    const { coverage } = this.data.model, height = 110, cx = LEFT + 72, radius = 42;
    this.ensure(height + 15);
    const cy = this.y - 54;
    this.page.drawRectangle({ x: LEFT, y: this.y - height, width: WIDTH, height, color: pale, borderColor: line, borderWidth: .6 });
    this.page.drawCircle({ x: cx, y: cy, size: radius, borderWidth: 8, borderColor: line });
    drawInsightsRingArc(this.page, { x: cx, y: cy, radius, fraction: (coverage.percent ?? 0) / 100, color: teal, thickness: 8 });
    const value = percent(coverage.percent);
    this.text(value, cx - this.bold.widthOfTextAtSize(value, 21) / 2, cy + 1, 21, true, teal);
    this.text("required checks", cx - 35, cy - 18, 8, false, muted); this.text("covered", cx - 17, cy - 30, 8, false, muted);
    this.block(`${number(coverage.gaps)} CIs have coverage gaps`, LEFT + 145, this.y - 28, WIDTH - 163, 14, true, ink);
    this.block(`${number(coverage.coveredChecks)} of ${number(coverage.applicableChecks)} required tool checks are covered. Coverage uses the configured tool-to-CI mappings.`, LEFT + 145, this.y - 57, WIDTH - 163, 10);
    this.y -= height + 18;
  }
  tools() {
    const tools = this.data.model.coverage.tools, width = (WIDTH - 12) / 2;
    if (!tools.length) { this.paragraph("N/A - no discovery tools apply to this selection."); return; }
    for (let offset = 0; offset < tools.length; offset += 2) {
      const group = tools.slice(offset, offset + 2), labels = group.map(tool => this.wrap(tool.label, width - 24, 10, this.bold));
      const narratives = group.map(tool => tool.applicable
        ? `${number(tool.covered)} of ${number(tool.applicable)} applicable CIs are covered; ${number(tool.missing)} ${tool.missing === 1 ? "has" : "have"} a coverage gap to review.`
        : "No CIs in this scope require this tool under the configured mappings. Coverage is N/A.");
      const height = Math.max(...group.map((_, index) => 72 + labels[index].length * 14 + this.wrap(narratives[index], width - 24, 8).length * 12));
      if (height > 500) {
        for (const [index, tool] of group.entries()) { this.paragraph(tool.label, 11, ink, true); this.metrics([{ label: "Covered", value: percent(tool.applicable ? tool.coveragePercent : null), detail: `${number(tool.covered)} / ${number(tool.applicable)} CIs` }, { label: "Coverage gaps", value: number(tool.missing), color: amber }]); this.paragraph(narratives[index], 9); }
        continue;
      }
      this.ensure(height + 12);
      group.forEach((tool, index) => {
        const x = LEFT + index * (width + 12);
        this.page.drawRectangle({ x, y: this.y - height, width, height, color: pale, borderColor: line, borderWidth: .6 });
        this.block(tool.label, x + 12, this.y - 20, width - 24, 10, true, ink);
        const base = this.y - 14 * labels[index].length;
        this.text(percent(tool.applicable ? tool.coveragePercent : null), x + 12, base - 40, 27, true, teal);
        this.page.drawRectangle({ x: x + 12, y: base - 57, width: width - 24, height: 6, color: line });
        if (tool.applicable && tool.covered) this.page.drawRectangle({ x: x + 12, y: base - 57, width: (width - 24) * Math.min(1, tool.covered / tool.applicable), height: 6, color: teal });
        this.block(narratives[index], x + 12, base - 73, width - 24, 8, false, tool.missing ? amber : muted);
      });
      this.y -= height + 12;
    }
  }
  hero() {
    this.ensure(188);
    drawInsightsHero(this.page, this.assets, "cyber", { x: LEFT, y: this.y - 174, width: WIDTH, height: 174 });
    this.y -= 188;
  }
  footer() {
    const pages = this.doc.getPages(), timestamp = insightsSnapshotTimestamp(this.data.snapshotGeneratedAt);
    pages.forEach((page, index) => {
      this.page = page;
      page.drawLine({ start: { x: LEFT, y: 43 }, end: { x: LEFT + WIDTH, y: 43 }, thickness: .6, color: line });
      this.text(`Snapshot timestamp: ${timestamp}`, LEFT, 29, 7, false, muted);
      const label = `${index + 1} / ${pages.length}`;
      this.text(label, LEFT + WIDTH - this.regular.widthOfTextAtSize(label, 8), 29, 8, false, muted);
    });
  }
}

/** Uses existing projections, local page artwork and vector charts; no runtime browser or network assets. */
export async function createGovernanceInsightsPdf(data: GovernanceInsightsData, generatedAt = new Date(), options: InsightsPdfRenderOptions = {}): Promise<Uint8Array> {
  if (!Number.isFinite(generatedAt.getTime())) throw new Error("Invalid PDF generation timestamp");
  const doc = await PDFDocument.create(), regular = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle("Cyber Terrain Posture - Insights"); doc.setAuthor("TSAAT"); doc.setProducer("TSAAT executive reporting");
  doc.setCreationDate(generatedAt); doc.setModificationDate(generatedAt);
  doc.setSubject(`Snapshot ${data.model.snapshotDate}; snapshot timestamp ${insightsSnapshotTimestamp(data.snapshotGeneratedAt)}`);
  const assets = await loadInsightsPdfAssets(doc, "cyber", options);
  const pdf = new InsightsPdf(doc, regular, bold, data, assets);
  const { coverage, endpoints, software, vulnerabilities, patches, shadow } = data.model, { insights, impact } = data;
  const summary = insights.hasEvidence ? [
    `The selected snapshot records ${number(endpoints.total)} endpoints, ${number(insights.priority)} system-linked critical/high findings and ${number(vulnerabilities.total)} CVE observations. Priority findings are linked to ${number(insights.prioritySystems)} ICT systems, ${number(insights.exposedServices)} business services and ${number(insights.exposedCapabilities)} mission capabilities. These recorded associations guide investigation; they do not predict outages.`,
    `Required discovery-check coverage is ${percent(coverage.percent)}, with ${number(coverage.gaps)} CIs showing gaps. ${number(patches.patched)} of ${number(patches.total)} servers are verified patched; ${number(patches.unknown)} have unknown status. Missing or incomplete evidence remains visible throughout this briefing. Findings, observations, checks and servers are separate populations, not a combined risk score.`
  ] : [
    "No evidence is available in this selection. The report retains the selected scope and snapshot so readers can distinguish an empty evidence base from a confirmed result. Zero records do not establish compliance or the absence of exposure.",
    "The following chapters explain visibility, findings, service relationships and patch assurance using the available snapshot. Measures without an applicable denominator remain N/A. No posture conclusion can be drawn until the scope and collection evidence have been confirmed."
  ];
  const recommendations = insights.actions.length ? insights.actions.map(action => action.detail) : [
    insights.hasEvidence ? "Review lower-severity findings and evidence completeness even though this briefing identifies no priority triggers. Confirm that collection and configured discovery requirements remain appropriate for the selected scope." : "Confirm the selected networks, ICT systems, security domains and snapshot, then validate discovery collection and the arrival of source evidence before making a posture decision.",
    "Assign evidence owners, agree a review date and verify the next snapshot against the supporting explorers. Maintain explicit unknown states until records support a conclusion; an empty result is not an assurance statement."
  ];
  if (recommendations.length === 1) recommendations.push("Assign an accountable owner and a review date for the action. Confirm completion using the supporting explorer and the next selected snapshot, while retaining unknown and unmapped evidence for follow-up.");
  drawInsightsOpeningPage(doc, assets, {
    kind: "cyber", title: "Cyber Terrain Insights", snapshotDate: data.model.snapshotDate, generatedAt,
    scopeLines: [
      ...(data.scopeLabels.networks.length ? ["Managed networks: " + data.scopeLabels.networks.join("; ")] : []),
      ...(data.scopeLabels.systems.length ? ["ICT systems: " + data.scopeLabels.systems.join("; ")] : []),
      "Security domains: " + (data.scopeLabels.domains.join(", ") || "None selected")
    ], summary, recommendations
  });

  pdf.pageFor("Executive briefing"); pdf.hero();
  pdf.paragraph(insights.hasEvidence ? insights.headline : "No evidence is available in this selection.", 12, ink, true);
  pdf.paragraph("Read visibility, exposure, service context and resilience together. Each chapter uses a different evidence population; the headline measures below are complementary signals and must not be added together.", 9);
  pdf.paragraph(`Snapshot timestamp: ${insightsSnapshotTimestamp(data.snapshotGeneratedAt)}`, 9);
  pdf.paragraph(`PDF generated: ${generatedAt.toISOString().replace("T", " ").replace("Z", " UTC")}`, 9);
  if (data.scopeLabels.networks.length) pdf.paragraph("Managed networks: " + data.scopeLabels.networks.join("; "), 9);
  if (data.scopeLabels.systems.length) pdf.paragraph("ICT systems: " + data.scopeLabels.systems.join("; "), 9);
  pdf.paragraph("Security domains: " + (data.scopeLabels.domains.join(", ") || "None selected"), 9);
  pdf.metrics([{ label: "Endpoints observed", value: number(endpoints.total), detail: "Inventory records in scope" },
    { label: "Priority findings", value: number(insights.priority), detail: "System-linked critical / high", color: rose },
    { label: "CVE observations", value: number(vulnerabilities.total), detail: `${number(vulnerabilities.distinctCves)} distinct codes`, color: amber },
    { label: "Verified patched", value: percent(patches.verifiedPercent), detail: `${number(patches.patched)} of ${number(patches.total)} servers` }], 4);

  pdf.pageFor("You can only protect what you can see.", "01");
  pdf.paragraph("Discovery coverage is the foundation of a defensible posture. Collection gaps reduce the evidence available to decision-makers.");
  pdf.coverageRing();
  pdf.paragraph(coverage.applicableChecks ? `The coverage ring represents ${number(coverage.coveredChecks)} covered checks out of ${number(coverage.applicableChecks)} required checks, rather than a percentage of all endpoints. Review the ${number(coverage.gaps)} CIs with gaps to distinguish collection failures from missing evidence.` : "No required discovery checks are applicable in this selection, so the coverage ring is N/A. Confirm the scoped inventory and tool-to-CI mappings before interpreting visibility.", 9);
  pdf.heading(`The terrain in view: ${number(coverage.total)} configuration items`);
  pdf.paragraph(`The composition chart shows how the ${number(coverage.total)} scoped CIs are distributed across their recorded asset types. The distribution describes inventory breadth, not the protection level or business criticality of each type.`, 9);
  pdf.bars(coverage.ciTypes.map(row => ({ label: formatAssetTypeLabel(row.type), count: row.inScope })), coverage.total);
  pdf.heading("Evidence freshness and unknown terrain");
  pdf.metrics([{ label: "Discoveries over 30 days old", value: number(endpoints.stale), color: amber }, { label: "No discovery date", value: number(endpoints.undated), color: grey }, { label: "Unidentified IP nodes", value: number(shadow.total), color: amber }], 3);
  pdf.paragraph(`${number(endpoints.stale)} endpoint discoveries are over 30 days old and ${number(endpoints.undated)} have no discovery date. Age is measured against the selected snapshot. Separately, ${number(shadow.total)} unidentified IP nodes require investigation using scan and ARP evidence; they are not confirmed endpoint identities.`, 9);

  pdf.pageFor("Discovery tool coverage", "01");
  pdf.paragraph("Report cards compare covered and missing required checks for each applicable tool. Tool applicability follows the saved CI-type mappings.");
  pdf.tools();
  pdf.paragraph(`${number(coverage.unmapped)} CIs have no applicable tool mapping. N/A denotes no applicable denominator, not complete coverage.`, 9);

  pdf.pageFor("Separate the urgent from the underlying.", "02");
  pdf.paragraph(`The evidence records ${number(insights.counts.findings)} system-linked open findings, including ${number(insights.priority)} in the critical/high priority classes. Findings describe control exceptions, while the CVE observations later in this chapter describe a separate vulnerability population.`, 9);
  pdf.metrics([{ label: "Priority findings", value: number(insights.priority), color: rose }, { label: "ICT systems with priority findings", value: number(insights.prioritySystems), color: amber }, { label: "System-linked open findings", value: number(insights.counts.findings) }], 3);
  pdf.heading("Configured finding severity");
  pdf.paragraph("The severity bars retain the configured finding labels and show each class against the system-linked finding total. Priority counts use Critical Exposure and High Risk; lower-severity findings remain visible and still require review.", 9);
  pdf.bars(insights.severities.map(row => ({ label: row.label, count: row.count, color: row.key === "Critical Exposure" ? rose : row.key === "High Risk" ? amber : grey })), insights.counts.findings);
  pdf.paragraph(`${number(impact.unattributedFindings)} additional open findings could not be attributed to an in-scope ICT system. Priority means Critical Exposure or High Risk.`, 9);
  pdf.heading("Software vulnerability exposure");
  pdf.paragraph(`The vulnerability measures record ${number(vulnerabilities.total)} observations across ${number(vulnerabilities.affectedEndpoints)} endpoints and ${number(vulnerabilities.distinctCves)} distinct CVE codes; ${number(vulnerabilities.missingRemediation)} observations lack remediation guidance. These records are separate from control findings and are not confirmed exploitation. Validate affected software and configuration before asserting exploitability or a missing OS patch.`, 9);
  pdf.metrics([{ label: "Critical / high CVE observations", value: number(vulnerabilities.criticalHigh), color: rose }, { label: "Distinct CVE codes", value: number(vulnerabilities.distinctCves), color: amber }, { label: "Affected endpoints", value: number(vulnerabilities.affectedEndpoints) }], 3);

  pdf.pageFor("Technical exposure has a service context.", "03");
  pdf.paragraph("Trace recorded associations from affected endpoints to systems, business services and mission capabilities to guide the order of work.");
  pdf.metrics([{ label: "CIs with priority findings", value: number(insights.priorityCis) }, { label: "ICT systems with priority findings", value: number(insights.prioritySystems) }, { label: "Linked business services", value: number(insights.exposedServices) }], 3);
  pdf.heading("Start where priority findings concentrate");
  pdf.paragraph("The service list highlights up to three business services ranked first by critical and then by high findings. Use the associated systems to establish ownership and sequence investigation; a shared finding may contribute to more than one service.", 9);
  const services = insights.services.filter(row => row.critical + row.high > 0).slice(0, 3);
  if (!services.length) pdf.paragraph("No business services are linked to critical/high findings in this selection.");
  services.forEach((service, index) => {
    pdf.ensure(78); pdf.paragraph(`0${index + 1} / ${service.name}`, 12, ink, true);
    pdf.paragraph(`${number(service.critical + service.high)} priority findings: ${number(service.critical)} critical, ${number(service.high)} high. ${number(service.systemIds.length)} associated systems.`, 10, teal);
  });
  pdf.paragraph("Ranked by critical, then high findings. Shared findings can appear under several services; service rows are not additive.", 9);
  pdf.heading("Mission awareness");
  pdf.paragraph(`${number(insights.exposedCapabilities)} of the ${number(impact.missionCount)} represented mission capabilities have recorded links to priority findings. This places technical evidence in operational context without assuming that an affected component will interrupt a mission.`, 9);
  pdf.metrics([{ label: "Capabilities linked to priority findings", value: number(insights.exposedCapabilities) }, { label: "Capabilities represented", value: number(impact.missionCount), detail: `${number(impact.businessCount)} business services represented` }]);
  pdf.paragraph("These are recorded relationships, not an outage prediction. Use the Service Impact Topology and findings evidence to confirm operational consequences.", 9);

  pdf.pageFor("Completion needs evidence, not intention.", "04");
  pdf.paragraph(`The patch evidence covers ${number(patches.total)} servers. ${number(patches.overdue)} are beyond their recorded due date and ${number(patches.unknown)} have unknown status. These separate signals help identify delivery work and assurance gaps without treating an unknown status as successful completion.`, 9);
  pdf.metrics([{ label: "Servers verified patched", value: percent(patches.verifiedPercent), detail: `${number(patches.patched)} / ${number(patches.total)} servers` }, { label: "Overdue patch work", value: number(patches.overdue), color: amber }, { label: "Unknown patch status", value: number(patches.unknown), color: grey }], 3);
  pdf.paragraph("Patch completion includes installation, restart and verification evidence. Unknown servers remain in the percentage denominator.", 9);
  pdf.heading("Recorded patch status");
  pdf.paragraph("The status bars separate verified completion from work that is pending, in progress, awaiting restart or failed. Their denominator includes every scoped server, including Unknown; where no servers are present the verified-patched percentage is N/A.", 9);
  pdf.bars(patches.statuses.map(row => ({ label: row.status, count: row.count, color: row.status === "Patched" ? teal : row.status === "Unknown" ? grey : row.status === "Not patched" || row.status === "Failed" ? rose : amber })), patches.total);
  pdf.ensure(185);
  pdf.heading("Software evidence behind the decision");
  pdf.paragraph(`The software inventory contains ${number(software.total)} installations across ${number(software.endpoints)} endpoints and ${number(software.products)} recorded product names. ${number(software.missingVersion)} installations have no version recorded. ${software.missingVersion ? "Missing versions limit precise vulnerability matching and remediation validation." : "Version completeness describes the recorded fields; it does not establish software currency or absence of vulnerabilities."}`, 9);
  pdf.metrics([{ label: "Software installations", value: number(software.total), detail: `${number(software.products)} recorded product names` }, { label: "No version recorded", value: number(software.missingVersion), detail: `${number(software.endpoints)} endpoints in the software inventory`, color: amber }]);

  pdf.pageFor("Turn evidence into accountable action.", "05");
  pdf.paragraph("Confirm ownership, agree the next milestone and review evidence of completion. These priorities reflect the current scope and snapshot.");
  pdf.paragraph("The agenda retains the page's editorial order and includes up to three nonzero triggers. It is a focused review sequence, not a comparative risk score; the remaining chapters retain evidence that may also need an owner or follow-up.", 9);
  if (!insights.actions.length) pdf.paragraph(insights.hasEvidence ? "No priority triggers were identified by this briefing. Review lower-severity findings and evidence completeness; this is not a declaration of compliance." : "Establish the evidence base. Confirm discovery collection and the selected scope before drawing a posture conclusion.", 11, teal);
  insights.actions.forEach((action, index) => {
    pdf.ensure(110); pdf.heading(`0${index + 1} / ${action.title}`); pdf.paragraph(action.detail);
    const destination = action.destination === "impact" ? "Service Impact Analyser" : action.destination === "tools" ? "Discovery Tool Coverage" : action.destination === "patch-management" ? "Patch Management Explorer" : action.destination === "security-vulnerabilities" ? "Security Vulnerability Explorer" : action.destination === "shadow-it" ? "Shadow IT Explorer" : "End Point Explorer";
    pdf.paragraph(`Supporting evidence: ${destination}`, 9, teal);
  });
  pdf.heading("About this briefing");
  pdf.paragraph("This is a snapshot briefing, not a trend or composite risk score. Counts use the applied network/system, security domains and resolved snapshot. The website and this PDF use the same Discovery and Service Impact models.", 9);
  pdf.paragraph("Findings are deduplicated within the selected systems. CVE observations, discovery checks, configuration items and patch records are different populations and must not be added together. Zero findings and empty results do not establish compliance or absence of exposure.", 9);
  pdf.paragraph("The cover terrain is conceptual. N/A means there is no applicable denominator. Snapshot timestamp is the recorded dataset generation time; PDF generated is the export time. A missing source timestamp is shown as Not recorded.", 9);
  pdf.footer(); return doc.save();
}
