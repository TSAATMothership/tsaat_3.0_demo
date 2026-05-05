export interface OverviewScoreSegment {
  label: string;
  shortLabel: string;
  value: number;
  barClassName: string;
  chipClassName: string;
}

export interface OverviewScoreCard {
  title: string;
  score: number;
  total: number;
  contextLabel: string;
  segments: OverviewScoreSegment[];
}

interface ModellingCoverage {
  modelledPercent: number;
  notModelledPercent: number;
  modelledCount: number;
  notModelledCount: number;
  totalCount: number;
}

function boundedPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
}

function segmentWidth(value: number, total: number): string {
  if (!total || value <= 0) {
    return "0%";
  }
  return `${Math.max((value / total) * 100, 2).toFixed(2)}%`;
}

export function ScoreCard({ card }: { card: OverviewScoreCard }) {
  return (
    <article className="rounded-lg border border-sky-300/25 bg-slate-950/55 p-3 shadow-[inset_0_1px_0_rgba(148,163,184,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-300/75">{card.title}</p>
          <p className="mt-1 text-[11px] text-sky-200/75">{card.contextLabel}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-3xl font-semibold leading-none text-emerald-100">{card.score}%</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-slate-400">{card.total} checks</p>
        </div>
      </div>

      <div
        className="mt-3 flex h-2.5 overflow-hidden rounded-full border border-sky-300/20 bg-slate-800/80"
        aria-label={`${card.title}: ${card.score}%`}
      >
        {card.total ? (
          card.segments.map((segment) =>
            segment.value > 0 ? (
              <div
                key={segment.label}
                className={segment.barClassName}
                style={{ width: segmentWidth(segment.value, card.total) }}
                title={`${segment.label}: ${segment.value}`}
              />
            ) : null
          )
        ) : (
          <div className="h-full w-full bg-slate-600/60" />
        )}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {card.segments.map((segment) => (
          <div
            key={segment.label}
            className={`rounded-md border px-2 py-1 text-[11px] leading-tight ${segment.chipClassName}`}
            title={segment.label}
          >
            <span className="font-semibold">{segment.shortLabel}</span>{" "}
            <span className="tabular-nums">{segment.value}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function ModellingGapTile({
  title,
  entityLabel,
  coverage
}: {
  title: string;
  entityLabel: string;
  coverage: ModellingCoverage;
}) {
  const modelledPercent = boundedPercent(coverage.modelledPercent);
  const notModelledPercent = boundedPercent(coverage.notModelledPercent);

  return (
    <article className="rounded-lg border border-sky-300/25 bg-slate-950/55 p-3 shadow-[inset_0_1px_0_rgba(148,163,184,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-300/75">{title}</p>
          <p className="mt-1 text-[11px] text-sky-200/75">Current modelling scope</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-3xl font-semibold leading-none text-amber-100">{notModelledPercent}%</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-slate-400">
            {coverage.totalCount} {entityLabel}
          </p>
        </div>
      </div>

      <div
        className="mt-3 flex h-2.5 overflow-hidden rounded-full border border-sky-300/20 bg-slate-800/80"
        aria-label={`${title}: ${notModelledPercent}%`}
        title={`${coverage.modelledCount} modelled, ${coverage.notModelledCount} not modelled`}
      >
        {coverage.totalCount ? (
          <>
            <div className="h-full bg-emerald-400/90" style={{ width: segmentWidth(coverage.modelledCount, coverage.totalCount) }} />
            <div
              className="h-full bg-amber-300/95"
              style={{ width: segmentWidth(coverage.notModelledCount, coverage.totalCount) }}
            />
          </>
        ) : (
          <div className="h-full w-full bg-slate-600/60" />
        )}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <div
          className="rounded-md border border-emerald-300/25 bg-emerald-500/10 px-2 py-1 text-[11px] leading-tight text-emerald-100"
          title="Modelled"
        >
          <span className="font-semibold">M</span> <span className="tabular-nums">{coverage.modelledCount}</span>
        </div>
        <div
          className="rounded-md border border-amber-300/25 bg-amber-500/10 px-2 py-1 text-[11px] leading-tight text-amber-100"
          title="Not modelled"
        >
          <span className="font-semibold">NM</span> <span className="tabular-nums">{coverage.notModelledCount}</span>
        </div>
      </div>
      <p className="sr-only">
        {coverage.notModelledCount} of {coverage.totalCount} {entityLabel} are not modelled.
      </p>
    </article>
  );
}

export function OverviewComplianceScoreStrip({
  snapshotDate,
  scoreCards,
  modellingGapLabel,
  modellingEntityLabel,
  modellingCoverage
}: {
  snapshotDate: string;
  scoreCards: [OverviewScoreCard, OverviewScoreCard];
  modellingGapLabel: string;
  modellingEntityLabel: string;
  modellingCoverage: ModellingCoverage;
}) {
  return (
    <section className="panel relative overflow-hidden p-2.5">
      <div className="grid items-center gap-2 xl:grid-cols-[minmax(16rem,0.62fr)_minmax(0,2.4fr)]">
        <div className="min-w-0">
          <h2 className="text-sm uppercase tracking-[0.14em] text-slate-100">Compliance Scores</h2>
          <p className="mt-0.5 text-xs text-slate-300/80">Snapshot baseline at {snapshotDate}.</p>
        </div>

        <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(13rem,0.72fr)]">
          {scoreCards.map((card) => (
            <ScoreCard key={card.title} card={card} />
          ))}
          <ModellingGapTile title={modellingGapLabel} entityLabel={modellingEntityLabel} coverage={modellingCoverage} />
        </div>
      </div>
    </section>
  );
}
