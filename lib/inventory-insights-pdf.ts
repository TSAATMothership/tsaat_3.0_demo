import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { OverviewPdf } from "@/lib/discovery-overview-report-pdf";
import type { DiscoveryOverviewData } from "@/lib/discovery-overview-data";
import { ENDPOINT_COLUMNS, NOT_RECORDED, endpointFacetCounts, type EndpointRecord } from "@/lib/endpoint-explorer";
import { VULNERABILITY_COLUMNS, vulnerabilityTableColumns, type SecurityVulnerabilityRecord } from "@/lib/security-vulnerability-explorer";
import { emptyExplorerTableFilters, prepareExplorerRows, queryExplorerRows } from "@/lib/explorer-table";

const WIDTH = 531.28;
const teal = rgb(.06, .51, .48), red = rgb(.76, .21, .26), amber = rgb(.76, .45, .08);
const count = (value: number) => value.toLocaleString("en-AU");
const percent = (value: number | null) => value === null ? "N/A" : `${value}%`;
type Count = { value: string; count: number };
type Appendix = { title: string; values: Count[]; unit: string };
type EndpointData = DiscoveryOverviewData & { rows: EndpointRecord[] };
type VulnerabilityData = DiscoveryOverviewData & { rows: SecurityVulnerabilityRecord[] };

