import { redirect } from "next/navigation";
import { postureReplacementHref, type WorkspaceSearchParams } from "@/lib/workspace-navigation";

export default function SystemsPage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  redirect(postureReplacementHref("/systems", searchParams));
}
