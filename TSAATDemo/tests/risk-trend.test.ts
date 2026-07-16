import { describe, expect, it } from "vitest";
import { buildWeeklyOpenRiskTrend } from "@/lib/risk-trend";

describe("weekly open risk trend", () => {
  it("clamps a future requested endpoint to the latest available snapshot", () => {
    const trend = buildWeeklyOpenRiskTrend(
      [
        { severity: "High Risk", timestamp: "2026-01-01T00:00:00.000Z", closedTimestamp: null },
        { severity: "Critical Exposure", timestamp: "2026-02-01T00:00:00.000Z", closedTimestamp: null }
      ],
      "2026-07-16",
      "2026-04-23",
      13
    );

    expect(trend).toHaveLength(13);
    expect(trend.at(-1)?.weekLabel).toBe("Apr 23");
    expect(trend.every((point) => point.highRiskCount !== null && point.criticalExposureCount !== null)).toBe(true);
    expect(trend.at(-1)).toEqual({ weekLabel: "Apr 23", highRiskCount: 1, criticalExposureCount: 1 });
  });

  it("counts findings as open only between their opened and closed dates", () => {
    const trend = buildWeeklyOpenRiskTrend(
      [
        {
          severity: "High Risk",
          timestamp: "2026-01-02T00:00:00.000Z",
          closedTimestamp: "2026-01-15T00:00:00.000Z"
        },
        { severity: "Critical Exposure", timestamp: "2026-01-10T00:00:00.000Z", closedTimestamp: null },
        { severity: "Major", timestamp: "2025-12-01T00:00:00.000Z", closedTimestamp: null }
      ],
      "2026-01-15",
      "2026-01-15",
      3
    );

    expect(trend).toEqual([
      { weekLabel: "Jan 1", highRiskCount: null, criticalExposureCount: null },
      { weekLabel: "Jan 8", highRiskCount: 1, criticalExposureCount: 0 },
      { weekLabel: "Jan 15", highRiskCount: 0, criticalExposureCount: 1 }
    ]);
  });

  it("returns an explicit no-history series when the scope has no severe findings", () => {
    const trend = buildWeeklyOpenRiskTrend(
      [{ severity: "Major", timestamp: "2026-01-01T00:00:00.000Z", closedTimestamp: null }],
      "2026-04-23",
      "2026-04-23",
      2
    );

    expect(trend).toEqual([
      { weekLabel: "Apr 16", highRiskCount: null, criticalExposureCount: null },
      { weekLabel: "Apr 23", highRiskCount: null, criticalExposureCount: null }
    ]);
  });
});
