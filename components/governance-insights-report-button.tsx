"use client";

import { InsightsReportButton } from "@/components/insights-report-button";

export function GovernanceInsightsReportButton({ href, snapshotDate }: { href: string; snapshotDate: string }) {
  return <InsightsReportButton href={href} filename={`cyber-terrain-insights-${snapshotDate}.pdf`} title="Cyber Terrain Posture" />;
}
