import { Finding } from "@/lib/types";

function toTimestamp(value?: string | null): number {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }
  const parsed = new Date(value).getTime();
  if (Number.isNaN(parsed)) {
    return Number.NEGATIVE_INFINITY;
  }
  return parsed;
}

function toDiscreteFindingKey(finding: Finding): string {
  return `${finding.scope.assetId}|spi-${finding.spiId}|${finding.severity}|${finding.complianceStatus}`;
}

function toFindingRecencyScore(finding: Finding): number {
  const openedAt = toTimestamp(finding.timestamp);
  const closedAt = toTimestamp(finding.closedTimestamp);
  return Math.max(openedAt, closedAt);
}

export function deduplicateFindings(findings: Finding[]): Finding[] {
  const findingByKey = new Map<string, Finding>();
  const keyOrder: string[] = [];

  for (const finding of findings) {
    const key = toDiscreteFindingKey(finding);
    const current = findingByKey.get(key);
    if (!current) {
      findingByKey.set(key, finding);
      keyOrder.push(key);
      continue;
    }

    const currentScore = toFindingRecencyScore(current);
    const candidateScore = toFindingRecencyScore(finding);
    if (candidateScore > currentScore) {
      findingByKey.set(key, finding);
      continue;
    }

    if (candidateScore === currentScore && finding.id > current.id) {
      findingByKey.set(key, finding);
    }
  }

  return keyOrder
    .map((key) => findingByKey.get(key))
    .filter((finding): finding is Finding => Boolean(finding));
}
