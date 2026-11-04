import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { createReportPage } from "@/lib/report-template-pdf";
import { DISCOVERY_OVERVIEW_NOTES, discoveryOverviewActions } from "@/lib/discovery-overview";
import type { DiscoveryOverviewData } from "@/lib/discovery-overview-data";
import { formatAssetTypeLabel } from "@/lib/asset-taxonomy";

const LEFT = 32, WIDTH = 531.28, BOTTOM = 48;
const ink = rgb(.07,.2,.31), muted = rgb(.33,.4,.47), pale = rgb(.95,.97,.99), line = rgb(.81,.87,.91);
const teal = rgb(.06,.51,.48), red = rgb(.76,.21,.26), amber = rgb(.76,.45,.08), grey = rgb(.48,.55,.62);
const count = (value: number) => value.toLocaleString("en-AU");
const percent = (value: number | null) => value === null ? "N/A" : value + "%";
const share = (value: number, total: number) => total ? percent(Math.round(value / total * 1000) / 10) : "N/A";
type Bar = { label: string; count: number; color?: RGB };

/** Vector charts and measured text keep the report independent of browser rendering and downloads. */
class OverviewPdf {
  page!: PDFPage;
  y = 0;
  section = "";
  constructor(readonly doc: PDFDocument, readonly regular: PDFFont, readonly bold: PDFFont, readonly date: string) {}
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
    const result = createReportPage({ pdfDoc: this.doc, pageTitle: "Discovery Overview Report", snapshotDate: this.date, fontRegular: this.regular, fontBold: this.bold });
    this.page = result.page; this.y = result.y;
    for (const title of this.wrap(section + (continued ? " - continued" : ""), WIDTH, 17, this.bold)) {
      this.text(title,LEFT,this.y,17,true); this.y -= 22;
    }
    this.y -= 5;
  }
  ensure(height: number) { if (this.y - height < BOTTOM) this.pageFor(this.section,true); }
  paragraph(value: string, size = 9, color = muted) {
    for (const text of this.wrap(value,WIDTH,size)) { this.ensure(size + 6); this.text(text,LEFT,this.y,size,false,color); this.y -= size + 4; }
    this.y -= 7;
  }
  heading(value: string) { this.ensure(56); this.text(value,LEFT,this.y,11,true); this.y -= 21; }
  cards(cards: Array<{ label: string; value: string; color?: RGB }>) {
    const width = (WIDTH - 24) / 3, height = 88;
    for (let offset = 0; offset < cards.length; offset += 3) {
      this.ensure(height + 12);
      cards.slice(offset,offset+3).forEach((card,index) => {
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
  toolCards(tools: DiscoveryOverviewData["model"]["coverage"]["tools"]) {
    if (!tools.length) { this.paragraph("N/A - no discovery tools are applicable to the CIs in this scope."); return; }
    const width=(WIDTH-24)/3,height=142;
    for(let offset=0;offset<tools.length;offset+=3){
      this.ensure(height+14);
      tools.slice(offset,offset+3).forEach((tool,index)=>{
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

export async function createDiscoveryOverviewPdf(data: DiscoveryOverviewData, generatedAt = new Date()): Promise<Uint8Array> {
  if (!Number.isFinite(generatedAt.getTime())) throw Error("Invalid report generation date.");
  const doc=await PDFDocument.create(),regular=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle("Discovery Overview Report"); doc.setAuthor("TSAAT"); doc.setCreationDate(generatedAt);
  const pdf=new OverviewPdf(doc,regular,bold,data.model.snapshotDate);
  const {coverage,endpoints,software,vulnerabilities,patches,shadow}=data.model;
  const ageColors=[teal,rgb(.1,.52,.7),amber,red,rgb(.47,.37,.64),grey];
  const ageBars=(ages: typeof endpoints.ages)=>ages.map((row,index)=>({label:row.age,count:row.count,color:ageColors[index]}));
  const ageTable=(ages: typeof endpoints.ages,total:number)=>ages.map(row=>[row.age,count(row.count),share(row.count,total)]);
  pdf.pageFor("Summary and scope");
  pdf.paragraph("Discovery coverage, inventory evidence, security vulnerabilities and server patch readiness.",11,ink);
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
  pdf.heading("Scope at a glance");
  pdf.table(["Inventory / evidence","Total","Counting unit"],[
    ["Discovery coverage",count(coverage.total),"Configuration items (CIs)"],
    ["Applicable discovery tools",count(coverage.tools.length),"Tools with required CI mappings"],
    ["Endpoint discovery",count(endpoints.total),"Endpoint records"],
    ["Software inventory",count(software.total),"Individual installations"],
    ["Security vulnerabilities",count(vulnerabilities.total),"Recorded CVE observations"],
    ["Server patch management",count(patches.total),"Servers"],
    ["Shadow IT",count(shadow.total),"Unidentified IP nodes"]
  ],[230,70,WIDTH-300]);
  pdf.paragraph("These totals describe different inventories and must not be added together. All sections use the same applied header scope and resolved snapshot as Discovery Overview.");

  pdf.pageFor("Discovery tool coverage - report cards");
  pdf.cards([{label:"Required tool coverage",value:percent(coverage.percent)},{label:"Compliant CIs",value:count(coverage.compliant),color:teal},{label:"CIs with gaps",value:count(coverage.gaps),color:red}]);
  pdf.paragraph(count(coverage.coveredChecks)+" / "+count(coverage.applicableChecks)+" required tool-to-CI checks covered; "+count(coverage.missingChecks)+" checks missing.");
  pdf.paragraph("Each card compares covered and missing required checks for one tool. Green = covered; red = missing. Tools are ordered by missing checks. Full tool names and counts appear in the following table.");
  pdf.toolCards(coverage.tools);
  pdf.paragraph(count(coverage.unmapped)+" CIs have no applicable tool mapping. These CIs count as compliant because no tool is required, and are excluded from the coverage percentage. No applicable checks is N/A, not 100%.");

  pdf.pageFor("Tool coverage detail and CI footprint");
  pdf.table(["Discovery tool","Covered","Missing","Required","Coverage"],coverage.tools.map(tool=>[tool.label,count(tool.covered),count(tool.missing),count(tool.applicable),percent(tool.applicable ? tool.coveragePercent : null)]),[243.28,68,68,76,76]);
  pdf.heading("Configuration items in scope");
  pdf.bars(coverage.ciTypes.map(row=>({label:formatAssetTypeLabel(row.type),count:row.inScope})),coverage.total);
  pdf.table(["CI type","In scope","Used in coverage"],coverage.ciTypes.map(row=>[formatAssetTypeLabel(row.type),count(row.inScope),count(row.usedInCalculations)]),[271.28,100,160]);
  pdf.paragraph("Used in coverage counts CIs with at least one required discovery tool. Tool-to-CI checks can exceed the CI count when several tools are required.");

  pdf.pageFor("Security vulnerabilities");
  pdf.cards([{label:"Recorded observations",value:count(vulnerabilities.total)},{label:"Distinct CVE codes",value:count(vulnerabilities.distinctCves)},{label:"Affected endpoints",value:count(vulnerabilities.affectedEndpoints)}]);
  pdf.heading("Observations by source severity");
  pdf.bars(vulnerabilities.severities.map(row=>({label:row.severity,count:row.count,color:row.severity==="Critical"||row.severity==="High" ? red : row.severity==="Medium" ? amber : grey})),vulnerabilities.total);
  pdf.table(["Severity","Observations","Share"],vulnerabilities.severities.map(row=>[row.severity,count(row.count),share(row.count,vulnerabilities.total)]),[291.28,120,120]);
  pdf.table(["Evidence check","Observations"],[["Remediation action not recorded",count(vulnerabilities.missingRemediation)]],[391.28,140]);
  pdf.paragraph("Counts describe recorded observations, not open remediation cases. Repeated CVEs on different endpoints remain separate observations. Source severity is not a new risk score. No observations does not establish that an endpoint is vulnerability-free.");

  pdf.pageFor("Server patch management");
  pdf.cards([{label:"Patched and verified",value:percent(patches.verifiedPercent),color:teal},{label:"Overdue actions",value:count(patches.overdue),color:amber},{label:"Unknown / stale evidence",value:count(patches.unknown),color:grey}]);
  const patchLabel=(status:string)=>status==="Patched" ? "Patched and verified" : status==="Unknown" ? "Unknown / stale evidence" : status;
  pdf.heading("Status across "+count(patches.total)+" servers");
  pdf.bars(patches.statuses.map(row=>({label:patchLabel(row.status),count:row.count,color:row.status==="Patched" ? teal : row.status==="Unknown" ? grey : row.status==="Failed" ? red : amber})),patches.total);
  pdf.table(["Patch status","Servers","Share"],patches.statuses.map(row=>[patchLabel(row.status),count(row.count),share(row.count,patches.total)]),[291.28,120,120]);
  pdf.paragraph("Patched requires current, verified evidence and no required restart. The verified percentage includes unknown servers in its denominator and is N/A for an empty server scope. Overdue actions overlap status categories; exceptions do not hide overdue work. CVE observations do not prove that an OS patch is missing.");

  pdf.pageFor("Endpoint discovery");
  pdf.cards([{label:"Endpoint records",value:count(endpoints.total)},{label:"Last discovered >30 days",value:count(endpoints.stale),color:amber},{label:"Discovery date missing",value:count(endpoints.undated),color:grey}]);
  pdf.heading("Discovery age relative to the snapshot"); pdf.bars(ageBars(endpoints.ages),endpoints.total);
  pdf.table(["Discovery age","Endpoints","Share"],ageTable(endpoints.ages,endpoints.total),[291.28,120,120]);
  pdf.table(["Evidence check","Endpoints"],[["Discovery source not recorded",count(endpoints.missingSource)]],[391.28,140]);
  pdf.paragraph("The >30-day review prompt includes 31-90 days and Over 90 days only. Missing and after-snapshot dates are shown separately. Discovery age does not change required-tool compliance.");

  pdf.pageFor("Software inventory");
  pdf.cards([{label:"Recorded installations",value:count(software.total)},{label:"Products",value:count(software.products)},{label:"Endpoints with software",value:count(software.endpoints)}]);
  const softwareChecks=[{label:"Version not recorded",count:software.missingVersion},{label:"Last discovered >30 days",count:software.stale},{label:"Date not recorded",count:software.undated},{label:"Source not recorded",count:software.missingSource},{label:"Date after snapshot",count:software.afterSnapshot}];
  pdf.heading("Inventory evidence checks"); pdf.bars(softwareChecks,software.total);
  pdf.table(["Evidence check","Installations","Share"],softwareChecks.map(row=>[row.label,count(row.count),share(row.count,software.total)]),[291.28,120,120]);
  pdf.paragraph("Evidence checks overlap and must not be summed. Software counts represent individual installations, including repeated products on different endpoints. Missing versions are not inferred.");

  pdf.pageFor("Shadow IT");
  pdf.cards([{label:"Unidentified IP nodes",value:count(shadow.total)},{label:"ARP owner endpoints",value:count(shadow.owners)},{label:"Last discovered >30 days",value:count(shadow.stale),color:amber}]);
  pdf.heading("Discovery approach");
  const approaches=[{label:"IP Scan",count:shadow.ipScan},{label:"ARP Table",count:shadow.arp}];
  pdf.bars(approaches,shadow.total);
  pdf.table(["Discovery approach","IP nodes","Share"],approaches.map(row=>[row.label,count(row.count),share(row.count,shadow.total)]),[291.28,120,120]);
  pdf.heading("Evidence quality");
  pdf.table(["Evidence check","IP nodes"],[["Last discovered >30 days",count(shadow.stale)],["Date not recorded",count(shadow.undated)],["Source not recorded",count(shadow.missingSource)],["Date after snapshot",count(shadow.afterSnapshot)]],[391.28,140]);
  pdf.paragraph("Evidence checks overlap. ARP owner endpoints supply the observation table; they are distinct from the unidentified IP nodes. System scope includes Shadow IT observations associated through these owners.");

  pdf.pageFor("Suggested actions and calculation notes");
  const actions=discoveryOverviewActions(data.model);
  pdf.table(["Suggested action","Count / unit","Next step"],actions.map(action=>[action.title,count(action.count)+" "+action.unit,action.detail]),[190,91,250.28]);
  if(!actions.length) pdf.paragraph("No suggested actions are triggered by the recorded overview counts. This does not establish that the environment is vulnerability-free.");
  pdf.heading("Calculation notes");
  for(const note of DISCOVERY_OVERVIEW_NOTES) pdf.paragraph(note);
  pdf.paragraph("Required-tool applicability uses the saved Discovery Tools settings at report generation, matching the overview page. Counts are point-in-time summaries rather than trends. Current explorer data is the source for detailed investigation.");
  pdf.footer();
  return doc.save();
}