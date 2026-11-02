import type { Finding } from "@/lib/types";
import type { ExplorerNumberRange } from "@/lib/explorer-table";

export function parseFindingDurationRange(minimum?: string, maximum?: string): ExplorerNumberRange {
  const parse = (value?: string) => value?.trim() && /^\d+$/.test(value.trim()) && Number.isSafeInteger(Number(value)) ? Number(value) : undefined;
  const min = parse(minimum);
  const max = parse(maximum);
  return min !== undefined && max !== undefined && min > max ? {} : { min, max };
}

export function findingsByDuration(findings: Pick<Finding, "timestamp" | "status" | "severity">[], asOfDate: string) {
  const buckets: Array<{ label: string; min?: number; max?: number; unknownDate?: boolean; total: number; severities: Record<string, number> }> = [
    { label: "0\u201330 days", min: 0, max: 30, total: 0, severities: {} },
    { label: "31\u201360 days", min: 31, max: 60, total: 0, severities: {} },
    { label: "61\u201390 days", min: 61, max: 90, total: 0, severities: {} },
    { label: "91\u2013180 days", min: 91, max: 180, total: 0, severities: {} },
    { label: "181+ days", min: 181, total: 0, severities: {} },
    { label: "Unknown date", unknownDate: true, total: 0, severities: {} }
  ];
  for (const finding of findings) {
    if (finding.status !== "open") continue;
    const days = findingDurationDays(finding, asOfDate);
    const bucket = days === null ? buckets[5] : buckets.find(row => !row.unknownDate && days >= row.min! && (row.max === undefined || days <= row.max))!;
    bucket.total += 1;
    bucket.severities[finding.severity] = (bucket.severities[finding.severity] ?? 0) + 1;
  }
  return buckets.filter(bucket => !bucket.unknownDate || bucket.total > 0);
}

/** Calendar days open at the selected findings date, using the register's UTC dates. */
export function findingDurationDays(
  finding: Pick<Finding, "timestamp" | "status">,
  asOfDate: string
): number | null {
  if (finding.status !== "open") return null;

  const opened = new Date(finding.timestamp);
  const asOf = new Date(`${asOfDate}T00:00:00.000Z`);
  if (Number.isNaN(opened.getTime()) || Number.isNaN(asOf.getTime())) return null;

  const openedDay = Date.UTC(opened.getUTCFullYear(), opened.getUTCMonth(), opened.getUTCDate());
  return Math.max(0, Math.floor((asOf.getTime() - openedDay) / 86_400_000));
}
