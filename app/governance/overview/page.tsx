import { GovernancePlaceholder } from "@/components/governance-placeholder";
import type { WorkspaceSearchParams } from "@/lib/workspace-navigation";

export default function GovernanceOverviewPage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  return <GovernancePlaceholder view="overview" searchParams={searchParams} />;
}
