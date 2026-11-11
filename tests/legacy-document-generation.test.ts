import { beforeEach, describe, expect, it, vi } from "vitest";
import { inflateSync } from "node:zlib";
import { PDFDocument, PDFRawStream } from "pdf-lib";
import { NextRequest } from "next/server";
import { defaultDiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { normalizeKpiDefinitions } from "@/lib/kpi-definitions";
import type { Dataset, Finding } from "@/lib/types";
import { loadDatasetForDate } from "@/lib/data-loader";
import { renderLegacyPdfDocument, type LegacyPdfDocumentJob } from "@/lib/documents/legacy-pdf";
import { GET as summary } from "@/app/api/report/summary/route";
import { GET as networks } from "@/app/api/networks/remediation-report/route";
import { GET as systems } from "@/app/api/systems/remediation-report/route";
import { GET as operatingSystems } from "@/app/api/systems/out-of-support-os-report/route";
import { GET as modelling } from "@/app/api/systems/modelling-status-report/route";
import { GET as discovery } from "@/app/api/discovery-coverage/remediation-report/route";
import { GET as networkEntity } from "@/app/api/networks/[networkId]/remediation-report/route";
import { GET as systemEntity } from "@/app/api/systems/[systemId]/remediation-report/route";
import { GET as systemCoverage } from "@/app/api/systems/[systemId]/coverage-gaps-report/route";
import { GET as networkDiscovery } from "@/app/api/discovery-coverage/network-report/route";
import { GET as networkPerformance } from "@/app/api/networks/performance-report/route";
import { GET as systemPerformance } from "@/app/api/systems/performance-report/route";
import rawKpiDefinitions from "../Database Schema/data/kpi-definitions.json";
import { testMeasuresSettings, testSeverityDefinitions, testSpiDefinitions } from "./spi-definition-fixtures";

vi.mock("@/lib/data-loader",()=>({loadDatasetForDate:vi.fn(),loadDiscoveryToolsSettings:vi.fn(),loadMeasuresSettings:vi.fn(),loadSeverityDefinitions:vi.fn(),loadSpiDefinitions:vi.fn(),loadKpiDefinitions:vi.fn(),loadSnapshotKpiEvaluationsForScopes:vi.fn()}));
import * as loaders from "@/lib/data-loader";
const date="2026-04-23";
function fixture():Dataset {
  const selected={id:"asset-alpha",name:"Selected server",hostname:"selected.example",type:"server" as const,networkId:"net-alpha",securityDomain:"SECRET" as const,
    lifecycle:{eolStatus:"Unknown" as const,warrantyStatus:"Unknown" as const},vulnerabilities:[],systemContext:{systemId:"sys-alpha",environmentType:"Production" as const},operatingSystem:null,installedSoftware:[],deviceModel:"Selected model",ipAddress:"10.0.0.1"};
  return {snapshotDate:date,generatedAt:date+"T00:00:00Z",spiEvaluations:[],findings:[],
    assets:[selected,{...selected,id:"asset-private",name:"PRIVATE-OUT-OF-SCOPE",networkId:"net-private",securityDomain:"PROTECTED",systemContext:{systemId:"sys-private",environmentType:"Production"}}],
    managedNetworks:[{id:"net-alpha",name:"Selected network",securityDomain:"SECRET",criticality:"Critical",adfPlatform:true,enterprisePlatform:false,modellingStatus:true,discoveryStatus:"Discovery Enabled",ictSystemIds:["sys-alpha"],assetIds:["asset-alpha"]},
      {id:"net-private",name:"PRIVATE-OUT-OF-SCOPE",securityDomain:"PROTECTED",criticality:"Critical",adfPlatform:false,enterprisePlatform:false,modellingStatus:true,discoveryStatus:"Discovery Enabled",ictSystemIds:["sys-private"],assetIds:["asset-private"]}],
    ictSystems:[{id:"sys-alpha",name:"Selected system",adfPlatform:true,enterprisePlatform:false,modellingStatus:false,diisDefined:true,networkId:"net-alpha",criticality:"Critical",securityDomain:"SECRET",missionCapabilities:[],businessServices:[],environments:[]},
      {id:"sys-private",name:"PRIVATE-OUT-OF-SCOPE",adfPlatform:false,enterprisePlatform:false,modellingStatus:false,diisDefined:true,networkId:"net-private",criticality:"Critical",securityDomain:"PROTECTED",missionCapabilities:[],businessServices:[],environments:[]}],
    discoveryCoverageEvaluations:[{assetId:"asset-alpha",toolValues:{tenable:0},missingToolIds:["tenable"],missingToolNames:["Tenable"],coverageCompliance:false}]
  };
}
beforeEach(()=>{
  vi.restoreAllMocks();vi.clearAllMocks();
  vi.mocked(loadDatasetForDate).mockResolvedValue(fixture());
  vi.mocked(loaders.loadDiscoveryToolsSettings).mockResolvedValue(defaultDiscoveryToolsSettings());
  vi.mocked(loaders.loadSpiDefinitions).mockResolvedValue(testSpiDefinitions);
  vi.mocked(loaders.loadSeverityDefinitions).mockResolvedValue(testSeverityDefinitions);
  vi.mocked(loaders.loadMeasuresSettings).mockResolvedValue(testMeasuresSettings);
  vi.mocked(loaders.loadKpiDefinitions).mockResolvedValue(normalizeKpiDefinitions(rawKpiDefinitions));
  vi.mocked(loaders.loadSnapshotKpiEvaluationsForScopes).mockResolvedValue(new Map());
});
const routes:Array<[string,(request:NextRequest)=>Promise<Response>]>=[
  ["/api/report/summary",summary],["/api/networks/remediation-report",networks],["/api/systems/remediation-report",systems],
  ["/api/systems/out-of-support-os-report",operatingSystems],["/api/systems/modelling-status-report",modelling],
  ["/api/discovery-coverage/remediation-report",discovery],
  ["/api/networks/net-alpha/remediation-report",request=>networkEntity(request,{params:{networkId:"net-alpha"}})],
  ["/api/systems/sys-alpha/remediation-report",request=>systemEntity(request,{params:{systemId:"sys-alpha"}})],
  ["/api/systems/sys-alpha/coverage-gaps-report",request=>systemCoverage(request,{params:{systemId:"sys-alpha"}})],
  ["/api/discovery-coverage/network-report",networkDiscovery],["/api/networks/performance-report",networkPerformance],["/api/systems/performance-report",systemPerformance]
];
async function pdfText(bytes:Uint8Array) {
  const doc=await PDFDocument.load(bytes),parts:string[]=[];
  for(const [,item] of doc.context.enumerateIndirectObjects()) if(item instanceof PDFRawStream){
    let text:string;try{text=inflateSync(item.contents).toString("latin1");}catch{continue;}
    for(const match of text.matchAll(/<([0-9A-F]+)> Tj/g))parts.push(Buffer.from(match[1],"hex").toString("latin1"));
  }
  return {doc,text:parts.join(" ")};
}
describe("legacy PDF data and browser rendering boundary",()=>{
  it.each([
    ["/api/report/summary", summary, 10],
    ["/api/networks/remediation-report", networks, 300],
    ["/api/systems/remediation-report", systems, 300],
    ["/api/networks/net-alpha/remediation-report", (request: NextRequest) => networkEntity(request, {params:{networkId:"net-alpha"}}), 200],
    ["/api/systems/sys-alpha/remediation-report", (request: NextRequest) => systemEntity(request, {params:{systemId:"sys-alpha"}}), 200]
  ] as const)("%s selects the same highest-priority evidence before truncation regardless of provider input order", async (path, handler, limit) => {
    const dataset = fixture();
    const selected = dataset.assets[0];
    dataset.assets = Array.from({length:340}, (_, index) => ({ ...selected, id: `asset-${String(index).padStart(4,"0")}`,
      name: `Scoped server ${String(index).padStart(4,"0")}`, hostname: `scoped-${index}.example` }));
    dataset.managedNetworks[0].assetIds = dataset.assets.map(asset => asset.id);
    const findings: Finding[] = dataset.assets.map((asset, index) => ({ id: `finding-${String(index).padStart(4,"0")}`,
      spiId: 10, priorityRank: index < 20 ? 1 : index < 320 ? 2 : 90, severity: "High Risk", status:"open",
      complianceStatus:"Non-compliant", timestamp:date+"T12:00:00Z", scope:{assetId:asset.id,networkId:"net-alpha",systemId:"sys-alpha",environmentType:"Production"},
      title:`Scoped finding ${index}`, evidence:{}, recommendedAction:"Configured action" }));
    const request = () => new NextRequest("http://localhost"+path+"?network=net-alpha&system=sys-alpha&dataDate="+date+"&format=pdf");
    const jobs: LegacyPdfDocumentJob[] = [];
    for (const ordered of [[...findings].reverse(), [...findings.filter((_,i)=>i%2), ...findings.filter((_,i)=>i%2===0)]]) {
      const inputOrder = ordered.map(finding => finding.id);
      dataset.findings = ordered;
      vi.mocked(loadDatasetForDate).mockResolvedValue(dataset);
      const response = await handler(request());
      expect(response.status).toBe(200);
      const job: LegacyPdfDocumentJob = await response.json();
      if (!('tables' in job.data)) throw new Error("Expected narrative or summary job");
      expect(job.data.tables[0].rows).toHaveLength(limit);
      expect(job.data.tables[0].rows.map(row=>row.device.deviceName)).toEqual(Array.from({length:limit},(_,i)=>`Scoped server ${String(i).padStart(4,"0")}`));
      expect(dataset.findings.map(finding => finding.id)).toEqual(inputOrder);
      jobs.push(job);
    }
    const normalized = (job: LegacyPdfDocumentJob) => JSON.parse(JSON.stringify(job.data).split(job.generatedAt).join("<export-time>"));
    expect(normalized(jobs[0])).toEqual(normalized(jobs[1]));
  });
  it.each(routes)("%s returns scoped evidence, then the portable renderer produces a PDF",async(path,handler)=>{
    const create=vi.spyOn(PDFDocument,"create");
    const response=await handler(new NextRequest("http://localhost"+path+"?network=net-alpha&system=sys-alpha&securityDomain=SECRET&dataDate="+date+"&format=pdf",{headers:{accept:"application/json"}}));
    expect(response.status).toBe(200);expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");expect(response.headers.get("content-disposition")).toBeNull();
    expect(create).not.toHaveBeenCalled();
    const job:LegacyPdfDocumentJob=await response.json();
    expect(job.version).toBe(1);expect(job.filename).toMatch(/\.pdf$/);expect(job.data.snapshotDate).toBe(date);
    expect(JSON.stringify(job)).not.toContain("PRIVATE-OUT-OF-SCOPE");
    expect(job.data).not.toHaveProperty("dataset");expect(job.data).not.toHaveProperty("assets");
    const progress=vi.fn();
    const {doc,text}=await pdfText(await renderLegacyPdfDocument(job,{assetBaseUrl:"http://localhost/",onProgress:progress}));
    expect(create).toHaveBeenCalled();expect(doc.getPageCount()).toBeGreaterThan(0);expect(text).toContain(date);
    expect(text).not.toContain("PRIVATE-OUT-OF-SCOPE");expect(progress).toHaveBeenCalled();
  });
  it("retains the existing summary JSON contract unless PDF data was requested",async()=>{
    const response=await summary(new NextRequest("http://localhost/api/report/summary?network=net-alpha&dataDate="+date));
    const body=await response.json();expect(body.snapshotDate).toBe(date);expect(body).toHaveProperty("topRisks");expect(body).not.toHaveProperty("kind");
  });
  it("retains bookmarked PDF URLs through a browser generation landing page",async()=>{
    const response=await modelling(new NextRequest("http://localhost/api/systems/modelling-status-report?system=sys-alpha&dataDate="+date,{headers:{accept:"text/html"}}));
    expect(response.status).toBe(303);
    const target=new URL(response.headers.get("location")!);expect(target.pathname).toBe("/documents/generate");
    expect(target.searchParams.get("source")).toBe("/api/systems/modelling-status-report?system=sys-alpha&dataDate="+date);
  });
  it("keeps entity report evidence filtered to the selected security domain",async()=>{
    const response=await systemEntity(new NextRequest("http://localhost/api/systems/sys-alpha/remediation-report?securityDomain=PROTECTED"),{params:{systemId:"sys-alpha"}});
    expect(response.status).toBe(200);
    const job=await response.json();
    expect(job.data.lines).toContain("- Assets in Scope: 0");
    expect(job.data.tables).toEqual([]);
    expect(JSON.stringify(job)).not.toContain("PRIVATE-OUT-OF-SCOPE");
  });
});
