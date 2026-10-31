import { ASSET_TYPE_LABELS } from "@/lib/asset-taxonomy";
import type { DiscoveryCoverageCiTypeTotal } from "@/lib/scoped-discovery-tool-coverage";

const number = (value: number) => value.toLocaleString("en-AU");

export function DiscoveryCoverageCiTotals({ totals }: { totals: DiscoveryCoverageCiTypeTotal[] }) {
  const used = totals.reduce((sum, item) => sum + item.usedInCalculations, 0);
  const inScope = totals.reduce((sum, item) => sum + item.inScope, 0);
  return <section className="coverage-ci-totals" aria-labelledby="coverage-ci-totals-title">
    <div className="coverage-ci-totals-heading">
      <h2 id="coverage-ci-totals-title">CIs used in calculations by type</h2>
      <p><strong>{number(used)}</strong> used / {number(inScope)} in scope</p>
    </div>
    <dl className="coverage-ci-type-grid">
      {totals.map((item) => <div key={item.type}>
        <dt>{ASSET_TYPE_LABELS[item.type]}</dt>
        <dd><strong>{number(item.usedInCalculations)}</strong><span>of {number(item.inScope)} in scope</span></dd>
      </div>)}
    </dl>
    <p className="coverage-ci-totals-note">Page filters apply. CIs mapped to at least one tool are counted once here; each tool&apos;s applicable total follows its own CI-type mappings.</p>
  </section>;
}
