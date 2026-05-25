import {
  Asset,
  ComplianceStatus,
  NetworkDeviceAsset,
  ServerAsset,
  SpiEvaluation,
  WorkstationAsset
} from "@/lib/types";
import { isSpiApplicableToAssetType, SpiDefinition } from "@/lib/spi-definitions";

function hasVulnerabilitySeverity(asset: Asset, severity: string): boolean {
  return asset.vulnerabilities.some((vuln) => vuln.severity === severity);
}

function vulnerabilitySeverityCount(asset: Asset, severity: string): number {
  return asset.vulnerabilities.filter((vuln) => vuln.severity === severity).length;
}

function isProductionContext(asset: Asset): boolean {
  return asset.systemContext?.environmentType === "Production";
}

function isEnvironmentContext(asset: Asset, environmentType: string): boolean {
  return asset.systemContext?.environmentType === environmentType;
}

function statusFromBool(value: boolean): ComplianceStatus {
  return value ? "Compliant" : "Non-compliant";
}

function evaluateSupportRule(
  supportStatus: string | undefined | null,
  reasonLabel: string,
  unsupportedStatus: string,
  unknownSupportStatus: string
): Pick<SpiEvaluation, "outcomeKey" | "status" | "reasons"> {
  if (!supportStatus || supportStatus === unknownSupportStatus) {
    return { outcomeKey: "missing_support_status", status: "Unknown", reasons: [`Missing ${reasonLabel}.`] };
  }
  return {
    outcomeKey: supportStatus === unsupportedStatus ? "unsupported" : "supported",
    status: supportStatus === unsupportedStatus ? "Non-compliant" : "Compliant",
    reasons:
      supportStatus === unsupportedStatus
        ? [`${reasonLabel} is out of support.`]
        : [`${reasonLabel} is vendor supported.`]
  };
}

