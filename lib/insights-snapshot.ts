export function insightsSnapshotTimestamp(value: string | null | undefined): string {
  if (!value || !/T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return "Not recorded";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().replace("T", " ").replace("Z", " UTC") : "Not recorded";
}
