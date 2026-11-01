import Link from "next/link";
import { measuresFindingsHref } from "@/lib/measures-explorer";
import type { MeasuresSummaryModel } from "@/lib/measures-summary";
import type { Filters } from "@/lib/types";

export const severityBarColors: Record<string, string> = {
  "Critical Exposure": "#ef4444",
  "High Risk": "#f97316",
  Major: "#facc15",
  Moderate: "#3b82f6",
  "Data Gap": "#a855f7"
};
const number = (value: number) => value.toLocaleString("en-AU");
function Arrow() { return <span aria-hidden="true">↗</span>; }
export function FindingsDurationPanel({ model, filters, snapshotDate }: { model: Pick<MeasuresSummaryModel, "openFindings" | "findingsByDuration" | "severities">; filters: Filters; snapshotDate: string }) {
  const maximum = Math.max(1, ...model.findingsByDuration.map(bucket => bucket.total));
  return <section className="discovery-overview-panel" aria-labelledby="summary-duration-title">
    <header><h2 id="summary-duration-title">Findings by Duration</h2><Link prefetch={false} href={measuresFindingsHref(filters, snapshotDate)}>Findings <Arrow /></Link></header>
    <p className="discovery-overview-note">Open findings by days since their timestamp, as of {snapshotDate}.</p>
    <ul className="measures-duration-legend" aria-label="Severity legend">{model.severities.map(severity => <li key={severity.key}>
      <span aria-hidden="true" style={{ backgroundColor: severityBarColors[severity.key] ?? "#94a3b8" }} />{severity.label}
    </li>)}</ul>
    <div className="measures-duration-chart" role="group" aria-label="Open findings by duration and severity">
      {model.findingsByDuration.map(bucket => {
        const range = { durationMin: bucket.min, durationMax: bucket.max };
        return <div className="measures-duration-row" key={bucket.label}>
          {bucket.total && !bucket.unknownDate ? <Link prefetch={false} href={measuresFindingsHref(filters, snapshotDate, range)} aria-label={`${bucket.label}: ${number(bucket.total)} open findings`}>{bucket.label}</Link> : <span>{bucket.label}</span>}
          <div className="measures-duration-track"><div className="measures-duration-stack" style={{ width: `${bucket.total / maximum * 100}%` }}>
            {model.severities.filter(severity => bucket.severities[severity.key] > 0).map(severity => {
              const count = bucket.severities[severity.key];
              const label = `${severity.label}, ${bucket.label}: ${number(count)} open findings`;
              const style = { width: `${count / bucket.total * 100}%`, backgroundColor: severityBarColors[severity.key] ?? "#94a3b8" };
              return bucket.unknownDate ? <span key={severity.key} className="measures-duration-segment" role="img" aria-label={label} title={label} style={style}>{number(count)}</span>
                : <Link prefetch={false} key={severity.key} className="measures-duration-segment" href={measuresFindingsHref(filters, snapshotDate, { ...range, severity: severity.key })} aria-label={label} title={label} style={style}>{number(count)}</Link>;
            })}
          </div></div>
          <strong>{number(bucket.total)}</strong>
        </div>;
      })}
    </div>
    <p className="discovery-overview-note">{model.openFindings ? "Select a bar segment to review matching findings. Bar lengths show finding counts." : "No open findings in this scope."}</p>
  </section>;
}