async function begin(data: DiscoveryOverviewData, title: string, generatedAt: Date) {
  if (!Number.isFinite(generatedAt.getTime())) throw Error("Invalid report generation date.");
  const doc = await PDFDocument.create(), regular = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle(title); doc.setAuthor("TSAAT"); doc.setCreationDate(generatedAt);
  const pdf = new OverviewPdf(doc, regular, bold, data.model.snapshotDate, title);
  pdf.pageFor("Summary and scope");
  if (data.scopeLabels.networks.length) pdf.paragraph("Managed networks: " + data.scopeLabels.networks.join("; "));
  if (data.scopeLabels.systems.length) pdf.paragraph("ICT systems: " + data.scopeLabels.systems.join("; "));
  pdf.paragraph("Security domains: " + (data.scopeLabels.domains.join(", ") || "None selected"));
  pdf.paragraph("Generated: " + generatedAt.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC"));
  return pdf;
}

/** Keep charts readable while retaining every value, including long labels, in measured table rows. */
function distribution(pdf: OverviewPdf, title: string, values: Count[], total: number, unit: string, appendices: Appendix[]) {
  const needsAppendix = values.length > 6 || values.some(row => pdf.wrap(row.value, 148, 9).length > 3);
  const chartHeight = values.slice(0, 6).reduce((height, row) => height + Math.max(29, Math.min(3, pdf.wrap(row.value, 148, 9).length) * 12 + 8), 0);
  // Keep each summary chart with its title and appendix note; full tables can paginate.
  if (values.length) pdf.ensure(21 + chartHeight + 12 + (needsAppendix ? 45 : 0));
  pdf.heading(title);
  pdf.bars(values.slice(0, 6).map(row => ({ label: row.value, count: row.count })), total);
  if (needsAppendix) {
    pdf.paragraph(`Chart shows the first ${Math.min(6, values.length)} groups. Appendix: ${title} retains all ${values.length} values and counts (${unit}).`);
    appendices.push({ title, values, unit });
  }
}
function appendTables(pdf: OverviewPdf, appendices: Appendix[]) {
  for (const entry of appendices) {
    pdf.pageFor("Appendix: " + entry.title);
    pdf.paragraph("Complete breakdown. Counting unit: " + entry.unit + ". Labels are retained in full, with continuation pages where needed.");
    pdf.table(["Recorded value", "Count"], entry.values.map(row => [row.value, count(row.count)]), [WIDTH - 80, 80]);
  }
}
function coverageSection(pdf: OverviewPdf, { coverage }: DiscoveryOverviewData["model"]) {
  pdf.paragraph("Required tool checks use the scoped Discovery Compliance CI inventory and saved CI-type mappings. They do not estimate undiscovered devices or prove vulnerability scanning is complete.");
  pdf.cards([{ label: "Required checks covered", value: percent(coverage.percent), color: teal },
    { label: "CIs with coverage gaps", value: count(coverage.gaps), color: amber },
    { label: "Missing tool-to-CI checks", value: count(coverage.missingChecks), color: red }]);
  pdf.paragraph(`${count(coverage.coveredChecks)} of ${count(coverage.applicableChecks)} required checks covered across ${count(coverage.total)} CIs. ${count(coverage.unmapped)} CIs have no required tool mapping: they count as compliant and are excluded from the percentage. No applicable checks means N/A.`);
  pdf.toolCards(coverage.tools);
  pdf.heading("Required tools - complete detail");
  pdf.table(["Discovery tool", "Covered", "Missing", "Required"], coverage.tools.map(tool => [tool.label, count(tool.covered), count(tool.missing), count(tool.applicable)]), [WIDTH - 240, 80, 80, 80]);
}
function commonNotes(pdf: OverviewPdf) {
  pdf.heading("Scope and interpretation");
  pdf.paragraph("All values use the applied header network or ICT-system scope, security domains and the resolved snapshot shown on every page. Local Explorer filters are not applied to this briefing. Counts use the same provider facades and existing measures as the page.");
  pdf.paragraph("Missing checks may overlap. Do not add field gaps into a single issue total. A recorded value does not validate its correctness or applicability; identity labels can fall back to identifiers. Empty inventories and zero gaps do not establish complete discovery or absence of exposure.");
}
const byCount = (values: Count[]) => [...values].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

export async function createEndpointInsightsPdf(data: EndpointData, generatedAt = new Date()): Promise<Uint8Array> {
  const pdf = await begin(data, "End Point Insights Report", generatedAt), appendices: Appendix[] = [];
  const { endpoints, shadow, snapshotDate } = data.model, rows = data.rows;
  const facets = (key: typeof ENDPOINT_COLUMNS[number]["key"]) => endpointFacetCounts(rows, key);
  pdf.paragraph("Endpoint inventory, missing details, discovery evidence and the surrounding collection picture.");
  pdf.cards([{ label: "Endpoint records", value: count(endpoints.total) }, { label: "Discoveries over 30 days old", value: count(endpoints.stale), color: amber },
    { label: "Missing / invalid discovery dates", value: count(endpoints.undated), color: amber }, { label: "Missing discovery sources", value: count(endpoints.missingSource), color: red }], 2);
  if (!rows.length) pdf.paragraph("No endpoint records in this scope. An empty inventory does not establish complete discovery or absence of devices.");
  pdf.paragraph("Five chapters: the estate; missing details; discovery evidence; coverage context; next steps. Full distributions follow in appendices when a chart is abbreviated.");

  pdf.pageFor("01 / The recorded estate");
  pdf.paragraph("The same scoped CMDB inventory as End Point Explorer, including every CI type it contains. This is the recorded estate, not a count of every device that may exist.");
  distribution(pdf, "CI composition", facets("ciType"), rows.length, "endpoint records", appendices);
  distribution(pdf, "Managed networks", facets("managedNetwork"), rows.length, "endpoint records", appendices);

  pdf.pageFor("02 / Missing details");
  pdf.paragraph("Gap counts apply to displayed fields on endpoint records. Date gaps include missing or invalid dates; the dated count includes parseable dates, with future dates reported separately.");
  const fields = ENDPOINT_COLUMNS.map(({ key, label }) => {
    const missing = key === "lastDiscoveredDate" ? endpoints.undated : facets(key).find(row => row.value === NOT_RECORDED)?.count ?? 0;
    return [label, count(missing), count(rows.length - missing)];
  });
  pdf.table(["Field", "Gap count", "Recorded / dated"], fields, [WIDTH - 210, 80, 130]);
  const unknown = facets("securityDomain").find(row => row.value === "UNKNOWN")?.count ?? 0;
  pdf.paragraph(`${count(unknown)} records have security domain UNKNOWN. This is an explicit value, separate from an empty field. Names and network labels can fall back to identifiers. Fields such as model or MAC address may not apply to every CI type.`);

  pdf.pageFor("03 / Discovery evidence");
  pdf.paragraph(`Age is relative to snapshot ${snapshotDate}, not today. More than 30 days is a review prompt, not a new coverage-compliance rule.`);
  pdf.heading("Time since discovery");
  pdf.bars(endpoints.ages.map((row, index) => ({ label: row.age, count: row.count, color: index < 2 ? teal : amber })), endpoints.total);
  pdf.paragraph(`${count(endpoints.afterSnapshot)} dates occur after the snapshot. They are separate from recent evidence. ${count(endpoints.undated)} records have missing or invalid discovery dates.`);
  distribution(pdf, "Recorded collection sources", facets("discoveredBy"), rows.length, "endpoint records", appendices);

  pdf.pageFor("04 / Coverage context"); coverageSection(pdf, data.model);
  pdf.heading("Unidentified IP nodes");
  pdf.paragraph(`${count(shadow.total)} unidentified IP nodes are recorded in Shadow IT. These IP scan and ARP observations form a separate inventory; do not add them to endpoint totals or infer the number of unseen devices from them.`);

  pdf.pageFor("05 / Next steps");
  pdf.heading("Restore identity details"); pdf.paragraph("Review missing IP addresses, MAC addresses and device models. Confirm applicability before completing a field.");
  pdf.heading("Refresh discovery evidence"); pdf.paragraph("Investigate old, missing and future-dated observations, and confirm the recorded collection source.");
  pdf.heading("Close visibility gaps"); pdf.paragraph("Review missing required tools and investigate unidentified IP nodes in the surrounding scope. Zero missing fields do not establish correctness or complete coverage.");
  commonNotes(pdf); appendTables(pdf, appendices); pdf.footer(); return pdf.doc.save();
}

export async function createVulnerabilityInsightsPdf(data: VulnerabilityData, generatedAt = new Date()): Promise<Uint8Array> {
  const pdf = await begin(data, "Security Vulnerability Insights Report", generatedAt), appendices: Appendix[] = [];
  const { vulnerabilities, endpoints, coverage, snapshotDate } = data.model, rows = data.rows;
  const { facets } = queryExplorerRows(prepareExplorerRows(rows, vulnerabilityTableColumns), vulnerabilityTableColumns, emptyExplorerTableFilters());
  pdf.paragraph("Recorded vulnerability observations, missing context, provenance and discovery coverage.");
  pdf.cards([{ label: "Recorded observations", value: count(vulnerabilities.total) }, { label: "Distinct CVEs", value: count(vulnerabilities.distinctCves) },
    { label: "Affected endpoints", value: count(vulnerabilities.affectedEndpoints) }, { label: "Critical / high observations", value: count(vulnerabilities.criticalHigh), color: red }], 2);
  if (!rows.length) pdf.paragraph("No vulnerability observations in this scope. No observations does not establish that endpoints were scanned or are vulnerability-free.");
  pdf.paragraph("Five chapters: recorded exposure; evidence gaps; sources and context; discovery coverage; next steps. Appendices retain every group, including those collapsed on the page.");

  pdf.pageFor("01 / Recorded exposure");
  pdf.paragraph("Observation, CVE and endpoint counts are different units and are not additive. Repeated CVEs and persisted observations retain their identities; these are not counts of open remediation cases.");
  distribution(pdf, "Recorded severity", vulnerabilities.severities.map(row => ({ value: row.severity, count: row.count })), rows.length, "vulnerability observations", appendices);
  pdf.paragraph("Severity is retained from the source, including missing or unrecognised values. It is not a new risk score or evidence of exploitation.");
  distribution(pdf, "CVE codes", byCount(facets.cve), rows.length, "vulnerability observations", appendices);
  pdf.paragraph("CVE syntax alone does not verify a public CVE record or endpoint exposure.");

  pdf.pageFor("02 / Evidence gaps");
  pdf.paragraph("All 15 Explorer fields are included. Empty and whitespace-only values use the existing Not recorded facet. Counts are observations, not distinct endpoints; device and OS details can repeat on many observations.");
  pdf.table(["Field", "Not recorded", "With value"], VULNERABILITY_COLUMNS.map(({ key, label }) => {
    const missing = facets[key].find(row => row.value === NOT_RECORDED)?.count ?? 0;
    return [label, count(missing), count(rows.length - missing)];
  }), [WIDTH - 180, 90, 90]);
  pdf.paragraph("Presence does not validate accuracy or applicability. Date presence does not validate a date. Some endpoint fields may not apply to every device. Field gaps overlap and must not be summed into an issue total.");

  pdf.pageFor("03 / Sources and context");
  pdf.paragraph("Each bar counts observations, including repeated endpoint details. Groups are ordered by count, then label. Source labels retain their original wording.");
  for (const [key, title] of [["softwareName", "Affected software"], ["osName", "Operating systems"], ["source", "Detection sources"], ["detectedDate", "Detection dates"]] as const) {
    distribution(pdf, title, byCount(facets[key]), rows.length, "vulnerability observations", appendices);
  }
  pdf.paragraph("Detection date is not a last-scan date. CVE creation is the record reservation date, not publication or endpoint detection. Older detections alone do not prove stale scans or unresolved remediation. The selected inventory excludes detections after the snapshot.");

  pdf.pageFor("04 / Discovery coverage"); coverageSection(pdf, data.model);
  pdf.heading("Endpoint discovery context");
  pdf.paragraph(`These checks cover all ${count(endpoints.total)} End Point Explorer records in scope, not only endpoints with vulnerability observations. Age is relative to ${snapshotDate}, and does not redefine coverage compliance.`);
  pdf.table(["Discovery check", "Endpoint records"], [["Discoveries over 30 days old", count(endpoints.stale)], ["Missing or invalid discovery dates", count(endpoints.undated)], ["Missing discovery sources", count(endpoints.missingSource)]], [WIDTH - 120, 120]);

  pdf.pageFor("05 / Next steps");
  pdf.heading("Review the highest recorded severities"); pdf.paragraph(`${count(vulnerabilities.criticalHigh)} critical / high observations. Validate affected versions, applicability and recorded exposure before deciding a response.`);
  pdf.heading("Make remediation evidence actionable"); pdf.paragraph(`${count(vulnerabilities.missingRemediation)} observations have no remediation text. Review source evidence and record the applicable vendor or operational action. Text presence alone does not confirm remediation.`);
  pdf.heading("Strengthen the collection picture"); pdf.paragraph(`${count(coverage.gaps)} CIs have required tool gaps. Discovery coverage is separate from a verified vulnerability scan. Zero observations or gaps do not establish scanned, remediated or vulnerability-free endpoints.`);
  commonNotes(pdf); pdf.paragraph("Unassigned networks, unidentified IP nodes and future detections are excluded from the vulnerability inventory. No scan-age, remediation-status or inferred vulnerable-population calculation is introduced.");
  appendTables(pdf, appendices); pdf.footer(); return pdf.doc.save();
}
