import type { InventoryInsightsDocumentData as InventoryContextData } from "@/lib/documents/insights";
import { drawInsightsPageFrame,drawInsightsRingArc,INSIGHTS_PDF_THEME,type InsightsPdfAssets,type InsightsReportKind } from "@/lib/insights-pdf-theme";
import { createReportPage } from "@/lib/report-template-pdf";
import { PDFDocument,rgb,type PDFFont,type PDFPage,type RGB } from "pdf-lib";

const LEFT = 32, WIDTH = 531.28, BOTTOM = 48;
const { ink, muted, pale, line, teal } = INSIGHTS_PDF_THEME;
const red = INSIGHTS_PDF_THEME.rose, grey = rgb(.48,.55,.62);
const count = (value: number) => value.toLocaleString("en-AU");
const percent = (value: number | null) => value === null ? "N/A" : value + "%";
const share = (value: number, total: number) => total ? percent(Math.round(value / total * 1000) / 10) : "N/A";
type Bar = { label: string; count: number; color?: RGB };

/** Vector charts and measured text keep the report independent of browser rendering and downloads. */
export class InventoryReportPdf {
  page!: PDFPage;
  y = 0;
  section = "";
  constructor(readonly doc: PDFDocument, readonly regular: PDFFont, readonly bold: PDFFont, readonly date: string, readonly title = "Inventory Insights Report", readonly assets?: InsightsPdfAssets, readonly kind: InsightsReportKind = "endpoint") {}
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
  toolCards(tools: InventoryContextData["model"]["coverage"]["tools"], columns = 3) {
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

export function coverageRing(pdf: InventoryReportPdf, coverage: InventoryContextData["model"]["coverage"]) {
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

