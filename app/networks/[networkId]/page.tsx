import { notFound, redirect } from "next/navigation";
import { extractDataDateParam } from "@/lib/data-date";
import { networkDetailsHref } from "@/lib/network-details";
import { isUnassignedNetworkId } from "@/lib/network-scope";
import type { WorkspaceSearchParams } from "@/lib/workspace-navigation";

/** Saved network drill-through links now open the Network Details panel. */
export default function NetworkDetailsPage({ params, searchParams }: {
  params: { networkId: string }; searchParams: WorkspaceSearchParams;
}) {
  if (isUnassignedNetworkId(params.networkId)) notFound();
  redirect(networkDetailsHref(params.networkId, extractDataDateParam(searchParams)));
}
