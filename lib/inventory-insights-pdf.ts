import { PDFDocument, type RGB } from "pdf-lib";
import { InventoryReportPdf, coverageRing } from "@/lib/inventory-report-layout";
import type { InventoryInsightsDocumentData as InventoryContextData } from "@/lib/documents/insights";
import { ENDPOINT_COLUMNS, NOT_RECORDED, endpointFacetCounts, type EndpointRecord } from "@/lib/endpoint-explorer";
import { VULNERABILITY_COLUMNS, vulnerabilityTableColumns, type SecurityVulnerabilityRecord } from "@/lib/security-vulnerability-explorer";
import { emptyExplorerTableFilters, prepareExplorerRows, queryExplorerRows } from "@/lib/explorer-table";
import { drawInsightsOpeningPage, INSIGHTS_PDF_THEME, loadInsightsPdfAssets, type InsightsReportKind, type InsightsPdfRenderOptions } from "@/lib/insights-pdf-theme";

const WIDTH = 531.28;
const { teal, amber } = INSIGHTS_PDF_THEME, red = INSIGHTS_PDF_THEME.rose;
const count = (value: number) => value.toLocaleString("en-AU");
type Count = { value: string; count: number; color?: RGB };
type Appendix = { title: string; values: Count[]; unit: string };
type EndpointData = InventoryContextData & { rows: EndpointRecord[] };
type VulnerabilityData = InventoryContextData & { rows: SecurityVulnerabilityRecord[] };

