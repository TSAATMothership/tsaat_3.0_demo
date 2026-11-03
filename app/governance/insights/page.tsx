import { GovernancePlaceholder } from "@/components/governance-placeholder";
import type { WorkspaceSearchParams } from "@/lib/workspace-navigation";

export default function GovernanceInsightsPage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  return <GovernancePlaceholder view="insights" searchParams={searchParams} />;
}
