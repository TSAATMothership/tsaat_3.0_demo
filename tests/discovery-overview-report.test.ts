import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { PDFDocument, PDFRawStream } from "pdf-lib";
import { NextRequest } from "next/server";
import { buildDiscoveryOverview } from "@/lib/discovery-overview";
import { buildScopedDiscoveryToolCoverage } from "@/lib/scoped-discovery-tool-coverage";
import { defaultDiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { createDiscoveryOverviewPdf } from "@/lib/discovery-overview-report-pdf";
import { discoveryOverviewReportHref } from "@/lib/discovery-overview-report-links";
import { loadDiscoveryOverview, type DiscoveryOverviewData } from "@/lib/discovery-overview-data";
import * as data from "@/lib/data-loader";
import { GET } from "@/app/api/discovery-coverage/overview-report/route";
import type { Dataset } from "@/lib/types";
vi.mock("@/lib/data-loader",()=>({loadDatasetForDate:vi.fn(),loadDiscoveryToolsSettings:vi.fn(),loadEndpointExplorerData:vi.fn(),loadInstalledSoftwareExplorerData:vi.fn(),loadShadowItExplorerData:vi.fn(),loadSecurityVulnerabilityExplorerData:vi.fn(),loadPatchManagementExplorerData:vi.fn()}));
const snapshotDate="2026-03-05",settings=defaultDiscoveryToolsSettings();
const sample:Dataset=JSON.parse(readFileSync("data/current.json","utf8"));
const model=()=>buildDiscoveryOverview({snapshotDate,coverage:buildScopedDiscoveryToolCoverage([],settings),endpoints:[],software:[],shadow:[],vulnerabilities:[],patches:[]});
const fixture=():DiscoveryOverviewData=>({model:model(),scope:{network:["net-1"],system:[],dataDate:snapshotDate,securityDomain:"NONE"},scopeLabels:{networks:["Example network (net-1)"],systems:[],domains:[]}});
async function readPdf(bytes:Uint8Array){
  const doc=await PDFDocument.load(bytes),texts:string[]=[];
  for(const [,object] of doc.context.enumerateIndirectObjects())if(object instanceof PDFRawStream){
    let content:Buffer;try{content=inflateSync(object.contents);}catch{continue;}
    for(const match of content.toString("latin1").matchAll(/<([0-9A-F]+)> Tj/g))texts.push(Buffer.from(match[1],"hex").toString("latin1"));
  }
  return {doc,text:texts.join("\n")};
}
beforeEach(()=>{
  vi.clearAllMocks();
  vi.mocked(data.loadDatasetForDate).mockResolvedValue({...sample,snapshotDate});
  vi.mocked(data.loadDiscoveryToolsSettings).mockResolvedValue(settings);
  for(const loader of [data.loadEndpointExplorerData,data.loadInstalledSoftwareExplorerData,data.loadShadowItExplorerData,data.loadSecurityVulnerabilityExplorerData,data.loadPatchManagementExplorerData])vi.mocked(loader).mockResolvedValue({snapshotDate,rows:[]});
});
describe("Discovery Insights report",()=>{
  it("loads one resolved snapshot and forwards identical domain/scope to every projection",async()=>{
    const result=await loadDiscoveryOverview({network:["net-1","net-2"],securityDomain:"NONE",dataDate:"2026-03-06",assetType:"server",discoveryFilters:"local"});
    expect(data.loadDatasetForDate).toHaveBeenCalledExactlyOnceWith("2026-03-06",{profile:"summary"});
    for(const loader of [data.loadEndpointExplorerData,data.loadInstalledSoftwareExplorerData,data.loadShadowItExplorerData,data.loadSecurityVulnerabilityExplorerData,data.loadPatchManagementExplorerData])expect(loader).toHaveBeenCalledExactlyOnceWith({network:["net-1","net-2"],system:[],securityDomain:"NONE",dataDate:snapshotDate});
    expect(result.model).toEqual(model()); expect(result.scopeLabels.domains).toEqual([]);
  });
  it("pins only the overview header filters in report links",()=>{
    const href=discoveryOverviewReportHref({network:["net-2","net-1"],securityDomain:["Secret","Unknown"],dataDate:"latest",assetType:"server",discoveryFilters:"local"},snapshotDate);
    expect(Object.fromEntries(new URL(href,"http://localhost").searchParams)).toEqual({network:"net-1,net-2",securityDomain:"SECRET,UNKNOWN",dataDate:snapshotDate});
  });
  it("renders every overview section and explicit empty denominators into a valid PDF",async()=>{
    const {doc,text}=await readPdf(await createDiscoveryOverviewPdf(fixture(),new Date("2026-11-04T01:00:00Z")));
    expect(doc.getTitle()).toBe("Discovery Insights Report");expect(doc.getPageCount()).toBe(9);
    for(const heading of ["Summary and scope","Discovery tool coverage - report cards","Tool coverage detail and CI footprint","Security vulnerabilities","Server patch management","Endpoint discovery","Software inventory","Shadow IT","Suggested actions and calculation notes"])expect(text).toContain(heading);
    expect(text).toContain("None selected");expect(text).toContain("N/A");expect(text).toContain("Example network (net-1)");
    expect(text).toContain("does not establish");expect(text).not.toContain("NaN");
  });
  it("retains tool totals, paginates long labels and never invents a grade or omits tools",async()=>{
    const input=fixture(),base=buildScopedDiscoveryToolCoverage(sample.assets,settings,sample.discoveryCoverageEvaluations).toolCards[0];
    expect(base).toBeDefined();
    input.model.coverage.tools=Array.from({length:19},(_,index)=>({...base,label:"Tool "+index+" "+"LongUnspacedName".repeat(30),id:"tool-"+index,covered:3,missing:2,applicable:5,coveragePercent:60}));
    input.model.coverage.applicableChecks=95;input.model.coverage.coveredChecks=57;input.model.coverage.missingChecks=38;input.model.coverage.percent=60;
    const {doc,text}=await readPdf(await createDiscoveryOverviewPdf(input));
    expect(doc.getPageCount()).toBeGreaterThan(9);expect(text).toContain("60%");expect(text).toContain("3 / 5 covered");expect(text).toContain("2 missing");
    for(let index=0;index<19;index++)expect(text).toMatch(new RegExp("Tool "+index+"(?:\\s|$)"));
    expect(text).toContain("57 / 95 required tool-to-CI checks covered; 38 checks missing.");
  });
  it.each(["", "network=net-1&dataDate=bad", "network=net-1&dataDate=2026-03-05&dataDate=2026-03-06", "system=sys-1&securityDomain=INVALID"])("rejects invalid report scope: %s",async query=>{
    expect((await GET(new NextRequest("http://localhost/api/discovery-coverage/overview-report?"+query))).status).toBe(400);
    expect(data.loadDatasetForDate).not.toHaveBeenCalled();
  });
  it("returns a downloadable PDF for a historical, explicitly empty domain selection",async()=>{
    const response=await GET(new NextRequest("http://localhost/api/discovery-coverage/overview-report?system=sys-1&securityDomain=NONE&dataDate=2026-03-06"));
    expect(response.status).toBe(200);expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain(snapshotDate);expect(response.headers.get("cache-control")).toBe("no-store");
    const {text}=await readPdf(new Uint8Array(await response.arrayBuffer()));expect(text).toContain("None selected");expect(text).toContain("Snapshot Date: "+snapshotDate);
  });
  it("returns a recoverable error without exposing provider details",async()=>{
    vi.mocked(data.loadDatasetForDate).mockRejectedValueOnce(Error("Private database credentials"));
    const response=await GET(new NextRequest("http://localhost/api/discovery-coverage/overview-report?network=net-1"));
    expect(response.status).toBe(503);expect(await response.text()).not.toContain("Private");
  });
});