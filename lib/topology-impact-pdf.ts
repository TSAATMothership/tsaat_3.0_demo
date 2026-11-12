import { PDFDocument, StandardFonts, rgb, type PDFImage } from "pdf-lib";
import { InventoryReportPdf } from "@/lib/inventory-report-layout";
import { INSIGHTS_PDF_THEME as theme, type InsightsPdfRenderOptions } from "@/lib/insights-pdf-theme";
import { layoutTopology, TOPOLOGY_KINDS } from "@/lib/topology-explorer";
import { topologyImpactNarrative, type TopologyImpactReportData } from "@/lib/topology-impact-report";

const W = 531.28, L = 32;
const color = (hex: string) => rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);
const count = (n: number) => n.toLocaleString("en-AU");

class ImpactPdf extends InventoryReportPdf {
  logo?: PDFImage;
  generatedAt = "";
  heading(value: string, narrative?: string) {
    const lines = this.wrap(value, W, 11, this.bold);
    this.ensure(Math.min(580, lines.length * 15 + 12 + (narrative ? this.wrap(narrative, W).length * 13 + 7 : 25)));
    for (const line of lines) { this.ensure(20); this.text(line, L, this.y, 11, true); this.y -= 15; }
    this.y -= 6;
    if (narrative) this.paragraph(narrative);
  }
  pageFor(section: string, continued = false) {
    this.section = section;
    this.page = this.doc.addPage([595.28, 841.89]);
    this.page.drawRectangle({ x: 0, y: 732, width: 595.28, height: 110, color: theme.navy });
    this.page.drawRectangle({ x: 0, y: 729, width: 595.28, height: 3, color: theme.teal });
    if (this.logo) this.page.drawImage(this.logo, { x: L, y: 776, width: 34, height: 34 });
    this.text("TSAAT / RECORDED RELATIONSHIPS", 78, 804, 8, true, theme.mint);
    this.text("Topology Impact Report", 78, 777, 22, true, theme.white);
    this.text(`Snapshot ${this.date}`, L, 749, 9, false, theme.white);
    this.text("Decision brief + analyst evidence", 345, 749, 9, false, theme.mint);
    this.y = 701;
    for (const text of this.wrap(section + (continued ? " / continued" : ""), W, 17, this.bold)) {
      this.text(text, L, this.y, 17, true); this.y -= 23;
    }
    this.y -= 7;
  }
  footer() {
    const pages = this.doc.getPages();
    for (const [index, page] of pages.entries()) {
      page.drawLine({ start: { x: L, y: 35 }, end: { x: L + W, y: 35 }, thickness: .6, color: theme.line });
      page.drawText(`Snapshot ${this.date} | Generated ${this.generatedAt.slice(0, 16).replace("T", " ")} UTC`, { x: L, y: 21, size: 7, font: this.regular, color: theme.muted });
      const label = `${index + 1} / ${pages.length}`;
      page.drawText(label, { x: L + W - this.regular.widthOfTextAtSize(label, 8), y: 21, size: 8, font: this.regular, color: theme.muted });
    }
  }
}

