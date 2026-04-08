import {
  Asset,
  ComplianceStatus,
  NetworkDeviceAsset,
  ServerAsset,
  SpiEvaluation,
  WorkstationAsset
} from "@/lib/types";

function hasCriticalVulnerability(asset: Asset): boolean {
  return asset.vulnerabilities.some((vuln) => vuln.severity === "Critical");
}

function isProductionContext(asset: Asset): boolean {
  return asset.systemContext?.environmentType === "Production";
}

function statusFromBool(value: boolean): ComplianceStatus {
  return value ? "Compliant" : "Non-compliant";
}

function evaluateSupportRule(
  supportStatus: string | undefined | null,
  reasonLabel: string
): Pick<SpiEvaluation, "status" | "reasons"> {
  if (!supportStatus || supportStatus === "Unknown") {
    return { status: "Unknown", reasons: [`Missing ${reasonLabel}.`] };
  }
  return {
    status: supportStatus === "OutOfSupport" ? "Non-compliant" : "Compliant",
    reasons:
      supportStatus === "OutOfSupport"
        ? [`${reasonLabel} is out of support.`]
        : [`${reasonLabel} is vendor supported.`]
  };
}

function evaluateSpi1(asset: ServerAsset | WorkstationAsset): SpiEvaluation {
  const os = asset.operatingSystem;
  if (!os) {
    return {
      spiId: 1,
      status: "Unknown",
      evidence: { operatingSystem: null, supportStatus: null },
      reasons: ["Operating system data is missing."]
    };
  }

  const result = evaluateSupportRule(os.supportStatus, "Operating system");
  return {
    spiId: 1,
    status: result.status,
    evidence: {
      operatingSystem: `${os.family} ${os.version}`,
      supportStatus: os.supportStatus
    },
    reasons: result.reasons
  };
}

function evaluateSpi2(asset: ServerAsset | WorkstationAsset): SpiEvaluation {
  const os = asset.operatingSystem;
  if (!os || os.nMinus === null || os.nMinus === undefined) {
    return {
      spiId: 2,
      status: "Unknown",
      evidence: {
        operatingSystem: os ? `${os.family} ${os.version}` : null,
        nMinus: os?.nMinus ?? null
      },
      reasons: ["N-minus metadata is missing."]
    };
  }

  return {
    spiId: 2,
    status: os.nMinus <= 2 ? "Compliant" : "Non-compliant",
    evidence: {
      operatingSystem: `${os.family} ${os.version}`,
      nMinus: os.nMinus,
      currentMajor: os.currentSupportedMajor
    },
    reasons:
      os.nMinus <= 2
        ? ["OS is within N-2 range."]
        : ["OS major version is older than N-2."]
  };
}

function evaluateSpi3(asset: ServerAsset): SpiEvaluation {
  const critical = hasCriticalVulnerability(asset);
  return {
    spiId: 3,
    status: statusFromBool(!critical),
    evidence: {
      criticalVulnerabilities: asset.vulnerabilities.filter((v) => v.severity === "Critical").length
    },
    reasons: critical
      ? ["Server has one or more critical vulnerabilities."]
      : ["No critical server vulnerabilities present."]
  };
}

