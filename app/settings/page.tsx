import { RetiredFeature } from "@/components/retired-feature";
import type { WorkspaceSearchParams } from "@/lib/workspace-navigation";
export const dynamic = "force-dynamic";
export default function SettingsPage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  return <RetiredFeature pathname="/settings" searchParams={searchParams} />;
}
