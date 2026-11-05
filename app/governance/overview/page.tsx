import { redirect } from "next/navigation";
import type { WorkspaceSearchParams } from "@/lib/workspace-navigation";

export default function GovernanceOverviewPage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
  }
  redirect("/governance/trends" + (params.size ? `?${params}` : ""));
}
