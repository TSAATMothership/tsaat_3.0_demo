import { recommendedAction } from "@/lib/actions";
import { PRIORITY_ORDER, SPI_DESCRIPTIONS } from "@/lib/constants";
import {
  Asset,
  AssetSpiEvaluation,
  Finding,
  FindingSeverity,
  SpiEvaluation
} from "@/lib/types";

const FINDINGS_START_DATE = "2024-02-10";

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function toAnchorDate(anchorDate?: string): Date {
  if (!anchorDate) {
    return new Date();
  }

  const normalized = anchorDate.includes("T") ? anchorDate : `${anchorDate}T12:00:00.000Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
}

function formatEstTimestamp(timestamp: Date): string {
  const estOffsetMinutes = -5 * 60;
  const shifted = new Date(timestamp.getTime() + estOffsetMinutes * 60 * 1000);
  const yyyy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const min = String(shifted.getUTCMinutes()).padStart(2, "0");
  const ss = String(shifted.getUTCSeconds()).padStart(2, "0");
  const offset = "-05:00";

  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}${offset}`;
}

function buildDayStarts(anchorDate: Date): Date[] {
  const dayStarts: Date[] = [];
  const start = new Date(`${FINDINGS_START_DATE}T05:00:00.000Z`);
  const end = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth(), anchorDate.getUTCDate(), 5, 0, 0, 0));
  const cursor = new Date(start);

  while (cursor.getTime() <= end.getTime()) {
    dayStarts.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dayStarts;
}

function buildFindingTimestampForDate(findingKey: string, date: Date, anchorDate?: Date): string {
  const hash = hashString(`timestamp:${findingKey}`);
  const minuteOffset = Math.floor(hash / 97) % (24 * 60);
  const secondOffset = Math.floor(hash / 389) % 60;
  const timestamp = new Date(date.getTime() + minuteOffset * 60 * 1000 + secondOffset * 1000);
  if (anchorDate && timestamp.getTime() > anchorDate.getTime()) {
    timestamp.setTime(anchorDate.getTime());
  }
  return formatEstTimestamp(timestamp);
}

function buildCloseTimestampForDate(
  findingKey: string,
  date: Date,
  openedTimestamp: string,
  anchorDate?: Date
): string {
  const candidateTimestamp = buildFindingTimestampForDate(`closed:${findingKey}`, date, anchorDate);
  const candidateDate = new Date(candidateTimestamp);
  const openedDate = new Date(openedTimestamp);

  if (Number.isNaN(candidateDate.getTime()) || Number.isNaN(openedDate.getTime())) {
    return candidateTimestamp;
  }

  if (candidateDate.getTime() > openedDate.getTime()) {
    return candidateTimestamp;
  }

  const bumpedDate = new Date(openedDate.getTime() + 60 * 1000);
  if (anchorDate && bumpedDate.getTime() > anchorDate.getTime()) {
    bumpedDate.setTime(anchorDate.getTime());
  }
  return formatEstTimestamp(bumpedDate);
}

function rangedDeterministicInt(key: string, min: number, max: number): number {
  return min + (hashString(key) % (max - min + 1));
}

function buildPriorityRank(evaluation: SpiEvaluation, productionCritical: boolean): number {
  if (evaluation.status === "Unknown") {
    return 90;
  }

  if ([4, 5, 6].includes(evaluation.spiId) && evaluation.status === "Non-compliant") {
    return 1;
  }

  if (productionCritical && [3, 7].includes(evaluation.spiId) && evaluation.status === "Non-compliant") {
    return 2;
  }

  if ([1, 8].includes(evaluation.spiId) && evaluation.status === "Non-compliant") {
    return 3;
  }

  if (evaluation.spiId === 2 && evaluation.status === "Non-compliant") {
    return 4;
  }

  if (evaluation.spiId === 9 && evaluation.status === "Non-compliant") {
    return 6;
  }

  if (evaluation.spiId === 10 && evaluation.status === "Non-compliant") {
    return 7;
  }

  return PRIORITY_ORDER[evaluation.spiId] ?? 99;
}

function buildSeverity(evaluation: SpiEvaluation, productionCritical: boolean): FindingSeverity {
  if (evaluation.status === "Unknown") {
    return "Data Gap";
  }

  if ([4, 5, 6].includes(evaluation.spiId) && evaluation.status === "Non-compliant") {
    return "High Risk";
  }

  if (productionCritical && [3, 7].includes(evaluation.spiId) && evaluation.status === "Non-compliant") {
    return "Critical Exposure";
  }

  if ([1, 3, 7, 8].includes(evaluation.spiId) && evaluation.status === "Non-compliant") {
    return "Major";
  }

  return "Moderate";
}