function drawGraph(pdf: ImpactPdf, data: TopologyImpactReportData, modelOnly: boolean, numbers: Map<string, number>) {
  const nodes = data.graph.nodes.filter(node => !modelOnly || node.kind !== "asset");
  const ids = new Set(nodes.map(node => node.id)), roots = new Set(data.graph.rootIds);
  const edges = data.graph.edges.filter(edge => ids.has(edge.source) && ids.has(edge.target));
  if (!nodes.length) { pdf.paragraph("No model CIs are included in the displayed graph. The full CI register below retains the selected endpoints."); return; }
  const positions = modelOnly ? layoutTopology({ nodes, edges }, "hierarchical") : new Map(data.positions.map(point => [point.id, point]));
  const xs = nodes.map(node => positions.get(node.id)?.x ?? 0), ys = nodes.map(node => positions.get(node.id)?.y ?? 0);
  const minX = Math.min(...xs) - 55, maxX = Math.max(...xs) + 55, minY = Math.min(...ys) - 55, maxY = Math.max(...ys) + 55;
  const height = 454, scale = Math.min((W - 32) / Math.max(1, maxX - minX), (height - 48) / Math.max(1, maxY - minY));
  pdf.ensure(height + 55);
  const top = pdf.y, left = L + (W - (maxX - minX) * scale) / 2, bottom = top - height;
  pdf.page.drawRectangle({ x: L, y: bottom, width: W, height, color: theme.pale, borderColor: theme.line, borderWidth: .7 });
  const point = (id: string) => { const p = positions.get(id) ?? { x: 0, y: 0 }; return { x: left + (p.x - minX) * scale, y: top - (height - (maxY - minY) * scale) / 2 - (p.y - minY) * scale }; };
  const radius = Math.max(1.1, Math.min(11, 19 * scale));
  for (const edge of edges) {
    const a = point(edge.source), b = point(edge.target), length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const end = { x: b.x - (b.x - a.x) / length * (radius + 1), y: b.y - (b.y - a.y) / length * (radius + 1) };
    pdf.page.drawLine({ start: a, end, thickness: nodes.length > 150 ? .3 : .65, color: edge.kind === "observation" ? theme.amber : theme.muted, opacity: .5 });
    if (nodes.length <= 150) {
      const dx = (b.x - a.x) / length, dy = (b.y - a.y) / length;
      for (const side of [-1, 1]) pdf.page.drawLine({ start: end, end: { x: end.x - dx * 4 + dy * side * 2, y: end.y - dy * 4 - dx * side * 2 }, thickness: .6, color: theme.muted });
    }
  }
  for (const node of nodes) {
    const p = point(node.id);
    if (roots.has(node.id)) pdf.page.drawCircle({ ...p, size: radius + 2, borderWidth: .8, borderColor: theme.ink });
    pdf.page.drawCircle({ ...p, size: radius, color: color(TOPOLOGY_KINDS[node.kind].color), borderColor: theme.white, borderWidth: .5 });
    if (radius >= 5) {
      const label = String(numbers.get(node.id)), size = Math.min(8, radius * .9);
      pdf.text(label, p.x - pdf.bold.widthOfTextAtSize(label, size) / 2, p.y - size / 3, size, true);
    }
    if (modelOnly && nodes.length <= 18 && radius >= 5) {
      const labels = pdf.wrap(node.name, 72, 7);
      if (labels.length > 4) continue; // Full names remain in the register; keep overview labels clear of other tiers.
      const y = p.y - radius - 11;
      pdf.page.drawRectangle({ x: p.x - 38, y: y - (labels.length - 1) * 9 - 3, width: 76, height: labels.length * 9 + 2, color: theme.pale });
      labels.forEach((label, i) => pdf.text(label, p.x - pdf.regular.widthOfTextAtSize(label, 7) / 2, y - i * 9, 7));
    }
  }
  pdf.y = bottom - 18;
  let x = L;
  for (const kind of ["business", "mission", "network", "system", "asset"] as const) {
    if (!nodes.some(node => node.kind === kind)) continue;
    pdf.page.drawCircle({ x: x + 3, y: pdf.y + 2, size: 3, color: color(TOPOLOGY_KINDS[kind].color) });
    const label = TOPOLOGY_KINDS[kind].label;
    pdf.text(label, x + 10, pdf.y, 7); x += pdf.regular.widthOfTextAtSize(label, 7) + 24;
  }
  pdf.y -= 18;
  pdf.paragraph("Outer rings mark starting CIs. Numbers refer to the complete CI register. Large graphs are scaled to fit; use the registers for exact identities and relationship direction.", 8);
}

