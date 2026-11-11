import { securityDomainFilter } from "@/lib/security-domain.mjs";
import { redirect } from "next/navigation";
import { extractDataDateParam } from "@/lib/data-date";
import { ictSystemDetailsHref } from "@/lib/ict-system-details";
import type { WorkspaceSearchParams } from "@/lib/workspace-navigation";

/** Saved ICT system drill-through links now open the ICT System Details panel. */
export default function IctSystemDetailsPage({ params, searchParams = {} }: {
  params: { systemId: string }; searchParams?: WorkspaceSearchParams;
}) {
  redirect(ictSystemDetailsHref(params.systemId, extractDataDateParam(searchParams), securityDomainFilter(searchParams.securityDomain)));
}
