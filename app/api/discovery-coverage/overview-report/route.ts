import { NextRequest, NextResponse } from "next/server";
import { normalizeDataDate } from "@/lib/data-date";
import { parseSecurityDomainScope } from "@/lib/security-domain.mjs";
import { hasWorkspaceScope, scopeIds, type WorkspaceSearchParams } from "@/lib/workspace-navigation";
import { loadDiscoveryOverview } from "@/lib/discovery-overview-data";
import { createDiscoveryOverviewPdf } from "@/lib/discovery-overview-report-pdf";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  let scope: WorkspaceSearchParams;
  try {
    const query=request.nextUrl.searchParams, dates=query.getAll("dataDate");
    if(dates.length>1 || (dates.length && !normalizeDataDate(dates[0]))) throw Error("Invalid snapshot date.");
    const readIds=(key:string)=>{
      const ids=scopeIds(query.getAll(key));
      if(ids.length>10000 || ids.some(id=>id.length>255)) throw Error("Invalid scope.");
      return ids;
    };
    scope={network:readIds("network"),system:readIds("system"),dataDate:dates[0],
      securityDomain:parseSecurityDomainScope(query.has("securityDomain") ? query.getAll("securityDomain") : undefined)};
    if(!hasWorkspaceScope(scope)) throw Error("Choose a network or ICT system.");
  } catch {
    return NextResponse.json({error:"Select a valid network or ICT system scope, security domains and snapshot date."},{status:400});
  }
  try {
    const data=await loadDiscoveryOverview(scope), bytes=await createDiscoveryOverviewPdf(data);
    return new Response(Uint8Array.from(bytes).buffer,{headers:{
      "Content-Type":"application/pdf", "Content-Disposition":'attachment; filename="discovery-insights-'+data.model.snapshotDate+'.pdf"',
      "Cache-Control":"no-store"
    }});
  } catch {
    return NextResponse.json({error:"Unable to generate the Discovery Insights report. Please retry."},{status:503});
  }
}
