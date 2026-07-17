"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";
import { formatAssetTypeLabel } from "@/lib/asset-taxonomy";
import type { CmdbAssetDetails } from "@/lib/cmdb-drill-through";
import { DATA_DATE_PARAM, normalizeDataDate } from "@/lib/data-date";

const PANEL_TWEEN_MS = 220;
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface CmdbRequest {
  assetId: string;
  assetName: string;
  dataDate: string | null;
}

interface CmdbSelection extends CmdbRequest {
  state: "loading" | "ready" | "error";
  details: CmdbAssetDetails | null;
  error: string | null;
}

interface CmdbDrillThroughContextValue {
  openCmdbDrillThrough: (assetId: string, assetName?: string) => void;
}

const CmdbDrillThroughContext = createContext<CmdbDrillThroughContextValue | null>(null);

function currentDataDate(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const logicalHref = window.location.hash.startsWith("#/")
    ? window.location.hash.slice(1)
    : `${window.location.pathname}${window.location.search}`;
  const url = new URL(logicalHref, window.location.origin);
  return normalizeDataDate(url.searchParams.get(DATA_DATE_PARAM)) ?? null;
}

function detailsEndpoint(request: CmdbRequest): string {
  const params = new URLSearchParams({ assetId: request.assetId });
  if (request.dataDate) {
    params.set(DATA_DATE_PARAM, request.dataDate);
  }
  return `/api/assets/cmdb-details?${params.toString()}`;
}

function formatDetailValue(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === "" ? "Not supplied" : String(value);
}

