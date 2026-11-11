import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PDFDocument, PDFPage } from "pdf-lib";
import { drawInsightsHero, drawInsightsOpeningPage, drawInsightsPageFrame, INSIGHTS_PDF_THEME, loadInsightsPdfAssets, type InsightsReportKind } from "@/lib/insights-pdf-theme";
import { useBundledInsightsAssets } from "./insights-assets-fixture";

useBundledInsightsAssets();

const artwork: Record<InsightsReportKind, string> = {
  software: "software-terrain",
  endpoint: "endpoint-evidence", vulnerability: "vulnerability-evidence"
};
const kinds=Object.keys(artwork) as InsightsReportKind[];
const opening={
  kind:"endpoint" as const,title:"End Point Insights Report",snapshotDate:"2026-03-05",
  generatedAt:new Date("2026-11-09T01:00:00Z"),scopeLines:["Managed network: Example network"],
  summary:["The selected snapshot contains recorded discovery evidence."],
  recommendations:["Validate missing discovery evidence with its owner."]
};

afterEach(()=>vi.restoreAllMocks());

describe("Governance Insights PDF visual contract",()=>{
  it("keeps all three print derivatives aligned with their current local page artwork",()=>{
    const manifest=JSON.parse(readFileSync("public/insights-report-art/manifest.json","utf8")) as {
      assets:Array<{source:string;sourceSha256:string;output:string}>;
    };
    expect(manifest.assets.map(asset=>asset.source).sort()).toEqual(Object.values(artwork).map(name=>"public/"+name+".svg").sort());
    expect(new Set(manifest.assets.map(asset=>asset.output)).size).toBe(3);
    for(const asset of manifest.assets){
      const source=readFileSync(asset.source),png=readFileSync(asset.output);
      expect(createHash("sha256").update(Uint8Array.from(source)).digest("hex"),asset.source+" needs its print derivative regenerated").toBe(asset.sourceSha256);
      expect(asset.output).toBe(asset.source.replace("public/","public/insights-report-art/").replace(/\.svg$/,".png"));
      expect(png.subarray(0,8)).toEqual(Buffer.from([137,80,78,71,13,10,26,10]));
      const svg=source.toString("utf8"),viewBox=svg.match(/viewBox="[\d.]+ [\d.]+ ([\d.]+) ([\d.]+)"/);
      expect(viewBox).not.toBeNull();
      const sourceWidth=Number(viewBox![1]),sourceHeight=Number(viewBox![2]);
      const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
      expect(width/height).toBeCloseTo(sourceWidth/sourceHeight,3);
      expect(width).toBeGreaterThanOrEqual(sourceWidth);
      expect(height).toBeGreaterThanOrEqual(sourceHeight);
      expect(svg).not.toMatch(/(?:href|src)=["']https?:\/\//i);
    }
  });

  it("uses the matching local illustration for every report kind without stretching or overflowing its frame",async()=>{
    const doc=await PDFDocument.create(),embed=vi.spyOn(doc,"embedPng"),assets=await loadInsightsPdfAssets(doc);
    const page=doc.addPage([595.28,841.89]),draw=vi.spyOn(page,"drawImage");
    const box={x:419,y:696,width:140,height:102};
    for(const kind of kinds){
      const expected=readFileSync("public/insights-report-art/"+artwork[kind]+".png");
      const callIndex=embed.mock.calls.findIndex(([bytes])=>typeof bytes!=="string" && Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).equals(Uint8Array.from(expected)));
      expect(callIndex,kind+" must load its own page artwork").toBeGreaterThanOrEqual(0);
      expect(assets.heroes[kind]).toBe(await embed.mock.results[callIndex].value);
      drawInsightsHero(page,assets,kind,box);
      const [image,position]=draw.mock.calls.at(-1)!;
      expect(image).toBe(assets.heroes[kind]);
      expect(position!.width!/position!.height!).toBeCloseTo(image.width/image.height,8);
      expect(position!.x!).toBeGreaterThanOrEqual(box.x);
      expect(position!.y!).toBeGreaterThanOrEqual(box.y);
      expect(position!.x!+position!.width!).toBeLessThanOrEqual(box.x+box.width+.001);
      expect(position!.y!+position!.height!).toBeLessThanOrEqual(box.y+box.height+.001);
    }
  });

  it("loads only the logo and requested hero for a single-report export",async()=>{
    const doc=await PDFDocument.create(),embed=vi.spyOn(doc,"embedPng");
    const assets=await loadInsightsPdfAssets(doc,"endpoint");
    expect(embed).toHaveBeenCalledTimes(2);
    expect(Object.keys(assets.heroes)).toEqual(["endpoint"]);
    const page=doc.addPage([595.28,841.89]);
    expect(()=>drawInsightsHero(page,assets,"endpoint",{x:36,y:600,width:140,height:102})).not.toThrow();
    expect(()=>drawInsightsHero(page,assets,"software",{x:36,y:600,width:140,height:102})).toThrow();
  });

  it("loads bundled browser assets from the supplied app origin and reports section progress",async()=>{
    const doc=await PDFDocument.create(),progress=vi.fn();
    const assets=await loadInsightsPdfAssets(doc,"endpoint",{assetBaseUrl:"https://tsaat.test/",onProgress:progress});
    expect(vi.mocked(fetch).mock.calls.map(([url])=>url)).toEqual([
      "https://tsaat.test/tsaat-logo.png","https://tsaat.test/insights-report-art/endpoint-evidence.png"
    ]);
    drawInsightsPageFrame(doc.addPage([595.28,841.89]),assets,{kind:"endpoint",title:"End Point Insights",snapshotDate:opening.snapshotDate,section:"Discovery evidence"});
    expect(progress).toHaveBeenCalledWith("Rendering Discovery evidence");
  });

  it("fails a missing browser asset instead of falling back to filesystem or incomplete branding",async()=>{
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null,{status:404}));
    await expect(loadInsightsPdfAssets(await PDFDocument.create(),"endpoint",{assetBaseUrl:"https://tsaat.test/"})).rejects.toThrow("bundled report artwork");
  });

  it("places the summary and recommendations in equal, separate half-page panels",async()=>{
    const doc=await PDFDocument.create(),assets=await loadInsightsPdfAssets(doc);
    const rectangles=vi.spyOn(PDFPage.prototype,"drawRectangle"),texts=vi.spyOn(PDFPage.prototype,"drawText");
    drawInsightsOpeningPage(doc,assets,opening);
    expect(doc.getPageCount()).toBe(1);
    const panels=rectangles.mock.calls.map(([options])=>options!).filter(options=>options.color===INSIGHTS_PDF_THEME.pale && options.borderWidth);
    expect(panels).toHaveLength(2);
    const [summary,recommendations]=panels;
    expect(summary.width).toBe(recommendations.width);expect(summary.height).toBe(recommendations.height);
    expect(summary.height).toBeGreaterThan(250);
    expect(recommendations.y!+recommendations.height!).toBeLessThan(summary.y!);
    for(const [narrative,panel] of [[opening.summary[0],summary],[opening.recommendations[0],recommendations]] as const){
      const options=texts.mock.calls.find(([value])=>value===narrative)?.[1];
      expect(options).toBeDefined();
      expect(options!.y!).toBeGreaterThan(panel.y!+15);
      expect(options!.y!).toBeLessThan(panel.y!+panel.height!-40);
      expect(options!.size!).toBeGreaterThanOrEqual(8.5);
    }
    expect(texts.mock.calls.map(([value])=>value)).toContain("Executive summary");
    expect(texts.mock.calls.map(([value])=>value)).toContain("Recommendations");
    expect(texts.mock.calls.map(([value])=>value)).toContain("Snapshot "+opening.snapshotDate);
  });

  it.each(["summary","recommendations"] as const)("rejects excess %s copy instead of clipping or silently dropping it",async field=>{
    const doc=await PDFDocument.create(),assets=await loadInsightsPdfAssets(doc);
    expect(()=>drawInsightsOpeningPage(doc,assets,{...opening,[field]:["Long evidence narrative requiring more than half a page. ".repeat(150)]})).toThrow(/exceeds its half-page narrative space/);
  });

  it("keeps a long scope out of the opening narrative panels and supports all three line icons",async()=>{
    const doc=await PDFDocument.create(),assets=await loadInsightsPdfAssets(doc);
    const texts=vi.spyOn(PDFPage.prototype,"drawText"),icons=vi.spyOn(PDFPage.prototype,"drawSvgPath");
    drawInsightsOpeningPage(doc,assets,{...opening,scopeLines:["Network name ".repeat(70)]});
    expect(texts.mock.calls.map(([value])=>value)).toContain("Applied scope and security domains are detailed on the following page.");
    const iconPaths:string[]=[];
    for(const kind of kinds){
      const page=doc.addPage([595.28,841.89]);
      const y=drawInsightsPageFrame(page,assets,{kind,title:"Insights Report",snapshotDate:opening.snapshotDate,section:"Evidence quality"});
      expect(y).toBeGreaterThan(600);expect(y).toBeLessThan(657);
      iconPaths.push(icons.mock.calls.at(-1)![0]);
    }
    expect(new Set(iconPaths).size).toBe(3);
    const bytes=await doc.save();
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(4);
  });
});
