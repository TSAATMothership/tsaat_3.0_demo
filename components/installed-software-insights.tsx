"use client";

import { SoftwareInsightsBriefing } from "@/components/software-insights-briefing";
import type { InstalledSoftwareInsightsModel } from "@/lib/installed-software-insights";
import type { WorkspaceSearchParams } from "@/lib/workspace-navigation";

const number = (value: number) => value.toLocaleString("en-AU");

export function InstalledSoftwareInsights({ model, scope }: { model: InstalledSoftwareInsightsModel; scope: WorkspaceSearchParams }) {
  return <article className="software-insights is-story" data-software-snapshot={model.snapshotDate} data-software-total={model.total}>
    {model.total ? <SoftwareInsightsBriefing model={model} scope={scope} /> : <SoftwareEmptyState />}
    <SoftwareMethodology unnamed={model.unnamed} />
  </article>;
}

function SoftwareEmptyState() {
  return <section className="software-card software-empty"><p className="software-kicker">No inventory records</p><h2>No installed software in this selection</h2><p>Choose another network, ICT system, security domain or snapshot. An empty inventory does not confirm that no software is installed.</p></section>;
}

function SoftwareMethodology({ unnamed }: { unnamed: number }) {
  return <footer className="software-insights-footer"><details><summary>How to read these insights</summary><p>This page uses the same scoped software records and resolved snapshot as Installed Software Explorer. Counts describe recorded installations, not licences, all endpoints, vulnerability exposure or support compliance. Named products exclude missing names ({number(unnamed)} installations); version variation excludes missing names and versions. Names are not merged across spelling or case differences.</p><p>A version entry alone does not establish support status, currency or absence of vulnerabilities. Discovery age is measured against the snapshot, not today. Missing or invalid dates and dates after the snapshot remain separate. Charts show counts and links to matching records. Empty selections show no evidence rather than an assurance score.</p></details></footer>;
}
