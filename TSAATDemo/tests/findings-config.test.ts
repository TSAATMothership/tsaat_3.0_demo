import { describe, expect, it } from "vitest";
import runtimeConfig from "../data/runtime-config.json";
import { loadFindingDisplayConfiguration } from "@/lib/data-loader";
import {
  buildConfiguredEvidencePreview,
  findingBucketsOfType,
  findingMatchesBucket,
  normalizeFindingDisplayConfiguration,
  readConfiguredEvidenceValue
} from "@/lib/findings-config";
import { Finding } from "@/lib/types";

const baseFinding: Finding = {
  id: "finding-1",
  spiId: 4,
  priorityRank: 1,
  severity: "High Risk",
  status: "open",
  complianceStatus: "Non-compliant",
  timestamp: "2026-04-30T10:00:00-05:00",
  scope: {
    networkId: "net-1",
    systemId: "sys-1",
    environmentType: "Production",
    assetId: "asset-1"
  },
  title: "Finding title",
  evidence: {
    assetName: "Server 1",
    ipAddress: "10.0.0.10",
    assetType: "server",
    productionContext: true
  },
  recommendedAction: "Remediate finding."
};

describe("finding display configuration", () => {
  it("normalizes bucket and evidence metadata from JSON configuration", () => {
    const configuration = normalizeFindingDisplayConfiguration({
      sourcePolicies: [
        {
          policyKey: "persisted-first",
          displayOrder: 1,
          name: "Persisted First",
          description: "Use persisted findings first.",
          usePersistedFindings: true,
          generateWhenEmpty: true,
          enabled: true
        }
      ],
      generationPolicies: [],
      workflowStatuses: [
        { statusKey: "open", label: "Open", displayOrder: 1, toneKey: "warning", terminalStatus: false }
      ],
      buckets: [
        {
          bucketKey: "priority-1-2",
          bucketType: "priority",
          label: "P1-P2",
          displayOrder: 2,
          toneKey: "critical",
          conditionKey: "priority_between",
          severityKey: null,
          priorityMin: 1,
          priorityMax: 2,
          workflowStatus: null,
          enabled: true,
          description: "Immediate priority findings."
        },
        {
          bucketKey: "high-risk",
          bucketType: "severity",
          label: "High Risk",
          displayOrder: 1,
          toneKey: "warning",
          conditionKey: "severity_equals",
          severityKey: "High Risk",
          priorityMin: null,
          priorityMax: null,
          workflowStatus: null,
          enabled: true,
          description: "High-risk findings."
        }
      ],
      evidenceFields: [
        {
          fieldKey: "asset-name",
          displayOrder: 1,
          label: "Asset Name",
          purposeKey: "asset_name",
          candidateKeys: ["assetName", "hostname"],
          fallbackValue: null,
          enabled: true
        }
      ],
      registerColumns: []
    });

    expect(configuration.sourcePolicies[0]?.usePersistedFindings).toBe(true);
    expect(findingBucketsOfType(configuration, "severity")[0]?.bucketKey).toBe("high-risk");
    expect(findingMatchesBucket(baseFinding, configuration.buckets[0])).toBe(true);
    expect(readConfiguredEvidenceValue(baseFinding.evidence, configuration, "asset_name")).toBe("Server 1");
    expect(buildConfiguredEvidencePreview(baseFinding, configuration)).toContain("assetName: Server 1");
  });

  it("loads the complete finding catalogue from the demo runtime JSON", async () => {
    const expected = normalizeFindingDisplayConfiguration(
      runtimeConfig.findingDisplayConfiguration
    );
    const loaded = await loadFindingDisplayConfiguration();

    expect(loaded).toEqual(expected);
    expect(loaded.sourcePolicies).toHaveLength(1);
    expect(loaded.generationPolicies).toHaveLength(1);
    expect(loaded.workflowStatuses.map((status) => status.statusKey)).toEqual(["open", "closed"]);
    expect(loaded.buckets).toHaveLength(10);
    expect(loaded.evidenceFields).toHaveLength(7);
    expect(loaded.registerColumns).toHaveLength(7);
    expect(
      loaded.evidenceFields.find((field) => field.purposeKey === "asset_name")?.candidateKeys
    ).toEqual(["assetName", "asset_name", "hostname", "assetHostname"]);
  });
});