function numberParameter(definition: SpiDefinition, key: string, fallback: number): number {
  const value = definition.ruleParameters[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringParameter(definition: SpiDefinition, key: string, fallback: string): string {
  const value = definition.ruleParameters[key];
  return typeof value === "string" && value.trim().length ? value.trim() : fallback;
}

function booleanParameter(definition: SpiDefinition, key: string, fallback: boolean): boolean {
  const value = definition.ruleParameters[key];
  return typeof value === "boolean" ? value : fallback;
}

function renderOutcomeTemplate(template: string, definition: SpiDefinition, evaluation: SpiEvaluation): string {
  const context: Record<string, string | number | boolean | null | undefined> = {
    spiId: definition.spiId,
    status: evaluation.status,
    ...definition.ruleParameters,
    ...evaluation.evidence
  };

  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (match, key: string) => {
    const value = context[key];
    return value === null || value === undefined ? "" : String(value);
  });
}

function applyOutcomeTemplate(definition: SpiDefinition, evaluation: SpiEvaluation): SpiEvaluation {
  const outcomeKey = evaluation.outcomeKey;
  if (!outcomeKey) {
    return evaluation;
  }
  const template = definition.outcomeTemplates.find(
    (item) => item.outcomeKey === outcomeKey && item.complianceStatus === evaluation.status
  );
  if (!template) {
    return evaluation;
  }
  return {
    ...evaluation,
    reasons: [renderOutcomeTemplate(template.reasonTemplate, definition, evaluation)]
  };
}

function unsupportedStatusParameter(definition: SpiDefinition): string {
  return stringParameter(definition, "unsupportedStatus", "OutOfSupport");
}

function unknownSupportStatusParameter(definition: SpiDefinition): string {
  return stringParameter(definition, "unknownSupportStatus", "Unknown");
}

function vulnerabilitySeverityParameter(definition: SpiDefinition): string {
  return stringParameter(definition, "vulnerabilitySeverity", "Critical");
}

function environmentTypeParameter(definition: SpiDefinition): string {
  return stringParameter(definition, "environmentType", "Production");
}

function evaluateSpi1(asset: ServerAsset | WorkstationAsset, definition: SpiDefinition): SpiEvaluation {
  const os = asset.operatingSystem;
  if (!os) {
    return {
      spiId: definition.spiId,
      outcomeKey: "missing_os_data",
      status: "Unknown",
      evidence: { operatingSystem: null, supportStatus: null },
      reasons: ["Operating system data is missing."]
    };
  }

  const result = evaluateSupportRule(
    os.supportStatus,
    "Operating system",
    unsupportedStatusParameter(definition),
    unknownSupportStatusParameter(definition)
  );
  return {
    spiId: definition.spiId,
    outcomeKey: result.outcomeKey === "missing_support_status" ? "missing_os_data" : result.outcomeKey,
    status: result.status,
    evidence: {
      operatingSystem: `${os.family} ${os.version}`,
      supportStatus: os.supportStatus
    },
    reasons: result.reasons
  };
}

function evaluateSpi2(asset: ServerAsset | WorkstationAsset, definition: SpiDefinition): SpiEvaluation {
  const maxNMinus = numberParameter(definition, "maxNMinus", 2);
  const os = asset.operatingSystem;
  if (!os || os.nMinus === null || os.nMinus === undefined) {
    return {
      spiId: definition.spiId,
      outcomeKey: "missing_n_minus",
      status: "Unknown",
      evidence: {
        operatingSystem: os ? `${os.family} ${os.version}` : null,
        nMinus: os?.nMinus ?? null
      },
      reasons: ["N-minus metadata is missing."]
    };
  }

  return {
    spiId: definition.spiId,
    outcomeKey: os.nMinus <= maxNMinus ? "within_n_minus" : "older_than_n_minus",
    status: os.nMinus <= maxNMinus ? "Compliant" : "Non-compliant",
    evidence: {
      operatingSystem: `${os.family} ${os.version}`,
      nMinus: os.nMinus,
      currentMajor: os.currentSupportedMajor
    },
    reasons:
      os.nMinus <= maxNMinus
        ? [`OS is within N-${maxNMinus} range.`]
        : [`OS major version is older than N-${maxNMinus}.`]
  };
}

function evaluateSpi3(asset: ServerAsset, definition: SpiDefinition): SpiEvaluation {
  const severity = vulnerabilitySeverityParameter(definition);
  const critical = hasVulnerabilitySeverity(asset, severity);
  return {
    spiId: definition.spiId,
    outcomeKey: critical ? "critical_vulnerability_present" : "no_critical_vulnerability",
    status: statusFromBool(!critical),
    evidence: {
      criticalVulnerabilities: vulnerabilitySeverityCount(asset, severity)
    },
    reasons: critical
      ? ["Server has one or more critical vulnerabilities."]
      : ["No critical server vulnerabilities present."]
  };
}

function evaluateSpi4(asset: ServerAsset, definition: SpiDefinition): SpiEvaluation {
  const critical = hasVulnerabilitySeverity(asset, vulnerabilitySeverityParameter(definition));
  const production = isEnvironmentContext(asset, environmentTypeParameter(definition));
  const os = asset.operatingSystem;
  if (!production) {
    return {
      spiId: definition.spiId,
      outcomeKey: "not_production_context",
      status: "Compliant",
      evidence: {
        productionContext: false,
        criticalVulnerability: critical,
        osSupportStatus: os?.supportStatus ?? null
      },
      reasons: ["Asset is not in production context."]
    };
  }

  const unknownSupportStatus = unknownSupportStatusParameter(definition);
  if (!os || !os.supportStatus || os.supportStatus === unknownSupportStatus) {
    return {
      spiId: definition.spiId,
      outcomeKey: "missing_os_support",
      status: "Unknown",
      evidence: {
        productionContext: true,
        criticalVulnerability: critical,
        osSupportStatus: os?.supportStatus ?? null
      },
      reasons: ["Production server OS support status is missing."]
    };
  }

  const triggered = critical && os.supportStatus === unsupportedStatusParameter(definition);
  return {
    spiId: definition.spiId,
    outcomeKey: triggered ? "triggered" : "not_triggered",
    status: triggered ? "Non-compliant" : "Compliant",
    evidence: {
      productionContext: true,
      criticalVulnerability: critical,
      osSupportStatus: os.supportStatus
    },
    reasons: triggered
      ? ["High Risk: Production server has critical vulnerability on unsupported OS."]
      : ["High Risk condition not triggered."]
  };
}

function evaluateSpi5(asset: ServerAsset, definition: SpiDefinition): SpiEvaluation {
  const critical = hasVulnerabilitySeverity(asset, vulnerabilitySeverityParameter(definition));
  const production = isEnvironmentContext(asset, environmentTypeParameter(definition));
  const software = asset.installedSoftware;
  const unsupportedStatus = unsupportedStatusParameter(definition);

  if (!production) {
    return {
      spiId: definition.spiId,
      outcomeKey: "not_production_context",
      status: "Compliant",
      evidence: {
        productionContext: false,
        criticalVulnerability: critical,
        outOfSupportSoftwareCount: 0
      },
      reasons: ["Asset is not in production context."]
    };
  }

  if (!software.length) {
    return {
      spiId: definition.spiId,
      outcomeKey: "missing_software",
      status: "Unknown",
      evidence: {
        productionContext: true,
        criticalVulnerability: critical,
        outOfSupportSoftwareCount: null
      },
      reasons: ["Installed software data is missing."]
    };
  }

  const outOfSupportCount = software.filter((item) => item.supportStatus === unsupportedStatus).length;
  const triggered = critical && outOfSupportCount > 0;
  return {
    spiId: definition.spiId,
    outcomeKey: triggered ? "triggered" : "not_triggered",
    status: triggered ? "Non-compliant" : "Compliant",
    evidence: {
      productionContext: true,
      criticalVulnerability: critical,
      outOfSupportSoftwareCount: outOfSupportCount
    },
    reasons: triggered
      ? ["High Risk: Production server has critical vulnerability and unsupported installed software."]
      : ["High Risk condition not triggered."]
  };
}

function evaluateSpi6(asset: WorkstationAsset, definition: SpiDefinition): SpiEvaluation {
  const critical = hasVulnerabilitySeverity(asset, vulnerabilitySeverityParameter(definition));
  const production = isEnvironmentContext(asset, environmentTypeParameter(definition));
  const software = asset.installedSoftware;
  const unsupportedStatus = unsupportedStatusParameter(definition);

  if (!production) {
    return {
      spiId: definition.spiId,
      outcomeKey: "not_production_context",
      status: "Compliant",
      evidence: {
        productionContext: false,
        criticalVulnerability: critical,
        outOfSupportSoftwareCount: 0
      },
      reasons: ["Workstation is not in production-support context."]
    };
  }

  if (!software.length) {
    return {
      spiId: definition.spiId,
      outcomeKey: "missing_software",
      status: "Unknown",
      evidence: {
        productionContext: true,
        criticalVulnerability: critical,
        outOfSupportSoftwareCount: null
      },
      reasons: ["Installed software data is missing."]
    };
  }

  const outOfSupportCount = software.filter((item) => item.supportStatus === unsupportedStatus).length;
  const triggered = critical && outOfSupportCount > 0;
  return {
    spiId: definition.spiId,
    outcomeKey: triggered ? "triggered" : "not_triggered",
    status: triggered ? "Non-compliant" : "Compliant",
    evidence: {
      productionContext: true,
      criticalVulnerability: critical,
      outOfSupportSoftwareCount: outOfSupportCount
    },
    reasons: triggered
      ? [
          "High Risk: Production-support workstation has critical vulnerability and unsupported installed software."
        ]
      : ["High Risk condition not triggered."]
  };
}

function evaluateSpi7(asset: NetworkDeviceAsset, definition: SpiDefinition): SpiEvaluation {
  const severity = vulnerabilitySeverityParameter(definition);
  const critical = hasVulnerabilitySeverity(asset, severity);
  return {
    spiId: definition.spiId,
    outcomeKey: critical ? "critical_vulnerability_present" : "no_critical_vulnerability",
    status: statusFromBool(!critical),
    evidence: {
      criticalVulnerabilities: vulnerabilitySeverityCount(asset, severity)
    },
    reasons: critical
      ? ["Network device has critical vulnerabilities."]
      : ["No critical vulnerabilities found on network device."]
  };
}

function evaluateSpi8(asset: NetworkDeviceAsset, definition: SpiDefinition): SpiEvaluation {
  const networkOs = asset.networkOs;
  if (!networkOs) {
    return {
      spiId: definition.spiId,
      outcomeKey: "missing_network_os",
      status: "Unknown",
      evidence: {
        networkOs: null,
        supportStatus: null
      },
      reasons: ["Network OS/firmware data is missing."]
    };
  }

  const result = evaluateSupportRule(
    networkOs.supportStatus,
    "Network OS/firmware",
    unsupportedStatusParameter(definition),
    unknownSupportStatusParameter(definition)
  );
  return {
    spiId: definition.spiId,
    outcomeKey: result.outcomeKey === "missing_support_status" ? "missing_network_os" : result.outcomeKey,
    status: result.status,
    evidence: {
      networkOs: `${networkOs.family} ${networkOs.version}`,
      supportStatus: networkOs.supportStatus
    },
    reasons: result.reasons
  };
}

function evaluateSpi9(asset: NetworkDeviceAsset, definition: SpiDefinition): SpiEvaluation {
  const patchState = asset.patchState;
  if (!patchState || patchState.isLatest === null) {
    return {
      spiId: definition.spiId,
      outcomeKey: "missing_patch_state",
      status: "Unknown",
      evidence: {
        isLatestPatch: null,
        lastPatchedDate: patchState?.lastPatchedDate ?? null
      },
      reasons: ["Patch state is missing."]
    };
  }

  const latestPatchRequired = booleanParameter(definition, "latestPatchRequired", true);
  const compliant = patchState.isLatest === latestPatchRequired;
  return {
    spiId: definition.spiId,
    outcomeKey: compliant ? "current" : "not_current",
    status: compliant ? "Compliant" : "Non-compliant",
    evidence: {
      isLatestPatch: patchState.isLatest,
      lastPatchedDate: patchState.lastPatchedDate
    },
    reasons: compliant
      ? ["Network device patch level is current."]
      : ["Network device is not on latest patch level."]
  };
}

function evaluateSpi10(asset: Asset, definition: SpiDefinition): SpiEvaluation {
  const { eolStatus, warrantyStatus } = asset.lifecycle;
  const unknownLifecycleStatus = stringParameter(definition, "unknownLifecycleStatus", "Unknown");
  if (eolStatus === unknownLifecycleStatus || warrantyStatus === unknownLifecycleStatus) {
    return {
      spiId: definition.spiId,
      outcomeKey: "missing_lifecycle",
      status: "Unknown",
      evidence: {
        eolStatus,
        warrantyStatus
      },
      reasons: ["Lifecycle data is incomplete."]
    };
  }

  const endOfLifeStatus = stringParameter(definition, "endOfLifeStatus", "EOL");
  const inWarrantyStatus = stringParameter(definition, "inWarrantyStatus", "InWarranty");
  const compliant = eolStatus !== endOfLifeStatus && warrantyStatus === inWarrantyStatus;
  return {
    spiId: definition.spiId,
    outcomeKey: compliant ? "current" : "expired",
    status: compliant ? "Compliant" : "Non-compliant",
    evidence: {
      eolStatus,
      warrantyStatus
    },
    reasons: compliant
      ? ["Lifecycle and warranty are within policy."]
      : ["Device is EOL or out of warranty."]
  };
}

function evaluateAssetSpiDefinition(asset: Asset, definition: SpiDefinition): SpiEvaluation | null {
  if (!isSpiApplicableToAssetType(definition, asset.type)) {
    return null;
  }

  let evaluation: SpiEvaluation | null = null;

  switch (definition.ruleDefinition.handlerKey) {
    case "os-support":
      evaluation = asset.type === "server" || asset.type === "workstation" ? evaluateSpi1(asset, definition) : null;
      break;
    case "os-n-minus":
      evaluation = asset.type === "server" || asset.type === "workstation" ? evaluateSpi2(asset, definition) : null;
      break;
    case "server-critical-vulnerability":
      evaluation = asset.type === "server" ? evaluateSpi3(asset, definition) : null;
      break;
    case "production-server-critical-unsupported-os":
      evaluation = asset.type === "server" ? evaluateSpi4(asset, definition) : null;
      break;
    case "production-server-critical-unsupported-software":
      evaluation = asset.type === "server" ? evaluateSpi5(asset, definition) : null;
      break;
    case "production-workstation-critical-unsupported-software":
      evaluation = asset.type === "workstation" ? evaluateSpi6(asset, definition) : null;
      break;
    case "network-device-critical-vulnerability":
      evaluation = asset.type === "network-device" ? evaluateSpi7(asset, definition) : null;
      break;
    case "network-device-support":
      evaluation = asset.type === "network-device" ? evaluateSpi8(asset, definition) : null;
      break;
    case "network-device-patch-currency":
      evaluation = asset.type === "network-device" ? evaluateSpi9(asset, definition) : null;
      break;
    case "asset-lifecycle-currency":
      evaluation = evaluateSpi10(asset, definition);
      break;
  }

  return evaluation ? applyOutcomeTemplate(definition, evaluation) : null;
}

export function evaluateAssetSpis(asset: Asset, spiDefinitions: SpiDefinition[]): SpiEvaluation[] {
  return spiDefinitions
    .map((definition) => evaluateAssetSpiDefinition(asset, definition))
    .filter((evaluation): evaluation is SpiEvaluation => Boolean(evaluation));
}

export function hasProductionCriticalVulnerability(asset: Asset): boolean {
  return isProductionContext(asset) && hasVulnerabilitySeverity(asset, "Critical");
}
