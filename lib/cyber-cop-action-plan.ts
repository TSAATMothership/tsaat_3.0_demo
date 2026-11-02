import type { Finding } from "@/lib/types";

const MILLISECONDS_PER_DAY = 86_400_000;

function utcDayTimestamp(value: string): number | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

export function countSevereOpenFindingsOlderThan(
  findings: Array<Pick<Finding, "severity" | "status" | "timestamp">>,
  asOfDateKey: string,
  thresholdDays = 60
): number {
  const asOfTimestamp = utcDayTimestamp(`${asOfDateKey}T00:00:00.000Z`);
  if (asOfTimestamp === null) {
    return 0;
  }
  const safeThresholdDays = Math.max(0, Math.floor(thresholdDays));

  return findings.filter((finding) => {
    if (
      finding.status !== "open" ||
      (finding.severity !== "Critical Exposure" && finding.severity !== "High Risk")
    ) {
      return false;
    }
    const openedTimestamp = utcDayTimestamp(finding.timestamp);
    if (openedTimestamp === null) {
      return false;
    }
    const ageDays = Math.max(0, Math.floor((asOfTimestamp - openedTimestamp) / MILLISECONDS_PER_DAY));
    return ageDays > safeThresholdDays;
  }).length;
}
