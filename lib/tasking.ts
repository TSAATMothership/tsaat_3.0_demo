import { recommendedAction } from "@/lib/actions";
import { KpiRow, SpiRow } from "@/lib/measures";
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

export function teamsForKpi(kpiId: string): TeamContact[] {
  const base = [
    {
      team: "Cyber Governance and Assurance Team",
      supportQueue: "CGA-ASSURANCE",
      contactEmail: "cga.assurance@defence.local"
    }
  ];

  const byId: Record<string, TeamContact[]> = {
    "KPI-1": [
      {
        team: "Cyber Governance and Assurance Team",
        supportQueue: "CGA-POSTURE",
        contactEmail: "cga.posture@defence.local"
      }
    ],
    "KPI-2": [
      {
        team: "Vulnerability Operations Team",
        supportQueue: "CYBER-VULN-OPS",
        contactEmail: "vuln.ops@defence.local"
      }
    ],
    "KPI-3": [
      {
        team: "Data Quality and Asset Intelligence Team",
        supportQueue: "CYBER-DATA-QUALITY",
        contactEmail: "asset.data@defence.local"
      }
    ],
    "KPI-4": [
      {
        team: "Production Security Response Team",
        supportQueue: "CYBER-PROD-RESP",
        contactEmail: "prod.response@defence.local"
      }
    ],
    "KPI-5": [
      {
        team: "Critical Exposure Response Cell",
        supportQueue: "CYBER-CRIT-EXPOSURE",
        contactEmail: "crit.exposure@defence.local"
      }
    ],
    "KPI-6": [
      {
        team: "Joint Cyber Operations Tasking Team",
        supportQueue: "CYBER-TASKING",
        contactEmail: "tasking.ops@defence.local"
      }
    ],
    "KPI-7": [
      {
        team: "ICT Governance and Accreditation Team",
        supportQueue: "ICT-ATO-GOV",
        contactEmail: "ato.governance@defence.local"
      }
    ],
    "KPI-8": [
      {
        team: "ICT Registry and Integration Team",
        supportQueue: "ICT-DIIS-REG",
        contactEmail: "diis.registry@defence.local"
      }
    ],
    "KPI-9": [
      {
        team: "ICT Modelling and Architecture Team",
        supportQueue: "ICT-MODELLING",
        contactEmail: "ict.modelling@defence.local"
      }
    ],
    "KPI-10": [
      {
        team: "Network Discovery Operations Team",
        supportQueue: "NETWORK-DISCOVERY",
        contactEmail: "network.discovery@defence.local"
      }
    ]
  };

  return uniqueTeams([...(byId[kpiId] ?? []), ...base]);
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

export function taskingConditionForKpi(row: KpiRow): string {
  if (row.nonCompliantCount > 0) {
    return `Detected ${row.nonCompliantCount} non-compliant measure item(s) for ${row.id}. This indicates current posture is below target threshold and requires directed remediation.`;
  }
  if (row.unknownCount > 0) {
    return `No non-compliance detected for ${row.id}, however ${row.unknownCount} data-gap item(s) limit confidence in full compliance assessment.`;
  }
  return `${row.id} is currently within target in this filter scope with no detected non-compliant condition.`;
}

const KPI_ACTIONS: Record<string, string[]> = {
  "KPI-1": [
    "Prioritize recovery of non-compliant SPI domains with strongest operational impact.",
    "Set two-week checkpoint for compliance uplift verification."
  ],
  "KPI-2": [
    "Open remediation tasks for all failing SPI checks and assign accountable owner.",
    "Track closure rate weekly until backlog reaches target."
  ],
  "KPI-3": [
    "Resolve unknown data fields in asset, lifecycle, and patch records.",
    "Implement data completeness guardrails in ingestion workflow."
  ],
  "KPI-4": [
    "Trigger immediate high-risk production mitigation workflow.",
    "Require executive escalation for unresolved high-risk items older than 48 hours."
  ],
  "KPI-5": [
    "Contain and remediate all production critical-exposure assets.",
    "Validate compensating controls where immediate patching is not feasible."
  ],
  "KPI-6": [
    "Re-balance operations workload to close priority 1-2 items first.",
    "Run daily command stand-up until immediate backlog returns to target."
  ],
  "KPI-7": [
    "Validate ATO currency for non-compliant ICT systems and initiate renewal workflows.",
    "Escalate expired or missing ATO records to ICT governance authority."
  ],
  "KPI-8": [
    "Register all non-compliant ICT systems within DIIS and verify metadata completeness.",
    "Set weekly reconciliation between ICT system inventory and DIIS register."
  ],
  "KPI-9": [
    "Prioritize DIIS systems with no model and assign modelling owners.",
    "Track modelling completion weekly until DIIS model coverage reaches target."
  ],
  "KPI-10": [
    "Enable discovery on all defined networks currently marked Discovery Non Enabled.",
    "Apply weekly validation against network inventory to keep discovery status current."
  ]
};

export function remediationActionsForKpi(row: KpiRow): string[] {
  return KPI_ACTIONS[row.id] ?? ["Maintain monitoring cadence and verify control effectiveness."];
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
