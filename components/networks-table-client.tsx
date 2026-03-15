"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PostureBadge } from "@/components/posture-badge";
import { ComplianceStatus } from "@/lib/types";
import { DATA_DATE_PARAM, normalizeDataDate, withDataDate } from "@/lib/data-date";

const PANEL_TWEEN_MS = 260;

export interface NetworkTableRow {
  id: string;
  name: string;
  classification: string;
  assetCount: number;
  posture: ComplianceStatus;
  openFindings: number;
  p12Findings: number;
  p12HighRiskFindings: number;
  p12CriticalExposureFindings: number;
  complianceScore: number;
  discoveryComplianceScore: number;
  description: string;
  owner: string;
  supportEmail: string;
  serviceCatalogueUrl: string;
  atoNumber: string;
  diisUrl: string;
  grcUrl: string;
}

function isExternalLink(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

export function NetworksTableClient({
  rows,
  scrollable = false
}: {
  rows: NetworkTableRow[];
  scrollable?: boolean;
}) {
  const searchParams = useSearchParams();
  const [selectedRow, setSelectedRow] = useState<NetworkTableRow | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scopedDataDate = normalizeDataDate(searchParams.get(DATA_DATE_PARAM));

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedRow) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPanelOpen(false);
        if (closeTimerRef.current) {
          clearTimeout(closeTimerRef.current);
        }
        closeTimerRef.current = setTimeout(() => {
          setSelectedRow(null);
          closeTimerRef.current = null;
        }, PANEL_TWEEN_MS);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedRow]);

  const openPanel = (row: NetworkTableRow) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    setSelectedRow(row);
    requestAnimationFrame(() => {
      setIsPanelOpen(true);
    });
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(() => {
      setSelectedRow(null);
      closeTimerRef.current = null;
    }, PANEL_TWEEN_MS);
  };

  return (
    <>
      <div className="panel h-full min-h-0 overflow-hidden">
        <div className={scrollable ? "h-full min-h-0 overflow-auto" : ""}>
          <table className="min-w-full text-sm">
            <thead
              className={`bg-slate-900/60 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80 ${
                scrollable ? "sticky top-0 z-[1] bg-slate-900/95" : ""
              }`}
            >
              <tr>
                <th className="px-2.5 py-1.5">Network</th>
                <th className="px-2.5 py-1.5">Classification</th>
                <th className="px-2.5 py-1.5">Assets</th>
                <th className="px-2.5 py-1.5">Posture</th>
                <th className="px-2.5 py-1.5">Open Findings</th>
                <th className="px-2.5 py-1.5">P1-P2 Findings</th>
                <th className="px-2.5 py-1.5">P1-P2 Findings (High Risk)</th>
                <th className="px-2.5 py-1.5">P1-P2 Findings (Critical Exposure)</th>
                <th className="px-2.5 py-1.5">Compliance Score</th>
                <th className="px-2.5 py-1.5">Discovery Compliance Score</th>
                <th className="px-2.5 py-1.5">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-sky-400/10">
                  <td className="px-2.5 py-2 text-slate-100">
                    <button
                      type="button"
                      onClick={() => openPanel(row)}
                      className="text-left text-sky-100 underline decoration-sky-300/40 underline-offset-2 transition hover:text-cyan-100 hover:decoration-cyan-300/80"
                    >
                      {row.name}
                    </button>
                  </td>
                  <td className="px-2.5 py-2 text-slate-300">{row.classification}</td>
                  <td className="px-2.5 py-2 text-slate-300">{row.assetCount}</td>
                  <td className="px-2.5 py-2">
                    <PostureBadge status={row.posture} />
                  </td>
                  <td className="px-2.5 py-2 text-slate-200">{row.openFindings}</td>
                  <td className="px-2.5 py-2 text-slate-200">{row.p12Findings}</td>
                  <td className="px-2.5 py-2 text-slate-200">{row.p12HighRiskFindings}</td>
                  <td className="px-2.5 py-2 text-slate-200">{row.p12CriticalExposureFindings}</td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-slate-100">{row.complianceScore}%</td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-slate-100">{row.discoveryComplianceScore}%</td>
                  <td className="px-2.5 py-2">
                    <Link
                      href={withDataDate(`/networks/${row.id}`, scopedDataDate)}
                      data-filter-loading="true"
                      data-filter-loading-message="Loading network page..."
                      className="text-sky-200 underline"
                    >
                      Drill Down
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRow ? (
        <div className="fixed inset-0 z-[130]">
          <div
            className={`absolute inset-0 bg-slate-950/92 backdrop-blur-[1px] transition-opacity duration-200 ${
              isPanelOpen ? "opacity-100" : "opacity-0"
            }`}
          />

          <aside
            className={`absolute right-0 top-0 h-full w-[min(560px,94vw)] border-l border-sky-300/35 bg-slate-950 p-5 shadow-[-22px_0_42px_rgba(0,0,0,0.55)] transition-all duration-[260ms] ease-out ${
              isPanelOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="network-slideout-title"
          >
            <button
              type="button"
              onClick={closePanel}
              className="absolute right-4 top-4 rounded-md border border-sky-300/35 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100"
            >
              Close
            </button>

            <div className="pt-2">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-300/75">Network Details</p>
              <h3 id="network-slideout-title" className="mt-2 pr-16 text-2xl font-semibold text-slate-100">
                {selectedRow.name}
              </h3>
            </div>

            <dl className="mt-5 space-y-4">
              <div className="panel-alt p-3">
                <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Description</dt>
                <dd className="mt-1 text-sm text-slate-100">{selectedRow.description}</dd>
              </div>
              <div className="panel-alt p-3">
                <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Owner</dt>
                <dd className="mt-1 text-sm text-slate-100">{selectedRow.owner}</dd>
              </div>
              <div className="panel-alt p-3">
                <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Support Mailbox</dt>
                <dd className="mt-1 text-sm text-sky-100">
                  <a className="underline decoration-sky-300/60 underline-offset-2" href={`mailto:${selectedRow.supportEmail}`}>
                    {selectedRow.supportEmail}
                  </a>
                </dd>
              </div>
              <div className="panel-alt p-3">
                <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Service Catalogue Item</dt>
                <dd className="mt-1 text-sm text-sky-100">
                  <Link
                    href={selectedRow.serviceCatalogueUrl}
                    className="underline decoration-sky-300/60 underline-offset-2"
                    target={isExternalLink(selectedRow.serviceCatalogueUrl) ? "_blank" : undefined}
                    rel={isExternalLink(selectedRow.serviceCatalogueUrl) ? "noreferrer" : undefined}
                  >
                    Open Service Catalogue Item
                  </Link>
                </dd>
              </div>
              <div className="security-accreditation-pulse rounded-xl border border-yellow-300/90 bg-sky-400/16 p-3 shadow-[0_0_14px_rgba(253,224,71,0.32)]">
                <dt className="text-[11px] uppercase tracking-[0.14em] text-sky-100/95">Security Accreditation</dt>
                <dd className="mt-2">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-sky-100/85">
                      <tr>
                        <th className="px-2 py-1.5">Authority to Operate (ATO)</th>
                        <th className="px-2 py-1.5">Links</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-sky-300/35 text-slate-100">
                        <td className="px-2 py-2 font-semibold text-sky-50">{selectedRow.atoNumber}</td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-3 text-sky-100">
                            <Link
                              href={selectedRow.diisUrl}
                              className="underline decoration-sky-300/70 underline-offset-2"
                              target={isExternalLink(selectedRow.diisUrl) ? "_blank" : undefined}
                              rel={isExternalLink(selectedRow.diisUrl) ? "noreferrer" : undefined}
                            >
                              View in DIIS
                            </Link>
                            <Link
                              href={selectedRow.grcUrl}
                              className="underline decoration-sky-300/70 underline-offset-2"
                              target={isExternalLink(selectedRow.grcUrl) ? "_blank" : undefined}
                              rel={isExternalLink(selectedRow.grcUrl) ? "noreferrer" : undefined}
                            >
                              View in Cyber GRC Portal
                            </Link>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      ) : null}
    </>
  );
}
