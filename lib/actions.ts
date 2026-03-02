import { SpiId } from "@/lib/types";

const ACTIONS: Record<SpiId, string> = {
  1: "Upgrade or migrate affected operating systems to vendor-supported versions and add lifecycle governance checkpoints.",
  2: "Plan staged OS major-version uplift to reach N-2 or better across impacted hosts.",
  3: "Patch or mitigate critical server vulnerabilities immediately and confirm exploitability posture.",
  4: "Treat as immediate operational risk: isolate or patch production server, remove critical vuln, and uplift unsupported OS.",
  5: "Prioritize production server software remediation: update unsupported software and clear linked critical vulnerabilities.",
  6: "Prioritize production-support workstation software remediation: update unsupported software and clear linked critical vulnerabilities.",
  7: "Patch or mitigate critical network-device vulnerabilities and validate rule/ACL hardening.",
  8: "Upgrade device firmware/OS to supported releases and align with approved baseline catalog.",
  9: "Bring network devices to latest patch level and enforce maintenance windows with SLA tracking.",
  10: "Replace or renew lifecycle-expired assets (EOL / out-of-warranty) through prioritized capital plan."
};

export function recommendedAction(spiId: SpiId): string {
  return ACTIONS[spiId];
}
