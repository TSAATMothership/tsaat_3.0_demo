import "server-only";
import { readJson, fileVersion, jsonStoreDirectory } from "./files";
type Row = Record<string, unknown>;
interface ReferenceFile { [key: string]: Row[] }
const cache = new Map<string, { version: string; value: unknown }>();
export async function reference<T = unknown>(name: string): Promise<T> {
  const file = "references/" + name + ".json", version = await fileVersion(file);
  const cacheKey = jsonStoreDirectory() + ":" + file;
  const cached = cache.get(cacheKey);
  if (cached?.version === version) return cached.value as T;
  const value = await readJson<T>(file); cache.set(cacheKey, { version, value }); return value;
}
export async function spiReferenceRows(): Promise<Row[]> {
  const [spis, ruleFile, sql, reports, classification] = await Promise.all([
    reference<ReferenceFile>("spi-definitions"), reference<ReferenceFile>("spi-rule-definitions"), reference<ReferenceFile>("spi-sql-calculations"),
    reference<ReferenceFile>("spi-report-detail-definitions"), reference<ReferenceFile>("spi-finding-classification-rules")
  ]);
  return spis.spis.map(spi => {
    const rule = ruleFile.rules.find(r => r.ruleKey === spi.ruleKey);
    const calculation = sql.calculations.find(c => c.ruleKey === spi.ruleKey);
    if (!rule || !calculation) throw new Error("Missing rule configuration for SPI " + spi.spiId);
    return { ...spi, ruleDefinition: rule, parameterDefinitions: rule.parameters, outcomeTemplates: rule.outcomes,
      calculationDefinition: { ...calculation, source: sql.calculationSources.find(s => s.sourceKey === calculation.sourceKey) },
      reportDetailDefinition: reports.reportDetails.find(d => d.reportDetailKey === spi.reportDetailKey),
      classificationRules: classification.classificationRules, featureBindings: sql.featureBindings.filter(b => b.spiId === spi.spiId) };
  });
}
export async function kpiReferenceRows() {
  const [definitions, tasking, reports, calculations] = await Promise.all([
    reference<ReferenceFile>("kpi-definitions"), reference<ReferenceFile>("kpi-tasking"),
    reference<ReferenceFile>("kpi-report-detail-definitions"), reference<ReferenceFile>("kpi-calculations")
  ]);
  return definitions.kpis.map(kpi => {
    const task = tasking.kpis.find(t => t.id === kpi.id);
    return { ...kpi, taskingTeams: [...(Array.isArray(task?.teams) ? task.teams : []), ...tasking.baseTeams], taskingActions: task?.actions ?? [],
      taskingConditions: tasking.conditionTemplates, calculationDefinition: calculations.calculations.find(c => c.calculationKey === kpi.calculationKey),
      reportDetailDefinition: reports.reportDetails.find(d => d.reportDetailKey === reports.bindings.find(b => b.kpiId === kpi.id)?.reportDetailKey) };
  });
}
export function clearReferenceCaches() { cache.clear(); }
