import { recommendedAction } from "@/lib/actions";
import { KpiRow, SpiRow } from "@/lib/measures";
import { KpiDefinition, KpiTaskingActionTemplate } from "@/lib/kpi-definitions";
import { spiDefinitionById, SpiDefinition, SpiTaskingActionTemplate } from "@/lib/spi-definitions";
import { SpiId } from "@/lib/types";

export interface TeamContact {
  team: string;
  supportQueue: string;
  contactEmail: string;
}

function uniqueTeams(items: TeamContact[]): TeamContact[] {
  const map = new Map(items.map((item) => [item.team, item]));
  return Array.from(map.values());
}

export function kpiDefinitionById(kpiDefinitions: KpiDefinition[]): Map<string, KpiDefinition> {
  return new Map(kpiDefinitions.map((definition) => [definition.id, definition]));
}

export function teamsForKpi(kpiId: string, kpiDefinitions: KpiDefinition[]): TeamContact[] {
  const definition = kpiDefinitionById(kpiDefinitions).get(kpiId);
  return uniqueTeams(
    definition?.taskingTeams.length
      ? definition.taskingTeams.map(({ team, supportQueue, contactEmail }) => ({ team, supportQueue, contactEmail }))
      : [
          {
            team: "Cyber Governance and Assurance Team",
            supportQueue: "CGA-ASSURANCE",
            contactEmail: "cga.assurance@defence.local"
          }
        ]
  );
}

export function teamsForSpi(spiId: SpiId, spiDefinitions: SpiDefinition[]): TeamContact[] {
  const definition = spiDefinitionById(spiDefinitions).get(spiId);
  return uniqueTeams(
    definition?.taskingTeams.length
      ? definition.taskingTeams.map(({ team, supportQueue, contactEmail }) => ({ team, supportQueue, contactEmail }))
      : [
          {
            team: "Cyber Security Operations Centre",
            supportQueue: "CSOC-ESCALATION",
            contactEmail: "csoc@defence.local"
          }
        ]
  );
}

function applyKpiTaskingTemplate(template: string, row: KpiRow): string {
  return template
    .replaceAll("{kpiId}", row.id)
    .replaceAll("{scorePercent}", String(row.scorePercent))
    .replaceAll("{compliantCount}", String(row.compliantCount))
    .replaceAll("{nonCompliantCount}", String(row.nonCompliantCount))
    .replaceAll("{unknownCount}", String(row.unknownCount))
    .replaceAll("{applicableCount}", String(row.applicableCount));
}

export function taskingConditionForKpi(row: KpiRow, kpiDefinitions: KpiDefinition[]): string {
  const definition = kpiDefinitionById(kpiDefinitions).get(row.id);
  if (row.nonCompliantCount > 0) {
    return applyKpiTaskingTemplate(
      definition?.taskingConditions.non_compliant ??
        "Detected {nonCompliantCount} non-compliant measure item(s) for {kpiId}. This indicates current posture is below target threshold and requires directed remediation.",
      row
    );
  }
  if (row.unknownCount > 0) {
    return applyKpiTaskingTemplate(
      definition?.taskingConditions.unknown ??
        "No non-compliance detected for {kpiId}, however {unknownCount} data-gap item(s) limit confidence in full compliance assessment.",
      row
    );
  }
  return applyKpiTaskingTemplate(
    definition?.taskingConditions.compliant ??
      "{kpiId} is currently within target in this filter scope with no detected non-compliant condition.",
    row
  );
}

function kpiActionApplies(row: KpiRow, action: KpiTaskingActionTemplate): boolean {
  if (action.conditionKey === "always") {
    return true;
  }
  if (action.conditionKey === "when_unknown") {
    return row.unknownCount > 0;
  }
  return row.nonCompliantCount === 0 && row.unknownCount === 0;
}

export function remediationActionsForKpi(row: KpiRow, kpiDefinitions: KpiDefinition[]): string[] {
  const definition = kpiDefinitionById(kpiDefinitions).get(row.id);
  const configuredActions = definition?.taskingActions
    .filter((action) => kpiActionApplies(row, action))
    .map((action) => action.actionText);

  return configuredActions?.length ? configuredActions : ["Maintain monitoring cadence and verify control effectiveness."];
}

function applyTaskingTemplate(template: string, row: SpiRow): string {
  return template
    .replaceAll("{spiId}", String(row.spiId))
    .replaceAll("{scorePercent}", String(row.scorePercent))
    .replaceAll("{compliant}", String(row.compliant))
    .replaceAll("{nonCompliant}", String(row.nonCompliant))
    .replaceAll("{unknown}", String(row.unknown))
    .replaceAll("{total}", String(row.total));
}

export function taskingConditionForSpi(row: SpiRow, spiDefinition?: SpiDefinition): string {
  if (row.nonCompliant > 0) {
    return applyTaskingTemplate(
      spiDefinition?.taskingConditions.non_compliant ??
        "Detected {nonCompliant} non-compliant evaluation(s) for SPI-{spiId}. Current measured compliance is {scorePercent}% across {total} applicable evaluation(s).",
      row
    );
  }
  if (row.unknown > 0) {
    return applyTaskingTemplate(
      spiDefinition?.taskingConditions.unknown ??
        "SPI-{spiId} has no non-compliant evaluations in scope, but {unknown} unknown evaluation(s) require data-quality remediation.",
      row
    );
  }
  return applyTaskingTemplate(
    spiDefinition?.taskingConditions.compliant ??
      "SPI-{spiId} is fully compliant in current scope ({scorePercent}% across {total} evaluations).",
    row
  );
}

function actionApplies(row: SpiRow, action: SpiTaskingActionTemplate): boolean {
  if (action.conditionKey === "always") {
    return true;
  }
  if (action.conditionKey === "when_unknown") {
    return row.unknown > 0;
  }
  return row.nonCompliant === 0 && row.unknown === 0;
}

export function remediationActionsForSpi(row: SpiRow, spiDefinitions: SpiDefinition[]): string[] {
  const definition = spiDefinitionById(spiDefinitions).get(row.spiId);
  const configuredActions = definition?.taskingActions
    .filter((action) => actionApplies(row, action))
    .map((action) => action.actionText);

  if (configuredActions?.length) {
    return configuredActions;
  }

  const actions = [recommendedAction(row.spiId, spiDefinitions)];
  if (row.unknown > 0) {
    actions.push("Resolve missing evidence fields to remove Unknown outcomes and increase confidence.");
  }
  if (row.nonCompliant === 0 && row.unknown === 0) {
    actions.push("Maintain current control baseline and continue scheduled assurance checks.");
  }
  return actions;
}