export function buildFindings(
  assets: Asset[],
  evaluations: AssetSpiEvaluation[],
  productionCriticalAssetIds: Set<string>,
  options: { anchorDate?: string } = {}
): Finding[] {
  const byAsset = new Map(assets.map((asset) => [asset.id, asset]));
  const anchorDate = toAnchorDate(options.anchorDate);
  const drafts: Omit<Finding, "status" | "timestamp">[] = [];

  for (const item of evaluations) {
    for (const evaluation of item.evaluations) {
      if (evaluation.status === "Compliant") {
        continue;
      }

      const asset = byAsset.get(item.assetId);
      if (!asset) {
        continue;
      }

      const productionCritical = productionCriticalAssetIds.has(item.assetId);
      const priorityRank = buildPriorityRank(evaluation, productionCritical);
      const severity = buildSeverity(evaluation, productionCritical);

      drafts.push({
        id: `${item.assetId}-spi-${evaluation.spiId}`,
        spiId: evaluation.spiId,
        priorityRank,
        severity,
        complianceStatus: evaluation.status,
        scope: {
          networkId: item.networkId,
          systemId: item.systemId,
          environmentType: item.environmentType,
          assetId: item.assetId
        },
        title: SPI_DESCRIPTIONS[evaluation.spiId],
        evidence: {
          assetName: asset.name,
          assetType: asset.type,
          ...evaluation.evidence
        },
        recommendedAction: recommendedAction(evaluation.spiId)
      });
    }
  }

  if (!drafts.length) {
    return [];
  }

  const orderedDrafts = drafts.slice().sort((a, b) => a.id.localeCompare(b.id));
  const dayStarts = buildDayStarts(anchorDate);
  if (!dayStarts.length) {
    return [];
  }
  const findings: Finding[] = [];
  const openFindingIndices: number[] = [];
  const anchorSeed = anchorDate.toISOString().slice(0, 10);
  let sequence = 1;

  const pushFinding = (date: Date, seedKey: string) => {
    const draftIndex = hashString(`template:${seedKey}`) % orderedDrafts.length;
    const draft = orderedDrafts[draftIndex];
    const findingId = `finding-${String(sequence).padStart(6, "0")}`;
    const timestamp = buildFindingTimestampForDate(`${draft.id}:${seedKey}`, date, anchorDate);

    findings.push({
      ...draft,
      id: findingId,
      status: "open",
      timestamp,
      closedTimestamp: null
    });
    openFindingIndices.push(findings.length - 1);
    sequence += 1;
  };

  // Baseline backlog at Feb 10, 2024.
  const firstDay = dayStarts[0];
  const baselineDate = new Date(`${FINDINGS_START_DATE}T05:00:00.000Z`);
  for (let index = 0; index < 200; index += 1) {
    pushFinding(firstDay, `baseline:${anchorSeed}:${index}:${baselineDate.toISOString().slice(0, 10)}`);
  }

  for (let dayIndex = 1; dayIndex < dayStarts.length; dayIndex += 1) {
    const dayStart = dayStarts[dayIndex];
    const openCount = openFindingIndices.length;
    const chooseAdd = (() => {
      if (openCount <= 180) {
        return true;
      }
      if (openCount >= 320) {
        return false;
      }
      return rangedDeterministicInt(`daily-direction:${anchorSeed}:${dayIndex}`, 1, 100) <= 38;
    })();

    if (chooseAdd) {
      const addRate = rangedDeterministicInt(`daily-add-rate:${anchorSeed}:${dayIndex}`, 0, 40);
      const projectedAddCount = openCount > 0 ? Math.floor((openCount * addRate) / 100) : 0;
      const addCount = Math.max(1, projectedAddCount);
      for (let addIndex = 0; addIndex < addCount; addIndex += 1) {
        pushFinding(dayStart, `daily-add:${anchorSeed}:${dayIndex}:${addIndex}`);
      }
      continue;
    }

    if (!openCount) {
      continue;
    }

    const closeRate = rangedDeterministicInt(`daily-close-rate:${anchorSeed}:${dayIndex}`, 10, 20);
    const closeCount = Math.min(openCount, Math.max(1, Math.floor((openCount * closeRate) / 100)));
    const closingSelection = openFindingIndices
      .slice()
      .sort((a, b) => {
        const aHash = hashString(`close-pick:${anchorSeed}:${dayIndex}:${findings[a].id}`);
        const bHash = hashString(`close-pick:${anchorSeed}:${dayIndex}:${findings[b].id}`);
        if (aHash !== bHash) {
          return aHash - bHash;
        }
        return findings[a].id.localeCompare(findings[b].id);
      })
      .slice(0, closeCount);

    const closingSet = new Set(closingSelection);
    for (const findingIndex of closingSelection) {
      const finding = findings[findingIndex];
      finding.status = "closed";
      finding.closedTimestamp = buildCloseTimestampForDate(
        `${finding.id}:${anchorSeed}:${dayIndex}`,
        dayStart,
        finding.timestamp,
        anchorDate
      );
    }
    const remainingOpen = openFindingIndices.filter((index) => !closingSet.has(index));
    openFindingIndices.length = 0;
    openFindingIndices.push(...remainingOpen);

    // Keep at least one finding timestamped each day while preserving a net decrease on close days.
    const backfillCount = rangedDeterministicInt(`daily-close-backfill:${anchorSeed}:${dayIndex}`, 1, 3);
    for (let addIndex = 0; addIndex < backfillCount; addIndex += 1) {
      pushFinding(dayStart, `daily-close-backfill:${anchorSeed}:${dayIndex}:${addIndex}`);
    }
  }

  return findings.sort((a, b) => {
    if (a.priorityRank !== b.priorityRank) {
      return a.priorityRank - b.priorityRank;
    }
    if (a.severity !== b.severity) {
      return a.severity.localeCompare(b.severity);
    }
    return a.id.localeCompare(b.id);
  });
}
