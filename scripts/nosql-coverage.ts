import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Dataset, Finding, StoredSpiEvaluation } from "../lib/types";
import { evaluateSpi } from "../lib/spi-evaluation";
import { normalizeSpiDefinitions, normalizeSeverityDefinitions, spiEvaluationMatchesFeature, type SpiDefinition } from "../lib/spi-definitions";
import { normalizeMeasuresSettings, normalizePriorityDefinitions, applyMeasuresPrioritySettings, applyMeasuresSeveritySettings, type MeasuresSettings } from "../lib/measures-settings";
import { deduplicateFindings } from "../lib/findings-normalization";
import { enrichDemoDataset, validateDemoDataset } from "./enrich-demo-dataset.mjs";

export const COVERAGE_PROFILE = "tsaat-sample-measure-coverage-v1";
export interface CoverageConfiguration { definitions: SpiDefinition[]; settings: MeasuresSettings }
type ReferenceFile = Record<string, Record<string, unknown>[]>;
export async function loadCoverageConfiguration(target: string, directories: { references?: string; settings?: string } = {}): Promise<CoverageConfiguration> {
  async function reference(name: string): Promise<ReferenceFile> {
    return JSON.parse((await fs.readFile(path.join(directories.references ?? path.join(target, "references"), name + ".json"), "utf8")).replace(/^\uFEFF/, ""));
  }
  const [spis, rules, sql, reports, classification, severity] = await Promise.all([
    reference("spi-definitions"), reference("spi-rule-definitions"), reference("spi-sql-calculations"),
    reference("spi-report-detail-definitions"), reference("spi-finding-classification-rules"), reference("severity-definitions")
  ]);
  const rows = spis.spis.map(spi => {
    const rule = rules.rules.find(r => r.ruleKey === spi.ruleKey), calculation = sql.calculations.find(c => c.ruleKey === spi.ruleKey);
    if (!rule || !calculation) throw new Error("Missing SPI configuration: " + spi.spiId);
    return { ...spi, ruleDefinition: rule, parameterDefinitions: rule.parameters, outcomeTemplates: rule.outcomes,
      calculationDefinition: { ...calculation, source: sql.calculationSources.find(s => s.sourceKey === calculation.sourceKey) },
      reportDetailDefinition: reports.reportDetails.find(r => r.reportDetailKey === spi.reportDetailKey),
      classificationRules: classification.classificationRules, featureBindings: sql.featureBindings.filter(b => b.spiId === spi.spiId) };
  });
  const definitions = normalizeSpiDefinitions(rows);
  if (!definitions.length || definitions.length !== spis.spis.filter(r => r.enabled !== false).length) throw new Error("Invalid SPI configuration; no data was changed.");
  const settings = normalizeMeasuresSettings(JSON.parse(await fs.readFile(path.join(directories.settings ?? path.join(target, "settings"), "measures-settings.json"), "utf8")),
    definitions, normalizeSeverityDefinitions(severity), normalizePriorityDefinitions(sql));
  return { definitions, settings };
}
function effectiveFindings(dataset: Dataset, configuration: CoverageConfiguration): Finding[] {
  if (!dataset.findings) throw new Error("Persisted finding history is required.");
  const atDate = dataset.findings.filter(f => f.timestamp.slice(0, 10) <= dataset.snapshotDate).map(f => ({
    ...f, status: f.closedTimestamp && f.closedTimestamp.slice(0, 10) <= dataset.snapshotDate ? "closed" as const : "open" as const
  }));
  return deduplicateFindings(applyMeasuresPrioritySettings(applyMeasuresSeveritySettings(atDate, dataset.assets, configuration.settings), configuration.settings));
}
const key = (assetId: string, spiId: number, status: string) => JSON.stringify([assetId, spiId, status]);
function evaluations(dataset: Dataset, configuration: CoverageConfiguration) {
  return dataset.assets.filter(asset => asset.type !== "ip-node").map(asset => ({ asset, results: configuration.definitions.filter(d => d.applicableAssetTypes.includes(asset.type)).map(d => evaluateSpi(asset, d)) }));
}
export function auditCoverage(dataset: Dataset, configuration: CoverageConfiguration) {
  const open = new Set(effectiveFindings(dataset, configuration).filter(f => f.status === "open").map(f => key(f.scope.assetId, f.spiId, f.complianceStatus)));
  const rows = evaluations(dataset, configuration);
  return { date: dataset.snapshotDate, assets: dataset.assets.length,
    knownEndpoints: rows.length, shadowNodes: dataset.assets.length - rows.length,
    missingMac: rows.filter(({ asset }) => !asset.macAddress?.trim()).length,
    missingModel: rows.filter(({ asset }) => !asset.deviceModel?.trim()).length,
    fullyCompliantAssets: rows.filter(row => row.results.length > 0 && row.results.every(e => e.status === "Compliant")).length,
    noApplicableMeasureAssets: rows.filter(row => !row.results.length).map(row => row.asset.id),
    uncovered: rows.flatMap(row => row.results.filter(e => e.status !== "Compliant" && !open.has(key(row.asset.id, e.spiId, e.status))).map(e => ({ assetId: row.asset.id, spiId: e.spiId, status: e.status }))) };
}
function classification(definition: SpiDefinition, evaluation: StoredSpiEvaluation, productionCritical: boolean) {
  return definition.classificationRules.find(rule => {
    if (rule.complianceStatus && rule.complianceStatus !== evaluation.status) return false;
    switch (rule.conditionKey) {
      case "always": return true;
      case "when_unknown": return evaluation.status === "Unknown";
      case "when_non_compliant": return evaluation.status === "Non-compliant";
      case "when_production_critical_asset": return evaluation.status === "Non-compliant" && productionCritical;
      case "when_not_production_critical_asset": return evaluation.status === "Non-compliant" && !productionCritical;
      default: throw new Error("Unsupported finding classification: " + rule.conditionKey);
    }
  });
}
/** Explicit sample maintenance only: never called while serving pages or building existing stores. */
export function enrichCoverage(input: Dataset, configuration: CoverageConfiguration): Dataset {
  const dataset = enrichDemoDataset(input);
  if (!dataset.findings) throw new Error("Persisted finding history is required.");
  const open = new Set(effectiveFindings(dataset, configuration).filter(f => f.status === "open").map(f => key(f.scope.assetId, f.spiId, f.complianceStatus)));
  const ids = new Set(dataset.findings.map(f => f.id));
  const definitions = new Map(configuration.definitions.map(d => [d.spiId, d]));
  for (const { asset, results } of evaluations(dataset, configuration)) {
    const productionCritical = results.some(e => spiEvaluationMatchesFeature(e, "production-critical-exposure", configuration.definitions));
    for (const evaluation of results) {
      const findingKey = key(asset.id, evaluation.spiId, evaluation.status);
      if (evaluation.status === "Compliant" || open.has(findingKey)) continue;
      const definition = definitions.get(evaluation.spiId)!;
      const rule = classification(definition, evaluation, productionCritical);
      const rawPriorityRank = rule?.priorityRank ?? definition.priorityOrder, rawSeverity = rule?.severityKey ?? definition.defaultSeverity;
      const baseId = "sample-coverage-" + dataset.snapshotDate + "-" + createHash("sha256").update(findingKey).digest("hex").slice(0, 32);
      let id = baseId, suffix = 1;
      while (ids.has(id)) id = baseId + "-" + suffix++;
      const finding: Finding = { id, spiId: evaluation.spiId, priorityRank: rawPriorityRank, severity: rawSeverity,
        rawPriorityRank, rawSeverity, sourceKind: "persisted", status: "open", complianceStatus: evaluation.status,
        timestamp: dataset.snapshotDate + "T23:59:59.999Z", closedTimestamp: null,
        scope: { assetId: asset.id, networkId: asset.networkId, systemId: asset.systemContext?.systemId ?? null, environmentType: asset.systemContext?.environmentType ?? null },
        title: definition.description, recommendedAction: evaluation.status === "Unknown" ? "Collect and verify the missing measure evidence. " + definition.recommendedAction : definition.recommendedAction,
        evidence: { ...evaluation.evidence, assetName: asset.name, assetType: asset.type, outcomeKey: evaluation.outcomeKey ?? null,
          reason: evaluation.reasons.join(" "), dataOrigin: "Sample enrichment", enrichmentProfile: COVERAGE_PROFILE, snapshotDate: dataset.snapshotDate } };
      dataset.findings.push(...applyMeasuresPrioritySettings(applyMeasuresSeveritySettings([finding], [asset], configuration.settings), configuration.settings));
      ids.add(id); open.add(findingKey);
    }
  }
  validateDemoDataset(dataset);
  const audit = auditCoverage(dataset, configuration);
  if (audit.uncovered.length || audit.noApplicableMeasureAssets.length || audit.missingMac || audit.missingModel) throw new Error("Finding coverage verification failed; no data was published.");
  return dataset;
}
export async function enrichJsonStore({ target = process.env.TSAAT_JSON_DATA_DIR || path.resolve("NoSQL/data"), apply = false, demo = false, backupDirectory }: {
  target?: string; apply?: boolean; demo?: boolean; backupDirectory?: string;
} = {}) {
  const { populateJsonStore } = await import("./populate-json-store.mjs");
  let configuration: CoverageConfiguration | undefined;
  const coverage: ReturnType<typeof auditCoverage>[] = [];
  const report = await populateJsonStore({ target, apply, demo, backupDirectory, profile: COVERAGE_PROFILE,
    transformDataset: async dataset => {
      configuration ??= await loadCoverageConfiguration(target); // Read settings under the publication writer lock.
      const enriched = enrichCoverage(dataset, configuration);
      coverage.push(auditCoverage(enriched, configuration));
      return enriched;
    } });
  return { ...report, coverage };
}
