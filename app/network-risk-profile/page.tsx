import { RetiredFeature } from "@/components/retired-feature";
import type { WorkspaceSearchParams } from "@/lib/workspace-navigation";
export default function Page({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  return <RetiredFeature pathname="/network-risk-profile" searchParams={searchParams} />;
}
