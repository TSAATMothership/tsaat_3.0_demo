import type { Finding } from "@/lib/types";

/** Provider iteration order must not choose which scoped findings survive a report's row limit. */
export function orderReportFindings<T extends Pick<Finding, "priorityRank" | "id">>(findings: readonly T[]): T[] {
  return [...findings].sort((left, right) => left.priorityRank - right.priorityRank || left.id.localeCompare(right.id));
}
