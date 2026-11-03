import { GovernancePlaceholder } from "@/components/governance-placeholder";
import type { WorkspaceSearchParams } from "@/lib/workspace-navigation";

export default function GovernanceTrendsPage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  return <GovernancePlaceholder view="trends" searchParams={searchParams} />;
}
