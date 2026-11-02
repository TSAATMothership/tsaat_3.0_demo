import { redirect } from "next/navigation";
import { postureReplacementHref, type WorkspaceSearchParams } from "@/lib/workspace-navigation";

export default function NetworksPage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  redirect(postureReplacementHref("/networks", searchParams));
}