/** Browser-worker renderer: all graphics, prose and evidence use the captured displayed graph. */
export async function createTopologyImpactPdf(data: TopologyImpactReportData, generatedAt: Date, options: InsightsPdfRenderOptions = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const pdf = new ImpactPdf(doc, await doc.embedFont(StandardFonts.Helvetica), await doc.embedFont(StandardFonts.HelveticaBold), data.snapshotDate);
  const load = options.loadAsset ?? (async (name: string) => {
    const response = await fetch(new URL(name, options.assetBaseUrl).href);
    if (!response.ok) throw new Error("Unable to load report branding.");
    return new Uint8Array(await response.arrayBuffer());
  });
  pdf.logo = await doc.embedPng(await load("/tsaat-logo.png"));
  pdf.generatedAt = generatedAt.toISOString();
  doc.setTitle("Topology Impact Report"); doc.setAuthor("TSAAT"); doc.setCreationDate(generatedAt);
  doc.setSubject(`Snapshot ${data.snapshotDate} | ${data.graph.mode} | ${data.selection}`);
  const { graph } = data, narrative = topologyImpactNarrative(data), numbers = new Map(graph.nodes.map((node, i) => [node.id, i + 1]));
  const roots = new Set(graph.rootIds), endpoints = graph.nodes.filter(node => node.kind === "asset");
  const withCves = endpoints.filter(node => node.cves.length), cves = new Set(withCves.flatMap(node => node.cves));
  const sharedSystems = graph.nodes.filter(node => node.kind === "system").map(node => ({ node, services: new Set(graph.edges.filter(edge => edge.kind === "association" && edge.target === node.id).map(edge => edge.source)).size })).filter(row => row.services > 1);

  options.onProgress?.("Writing the executive impact brief");
  pdf.pageFor("01 / Executive impact brief");
  pdf.paragraph(data.selection, 11, theme.ink);
  pdf.cards([{ label: "Starting CIs", value: count(roots.size) }, { label: "Displayed CIs", value: count(graph.nodes.length) }, { label: "Recorded relationships", value: count(graph.edges.length) }]);
  pdf.heading("What the model shows");
  for (const text of narrative.summary) pdf.paragraph(text);
  pdf.heading("Composition of this view");
  pdf.bars((["business", "mission", "network", "system", "asset"] as const).map(kind => ({ label: TOPOLOGY_KINDS[kind].label, count: narrative.counts[kind], color: color(TOPOLOGY_KINDS[kind].color) })), graph.nodes.length);
  pdf.heading("Decisions and follow-up");
  pdf.paragraph(`${sharedSystems.length} displayed ICT system(s) support more than one business or mission service in this view. Validate shared service ownership, resilience and change sequencing before treating a change as isolated.`);
  pdf.paragraph(`${withCves.length} displayed endpoint CI(s) have ${cves.size} distinct recorded CVE identifier(s). Ask the cyber analyst to validate applicability, current exposure and remediation status; these observations do not establish exploitation or severity.`);
  pdf.paragraph("This is a snapshot of recorded model relationships, not an outage simulation or a risk score. Availability, redundancy, service criticality and recovery time are not established by this graph.", 9, theme.teal);

  pdf.pageFor("02 / Scope and reading guide");
  pdf.table(["Selection", "Applied value"], [
    ["Snapshot", data.snapshotDate], ["Graph mode", graph.mode === "dependencies" ? "Dependencies" : "Business Impact"],
    ["Starting selection", data.selection], ["Networks", data.scope.networks.join("; ") || "No explicit network selection"],
    ["ICT systems", data.scope.systems.join("; ") || "No explicit system selection"], ["Security domains", data.scope.domains.join(", ") || "None"],
    ["Lookup filters", data.filters.join(" | ") || "None"], ["Layout", data.layout === "circular" ? "Radial" : data.layout]
  ], [120, W - 120]);
  pdf.heading("How to interpret the views");
  pdf.paragraph("For executive review: start with the decision brief, topology views and service narratives (sections 01, 03-05). For cyber analysis: continue with evidence gaps, CVEs, CI identities, directed relationships and software observations (sections 06-09).");
  pdf.paragraph("The report captures every CI and relationship presented in Impact Topology when Generate Impact Report was selected. The full graph is fitted to the page; camera zoom, pan and inspection highlights do not exclude evidence. Starting CIs and contextual CIs are distinguished in the register.");
  pdf.paragraph(graph.mode === "business-impact" ? "Business Impact shows model context and can include labelled ARP observations. For model starting CIs, endpoint membership is not expanded. Consequently, endpoint or CVE counts in this report can be zero even when underlying systems contain endpoints."
    : "Dependencies expands recorded member CIs and then their model ancestors. CI-to-CI communication and ARP observation links are excluded. Context ancestors do not expand unrelated sibling branches.");
  pdf.paragraph("Business services and mission services associate independently with ICT systems. A shared system does not create a direct relationship between those services. All statements below are limited to the displayed graph and selected snapshot.");

  options.onProgress?.("Drawing topology and service context views");
  pdf.pageFor("03 / Displayed topology");
  pdf.paragraph(`${count(graph.nodes.length)} CIs / ${count(graph.edges.length)} recorded relationships. This vector overview uses the selected layout and moved-node positions, fitted to the report page.`);
  drawGraph(pdf, data, false, numbers);
  pdf.pageFor("04 / Model and service context");
  pdf.paragraph("A second view of the same evidence, showing networks, ICT systems, business services and mission services. Endpoint CIs are omitted from this view only; they remain in the full topology and evidence register.");
  drawGraph(pdf, data, true, numbers);

  pdf.pageFor("05 / Service impact narrative");
  pdf.paragraph("Use these recorded paths to identify owners and scope an impact review. Counts describe this graph, not confirmed affected services or an enterprise-wide dependency census.");
  for (const service of narrative.services) pdf.heading(`${TOPOLOGY_KINDS[service.node.kind].label}: ${service.node.name}`, service.narrative);
  if (!narrative.services.length) pdf.paragraph("No business or mission service is displayed. Review model completeness before making service-impact decisions.");
  pdf.heading("Shared ICT systems");
  pdf.table(["CI ref", "ICT system", "Services"], sharedSystems.map(row => [String(numbers.get(row.node.id)), row.node.name, String(row.services)]), [55, W - 120, 65]);

  pdf.pageFor("06 / Cyber analyst review");
  pdf.cards([{ label: "Endpoints with CVE evidence", value: count(withCves.length), color: theme.amber }, { label: "Distinct recorded CVEs", value: count(cves.size), color: theme.amber }, { label: "Unlinked displayed CIs", value: count(narrative.isolated.length) }]);
  pdf.paragraph("CVE and software entries are the recorded endpoint evidence available to this topology snapshot. An absent CVE is not proof of a clean endpoint. No vulnerability severity, exploitability or active communication is inferred. Correlate with Security Vulnerability Explorer and current collection evidence before prioritising remediation.");
  pdf.heading("Evidence gaps and investigation sequence");
  pdf.paragraph(`${graph.nodes.filter(node => node.domain === "UNKNOWN").length} displayed CIs have an UNKNOWN security domain. ${endpoints.filter(node => !node.ip.trim()).length} displayed endpoint CIs have no recorded IP. Model CIs do not inherit fabricated endpoint addresses or security domains.`);
  pdf.paragraph("1. Confirm the selected CIs and owners. 2. Validate the service and system associations. 3. Check vulnerability applicability, asset exposure and change windows. 4. Confirm redundancy and recovery arrangements. 5. Update missing relationships and compare a later snapshot.");
  pdf.table(["CI ref", "Endpoint", "Recorded CVE identifiers"], withCves.map(node => [String(numbers.get(node.id)), node.name, node.cves.join(", ")]), [48, 165, W - 213]);

  options.onProgress?.("Writing complete CI and relationship evidence");
  pdf.pageFor("07 / Complete CI register");
  pdf.paragraph("Every displayed CI is listed once. An asterisk (*) marks a starting CI from the selected result or all matching results. Category names describe model roles; names and source IDs are preserved as recorded.");
  pdf.table(["Ref", "CI type", "Name", "Source ID", "Domain"], graph.nodes.map(node => [
    `${numbers.get(node.id)}${roots.has(node.id) ? "*" : ""}`, node.type, node.name, node.sourceId, node.domain || "Not applicable"
  ]), [34, 86, 176, 160, W - 456]);
  pdf.pageFor("08 / Complete relationship register");
  pdf.paragraph("Source and target references identify the CIs above. Labels retain the recorded direction. Environment applies to system-to-CI membership only. No relationship is created from co-occurrence or communication telemetry.");
  pdf.table(["Source ref", "Relationship", "Target ref", "Environment"], graph.edges.map(edge => [
    String(numbers.get(edge.source)), edge.label, String(numbers.get(edge.target)), edge.environments ? edge.environments.join(", ") || "Not recorded" : "Not applicable"
  ]), [70, 165, 70, W - 305]);
  pdf.pageFor("09 / Endpoint evidence register");
  pdf.paragraph("Endpoint identity and installed-software evidence for this displayed graph. Software entries are name/version observations; the report does not infer support status or remediation. Missing values remain explicit.");
  pdf.table(["CI ref", "Hostname / IP", "Installed software observations"], endpoints.map(node => [String(numbers.get(node.id)), `${node.hostname || "Hostname not recorded"}\n${node.ip || "IP not recorded"}`, node.software.join("; ") || "Not recorded"]), [48, 175, W - 223]);
  pdf.footer(); options.onProgress?.("Finalising the impact report");
  return doc.save();
}