function evaluateSpi4(asset: ServerAsset): SpiEvaluation {
  const critical = hasCriticalVulnerability(asset);
  const production = isProductionContext(asset);
  const os = asset.operatingSystem;
  if (!production) {
    return {
      spiId: 4,
      status: "Compliant",
      evidence: {
        productionContext: false,
        criticalVulnerability: critical,
        osSupportStatus: os?.supportStatus ?? null
      },
      reasons: ["Asset is not in production context."]
    };
  }

  if (!os || !os.supportStatus || os.supportStatus === "Unknown") {
    return {
      spiId: 4,
      status: "Unknown",
      evidence: {
        productionContext: true,
        criticalVulnerability: critical,
        osSupportStatus: os?.supportStatus ?? null
      },
      reasons: ["Production server OS support status is missing."]
    };
  }

  const triggered = critical && os.supportStatus === "OutOfSupport";
  return {
    spiId: 4,
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

function evaluateSpi5(asset: ServerAsset): SpiEvaluation {
  const critical = hasCriticalVulnerability(asset);
  const production = isProductionContext(asset);
  const software = asset.installedSoftware;

  if (!production) {
    return {
      spiId: 5,
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
      spiId: 5,
      status: "Unknown",
      evidence: {
        productionContext: true,
        criticalVulnerability: critical,
        outOfSupportSoftwareCount: null
      },
      reasons: ["Installed software data is missing."]
    };
  }

  const outOfSupportCount = software.filter((item) => item.supportStatus === "OutOfSupport").length;
  const triggered = critical && outOfSupportCount > 0;
  return {
    spiId: 5,
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

function evaluateSpi6(asset: WorkstationAsset): SpiEvaluation {
  const critical = hasCriticalVulnerability(asset);
  const production = isProductionContext(asset);
  const software = asset.installedSoftware;

  if (!production) {
    return {
      spiId: 6,
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
      spiId: 6,
      status: "Unknown",
      evidence: {
        productionContext: true,
        criticalVulnerability: critical,
        outOfSupportSoftwareCount: null
      },
      reasons: ["Installed software data is missing."]
    };
  }

  const outOfSupportCount = software.filter((item) => item.supportStatus === "OutOfSupport").length;
  const triggered = critical && outOfSupportCount > 0;
  return {
    spiId: 6,
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

function evaluateSpi7(asset: NetworkDeviceAsset): SpiEvaluation {
  const critical = hasCriticalVulnerability(asset);
  return {
    spiId: 7,
    status: statusFromBool(!critical),
    evidence: {
      criticalVulnerabilities: asset.vulnerabilities.filter((v) => v.severity === "Critical").length
    },
    reasons: critical
      ? ["Network device has critical vulnerabilities."]
      : ["No critical vulnerabilities found on network device."]
  };
}

function evaluateSpi8(asset: NetworkDeviceAsset): SpiEvaluation {
  const networkOs = asset.networkOs;
  if (!networkOs) {
    return {
      spiId: 8,
      status: "Unknown",
      evidence: {
        networkOs: null,
        supportStatus: null
      },
      reasons: ["Network OS/firmware data is missing."]
    };
  }

  const result = evaluateSupportRule(networkOs.supportStatus, "Network OS/firmware");
  return {
    spiId: 8,
    status: result.status,
    evidence: {
      networkOs: `${networkOs.family} ${networkOs.version}`,
      supportStatus: networkOs.supportStatus
    },
    reasons: result.reasons
  };
}

function evaluateSpi9(asset: NetworkDeviceAsset): SpiEvaluation {
  const patchState = asset.patchState;
  if (!patchState || patchState.isLatest === null) {
    return {
      spiId: 9,
      status: "Unknown",
      evidence: {
        isLatestPatch: null,
        lastPatchedDate: patchState?.lastPatchedDate ?? null
      },
      reasons: ["Patch state is missing."]
    };
  }

  return {
    spiId: 9,
    status: patchState.isLatest ? "Compliant" : "Non-compliant",
    evidence: {
      isLatestPatch: patchState.isLatest,
      lastPatchedDate: patchState.lastPatchedDate
    },
    reasons: patchState.isLatest
      ? ["Network device patch level is current."]
      : ["Network device is not on latest patch level."]
  };
}

function evaluateSpi10(asset: Asset): SpiEvaluation {
  const { eolStatus, warrantyStatus } = asset.lifecycle;
  if (eolStatus === "Unknown" || warrantyStatus === "Unknown") {
    return {
      spiId: 10,
      status: "Unknown",
      evidence: {
        eolStatus,
        warrantyStatus
      },
      reasons: ["Lifecycle data is incomplete."]
    };
  }

  const compliant = eolStatus !== "EOL" && warrantyStatus === "InWarranty";
  return {
    spiId: 10,
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

export function evaluateAssetSpis(asset: Asset): SpiEvaluation[] {
  const base: SpiEvaluation[] = [evaluateSpi10(asset)];

  if (asset.type === "server") {
    return [
      evaluateSpi1(asset),
      evaluateSpi2(asset),
      evaluateSpi3(asset),
      evaluateSpi4(asset),
      evaluateSpi5(asset),
      ...base
    ];
  }

  if (asset.type === "workstation") {
    return [evaluateSpi1(asset), evaluateSpi2(asset), evaluateSpi6(asset), ...base];
  }

  return [evaluateSpi7(asset), evaluateSpi8(asset), evaluateSpi9(asset), ...base];
}

export function hasProductionCriticalVulnerability(asset: Asset): boolean {
  return isProductionContext(asset) && hasCriticalVulnerability(asset);
}
