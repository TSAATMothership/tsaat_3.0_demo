import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { loadDatasetForDate } from "@/lib/data-loader";
import { GET as summary } from "@/app/api/report/summary/route";
import { GET as networks } from "@/app/api/networks/remediation-report/route";
import { GET as systems } from "@/app/api/systems/remediation-report/route";
import { GET as operatingSystems } from "@/app/api/systems/out-of-support-os-report/route";
import { GET as modelling } from "@/app/api/systems/modelling-status-report/route";
import { GET as discovery } from "@/app/api/discovery-coverage/remediation-report/route";

vi.mock("@/lib/data-loader", () => ({
  loadDatasetForDate: vi.fn(), loadDiscoveryToolsSettings: vi.fn().mockResolvedValue({}),
  loadSpiDefinitions: vi.fn().mockResolvedValue([]), loadSeverityDefinitions: vi.fn().mockResolvedValue([]),
  loadMeasuresSettings: vi.fn().mockResolvedValue({})
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadDatasetForDate).mockRejectedValue(new Error("snapshot selected"));
});

describe("catalogue PDF snapshot selection", () => {
  it.each([
    ["summary", summary], ["networks", networks], ["systems", systems],
    ["operating systems", operatingSystems], ["modelling", modelling], ["discovery", discovery]
  ] as const)("loads the chosen historical snapshot for %s", async (_, handler) => {
    await expect(handler(new NextRequest("http://localhost/report?system=sys-3&dataDate=2026-03-23&format=pdf")))
      .rejects.toThrow("snapshot selected");
    expect(loadDatasetForDate).toHaveBeenCalledExactlyOnceWith("2026-03-23");
  });
});
