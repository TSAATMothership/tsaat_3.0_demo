import { describe, expect, it } from "vitest";
import { workflowStatusAtAsOf } from "@/lib/finding-status";

describe("workflowStatusAtAsOf", () => {
  it("returns null before a finding is opened", () => {
    expect(
      workflowStatusAtAsOf(
        {
          timestamp: "2024-03-10T10:00:00-05:00",
          closedTimestamp: null
        },
        "2024-03-09"
      )
    ).toBeNull();
  });

  it("returns open between opened and closed dates", () => {
    expect(
      workflowStatusAtAsOf(
        {
          timestamp: "2024-03-10T10:00:00-05:00",
          closedTimestamp: "2024-03-20T11:00:00-05:00"
        },
        "2024-03-15"
      )
    ).toBe("open");
  });

  it("returns closed on and after close date", () => {
    expect(
      workflowStatusAtAsOf(
        {
          timestamp: "2024-03-10T10:00:00-05:00",
          closedTimestamp: "2024-03-20T11:00:00-05:00"
        },
        "2024-03-20"
      )
    ).toBe("closed");
  });
});