async function begin(data: InventoryContextData, title: string, generatedAt: Date, kind: InsightsReportKind, summary: string[], recommendations: string[], options: InsightsPdfRenderOptions) {
  if (!Number.isFinite(generatedAt.getTime())) throw Error("Invalid report generation date.");
  const doc = await PDFDocument.create(), assets = await loadInsightsPdfAssets(doc, kind, options);
  doc.setTitle(title); doc.setAuthor("TSAAT"); doc.setCreationDate(generatedAt);
  drawInsightsOpeningPage(doc, assets, { kind, title, snapshotDate: data.model.snapshotDate, generatedAt,
    scopeLines: [...data.scopeLabels.networks.map(label => "Managed network: " + label), ...data.scopeLabels.systems.map(label => "ICT system: " + label),
      "Security domains: " + (data.scopeLabels.domains.join(", ") || "None selected")], summary, recommendations });
  const pdf = new InventoryReportPdf(doc, assets.regular, assets.bold, data.model.snapshotDate, title, assets, kind);
  pdf.pageFor("Summary and scope");
  if (data.scopeLabels.networks.length) pdf.paragraph("Managed networks: " + data.scopeLabels.networks.join("; "));
  if (data.scopeLabels.systems.length) pdf.paragraph("ICT systems: " + data.scopeLabels.systems.join("; "));
  pdf.paragraph("Security domains: " + (data.scopeLabels.domains.join(", ") || "None selected"));
  pdf.paragraph("Generated: " + generatedAt.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC"));
  return pdf;
}

/** Keep charts readable while retaining every value, including long labels, in measured table rows. */
function distribution(pdf: InventoryReportPdf, title: string, values: Count[], total: number, unit: string, appendices: Appendix[], narrative: string) {
  const needsAppendix = values.length > 6 || values.some(row => pdf.wrap(row.value, 148, 9).length > 3);
  const chartHeight = values.slice(0, 6).reduce((height, row) => height + Math.max(29, Math.min(3, pdf.wrap(row.value, 148, 9).length) * 12 + 8), 0);
  // Keep each summary chart with its title and appendix note; full tables can paginate.
  if (values.length) pdf.ensure(21 + pdf.wrap(narrative, WIDTH, 9).length * 13 + 7 + chartHeight + 12 + (needsAppendix ? 45 : 0));
  pdf.heading(title, narrative);
  pdf.bars(values.slice(0, 6).map(row => ({ label: row.value, count: row.count, color: row.color })), total);
  if (needsAppendix) {
    pdf.paragraph(`Chart shows the first ${Math.min(6, values.length)} groups. Appendix: ${title} retains all ${values.length} values and counts (${unit}).`);
    appendices.push({ title, values, unit });
  }
}
function appendTables(pdf: InventoryReportPdf, appendices: Appendix[]) {
  for (const entry of appendices) {
    pdf.pageFor("Appendix: " + entry.title);
    pdf.paragraph("Complete breakdown. Counting unit: " + entry.unit + ". Labels are retained in full, with continuation pages where needed.");
    pdf.table(["Recorded value", "Count"], entry.values.map(row => [row.value, count(row.count)]), [WIDTH - 80, 80]);
  }
}
function coverageSection(pdf: InventoryReportPdf, { coverage }: InventoryContextData["model"]) {
  pdf.paragraph("Required tool checks use the scoped CI inventory and saved CI-type mappings. They do not estimate undiscovered devices or prove vulnerability scanning is complete.");
  pdf.paragraph(`${count(coverage.coveredChecks)} of ${count(coverage.applicableChecks)} required checks covered across ${count(coverage.total)} CIs, with ${count(coverage.missingChecks)} missing tool-to-CI checks. ${count(coverage.unmapped)} CIs have no required tool mapping: they count as compliant and are excluded from the percentage. No applicable checks means N/A.`);
  coverageRing(pdf, coverage);
  pdf.toolCards(coverage.tools);
  pdf.heading("Required tools - complete detail", "Each row counts required tool-to-CI checks, with covered and missing checks shown separately. Use this breakdown to identify the collection tools to investigate; a compliant discovery check does not validate every attribute collected by that tool.");
  pdf.table(["Discovery tool", "Covered", "Missing", "Required"], coverage.tools.map(tool => [tool.label, count(tool.covered), count(tool.missing), count(tool.applicable)]), [WIDTH - 240, 80, 80, 80]);
}
function commonNotes(pdf: InventoryReportPdf) {
  pdf.heading("Scope and interpretation");
  pdf.paragraph("All values use the applied header network or ICT-system scope and security domains detailed at the front of this briefing. The resolved snapshot is shown on every page. Local Explorer filters are not applied. Counts use the same provider facades and existing measures as the page.");
  pdf.paragraph("Missing checks may overlap. Do not add field gaps into a single issue total. A recorded value does not validate its correctness or applicability; identity labels can fall back to identifiers. Empty inventories and zero gaps do not establish complete discovery or absence of exposure.");
}
const byCount = (values: Count[]) => [...values].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

export async function createEndpointInsightsPdf(data: EndpointData, generatedAt = new Date(), options: InsightsPdfRenderOptions = {}): Promise<Uint8Array> {
  const { endpoints, shadow, coverage, snapshotDate } = data.model, rows = data.rows;
  const pdf = await begin(data, "End Point Insights Report", generatedAt, "endpoint", rows.length ? [
    `The selected snapshot contains ${count(endpoints.total)} endpoint records. The recorded estate includes the CI types shown in End Point Explorer; it is not an estimate of every device that exists in the environment.`,
    `${count(endpoints.stale)} records were last discovered more than 30 days before the snapshot. ${count(endpoints.undated)} have a missing or invalid discovery date and ${count(endpoints.missingSource)} have no collection source, limiting the context available to assess their currency.`,
    `The surrounding discovery picture has ${count(coverage.gaps)} CIs with required tool gaps and ${count(shadow.total)} unidentified IP nodes. These separate inventories provide investigation leads and must not be added to the endpoint total.`
  ] : [
    "No endpoint records are available for the selected scope, Security Domains and snapshot. An empty inventory does not establish complete discovery or absence of devices.",
    "The following chapters retain the field definitions and surrounding discovery coverage so the selection and collection evidence can be reviewed. Coverage percentages with no applicable checks are N/A."
  ], [
    rows.length ? "Restore the identity details that support reliable investigation. Review missing IP addresses, MAC addresses and models, confirming that each field applies to the CI type before filling it." : "Confirm the selected network or ICT system, Security Domains and snapshot, then verify that the intended endpoint inventory has been collected.",
    `Review the ${count(endpoints.stale)} older records, ${count(endpoints.undated)} unusable dates and ${count(endpoints.afterSnapshot)} dates after the snapshot with the relevant collection owners. Verify source evidence before classifying a device as current or absent.`,
    `Investigate the ${count(coverage.missingChecks)} missing required tool-to-CI checks and reconcile unidentified IP observations with known assets. Re-run the briefing after corrections; zero recorded gaps alone does not prove completeness.`
  ], options), appendices: Appendix[] = [];
  const facets = (key: typeof ENDPOINT_COLUMNS[number]["key"]) => endpointFacetCounts(rows, key);
  pdf.paragraph("Endpoint inventory, missing details, discovery evidence and the surrounding collection picture.");
  pdf.cards([{ label: "Endpoint records", value: count(endpoints.total) }, { label: "Discoveries over 30 days old", value: count(endpoints.stale), color: amber },
    { label: "Missing / invalid discovery dates", value: count(endpoints.undated), color: amber }, { label: "Missing discovery sources", value: count(endpoints.missingSource), color: red }], 2);
  if (!rows.length) pdf.paragraph("No endpoint records in this scope. An empty inventory does not establish complete discovery or absence of devices.");
  pdf.paragraph("Five chapters: the estate; missing details; discovery evidence; coverage context; next steps. Full distributions follow in appendices when a chart is abbreviated.");

  pdf.pageFor("01 / The recorded estate");
  pdf.paragraph("The same scoped CMDB inventory as End Point Explorer, including every CI type it contains. This is the recorded estate, not a count of every device that may exist.");
  distribution(pdf, "CI composition", facets("ciType"), rows.length, "endpoint records", appendices, "The composition shows which CI types contribute to this inventory. Interpret each field gap in that context: model and MAC address details may be useful for devices but inapplicable to some logical CIs.");
  distribution(pdf, "Managed networks", facets("managedNetwork"), rows.length, "endpoint records", appendices, "Network groupings show where the recorded endpoint inventory sits within the selected scope. Larger groups contain more records, which does not by itself establish better discovery coverage or a larger unseen population elsewhere.");

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
  pdf.heading("Time since discovery", `${count(endpoints.stale)} records are more than 30 days old. Review the age distribution alongside missing dates and source information to identify evidence that needs refreshing; the bars describe recorded observations rather than device availability.`);
  pdf.bars(endpoints.ages.map((row, index) => ({ label: row.age, count: row.count, color: index < 2 ? teal : amber })), endpoints.total);
  pdf.paragraph(`${count(endpoints.afterSnapshot)} dates occur after the snapshot. They are separate from recent evidence. ${count(endpoints.undated)} records have missing or invalid discovery dates.`);
  distribution(pdf, "Recorded collection sources", facets("discoveredBy"), rows.length, "endpoint records", appendices, `Source labels describe the collection provenance retained on endpoint records. ${count(endpoints.missingSource)} records lack that context. A source name alone does not confirm that every required tool has covered the CI.`);

  pdf.pageFor("04 / Coverage context"); coverageSection(pdf, data.model);
  pdf.heading("Unidentified IP nodes");
  pdf.paragraph(`${count(shadow.total)} unidentified IP nodes are recorded in Shadow IT. These IP scan and ARP observations form a separate inventory; do not add them to endpoint totals or infer the number of unseen devices from them.`);

  pdf.pageFor("05 / Next steps");
  pdf.paragraph("Use the following actions as an investigation sequence: establish identity, confirm the age and provenance of the evidence, then reconcile collection gaps. Assign follow-up to the relevant data owners and validate changes against the next snapshot.");
  pdf.heading("Restore identity details"); pdf.paragraph("Review missing IP addresses, MAC addresses and device models. Confirm applicability before completing a field.");
  pdf.heading("Refresh discovery evidence"); pdf.paragraph("Investigate old, missing and future-dated observations, and confirm the recorded collection source.");
  pdf.heading("Close visibility gaps"); pdf.paragraph("Review missing required tools and investigate unidentified IP nodes in the surrounding scope. Zero missing fields do not establish correctness or complete coverage.");
  commonNotes(pdf); appendTables(pdf, appendices); pdf.footer(); return pdf.doc.save();
}

export async function createVulnerabilityInsightsPdf(data: VulnerabilityData, generatedAt = new Date(), options: InsightsPdfRenderOptions = {}): Promise<Uint8Array> {
  const { vulnerabilities, endpoints, coverage, snapshotDate } = data.model, rows = data.rows;
  const pdf = await begin(data, "Security Vulnerability Insights Report", generatedAt, "vulnerability", rows.length ? [
    `The selected snapshot contains ${count(vulnerabilities.total)} vulnerability observations across ${count(vulnerabilities.affectedEndpoints)} affected endpoints, referring to ${count(vulnerabilities.distinctCves)} distinct CVEs. These are different counting units and must not be added together.`,
    `${count(vulnerabilities.criticalHigh)} observations carry a critical or high source severity. This identifies records to validate first; severity alone does not confirm exploitation, applicability or an open remediation case.`,
    `${count(vulnerabilities.missingRemediation)} observations lack remediation text. Required discovery coverage also has ${count(coverage.gaps)} CIs with tool gaps. Evidence completeness and collection coverage qualify the recorded picture; neither proves vulnerability scanning is complete.`
  ] : [
    "No vulnerability observations are available for the selected scope, Security Domains and snapshot. This does not establish that endpoints were scanned or are vulnerability-free.",
    "The report retains the evidence fields and surrounding discovery context so missing observations can be investigated. No remediation status, exploitation finding or unseen vulnerable population is inferred."
  ], [
    rows.length ? `Validate the ${count(vulnerabilities.criticalHigh)} critical or high observations against affected versions, endpoint identity and source evidence before prioritising a response.` : "Confirm the selected scope and snapshot, then verify that vulnerability observations have been collected and associated with the intended endpoints.",
    vulnerabilities.missingRemediation
      ? `Review the ${count(vulnerabilities.missingRemediation)} observations without remediation text and confirm applicable vendor or operational actions. Treat populated text as supporting context, not proof of completed remediation.`
      : "No recorded observations lack remediation text in this scope. Verify that any supplied guidance applies to the affected versions and environment; populated text is supporting context, not proof of completed remediation.",
    `Investigate the ${count(coverage.missingChecks)} missing required discovery checks, alongside endpoint dates and source gaps. Confirm vulnerability scanning separately and regenerate this briefing after evidence corrections.`
  ], options), appendices: Appendix[] = [];
  const { facets } = queryExplorerRows(prepareExplorerRows(rows, vulnerabilityTableColumns), vulnerabilityTableColumns, emptyExplorerTableFilters());
  pdf.paragraph("Recorded vulnerability observations, missing context, provenance and discovery coverage.");
  pdf.cards([{ label: "Recorded observations", value: count(vulnerabilities.total) }, { label: "Distinct CVEs", value: count(vulnerabilities.distinctCves) },
    { label: "Affected endpoints", value: count(vulnerabilities.affectedEndpoints) }, { label: "Critical / high observations", value: count(vulnerabilities.criticalHigh), color: red }], 2);
  if (!rows.length) pdf.paragraph("No vulnerability observations in this scope. No observations does not establish that endpoints were scanned or are vulnerability-free.");
  pdf.paragraph("Five chapters: recorded exposure; evidence gaps; sources and context; discovery coverage; next steps. Appendices retain every group, including those collapsed on the page.");

  pdf.pageFor("01 / Recorded exposure");
  pdf.paragraph("Observation, CVE and endpoint counts are different units and are not additive. Repeated CVEs and persisted observations retain their identities; these are not counts of open remediation cases.");
  distribution(pdf, "Recorded severity", vulnerabilities.severities.map(row => ({ value: row.severity, count: row.count, color: ["Critical", "High"].includes(row.severity) ? red : amber })), rows.length, "vulnerability observations", appendices, `${count(vulnerabilities.criticalHigh)} observations are labelled critical or high by the source. Use this distribution to direct validation effort, retaining unrecognised and missing severity values for review.`);
  pdf.paragraph("Severity is retained from the source, including missing or unrecognised values. It is not a new risk score or evidence of exploitation.");
  distribution(pdf, "CVE codes", byCount(facets.cve), rows.length, "vulnerability observations", appendices, `${count(vulnerabilities.distinctCves)} distinct CVEs are represented. The bars count observations per recorded code, so repeated codes can reflect several affected endpoints or evidence records rather than separate CVEs.`);
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
  for (const [key, title, narrative] of [
    ["softwareName", "Affected software", "These groups show which recorded software names carry observations. Several records may refer to one installation or product, so the distribution is not a software installation count. Validate versions and applicability before assigning remediation."],
    ["osName", "Operating systems", "Operating system labels provide endpoint context for the observations. A platform with more observations is not necessarily less secure: endpoint counts, collection depth and repeated findings can affect the recorded distribution."],
    ["source", "Detection sources", "Source labels show the provenance of the recorded observations. Missing labels make verification harder; a named source is not proof of a complete scan or independent confirmation of each finding."],
    ["detectedDate", "Detection dates", "Recorded detection dates describe when observations were detected, not when every endpoint was last scanned. Repeated dates can reflect collection batches and do not establish whether remediation remains outstanding."]
  ] as const) {
    distribution(pdf, title, byCount(facets[key]), rows.length, "vulnerability observations", appendices, narrative);
  }
  pdf.paragraph("Detection date is not a last-scan date. CVE creation is the record reservation date, not publication or endpoint detection. Older detections alone do not prove stale scans or unresolved remediation. The selected inventory excludes detections after the snapshot.");

  pdf.pageFor("04 / Discovery coverage"); coverageSection(pdf, data.model);
  pdf.heading("Endpoint discovery context");
  pdf.paragraph(`These checks cover all ${count(endpoints.total)} End Point Explorer records in scope, not only endpoints with vulnerability observations. Age is relative to ${snapshotDate}, and does not redefine coverage compliance.`);
  pdf.table(["Discovery check", "Endpoint records"], [["Discoveries over 30 days old", count(endpoints.stale)], ["Missing or invalid discovery dates", count(endpoints.undated)], ["Missing discovery sources", count(endpoints.missingSource)]], [WIDTH - 120, 120]);

  pdf.pageFor("05 / Next steps");
  pdf.paragraph("Prioritise source validation and actionable evidence before drawing assurance conclusions. The actions below connect the recorded severity, remediation context and collection gaps; they are review prompts rather than new risk scores or remediation-status rules.");
  pdf.heading("Review the highest recorded severities"); pdf.paragraph(`${count(vulnerabilities.criticalHigh)} critical / high observations. Validate affected versions, applicability and recorded exposure before deciding a response.`);
  pdf.heading("Make remediation evidence actionable"); pdf.paragraph(`${count(vulnerabilities.missingRemediation)} observations have no remediation text. Review source evidence and record the applicable vendor or operational action. Text presence alone does not confirm remediation.`);
  pdf.heading("Strengthen the collection picture"); pdf.paragraph(`${count(coverage.gaps)} CIs have required tool gaps. Discovery coverage is separate from a verified vulnerability scan. Zero observations or gaps do not establish scanned, remediated or vulnerability-free endpoints.`);
  commonNotes(pdf); pdf.paragraph("Unassigned networks, unidentified IP nodes and future detections are excluded from the vulnerability inventory. No scan-age, remediation-status or inferred vulnerable-population calculation is introduced.");
  appendTables(pdf, appendices); pdf.footer(); return pdf.doc.save();
}