function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function CmdbDrillThroughProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<CmdbSelection | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const cacheRef = useRef(new Map<string, CmdbAssetDetails>());

  const loadDetails = useCallback((request: CmdbRequest) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const cacheKey = `${request.dataDate ?? "latest"}:${request.assetId}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setSelection({ ...request, state: "ready", details: cached, error: null });
      return;
    }

    setSelection({ ...request, state: "loading", details: null, error: null });
    void fetch(detailsEndpoint(request), { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          asset?: CmdbAssetDetails;
          error?: string;
        };
        if (!response.ok || !payload.asset || payload.asset.assetId !== request.assetId) {
          throw new Error(payload.error || "Unable to load CMDB details for this device.");
        }
        cacheRef.current.set(cacheKey, payload.asset);
        setSelection((current) =>
          current?.assetId === request.assetId && current.dataDate === request.dataDate
            ? { ...request, state: "ready", details: payload.asset ?? null, error: null }
            : current
        );
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setSelection((current) =>
          current?.assetId === request.assetId && current.dataDate === request.dataDate
            ? {
                ...request,
                state: "error",
                details: null,
                error: error instanceof Error ? error.message : "Unable to load CMDB details for this device."
              }
            : current
        );
      });
  }, []);

  const openCmdbDrillThrough = useCallback(
    (assetId: string, assetName?: string) => {
      const normalizedAssetId = assetId.trim();
      if (!normalizedAssetId) {
        return;
      }
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const request: CmdbRequest = {
        assetId: normalizedAssetId,
        assetName: assetName?.trim() || normalizedAssetId,
        dataDate: currentDataDate()
      };
      loadDetails(request);
      window.requestAnimationFrame(() => setIsOpen(true));
    },
    [loadDetails]
  );

  const close = useCallback(() => {
    setIsOpen(false);
    abortRef.current?.abort();
    abortRef.current = null;
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setSelection(null);
      closeTimerRef.current = null;
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    }, PANEL_TWEEN_MS);
  }, []);
  const hasSelection = selection !== null;
  const selectedAssetId = selection?.assetId;

  useEffect(() => {
    setIsMounted(true);
    return () => {
      abortRef.current?.abort();
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!hasSelection || !isOpen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const panel = panelRef.current;
    const focusableElements = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).filter(
        (element) => element.getClientRects().length > 0
      );
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        close();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const focusable = focusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        closeButtonRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (panel && event.target instanceof Node && !panel.contains(event.target)) {
        closeButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [close, hasSelection, isOpen, selectedAssetId]);

  const contextValue = useMemo(() => ({ openCmdbDrillThrough }), [openCmdbDrillThrough]);
  const details = selection?.details ?? null;
  const cmdbRecordUrl = safeExternalUrl(details?.cmdbRecordUrl);
  const detailRows: Array<[string, string | number | null | undefined]> = details
    ? [
        ["Asset ID", details.assetId],
        ["Name", details.assetName],
        ["Hostname", details.assetHostname],
        ["Asset Type", formatAssetTypeLabel(details.assetType)],
        ["IP Address", details.assetIpAddress],
        ["Network", details.networkName || details.networkId],
        ["ICT System", details.hasIctSystem ? details.systemName : "Not linked to ICT system"],
        ["Environment", details.environmentType ?? "Unassigned"],
        ["Security Domain", details.securityDomain],
        ["Lifecycle EOL", details.lifecycleEolStatus],
        ["Warranty", details.lifecycleWarrantyStatus],
        ["Operating System", details.operatingSystemSummary],
        ["Network OS", details.networkOsSummary],
        ["Patch Status", details.patchStateSummary],
        ["Installed Software", details.installedSoftwareCount],
        ["Vulnerabilities", details.vulnerabilityCount],
        ["Critical Vulnerabilities", details.criticalVulnerabilityCount]
      ]
    : [];

  const panel =
    isMounted && selection
      ? createPortal(
          <div className="fixed inset-0 z-[11000] pointer-events-none cursor-default" data-cmdb-drill-through>
            <div
              aria-hidden="true"
              onClick={close}
              className={`absolute inset-0 cursor-default select-none bg-slate-950/55 transition-opacity duration-200 ${
                isOpen ? "pointer-events-auto opacity-100" : "opacity-0"
              }`}
            />
            <aside
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="cmdb-drill-through-title"
              aria-describedby="cmdb-drill-through-description"
              aria-busy={selection.state === "loading"}
              data-load-state={selection.state}
              className={`absolute left-0 top-0 flex h-full w-[min(29rem,94vw)] flex-col border-r border-sky-300/25 bg-slate-950 p-4 text-slate-100 shadow-[18px_0_40px_rgba(2,6,23,0.7)] transition-transform duration-200 ease-out pointer-events-auto cursor-default ${
                isOpen ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              <div className="flex cursor-default select-none items-start justify-between gap-3 border-b border-sky-300/20 pb-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-sky-200/80">Read Only</p>
                  <h3 id="cmdb-drill-through-title" className="text-lg font-semibold text-sky-100">
                    CMDB Drill Through
                  </h3>
                  <p id="cmdb-drill-through-description" className="mt-1 text-xs text-slate-300/80">
                    Asset Details for {details?.assetName ?? selection.assetName}
                  </p>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={close}
                  aria-label="Close CMDB Drill Through"
                  className="rounded-md border border-slate-600/80 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
              <div className="min-h-0 flex-1 cursor-text select-text overflow-y-auto py-3">
                {selection.state === "loading" ? (
                  <div className="rounded-lg border border-sky-300/20 bg-slate-900/65 p-4 text-sm text-slate-200" role="status">
                    Loading CMDB details...
                  </div>
                ) : selection.state === "error" ? (
                  <div className="rounded-lg border border-red-400/35 bg-red-500/10 p-4 text-sm text-red-100" role="alert">
                    <p>{selection.error}</p>
                    <button
                      type="button"
                      onClick={() => loadDetails(selection)}
                      className="mt-3 rounded-md border border-red-300/45 px-3 py-1.5 text-xs font-semibold hover:bg-red-500/15"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <table className="w-full table-fixed border-separate border-spacing-y-1 text-left select-text">
                    <tbody>
                      {detailRows.map(([label, value], index) => (
                        <tr key={label} className={index % 2 === 0 ? "bg-slate-900/35" : "bg-transparent"}>
                          <th
                            scope="row"
                            className="w-36 align-top rounded-l-md px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
                          >
                            {label}
                          </th>
                          <td className="rounded-r-md px-3 py-2 text-sm font-medium text-slate-100">
                            <span className="block break-words">{formatDetailValue(value)}</span>
                          </td>
                        </tr>
                      ))}
                      <tr className={detailRows.length % 2 === 0 ? "bg-slate-900/35" : "bg-transparent"}>
                        <th
                          scope="row"
                          className="w-36 align-top rounded-l-md px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
                        >
                          CMDB Record
                        </th>
                        <td className="rounded-r-md px-3 py-2 text-sm font-medium text-slate-100">
                          {cmdbRecordUrl ? (
                            <a
                              href={cmdbRecordUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="cursor-pointer break-words text-cyan-200 underline decoration-cyan-300/60 underline-offset-2 hover:text-cyan-100"
                            >
                              Open CMDB record
                            </a>
                          ) : (
                            "Not supplied"
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            </aside>
          </div>,
          document.body
        )
      : null;

  return (
    <CmdbDrillThroughContext.Provider value={contextValue}>
      {children}
      {panel}
    </CmdbDrillThroughContext.Provider>
  );
}

export function useCmdbDrillThrough(): CmdbDrillThroughContextValue {
  const context = useContext(CmdbDrillThroughContext);
  if (!context) {
    throw new Error("useCmdbDrillThrough must be used within CmdbDrillThroughProvider.");
  }
  return context;
}

export function CmdbDeviceName({
  assetId,
  name,
  className = "text-cyan-200 underline decoration-cyan-300/55 underline-offset-2 hover:text-cyan-100"
}: {
  assetId: string;
  name: string;
  className?: string;
}) {
  const { openCmdbDrillThrough } = useCmdbDrillThrough();
  return (
    <button
      type="button"
      data-cmdb-asset-id={assetId}
      aria-label={`Open CMDB Drill Through for ${name}`}
      title={`Open CMDB Drill Through for ${name}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openCmdbDrillThrough(assetId, name);
      }}
      className={`cursor-pointer text-left ${className}`}
    >
      {name}
    </button>
  );
}
