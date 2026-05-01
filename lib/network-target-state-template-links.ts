import { DATA_DATE_PARAM, normalizeDataDate } from "@/lib/data-date";

export const NETWORK_TARGET_STATE_TEMPLATE_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function safeFilenameSegment(value: string): string {
  const safe = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return safe || "network";
}

export function networkTargetStateTemplateFilename(networkName: string): string {
  return `${safeFilenameSegment(networkName)} target state template.xlsx`;
}

export function networkTargetStateTemplateContentDisposition(networkName: string): string {
  const filename = networkTargetStateTemplateFilename(networkName);
  const quotedFilename = filename.replace(/["\\]/g, "_");
  return `attachment; filename="${quotedFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function buildNetworkTargetStateTemplateHref({
  networkId,
  dataDate
}: {
  networkId: string;
  dataDate?: string;
}): string {
  const params = new URLSearchParams({ network: networkId });
  const normalizedDataDate = normalizeDataDate(dataDate);
  if (normalizedDataDate) {
    params.set(DATA_DATE_PARAM, normalizedDataDate);
  }
  return `/api/discovery-coverage/target-state-template?${params.toString()}`;
}
