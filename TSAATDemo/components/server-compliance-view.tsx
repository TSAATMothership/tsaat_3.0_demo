"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ScoreCard as OverviewScoreCardTile, type OverviewScoreCard } from "@/components/overview-compliance-score-strip";
import type { ServerComplianceModel } from "@/lib/server-compliance";

type ComplianceTab = "overview" | "discovery";
type WorkflowFilter = "all" | "open" | "closed";
type ServerComplianceMeasure = ServerComplianceModel["complianceOverview"]["measures"][number];
type ServerComplianceFinding = ServerComplianceMeasure["findings"][number];

const findingSeverityOptions = ["Critical Exposure", "High Risk", "Major", "Moderate", "Data Gap"];

function percentage(part: number, whole: number): number {
  if (!whole) {
    return 0;
  }
  return Number(((part / whole) * 100).toFixed(1));
}

function complianceStatusClass(status: string): string {
  if (status === "Compliant" || status === "Covered") {
    return "border-emerald-300/35 bg-emerald-500/15 text-emerald-100";
  }
  if (status === "Non-compliant" || status === "Missing") {
    return "border-rose-300/35 bg-rose-500/15 text-rose-100";
  }
  return "border-slate-300/25 bg-slate-500/15 text-slate-200";
}

function findingSeverityClass(severity: string): string {
  if (severity === "Critical Exposure") {
    return "border-red-400/35 bg-red-500/10 text-red-100";
  }
  if (severity === "High Risk") {
    return "border-orange-400/35 bg-orange-500/10 text-orange-100";
  }
  if (severity === "Major") {
    return "border-amber-400/35 bg-amber-500/10 text-amber-100";
  }
  return "border-sky-300/25 bg-sky-500/10 text-sky-100";
}

function workflowStatusClass(status: "open" | "closed"): string {
  return status === "open"
    ? "border-amber-400/45 bg-amber-500/15 text-amber-100"
    : "border-emerald-400/35 bg-emerald-500/10 text-emerald-100";
}

function displayValue(value: string | null | undefined): string {
  return value?.trim() || "Not available";
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "Not available";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return `${parsed.toLocaleString("en-AU", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC"
  })} UTC`;
}

function findingEvidencePreview(finding: ServerComplianceFinding): string {
  if (!finding.evidence.length) {
    return "No evidence recorded.";
  }
  return finding.evidence.map((item) => `${item.key}: ${item.value}`).join(" | ");
}

function scoreCardsForModel(model: ServerComplianceModel): [OverviewScoreCard, OverviewScoreCard] {
  const overview = model.complianceOverview;
  const discovery = model.discoveryCompliance;
  return [
    {
      title: "Compliance Score",
      score: overview.score,
      total: overview.total,
      contextLabel: `Selected server scope | ${overview.openFindingCount} open findings`,
      segments: [
        {
          label: "Compliant",
          shortLabel: "C",
          value: overview.compliant,
          barClassName: "h-full bg-emerald-400/90",
          chipClassName: "border-emerald-300/25 bg-emerald-500/10 text-emerald-100"
        },
        {
          label: "Non-compliant",
          shortLabel: "NC",
          value: overview.nonCompliant,
          barClassName: "h-full bg-rose-400/90",
          chipClassName: "border-rose-300/25 bg-rose-500/10 text-rose-100"
        },
        {
          label: "Unknown",
          shortLabel: "U",
          value: overview.unknown,
          barClassName: "h-full bg-slate-400/90",
          chipClassName: "border-slate-400/25 bg-slate-500/10 text-slate-100"
        }
      ]
    },
    {
      title: "Discovery Compliance Score",
      score: discovery.score,
      total: discovery.total,
      contextLabel: discovery.coverageCompliance ? "Current discovery scope | Compliant" : "Current discovery scope | Non-compliant",
      segments: [
        {
          label: "Covered",
          shortLabel: "C",
          value: discovery.covered,
          barClassName: "h-full bg-emerald-400/90",
          chipClassName: "border-emerald-300/25 bg-emerald-500/10 text-emerald-100"
        },
        {
          label: "Missing",
          shortLabel: "M",
          value: discovery.missing,
          barClassName: "h-full bg-rose-400/90",
          chipClassName: "border-rose-300/25 bg-rose-500/10 text-rose-100"
        },
        {
          label: "Not available",
          shortLabel: "N/A",
          value: discovery.notAvailable,
          barClassName: "h-full bg-slate-400/90",
          chipClassName: "border-slate-400/25 bg-slate-500/10 text-slate-100"
        }
      ]
    }
  ];
}

