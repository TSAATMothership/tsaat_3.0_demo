import type { Finding } from "@/lib/types";

export interface WeeklyOpenRiskTrendPoint {
  weekLabel: string;
  highRiskCount: number | null;
  criticalExposureCount: number | null;
}

export interface OpenRiskDailyTrendPoint {
  date: string;
  label: string;
  count: number | null;
}

type RiskTrendFinding = Pick<Finding, "severity" | "timestamp" | "closedTimestamp">;

function toUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseUtcDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatUtcDay(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function toFindingDateKey(timestamp?: string | null): string | null {
  if (!timestamp) {
    return null;
  }
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? null : toUtcDateKey(parsed);
}

export function buildOpenFindingsDailySeries(
  findings: readonly RiskTrendFinding[],
  severity: "High Risk" | "Critical Exposure",
  endDateKey: string,
  dataAvailableUntilDateKey: string,
  days = 365
): OpenRiskDailyTrendPoint[] {
  const pointCount = Math.max(0, Math.floor(days));
  const endDate = parseUtcDateKey(endDateKey);
  const startDate = addUtcDays(endDate, -(pointCount - 1));
  const startDateKey = toUtcDateKey(startDate);
  const effectiveDataEndDateKey =
    dataAvailableUntilDateKey <= endDateKey ? dataAvailableUntilDateKey : endDateKey;
  const events = new Map<string, number>();
  let openAtWindowStart = 0;

  for (const finding of findings) {
    if (finding.severity !== severity) {
      continue;
    }
    const openedDateKey = toFindingDateKey(finding.timestamp);
    if (!openedDateKey) {
      continue;
    }
    const closedDateKey = toFindingDateKey(finding.closedTimestamp);
    if (openedDateKey < startDateKey && (!closedDateKey || closedDateKey >= startDateKey)) {
      openAtWindowStart += 1;
    }
    if (openedDateKey >= startDateKey && openedDateKey <= effectiveDataEndDateKey) {
      events.set(openedDateKey, (events.get(openedDateKey) ?? 0) + 1);
    }
    if (closedDateKey && closedDateKey >= startDateKey && closedDateKey <= effectiveDataEndDateKey) {
      events.set(closedDateKey, (events.get(closedDateKey) ?? 0) - 1);
    }
  }

  const points: OpenRiskDailyTrendPoint[] = [];
  let running = openAtWindowStart;
  let hasObservedData = openAtWindowStart > 0;
  for (let offset = 0; offset < pointCount; offset += 1) {
    const pointDate = addUtcDays(startDate, offset);
    const pointDateKey = toUtcDateKey(pointDate);
    if (pointDateKey > effectiveDataEndDateKey) {
      points.push({ date: pointDateKey, label: formatUtcDay(pointDate), count: null });
      continue;
    }
    if (events.has(pointDateKey)) {
      hasObservedData = true;
    }
    running += events.get(pointDateKey) ?? 0;
    points.push({
      date: pointDateKey,
      label: formatUtcDay(pointDate),
      count: hasObservedData ? Math.max(0, running) : null
    });
  }
  return points;
}

export function buildWeeklyOpenRiskTrend(
  findings: readonly RiskTrendFinding[],
  requestedEndDateKey: string,
  dataAvailableUntilDateKey: string,
  weeks = 13
): WeeklyOpenRiskTrendPoint[] {
  const pointCount = Math.max(0, Math.floor(weeks));
  const effectiveEndDateKey =
    requestedEndDateKey <= dataAvailableUntilDateKey ? requestedEndDateKey : dataAvailableUntilDateKey;
  const endDate = parseUtcDateKey(effectiveEndDateKey);
  const severeFindings = findings
    .filter((finding) => finding.severity === "High Risk" || finding.severity === "Critical Exposure")
    .map((finding) => ({
      ...finding,
      openedDateKey: toFindingDateKey(finding.timestamp),
      closedDateKey: toFindingDateKey(finding.closedTimestamp)
    }))
    .filter((finding): finding is typeof finding & { openedDateKey: string } => Boolean(finding.openedDateKey));
  const earliestSevereOpenedDateKey = severeFindings.map((finding) => finding.openedDateKey).sort()[0];

  return Array.from({ length: pointCount }, (_, index) => {
    const weekOffset = pointCount - 1 - index;
    const pointDate = addUtcDays(endDate, -weekOffset * 7);
    const pointDateKey = toUtcDateKey(pointDate);

    if (!earliestSevereOpenedDateKey || pointDateKey < earliestSevereOpenedDateKey) {
      return {
        weekLabel: formatUtcDay(pointDate),
        highRiskCount: null,
        criticalExposureCount: null
      };
    }

    let highRiskCount = 0;
    let criticalExposureCount = 0;
    for (const finding of severeFindings) {
      if (finding.openedDateKey > pointDateKey || (finding.closedDateKey && finding.closedDateKey <= pointDateKey)) {
        continue;
      }
      if (finding.severity === "High Risk") {
        highRiskCount += 1;
      } else {
        criticalExposureCount += 1;
      }
    }

    return {
      weekLabel: formatUtcDay(pointDate),
      highRiskCount,
      criticalExposureCount
    };
  });
}
