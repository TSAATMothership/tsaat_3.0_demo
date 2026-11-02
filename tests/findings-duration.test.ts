import { describe, expect, it } from "vitest";
import { findingsByDuration, findingDurationDays, parseFindingDurationRange } from "@/lib/findings-duration";

describe("finding duration", () => {
  it("counts calendar days from the timestamp date to the selected timeline date", () => {
    const finding = { status: "open" as const, timestamp: "2026-10-25T23:59:59Z" };
    expect(findingDurationDays(finding, "2026-11-01")).toBe(7);
    expect(findingDurationDays(finding, "2026-10-27")).toBe(2);
    expect(findingDurationDays(finding, "2026-10-25")).toBe(0);
  });

  it("uses UTC days across timezone offsets and leap days", () => {
    expect(findingDurationDays({ status: "open", timestamp: "2024-02-28T23:30:00Z" }, "2024-03-01")).toBe(2);
    expect(findingDurationDays({ status: "open", timestamp: "2026-10-31T23:30:00-05:00" }, "2026-11-01")).toBe(0);
  });

  it("does not show an open duration for closed findings", () => {
    expect(findingDurationDays({ status: "closed", timestamp: "2026-10-25T00:00:00Z" }, "2026-11-01")).toBeNull();
  });

  it("handles invalid dates and prevents negative durations", () => {
    expect(findingDurationDays({ status: "open", timestamp: "invalid" }, "2026-11-01")).toBeNull();
    expect(findingDurationDays({ status: "open", timestamp: "2026-11-01T00:00:00Z" }, "invalid")).toBeNull();
    expect(findingDurationDays({ status: "open", timestamp: "2026-11-02T00:00:00Z" }, "2026-11-01")).toBe(0);
  });
});

describe("findings by duration", () => {
  const asOf = "2026-11-01";
  const finding = (days: number, severity = "High Risk") => ({ status: "open" as const, severity,
    timestamp: new Date(Date.parse(`${asOf}T23:59:59Z`) - days * 86_400_000).toISOString() });

  it("counts every band boundary once, using the same UTC calendar days as the register", () => {
    const rows = [0, 30, 31, 60, 61, 90, 91, 180, 181, 900].map(days => finding(days));
    const buckets = findingsByDuration(rows, asOf);
    expect(buckets.map(bucket => bucket.total)).toEqual([2, 2, 2, 2, 2]);
    expect(buckets.map(bucket => bucket.severities["High Risk"])).toEqual([2, 2, 2, 2, 2]);
    expect(findingsByDuration([finding(31)], "2026-10-31")[0].total).toBe(1);
  });

  it("excludes closed findings, preserves all severity classifications, and accounts for unknown dates", () => {
    const rows = [finding(5, "Critical Exposure"), finding(5, "Data Gap"), finding(5, "Custom severity"),
      { ...finding(10), status: "closed" as const }, { ...finding(10), timestamp: "invalid" }];
    const buckets = findingsByDuration(rows, asOf);
    expect(buckets[0].severities).toEqual({ "Critical Exposure": 1, "Data Gap": 1, "Custom severity": 1 });
    expect(buckets.at(-1)).toMatchObject({ unknownDate: true, total: 1, severities: { "High Risk": 1 } });
    expect(buckets.reduce((total, bucket) => total + bucket.total, 0)).toBe(4);
    expect(findingsByDuration([], asOf)).toHaveLength(5);
    expect(findingsByDuration([], asOf).every(bucket => bucket.total === 0)).toBe(true);
  });

  it("safely restores duration ranges from chart links", () => {
    expect(parseFindingDurationRange("0", "30")).toEqual({ min: 0, max: 30 });
    expect(parseFindingDurationRange("181")).toEqual({ min: 181, max: undefined });
    expect(parseFindingDurationRange(undefined, "60")).toEqual({ min: undefined, max: 60 });
    for (const value of ["", "-1", "1.5", "NaN", "Infinity", "9007199254740992"]) {
      expect(parseFindingDurationRange(value, value)).toEqual({ min: undefined, max: undefined });
    }
    expect(parseFindingDurationRange("60", "30")).toEqual({});
  });
});
