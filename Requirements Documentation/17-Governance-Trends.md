# Governance Trends

## Purpose and experience

Bundled SQL and JSON samples provide eight weekly observations from 2026-09-19 to 2026-11-07, covering both one-week and one-month trend windows. Future data changes must preserve at least four complete weeks, complete applicable evidence and cross-provider temporal/scope parity; see [sample evidence](../docs/sample-evidence.md).

`/governance/trends` is an executive infographic for managers reviewing compliance, lifecycle and discovery over time. It replaces the Trends placeholder, retains its existing sidebar/persona identity and follows the Cyber Terrain Insights visual language. Governance Overview is retired; old bookmarks redirect to Trends.

The briefing contains a scope/date masthead, **1 week / 1 month** history selector (1 month by default), three headline rates and direction indicators, anchored topic sections, current evidence counts, lifecycle server priorities, discovery tool coverage, management actions and expandable methodology/snapshot evidence. CSV includes all snapshot metrics, the selected period/start/cutoff and applied scope; filenames identify the period and cutoff date. No new PDF/report is introduced.

Charts space observations by actual date across the full selected period, connect only non-null adjacent observations and expose values through native keyboard-accessible snapshot selectors. Changing history updates the axis boundaries, plotted observations, comparisons, evidence table and downloads together. A single observation remains at its actual date instead of being centred. The masthead shows the requested period, actual snapshot count, latest evidence date and recorded snapshot markers. Counts and text supplement colour. No interpolation, forecast, benchmark or composite score is implied. Cards stack on narrow screens; the workspace owns vertical scrolling. Native details and FindingsDataTable provide the evidence alternative.

## Scope, history and interpretation

- Read through shared `loadSnapshotsForDateWindow(cutoff, 1, { profile: "full" })` and `loadDiscoveryToolsSettings`. Full snapshots are required because SQL summary payloads omit installed software. Both SQL and JSON use the same projection. The existing provider reader anchors its month to the resolved snapshot; the projection separately enforces the requested period, preventing stale or earliest-fallback data from appearing outside it.
- `trendHistory=week` means the seven-day interval before the header date; `trendHistory=month` means one calendar month before it, clamped to the last valid day when needed (31 March → 28/29 February). Both endpoint dates are included, allowing weekly snapshots at both boundaries to establish a comparison. Arithmetic uses UTC date keys. Default or invalid history values use month; legacy `trendSnapshots` counts are ignored and removed when changing history.
- Keep only observations within the selected start/cutoff, in date order, with one observation per date (greatest snapshot ID when duplicated). There is no snapshot-count cap. A period without observations has an explicit empty state; do not shift it to older data or use future snapshots. Scope and the requested header date remain unchanged when switching history.
- Apply network/system and security-domain scope to each snapshot independently; ignore local explorer filters. Report the first/latest observed dates, requested cutoff and actual point count. Zero matched inventory is distinct from no history or read failure.
- Changes compare the first and latest observations in the selected window. Rates use percentage-point differences. Higher compliance and discovery coverage are favourable; lower lifecycle issue rate is favourable. One snapshot or a null endpoint gives no comparison. Unchanged rates are explicitly neutral.
- Report CIs entering/leaving scope by asset ID, even when total inventory is unchanged. Snapshot membership, inventory and configuration changes can influence the trend; changes do not establish causation or remediation completion.
- Historical evidence is evaluated using the providers' current configured SPI rules and discovery mappings. This is not an immutable audit of past policy settings.
- Evidence navigation preserves applied scope/domain and the latest observed snapshot, and uses PersonaLink to disable inaccessible destination pages. The history selector retains the header's requested date. Direct routes/APIs retain the current login-free access model.

## Indicators

| Indicator | Numerator / denominator | Supporting evidence |
| --- | --- | --- |
| Compliance | Compliant recorded SPI checks / all scoped recorded SPI checks | Compliant, non-compliant and unknown counts; identified CIs without recorded checks |
| Life cycle | Servers with at least one confirmed lifecycle area affected / scoped servers | Out-of-warranty hardware devices; unsupported software installations; OS N−2+ devices; servers with multiple affected areas; evidence gaps |
| Discovery | Covered required tool/CI checks / all required tool/CI checks | Missing checks by tool; CIs missing any required tool; unidentified IP nodes; CIs with no required tool mapping |

Unknown SPI results stay in the denominator. Empty denominators display N/A. No checks are invented for unevaluated CIs. Lifecycle reuses `buildLifeCycleManagement`: recorded warranty/support statuses and recorded nonnegative integer OS distance, including exactly N−2 and older or unsupported OS. Multiple issue areas count a server once in the rate; installation multiplicity remains meaningful. Missing inventory/status does not become a confirmed failure or a claim of support. The taxonomy has no physical/virtual marker, so none is inferred. Up to three current server priorities reuse existing lifecycle ranking. Category counts overlap and must not be added together.

Discovery reuses `buildScopedDiscoveryToolCoverage`; only configured required tool/CI pairs enter the denominator. CIs with no required mappings contribute no checks and are reported separately. Unidentified IP nodes retain existing applicability semantics. Compliance and discovery use different check populations, not an average of asset percentages.

## Implementation and compatibility

The route has a no-scope early return, shared route-ready marker and sanitized failure/retry state. `lib/governance-trends-data.ts` loads bounded history; `lib/governance-trends.ts` projects serializable metrics and small priority summaries. Raw historical inventories stay on the server. `components/governance-trends.tsx` renders SVG charts and downloads formula-escaped CSV. No new package, remote asset, API, schema, persistence, provider operation or configuration field is introduced. No SQL migration or JSON upgrade is needed. Calculation-contract hashes remain unchanged.

## Impact and validation selection

UI, scoped historical aggregation and documentation are affected: select lint/types, focused projection/loader/page/render and existing scope/provider regression tests, storage contract checks, both guarded builds and compiled No-SQL browser smoke. Cover inclusive week/month boundaries, month ends/leap years, stale/future exclusions, dense history beyond the former 24-point cap and recalculated baselines. Browser acceptance covers actual week/month chart point/date changes, persistence on reload, return to month, matching exports for both periods, historical/single/empty scope, scoped links, persona disabling, keyboard controls and desktop/narrow layouts. The compiled smoke covers the live Trends page and retired Overview redirect.

SQL/JSON provider implementations and `NoSQL/calculation-contract.json` are reviewed because full history and derived counts are consumed. No new SQL query, persistence/rule implementation or provider divergence is introduced; live SQL migration/parity is not applicable to this shared projection. Schema/settings/mapping upgrades are not required. Generated route/API/navigation inventories do not change, so only docs:check is required. Dependencies, build tooling, authentication, reports/PDFs and release packaging are unchanged; no fresh install, report gate or comprehensive release gate is selected for this feature. Existing provider/query/rule contracts remain authoritative.
