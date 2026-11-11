import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  buildConfiguredEvidencePreview,
  findingBucketsOfType,
  findingMatchesBucket,
  normalizeFindingDisplayConfiguration,
  readConfiguredEvidenceValue
} from "@/lib/findings-config";
import { Finding } from "@/lib/types";

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf-8");
}

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
  it("normalizes bucket and evidence metadata from database-shaped rows", () => {
    const configuration = normalizeFindingDisplayConfiguration({
      sourcePolicies: [
        {
          policyKey: "persisted-first",
          displayOrder: 1,
          name: "Persisted First",
          description: "Use persisted findings first.",
          usePersistedFindings: 1,
          generateWhenEmpty: 1,
          enabled: 1
        }
      ],
      generationPolicies: [],
      workflowStatuses: [
        { statusKey: "open", label: "Open", displayOrder: 1, toneKey: "warning", terminalStatus: 0 }
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
          enabled: 1,
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
          enabled: 1,
          description: "High-risk findings."
        }
      ],
      evidenceFields: [
        {
          fieldKey: "asset-name",
          displayOrder: 1,
          label: "Asset Name",
          purposeKey: "asset_name",
          candidateKeysJson: JSON.stringify(["assetName", "hostname"]),
          fallbackValue: null,
          enabled: 1
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

  it("keeps finding schema, migration, loader, validator, manifest, and docs synchronized", () => {
    const schema = readRepoFile("Database Schema/database-schema.sql");
    const migration = readRepoFile("Database Schema/migrations/016_database_driven_findings_features.sql");
    const loader = readRepoFile("Database Schema/loaders/load-data.sql");
    const validator = readRepoFile("Database Schema/loaders/validate-database.sql");
    const manifest = readRepoFile("Database Schema/data/database-build-manifest.json");
    const mapping = readRepoFile("Database Schema/data-mapping-description.txt");
    const schemaDescription = readRepoFile("Database Schema/database-schema-description.txt");
    const erd = readRepoFile("Database Schema/ERD.md");

    for (const token of [
      "finding_source_policy",
      "finding_generation_policy",
      "finding_workflow_status_definition",
      "finding_bucket_definition",
      "finding_evidence_field_definition",
      "finding_register_column_definition",
      "vw_persisted_finding_normalized",
      "usp_generate_spi_findings_snapshot",
      "usp_get_effective_findings_snapshot",
      "usp_get_finding_history_snapshot",
      "usp_get_finding_spi_history_snapshot"
    ]) {
      expect(schema).toContain(token);
      expect(migration).toContain(token);
      expect(validator).toContain(token);
    }

    expect(loader).toContain("finding-definitions.json");
    expect(loader).toContain("MERGE [tsaat].[finding_source_policy]");
    expect(manifest).toContain('"findingDefinitions": "data/finding-definitions.json"');
    expect(mapping).toContain("Database Schema/data/finding-definitions.json");
    expect(schemaDescription).toContain("`finding_source_policy`");
    expect(erd).toContain("finding_source_policy");
  });
});
