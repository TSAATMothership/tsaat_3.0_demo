import { ReportExplorer } from "@/components/report-explorer";
import { RouteReadyMarker } from "@/components/route-ready-marker";
import { getCoreAppData } from "@/lib/app-data";
import { firstSearchParam } from "@/lib/data-date";
import { buildReportCatalogue } from "@/lib/report-catalogue";
import { hasWorkspaceScope, type WorkspaceSearchParams } from "@/lib/workspace-navigation";

export default async function ReportPage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  if (!hasWorkspaceScope(searchParams)) return <RouteReadyMarker pathname="/report" searchParams={searchParams} />;
  const scopedSearchParams = { ...searchParams };
  for (const key of ["criticality", "securityDomain", "environment", "assetType"]) delete scopedSearchParams[key];
  const { dataset, filters, spiDefinitions } = await getCoreAppData(scopedSearchParams, { profile: "summary" });
  const rows = buildReportCatalogue(filters, dataset.snapshotDate, spiDefinitions);
  const initialSearch = firstSearchParam(searchParams.reportSearch)?.trim() ?? "";

  return <>
    <RouteReadyMarker pathname="/report" searchParams={searchParams} />
    <ReportExplorer key={JSON.stringify([filters, dataset.snapshotDate, initialSearch])} rows={rows} snapshotDate={dataset.snapshotDate} initialSearch={initialSearch} />
  </>;
}
