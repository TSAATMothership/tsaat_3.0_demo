import { Finding } from "@/lib/types";

export type AsOfWorkflowStatus = "open" | "closed";

export function workflowStatusAtAsOf(
  finding: Pick<Finding, "timestamp" | "closedTimestamp">,
  asOfDate: string
): AsOfWorkflowStatus | null {
  const openedDate = finding.timestamp.slice(0, 10);
  if (openedDate > asOfDate) {
    return null;
  }

  const closedDate = finding.closedTimestamp?.slice(0, 10);
  if (closedDate && closedDate <= asOfDate) {
    return "closed";
  }

  return "open";
}
