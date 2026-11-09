import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { createReportPage } from "@/lib/report-template-pdf";
import { DISCOVERY_OVERVIEW_NOTES, discoveryOverviewActions } from "@/lib/discovery-overview";
import type { DiscoveryOverviewData } from "@/lib/discovery-overview-data";
import { formatAssetTypeLabel } from "@/lib/asset-taxonomy";
import { drawInsightsOpeningPage, drawInsightsPageFrame, drawInsightsRingArc, INSIGHTS_PDF_THEME, loadInsightsPdfAssets, type InsightsPdfAssets, type InsightsReportKind } from "@/lib/insights-pdf-theme";

const LEFT = 32, WIDTH = 531.28, BOTTOM = 48;
const { ink, muted, pale, line, teal, amber } = INSIGHTS_PDF_THEME;
const red = INSIGHTS_PDF_THEME.rose, grey = rgb(.48,.55,.62);
const count = (value: number) => value.toLocaleString("en-AU");
const percent = (value: number | null) => value === null ? "N/A" : value + "%";
const share = (value: number, total: number) => total ? percent(Math.round(value / total * 1000) / 10) : "N/A";
type Bar = { label: string; count: number; color?: RGB };

/** Vector charts and measured text keep the report independent of browser rendering and downloads. */
export class OverviewPdf {
  page!: PDFPage;
  y = 0;
  section = "";
  constructor(readonly doc: PDFDocument, readonly regular: PDFFont, readonly bold: PDFFont, readonly date: string, readonly title = "Discovery Insights Report", readonly assets?: InsightsPdfAssets, readonly kind: InsightsReportKind = "discovery") {}
  safe(value: string): string {
    return Array.from(value.normalize("NFKC").replace(/[\u2010-\u2015]/g,"-").replace(/[\r\n\t]/g," "))
      .map(char => { try { this.regular.encodeText(char); return char; } catch { return "?"; } }).join("");
  }
  wrap(value: string, width: number, size = 9, font = this.regular): string[] {
    const lines: string[] = []; let current = "";
    for (const word of this.safe(value).split(/\s+/).filter(Boolean)) {
      const proposed = current ? current + " " + word : word;
      if (font.widthOfTextAtSize(proposed,size) <= width) { current = proposed; continue; }
      if (current) lines.push(current); current = "";
      // Break unspaced identifiers rather than allowing them to run through adjacent cells.
      for (const char of word) {
        if (current && font.widthOfTextAtSize(current + char,size) > width) { lines.push(current); current = ""; }
        current += char;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [""];
  }
  text(value: string, x: number, y: number, size = 9, bold = false, color = ink) {
    this.page.drawText(this.safe(value), { x,y,size,font: bold ? this.bold : this.regular,color });
  }
  pageFor(section: string, continued = false) {
    this.section = section;
    if (this.assets) {
      this.page = this.doc.addPage([595.28,841.89]);
      this.y = drawInsightsPageFrame(this.page,this.assets,{kind:this.kind,title:this.title,snapshotDate:this.date,section,continued});
      return;
    }
    const result = createReportPage({ pdfDoc: this.doc, pageTitle: this.title, snapshotDate: this.date, fontRegular: this.regular, fontBold: this.bold });
    this.page = result.page; this.y = result.y;
    for (const title of this.wrap(section + (continued ? " - continued" : ""), WIDTH, 17, this.bold)) {
      this.text(title,LEFT,this.y,17,true); this.y -= 22;
    }
    this.y -= 5;
  }
  ensure(height: number) { if (this.y - height < BOTTOM) this.pageFor(this.section,true); }
  paragraph(value: string, size = 9, color = muted) {
    const lines=this.wrap(value,WIDTH,size),height=lines.length*(size+4)+7;
    const freshSpace=this.assets ? 657-this.wrap(this.section+" - continued",492,15,this.bold).length*20-10-BOTTOM : 620;
    if(height<=freshSpace) this.ensure(height);
    for (const text of lines) { this.ensure(size + 6); this.text(text,LEFT,this.y,size,false,color); this.y -= size + 4; }
    this.y -= 7;
  }
  heading(value: string, narrative?: string) {
    this.ensure(narrative ? Math.min(500,21+this.wrap(narrative,WIDTH).length*13+7+36) : 56);
    this.text(value,LEFT,this.y,11,true); this.y -= 21;
    if (narrative) this.paragraph(narrative);
  }
  cards(cards: Array<{ label: string; value: string; color?: RGB }>, columns = 3) {
    const width = (WIDTH - (columns - 1) * 12) / columns, height = 88;
    for (let offset = 0; offset < cards.length; offset += columns) {
      this.ensure(height + 12);
      cards.slice(offset,offset+columns).forEach((card,index) => {
        const x = LEFT + index * (width + 12);
        this.page.drawRectangle({ x,y:this.y-height,width,height,color:pale,borderColor:line,borderWidth:.6 });
        this.page.drawRectangle({ x,y:this.y-height,width:3,height,color:card.color ?? teal });
        this.wrap(card.label,width-22,9,this.bold).slice(0,2).forEach((label,i)=>this.text(label,x+11,this.y-18-i*12,9,true));
        this.text(card.value,x+11,this.y-70,25,true,card.color ?? ink);
      });
      this.y -= height + 12;
    }
  }
  table(headers: string[], rows: string[][], widths: number[]) {
    const header = () => {
      let x = LEFT;
      headers.forEach((label,i)=> {
        this.page.drawRectangle({x,y:this.y-24,width:widths[i],height:24,color:ink});
        this.text(label,x+6,this.y-16,8,true,rgb(1,1,1)); x += widths[i];
      }); this.y -= 24;
    };
    this.ensure(62); header();
    const actual = rows.length ? rows : [["None in this scope.",...headers.slice(1).map(()=>"")]];
    for (const [rowIndex,row] of actual.entries()) {
      const cells = headers.map((_,i)=>this.wrap(row[i] ?? "",widths[i]-12,9));
      const lines = Math.max(...cells.map(cell=>cell.length));
      if (lines*12+12 <= 620 && this.y-(lines*12+12)<BOTTOM) { this.pageFor(this.section,true); header(); }
      let offset = 0;
      while (offset < lines) {
        let available = Math.floor((this.y-BOTTOM-12)/12);
        if (available < 1) { this.pageFor(this.section,true); header(); available = Math.floor((this.y-BOTTOM-12)/12); }
        const used = Math.min(lines-offset,available), height = used*12+12;
        let x = LEFT;
        cells.forEach((cell,i)=> {
          this.page.drawRectangle({ x,y:this.y-height,width:widths[i],height,color:rowIndex%2 ? rgb(1,1,1) : pale,borderColor:line,borderWidth:.4 });
          const visible = cell.slice(offset,offset+used);
          if (offset && i===0 && !visible.length) visible.push("(continued)");
          visible.forEach((label,j)=>this.text(label,x+6,this.y-15-j*12,9)); x+=widths[i];
        });
        this.y -= height; offset += used;
      }
    }
    this.y -= 17;
  }
  bars(rows: Bar[], total: number) {
    if (!rows.length) { this.paragraph("No observations are recorded for this scope."); return; }
    for (const row of rows) {
      const labels = this.wrap(row.label,148,9), shown = labels.slice(0,3);
      if (labels.length>3) shown[2] = shown[2].slice(0,-3)+"...";
      const height = Math.max(29,shown.length*12+8); this.ensure(height+8);
      shown.forEach((label,i)=>this.text(label,LEFT,this.y-12-i*12));
      const x=LEFT+157, width=257, barY=this.y-17;
      this.page.drawRectangle({x,y:barY,width,height:10,color:line});
      const covered = total ? Math.max(0,Math.min(1,row.count/total)) : 0;
      if (covered) this.page.drawRectangle({x,y:barY,width:width*covered,height:10,color:row.color ?? teal});
      const label=count(row.count)+" / "+share(row.count,total);
      this.text(label,LEFT+WIDTH-this.regular.widthOfTextAtSize(label,8),this.y-13,8);
      this.y -= height;
    }
    this.y -= 12;
  }
  toolCards(tools: DiscoveryOverviewData["model"]["coverage"]["tools"], columns = 3) {
    if (!tools.length) { this.paragraph("N/A - no discovery tools are applicable to the CIs in this scope."); return; }
    const width=(WIDTH-(columns-1)*12)/columns,height=142;
    for(let offset=0;offset<tools.length;offset+=columns){
      this.ensure(height+14);
      tools.slice(offset,offset+columns).forEach((tool,index)=>{
        const x=LEFT+index*(width+12),color=tool.applicable ? tool.missing ? red : teal : grey;
        this.page.drawRectangle({x,y:this.y-height,width,height,color:pale,borderColor:line,borderWidth:.7});
        this.page.drawRectangle({x,y:this.y-height,width:4,height,color});
        const labels=this.wrap(tool.label,width-28,11,this.bold),shown=labels.slice(0,2);
        if(labels.length>2) shown[1]=shown[1].slice(0,-3)+"...";
        shown.forEach((label,i)=>this.text(label,x+14,this.y-21-i*14,11,true));
        this.text(percent(tool.applicable ? tool.coveragePercent : null),x+14,this.y-67,29,true,color);
        this.text(!tool.applicable ? "NOT APPLICABLE" : tool.missing ? "COVERAGE GAPS" : "COMPLETE COVERAGE",x+14,this.y-83,8,true,color);
        const barWidth=width-28,covered=tool.applicable ? tool.covered/tool.applicable : 0;
        this.page.drawRectangle({x:x+14,y:this.y-99,width:barWidth,height:8,color:tool.applicable ? rgb(.94,.81,.82) : line});
        if(covered>0) this.page.drawRectangle({x:x+14,y:this.y-99,width:barWidth*covered,height:8,color:teal});
        this.text(count(tool.covered)+" / "+count(tool.applicable)+" covered",x+14,this.y-116,9);
        const missing=count(tool.missing)+" missing";
        this.text(missing,x+14,this.y-132,9,true,color);
      });this.y-=height+14;
    }
  }
  footer() {
    const pages=this.doc.getPages();
    pages.forEach((page,index)=>{
      page.drawLine({start:{x:LEFT,y:35},end:{x:LEFT+WIDTH,y:35},thickness:.5,color:line});
      const label=(index+1)+" / "+pages.length;
      page.drawText(label,{x:LEFT+WIDTH-this.regular.widthOfTextAtSize(label,8),y:21,font:this.regular,size:8,color:muted});
    });
  }
}

export function coverageRing(pdf: OverviewPdf, coverage: DiscoveryOverviewData["model"]["coverage"]) {
  pdf.ensure(134);
  const x=LEFT+65,y=pdf.y-58,radius=46;
  pdf.page.drawCircle({x,y,size:radius,borderWidth:10,borderColor:line});
  const fraction=coverage.percent===null ? 0 : Math.max(0,Math.min(1,coverage.percent/100));
  drawInsightsRingArc(pdf.page,{x,y,radius,fraction,thickness:10,color:teal});
  const value=percent(coverage.percent);
  pdf.text(value,x-pdf.bold.widthOfTextAtSize(value,22)/2,y-7,22,true,teal);
  pdf.text("required tool coverage",LEFT+17,pdf.y-124,9,true);
  pdf.text(count(coverage.compliant)+" compliant CIs",LEFT+156,pdf.y-40,18,true,teal);
  pdf.text(count(coverage.gaps)+" CIs with gaps",LEFT+156,pdf.y-71,18,true,red);
  pdf.text("Required discovery checks at this snapshot",LEFT+156,pdf.y-98,9,false,muted);
  pdf.y-=145;
}

export async function createDiscoveryOverviewPdf(data: DiscoveryOverviewData, generatedAt = new Date()): Promise<Uint8Array> {
  if (!Number.isFinite(generatedAt.getTime())) throw Error("Invalid report generation date.");
  const doc=await PDFDocument.create(),regular=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle("Discovery Insights Report"); doc.setAuthor("TSAAT"); doc.setCreationDate(generatedAt);
  const assets=await loadInsightsPdfAssets(doc,"discovery");
  const pdf=new OverviewPdf(doc,regular,bold,data.model.snapshotDate,"Discovery Insights Report",assets,"discovery");
  const {coverage,endpoints,software,vulnerabilities,patches,shadow}=data.model;
  const actions=discoveryOverviewActions(data.model);
  const hasEvidence=Boolean(coverage.total || endpoints.total || software.total || shadow.total || vulnerabilities.total || patches.total);
  const scopeLines=[
    ...data.scopeLabels.networks.map(label=>"Managed network: "+label),
    ...data.scopeLabels.systems.map(label=>"ICT system: "+label),
    "Security domains: "+(data.scopeLabels.domains.join(", ") || "None selected")
  ];
  drawInsightsOpeningPage(doc,assets,{
    kind:"discovery",title:"Discovery Insights Report",snapshotDate:data.model.snapshotDate,generatedAt,scopeLines,
    summary:hasEvidence ? [
      "This snapshot describes "+count(coverage.total)+" configuration items, "+count(endpoints.total)+" endpoint records and "+count(software.total)+" software installations. These are different counting units and must not be added together.",
      coverage.applicableChecks
        ? "Required discovery coverage is "+percent(coverage.percent)+", with "+count(coverage.missingChecks)+" missing tool-to-CI checks. "+count(endpoints.stale)+" endpoints were last discovered over 30 days before the snapshot; "+count(endpoints.undated)+" have no usable discovery date."
        : "Required discovery coverage is N/A because there are no applicable tool-to-CI checks. "+count(endpoints.stale)+" endpoint records are older than 30 days; "+count(endpoints.undated)+" have no usable discovery date.",
      "Security follow-up includes "+count(vulnerabilities.criticalHigh)+" critical or high vulnerability observations and "+count(patches.overdue)+" servers with overdue patch actions. These separate evidence sets inform investigation; they do not establish remediation status."
    ] : [
      "No discovery records are available for the selected scope, Security Domains and snapshot. Coverage and patch percentages are N/A because there are no applicable records to assess.",
      "The following sections preserve the empty categories and counting rules. An absence of recorded observations does not establish complete discovery or the absence of vulnerabilities."
    ],
    recommendations:actions.length ? [
      ...actions.slice(0,2).map(action=>action.title+" for "+count(action.count)+" "+action.unit+". "+action.detail),
      (actions[2] ? actions[2].title+" for "+count(actions[2].count)+" "+actions[2].unit+". " : "")+"Use the detailed sections and matching Explorers to confirm ownership and supporting evidence. Checks can overlap; do not add them into a single issue total."
    ] : [
      hasEvidence ? "No positive-count actions are triggered by the existing discovery checks. Review the evidence quality and tool mappings before treating this as assurance of completeness." : "Confirm that the intended network or ICT system, Security Domains and snapshot are selected, then check that discovery evidence has been collected for that selection.",
      "Use the Explorers to verify dates, sources and ownership. Re-run this briefing after the evidence or scope is corrected; avoid assigning a complete-coverage conclusion to an empty denominator."
    ]
  });
  const ageColors=[teal,rgb(.1,.52,.7),amber,red,rgb(.47,.37,.64),grey];
  const ageBars=(ages: typeof endpoints.ages)=>ages.map((row,index)=>({label:row.age,count:row.count,color:ageColors[index]}));
  pdf.pageFor("Summary and scope");
  pdf.paragraph("Discover the estate. Understand the gaps.",11,ink);
  pdf.paragraph("This briefing brings together discovery coverage, inventory evidence, vulnerability observations and server patch readiness. The headline findings identify where investigation may be needed; they describe the selected snapshot rather than change over time.");
  if(data.scopeLabels.networks.length) pdf.paragraph("Managed networks: "+data.scopeLabels.networks.join("; "));
  if(data.scopeLabels.systems.length) pdf.paragraph("ICT systems: "+data.scopeLabels.systems.join("; "));
  pdf.paragraph("Security domains: "+(data.scopeLabels.domains.join(", ") || "None selected")+". Generated: "+generatedAt.toISOString().replace("T"," ").replace(/\.\d{3}Z$/," UTC"));
  pdf.cards([
    {label:"Critical / high CVE observations",value:count(vulnerabilities.criticalHigh),color:red},
    {label:"Servers with overdue patch actions",value:count(patches.overdue),color:amber},
    {label:"CIs with coverage gaps",value:count(coverage.gaps),color:amber},
    {label:"Endpoints last seen >30 days ago",value:count(endpoints.stale)},
    {label:"Software with no version",value:count(software.missingVersion)},
    {label:"Unidentified IP nodes",value:count(shadow.total)}
  ]);
  pdf.heading("Scope at a glance","The inventories below describe different parts of the discovery story. A CI may contribute several required checks, installations or observations, so these totals are not a single population of devices.");
  pdf.table(["Inventory / evidence","Total","Counting unit"],[
    ["Discovery coverage",count(coverage.total),"Configuration items (CIs)"],
    ["Applicable discovery tools",count(coverage.tools.length),"Tools with required CI mappings"],
    ["Endpoint discovery",count(endpoints.total),"Endpoint records"],
    ["Software inventory",count(software.total),"Individual installations"],
    ["Security vulnerabilities",count(vulnerabilities.total),"Recorded CVE observations"],
    ["Server patch management",count(patches.total),"Servers"],
    ["Shadow IT",count(shadow.total),"Unidentified IP nodes"]
  ],[230,70,WIDTH-300]);

  pdf.pageFor("Discovery tool coverage - report cards");
  pdf.paragraph("Coverage compares the required discovery tools with recorded evidence. Each card separates covered (teal) and missing (rose) checks for one tool. Full tool labels and counts follow.");
  coverageRing(pdf,coverage);
  pdf.paragraph(count(coverage.coveredChecks)+" / "+count(coverage.applicableChecks)+" required tool-to-CI checks covered; "+count(coverage.missingChecks)+" checks missing.");
  pdf.paragraph(count(coverage.unmapped)+" CIs have no applicable tool mapping. These CIs count as compliant because no tool is required, and are excluded from the coverage percentage. No applicable checks is N/A, not 100%.");
  pdf.toolCards(coverage.tools,4);

  pdf.pageFor("Tool coverage detail and CI footprint");
  pdf.paragraph("The complete tool table retains every applicable tool and its covered, missing and required checks. Read this alongside the CI footprint to distinguish a broad inventory from the subset with configured discovery requirements.");
  pdf.table(["Discovery tool","Covered","Missing","Required","Coverage"],coverage.tools.map(tool=>[tool.label,count(tool.covered),count(tool.missing),count(tool.applicable),percent(tool.applicable ? tool.coveragePercent : null)]),[243.28,68,68,76,76]);
  pdf.heading("Configuration items in scope",count(coverage.total)+" CIs are represented below. Each bar gives the in-scope count and share; its label also gives the CIs used in coverage because they require at least one tool. Multiple requirements can produce more checks than CIs.");
  const ciBars=coverage.ciTypes.map(row=>({label:formatAssetTypeLabel(row.type)+" ("+count(row.usedInCalculations)+" used in coverage)",count:row.inScope}));
  pdf.bars(ciBars,coverage.total);
  if(ciBars.some(row=>pdf.wrap(row.label,148).length>3)) pdf.table(["CI type","In scope","Used in coverage"],coverage.ciTypes.map(row=>[formatAssetTypeLabel(row.type),count(row.inScope),count(row.usedInCalculations)]),[271.28,100,160]);

  pdf.pageFor("Security vulnerabilities");
  pdf.paragraph("The vulnerability evidence contains "+count(vulnerabilities.total)+" observations across "+count(vulnerabilities.affectedEndpoints)+" endpoints. "+count(vulnerabilities.criticalHigh)+" observations are labelled Critical or High by their source. These are investigation leads, not open remediation-case counts; no observations does not establish that an endpoint is vulnerability-free.");
  pdf.cards([{label:"Recorded observations",value:count(vulnerabilities.total)},{label:"Distinct CVE codes",value:count(vulnerabilities.distinctCves)},{label:"Affected endpoints",value:count(vulnerabilities.affectedEndpoints)}]);
  pdf.heading("Observations by source severity","The distribution preserves the severity recorded by the source, including unknown or other values. Repeated CVEs on different endpoints remain separate observations, so distinct CVEs and affected endpoints provide complementary context.");
  pdf.bars(vulnerabilities.severities.map(row=>({label:row.severity,count:row.count,color:row.severity==="Critical"||row.severity==="High" ? red : row.severity==="Medium" ? amber : grey})),vulnerabilities.total);
  if(vulnerabilities.severities.some(row=>pdf.wrap(row.severity,148).length>3)) pdf.table(["Severity","Observations","Share"],vulnerabilities.severities.map(row=>[row.severity,count(row.count),share(row.count,vulnerabilities.total)]),[291.28,120,120]);
  pdf.heading("Remediation evidence",count(vulnerabilities.missingRemediation)+" observations have no recorded remediation action. Validate the observation and obtain suitable guidance before creating or closing remediation work.");
  pdf.table(["Evidence check","Observations"],[["Remediation action not recorded",count(vulnerabilities.missingRemediation)]],[391.28,140]);

  pdf.pageFor("Server patch management");
  pdf.paragraph("Server patch evidence complements the vulnerability inventory. "+count(patches.patched)+" of "+count(patches.total)+" servers have current verified evidence with no required restart; "+count(patches.unknown)+" have unknown or stale evidence. Unknown servers remain in the verified percentage denominator; an empty server scope is N/A.");
  pdf.cards([{label:"Patched and verified",value:percent(patches.verifiedPercent),color:teal},{label:"Overdue actions",value:count(patches.overdue),color:amber},{label:"Unknown / stale evidence",value:count(patches.unknown),color:grey}]);
  const patchLabel=(status:string)=>status==="Patched" ? "Patched and verified" : status==="Unknown" ? "Unknown / stale evidence" : status;
  pdf.heading("Status across "+count(patches.total)+" servers","All six status categories remain visible, including Unknown. Overdue actions overlap these categories and exceptions do not hide overdue work. CVE observations do not prove that an OS patch is missing.");
  pdf.bars(patches.statuses.map(row=>({label:patchLabel(row.status),count:row.count,color:row.status==="Patched" ? teal : row.status==="Unknown" ? grey : row.status==="Failed" ? red : amber})),patches.total);

  pdf.pageFor("Endpoint discovery");
  pdf.paragraph("Endpoint discovery dates show how recent the recorded inventory is relative to "+data.model.snapshotDate+". "+count(endpoints.stale)+" endpoints were last seen more than 30 days earlier, and "+count(endpoints.undated)+" lack a usable discovery date; neither group should be treated as recent evidence.");
  pdf.cards([{label:"Endpoint records",value:count(endpoints.total)},{label:"Last discovered >30 days",value:count(endpoints.stale),color:amber},{label:"Discovery date missing",value:count(endpoints.undated),color:grey}]);
  pdf.heading("Discovery age relative to the snapshot","The >30-day prompt includes 31-90 days and Over 90 days only. Missing and after-snapshot dates remain separate. Every bucket shows its count and share; discovery age does not change required-tool compliance."); pdf.bars(ageBars(endpoints.ages),endpoints.total);
  pdf.heading("Discovery source evidence",count(endpoints.missingSource)+" endpoint records have no named discovery source. Recording the collector makes it easier to trace an observation and request a refresh when its age or identity is uncertain.");
  pdf.table(["Evidence check","Endpoints"],[["Discovery source not recorded",count(endpoints.missingSource)]],[391.28,140]);

  pdf.pageFor("Software inventory");
  pdf.paragraph("The software inventory records "+count(software.total)+" installations spanning "+count(software.products)+" products on "+count(software.endpoints)+" endpoints. An installation is counted separately on each endpoint, so this is evidence of software presence rather than a licence or device total.");
  pdf.cards([{label:"Recorded installations",value:count(software.total)},{label:"Products",value:count(software.products)},{label:"Endpoints with software",value:count(software.endpoints)}]);
  const softwareChecks=[{label:"Version not recorded",count:software.missingVersion},{label:"Last discovered >30 days",count:software.stale},{label:"Date not recorded",count:software.undated},{label:"Source not recorded",count:software.missingSource},{label:"Date after snapshot",count:software.afterSnapshot}];
  pdf.heading("Inventory evidence checks",count(software.missingVersion)+" installations lack a version and "+count(software.missingSource)+" have no recorded source. These gaps can hinder identification and follow-up. Checks overlap and must not be summed; missing versions are not inferred."); pdf.bars(softwareChecks,software.total);

  pdf.pageFor("Shadow IT");
  pdf.paragraph("Shadow IT describes "+count(shadow.total)+" unidentified IP nodes observed through discovery, not confirmed managed endpoints. "+count(shadow.owners)+" distinct ARP owner endpoints supplied observation tables and are counted separately. System scope includes observations associated through these owners.");
  pdf.cards([{label:"Unidentified IP nodes",value:count(shadow.total)},{label:"ARP owner endpoints",value:count(shadow.owners)},{label:"Last discovered >30 days",value:count(shadow.stale),color:amber}]);
  pdf.heading("Discovery approach","IP Scan and ARP Table observations describe how the unidentified nodes were found. Use the collection method and owner context to locate and identify each device before updating the managed inventory.");
  const approaches=[{label:"IP Scan",count:shadow.ipScan},{label:"ARP Table",count:shadow.arp}];
  pdf.bars(approaches,shadow.total);
  pdf.heading("Evidence quality",count(shadow.stale)+" nodes have evidence older than 30 days and "+count(shadow.undated)+" have no usable date. Check the source and timing before interpreting an unidentified node as still present; these checks can overlap.");
  pdf.table(["Evidence check","IP nodes"],[["Last discovered >30 days",count(shadow.stale)],["Date not recorded",count(shadow.undated)],["Source not recorded",count(shadow.missingSource)],["Date after snapshot",count(shadow.afterSnapshot)]],[391.28,140]);

  pdf.pageFor("Suggested actions and calculation notes");
  pdf.paragraph("The actions below are the same positive-count discovery checks shown on the Insights page. They preserve the evidence counts and practical next steps; they are neither a new risk ranking nor a deduplicated work queue.");
  pdf.table(["Suggested action","Count / unit","Next step"],actions.map(action=>[action.title,count(action.count)+" "+action.unit,action.detail]),[190,91,250.28]);
  if(!actions.length) pdf.paragraph("No suggested actions are triggered by the recorded overview counts. This does not establish that the environment is vulnerability-free.");
  pdf.heading("Calculation notes","These rules explain the boundaries of the briefing and keep its evidence comparable with the Explorers. Retain the selected scope and snapshot when investigating a figure so that the same records are being compared.");
  for(const note of DISCOVERY_OVERVIEW_NOTES) pdf.paragraph(note);
  pdf.paragraph("Required-tool applicability uses the saved Discovery Tools settings at report generation, matching the overview page. Counts are point-in-time summaries rather than trends. Current explorer data is the source for detailed investigation.");
  pdf.footer();
  return doc.save();
}