export function ServerComplianceView({
  assetId,
  assetName,
  dataDate,
  dataPath = "/api/cyber-cop/impact-analyser-2/compliance",
  onClose
}: {
  assetId: string;
  assetName: string;
  dataDate?: string;
  dataPath?: string;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<ComplianceTab>("overview");
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [model, setModel] = useState<ServerComplianceModel | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [selectedMeasure, setSelectedMeasure] = useState<ServerComplianceMeasure | null>(null);
  const [workflowFilter, setWorkflowFilter] = useState<WorkflowFilter>("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [findingSearch, setFindingSearch] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const selectedMeasureRef = useRef<ServerComplianceMeasure | null>(null);

  const requestUrl = useMemo(() => {
    const params = new URLSearchParams({ assetId });
    if (dataDate) {
      params.set("dataDate", dataDate);
    }
    return `${dataPath}?${params.toString()}`;
  }, [assetId, dataDate, dataPath]);

  const sortedMeasures = useMemo(
    () =>
      [...(model?.complianceOverview.measures ?? [])].sort(
        (left, right) => right.score - left.score || left.spiId - right.spiId
      ),
    [model?.complianceOverview.measures]
  );

  const selectedMeasureFindings = useMemo(() => selectedMeasure?.findings ?? [], [selectedMeasure]);
  const filteredFindings = useMemo(() => {
    const normalizedSearch = findingSearch.trim().toLowerCase();
    return selectedMeasureFindings.filter((finding) => {
      if (workflowFilter !== "all" && finding.status !== workflowFilter) {
        return false;
      }
      if (severityFilter !== "all" && finding.severity !== severityFilter) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      return [
        finding.id,
        finding.title,
        finding.severity,
        finding.status,
        finding.complianceStatus,
        findingEvidencePreview(finding),
        finding.recommendedAction
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [findingSearch, selectedMeasureFindings, severityFilter, workflowFilter]);

  useEffect(() => {
    selectedMeasureRef.current = selectedMeasure;
  }, [selectedMeasure]);

  useEffect(() => {
    const abortController = new AbortController();
    setLoadState("loading");
    setErrorMessage("");
    fetch(requestUrl, { cache: "no-store", signal: abortController.signal })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || `Request failed with ${response.status}`);
        }
        return response.json() as Promise<ServerComplianceModel>;
      })
      .then((payload) => {
        setModel(payload);
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted) {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : "Unable to load server compliance.");
        setLoadState("error");
      });
    return () => abortController.abort();
  }, [requestUrl, retryKey]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (selectedMeasureRef.current) {
        setSelectedMeasure(null);
        return;
      }
      onClose();
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose]);

  const openMeasureDetail = (measure: ServerComplianceMeasure) => {
    setSelectedMeasure(measure);
    setWorkflowFilter(measure.findings.some((finding) => finding.status === "open") ? "open" : "all");
    setSeverityFilter("all");
    setFindingSearch("");
  };

  const selectTab = (tab: ComplianceTab) => {
    setActiveTab(tab);
    setSelectedMeasure(null);
  };

  if (typeof document === "undefined") {
    return null;
  }

  const titleId = `server-compliance-title-${assetId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const overview = model?.complianceOverview;
  const discovery = model?.discoveryCompliance;
  const scoreCards = model ? scoreCardsForModel(model) : null;

  return createPortal(
    <div
      data-server-compliance-view="true"
      data-asset-id={assetId}
      data-load-state={loadState}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/78 p-4 backdrop-blur-[2px]"
    >
      <section
        data-server-compliance-dialog="fixed"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-[calc(100vh-2rem)] max-h-[56rem] w-[calc(100vw-2rem)] max-w-[90rem] flex-col overflow-hidden rounded-xl border border-cyan-300/35 bg-slate-950 shadow-[0_24px_80px_rgba(0,0,0,0.75)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-sky-300/15 bg-slate-900/90 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/70">Server Compliance View</p>
            <h2 id={titleId} className="mt-1 truncate text-lg font-semibold text-slate-50">
              {model?.asset.name || assetName}
            </h2>
            <p className="mt-1 truncate text-xs text-slate-300/75">
              {model
                ? `${displayValue(model.asset.hostname)} | ${displayValue(model.asset.ipAddress)} | ${displayValue(model.asset.environmentType)} | Snapshot ${model.snapshotDate}`
                : "Loading compliance and discovery evidence..."}
            </p>
            {model ? (
              <p className="mt-0.5 truncate text-[11px] text-slate-400">
                ICT System: {displayValue(model.asset.systemName)} | Network: {displayValue(model.asset.networkName)} | Security Domain: {displayValue(model.asset.securityDomain)}
              </p>
            ) : null}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close Server Compliance"
            onClick={onClose}
            className="shrink-0 rounded-md border border-rose-300/45 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-rose-100 hover:border-rose-200/70 hover:bg-rose-500/25"
          >
            Close
          </button>
        </header>

        <div className="flex shrink-0 gap-1 border-b border-sky-300/15 bg-slate-950 px-4 pt-2" role="tablist" aria-label="Server compliance sections">
          {([
            ["overview", "Compliance Overview"],
            ["discovery", "Discovery Compliance"]
          ] as const).map(([tabId, label]) => (
            <button
              key={tabId}
              type="button"
              role="tab"
              aria-selected={activeTab === tabId}
              onClick={() => selectTab(tabId)}
              className={`rounded-t-md border border-b-0 px-3 py-2 text-xs font-semibold ${
                activeTab === tabId
                  ? "border-cyan-300/40 bg-cyan-500/15 text-cyan-100"
                  : "border-sky-300/15 bg-slate-900/55 text-slate-300 hover:text-slate-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-hidden p-3">
          {loadState === "loading" ? (
            <div className="flex h-full items-center justify-center rounded-lg border border-sky-300/15 bg-slate-900/45 text-sm text-slate-300">
              Loading Compliance View...
            </div>
          ) : loadState === "error" ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-rose-300/25 bg-rose-950/35 p-6 text-center">
              <p className="text-sm text-rose-100">{errorMessage}</p>
              <button
                type="button"
                onClick={() => setRetryKey((current) => current + 1)}
                className="rounded-md border border-cyan-300/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/25"
              >
                Retry
              </button>
            </div>
          ) : model && overview && discovery && scoreCards ? (
            <div className="flex h-full min-h-0 flex-col">
              <div data-server-compliance-score-tiles="true" className="grid shrink-0 gap-2 lg:grid-cols-2">
                {scoreCards.map((card) => <OverviewScoreCardTile key={card.title} card={card} />)}
              </div>

              <div className="relative mt-3 min-h-0 flex-1 overflow-hidden">
                {activeTab === "overview" ? (
                  <div data-server-compliance-section="overview" className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-sky-300/15 bg-slate-900/45">
                    <div className="shrink-0 border-b border-sky-300/15 px-4 py-3">
                      <h3 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Security Posture Indicator breakdown</h3>
                      <p className="mt-1 text-xs text-slate-300/75">
                        SPI-level contribution to the score with status mix, impacted assets and non-compliance reasons.
                      </p>
                    </div>
                    <div data-server-compliance-spi-breakdown="true" className="min-h-0 flex-1 overflow-auto">
                      <table className="min-w-full text-sm">
                        <thead className="sticky top-0 z-[1] bg-slate-900/95 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
                          <tr>
                            <th className="px-3 py-2">Security Posture Indicator</th>
                            <th className="px-3 py-2">Score</th>
                            <th className="px-3 py-2">Status Mix</th>
                            <th className="px-3 py-2">Impacted Assets</th>
                            <th className="px-3 py-2">Top Non-Compliance Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedMeasures.map((measure) => {
                            const compliantPercent = percentage(measure.compliant, measure.total);
                            const nonCompliantPercent = percentage(measure.nonCompliant, measure.total);
                            const unknownPercent = percentage(measure.unknown, measure.total);
                            return (
                              <tr key={measure.spiId} className="border-t border-sky-400/10">
                                <td className="px-3 py-2 text-slate-100">
                                  <button
                                    type="button"
                                    data-server-compliance-measure-action={measure.spiId}
                                    onClick={() => openMeasureDetail(measure)}
                                    className="text-left text-sky-100 underline decoration-sky-300/45 underline-offset-2 transition hover:text-cyan-100 hover:decoration-cyan-300/80"
                                  >
                                    {measure.label}
                                  </button>
                                </td>
                                <td className="px-3 py-2 text-slate-100">{measure.score}%</td>
                                <td className="px-3 py-2">
                                  <div className="w-[220px] max-w-full">
                                    <div className="overflow-hidden rounded-full border border-sky-300/20 bg-slate-950/60">
                                      <div className="flex h-2.5 w-full">
                                        <div className="bg-emerald-400/80" style={{ width: `${compliantPercent}%` }} />
                                        <div className="bg-red-400/80" style={{ width: `${nonCompliantPercent}%` }} />
                                        <div className="bg-slate-400/70" style={{ width: `${unknownPercent}%` }} />
                                      </div>
                                    </div>
                                    <p className="mt-1 text-[11px] text-slate-300/75">
                                      C {measure.compliant} | NC {measure.nonCompliant} | U {measure.unknown}
                                    </p>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-slate-200">{measure.impactedAssets}</td>
                                <td className="px-3 py-2 text-xs text-slate-300/85">{measure.topReasons[0] ?? "-"}</td>
                              </tr>
                            );
                          })}
                          {!sortedMeasures.length ? (
                            <tr>
                              <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-300/80">No SPI data is available for this server.</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div data-server-compliance-section="discovery" className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
                    <section className="shrink-0 rounded-lg border border-sky-300/15 bg-slate-900/45 p-3">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <h3 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Discovery Tool Coverage</h3>
                          <p className="mt-1 text-xs text-slate-300/75">Required discovery sources for the selected server.</p>
                        </div>
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${complianceStatusClass(discovery.coverageCompliance ? "Compliant" : "Non-compliant")}`}>
                          {discovery.coverageCompliance ? "Coverage compliant" : "Coverage non-compliant"}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-2">
                        {discovery.tools.map((tool) => {
                          const coveragePercent = tool.status === "Covered" ? 100 : 0;
                          return (
                            <article key={`server-discovery-card-${tool.id}`} className="rounded-lg border border-sky-300/20 bg-slate-950/50 p-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-200" title={tool.name}>{tool.name}</p>
                                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${complianceStatusClass(tool.status)}`}>{tool.status}</span>
                              </div>
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800/90">
                                <div className={`h-full ${tool.status === "Covered" ? "bg-emerald-400" : tool.status === "Missing" ? "bg-red-400" : "bg-slate-500"}`} style={{ width: tool.status === "Not available" ? "100%" : `${coveragePercent}%` }} />
                              </div>
                              <p className="mt-2 text-[11px] text-slate-300/75">
                                {tool.status === "Not available" ? "No source value available" : `${coveragePercent}% covered for this server`}
                              </p>
                            </article>
                          );
                        })}
                      </div>
                    </section>

                    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-sky-300/15 bg-slate-900/45">
                      <div className="shrink-0 border-b border-sky-300/15 px-4 py-2.5">
                        <h3 className="text-sm font-semibold text-slate-100">Discovery source details</h3>
                        <p className="text-[11px] text-slate-300/70">Coverage status, value and operational ownership.</p>
                      </div>
                      {discovery.tools.length ? (
                        <div className="min-h-0 flex-1 overflow-auto">
                          <table className="min-w-full text-left text-xs">
                            <thead className="sticky top-0 z-[1] bg-slate-950/95 text-[10px] uppercase tracking-[0.12em] text-slate-300/70">
                              <tr>
                                <th className="px-3 py-2">Discovery Tool</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2">Value</th>
                                <th className="px-3 py-2">EL2 Owner</th>
                                <th className="px-3 py-2">EL2 Operations Manager</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-sky-300/10">
                              {discovery.tools.map((tool) => (
                                <tr key={tool.id} className="align-top text-slate-200">
                                  <td className="px-3 py-2">
                                    <p className="font-medium text-slate-100">{tool.name}</p>
                                    <p className="mt-0.5 max-w-lg text-[11px] text-slate-400">{tool.description || "No description recorded."}</p>
                                  </td>
                                  <td className="px-3 py-2"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${complianceStatusClass(tool.status)}`}>{tool.status}</span></td>
                                  <td className="px-3 py-2 text-slate-300/85">{tool.value === null ? "N/A" : tool.value}</td>
                                  <td className="px-3 py-2 text-slate-300/85">{displayValue(tool.el2Owner)}</td>
                                  <td className="px-3 py-2 text-slate-300/85">{displayValue(tool.el2OperationsManager)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : <p className="px-3 py-8 text-center text-sm text-slate-400">No discovery tools apply to this server.</p>}
                    </section>
                  </div>
                )}

                {selectedMeasure ? (
                  <section
                    data-server-compliance-measure-detail="true"
                    role="dialog"
                    aria-modal="true"
                    aria-label="SPI Findings and Evidence"
                    className="absolute inset-0 z-20 flex min-h-0 flex-col overflow-hidden rounded-lg border border-cyan-300/35 bg-slate-950 shadow-[0_18px_48px_rgba(0,0,0,0.7)]"
                  >
                    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-sky-300/15 bg-slate-900/90 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-300/75">Compliance Detail</p>
                        <h4 className="mt-1 text-lg font-semibold text-slate-100">Findings and Evidence</h4>
                        <p className="mt-1 truncate text-xs text-slate-300/80">Selected SPI: {selectedMeasure.label}</p>
                      </div>
                      <button
                        type="button"
                        aria-label="Close Security Posture Indicator Detail"
                        onClick={() => setSelectedMeasure(null)}
                        className="shrink-0 rounded-md border border-sky-300/35 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-200 hover:border-sky-200/60 hover:text-sky-100"
                      >
                        Close
                      </button>
                    </div>

                    <div className="grid shrink-0 gap-2 border-b border-sky-300/10 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_11rem_11rem]">
                      <div className="rounded-lg border border-sky-300/15 bg-slate-900/55 p-2.5">
                        <p className="text-[10px] uppercase tracking-[0.12em] text-slate-300/70">Evaluation Evidence</p>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-200">
                          {selectedMeasure.evidence.length
                            ? selectedMeasure.evidence.map((item) => `${item.key}: ${item.value}`).join(" | ")
                            : "No evaluation evidence recorded."}
                        </p>
                      </div>
                      <div className="rounded-lg border border-sky-300/15 bg-slate-900/55 p-2.5">
                        <p className="text-[10px] uppercase tracking-[0.12em] text-slate-300/70">Non-Compliance Reasons</p>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-200">{selectedMeasure.topReasons.join(" | ") || "No non-compliance reasons recorded."}</p>
                      </div>
                      <div>
                        <label htmlFor="server-spi-workflow-filter" className="text-[10px] uppercase tracking-[0.12em] text-slate-300/70">Workflow Status</label>
                        <select id="server-spi-workflow-filter" value={workflowFilter} onChange={(event) => setWorkflowFilter(event.target.value as WorkflowFilter)} className="mt-1 w-full rounded-md border border-sky-400/20 bg-slate-950/60 px-2 py-2 text-xs text-slate-100">
                          <option value="all">All</option><option value="open">Open</option><option value="closed">Closed</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="server-spi-severity-filter" className="text-[10px] uppercase tracking-[0.12em] text-slate-300/70">Findings Severity</label>
                        <select id="server-spi-severity-filter" value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)} className="mt-1 w-full rounded-md border border-sky-400/20 bg-slate-950/60 px-2 py-2 text-xs text-slate-100">
                          <option value="all">All</option>
                          {findingSeverityOptions.map((severity) => <option key={severity} value={severity}>{severity}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="shrink-0 px-3 pb-3">
                      <label htmlFor="server-spi-findings-search" className="text-[10px] uppercase tracking-[0.12em] text-slate-300/70">Text Search</label>
                      <input id="server-spi-findings-search" type="search" value={findingSearch} onChange={(event) => setFindingSearch(event.target.value)} placeholder="Search title, severity, evidence or recommended action..." className="mt-1 w-full rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-400/70" />
                    </div>

                    <div className="min-h-0 flex-1 overflow-auto border-t border-sky-300/10">
                      <table className="min-w-full text-sm">
                        <thead className="sticky top-0 z-[1] bg-slate-900/95 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
                          <tr><th className="px-3 py-2">Severity</th><th className="px-3 py-2">Timestamp</th><th className="px-3 py-2">Title</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Evidence</th><th className="px-3 py-2">Recommended Action</th></tr>
                        </thead>
                        <tbody>
                          {filteredFindings.map((finding) => (
                            <tr key={finding.id} className="border-t border-sky-400/10 align-top">
                              <td className="px-3 py-2"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${findingSeverityClass(finding.severity)}`}>{finding.severity}</span></td>
                              <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-300/85">{formatTimestamp(finding.timestamp)}</td>
                              <td className="px-3 py-2 text-slate-100">{finding.title}</td>
                              <td className="px-3 py-2"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${workflowStatusClass(finding.status)}`}>{finding.status}</span></td>
                              <td className="max-w-sm px-3 py-2 text-xs text-slate-300/85">{findingEvidencePreview(finding)}</td>
                              <td className="max-w-sm px-3 py-2 text-xs text-slate-300/85">{finding.recommendedAction || "No recommended action recorded."}</td>
                            </tr>
                          ))}
                          {!filteredFindings.length ? (
                            <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-300/80">{selectedMeasureFindings.length ? "No findings match the active filters." : "No findings were generated for this SPI in the selected server scope."}</td></tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>,
    document.body
  );
}
