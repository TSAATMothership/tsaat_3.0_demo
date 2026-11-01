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
import { FindingsDataTable } from "@/components/findings-data-table";
import { formatAssetTypeLabel } from "@/lib/asset-taxonomy";
import type { CmdbAssetDetails } from "@/lib/cmdb-drill-through";
import { DATA_DATE_PARAM, normalizeDataDate } from "@/lib/data-date";
import type { ExplorerColumn } from "@/lib/explorer-table";

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

interface CmdbDetailRow { label: string; value: string; href?: string }
const detailColumns: ExplorerColumn<CmdbDetailRow>[] = [
  { key: "label", label: "Field", value: row => row.label },
  { key: "value", label: "Value", value: row => row.value }
];

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
  const panelRef = useRef<HTMLDialogElement | null>(null);
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
      if (!panelRef.current?.open) {
        returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      }
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
    if (!hasSelection) return;
    const panel = panelRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel?.showModal();
    return () => {
      panel?.close();
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    };
  }, [hasSelection]);

  useEffect(() => {
    if (!hasSelection || !isOpen) {
      return;
    }
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
        const filterClose = panel?.querySelector<HTMLButtonElement>('.endpoint-filter-popup button[aria-label^="Close "]');
        if (filterClose) filterClose.click();
        else close();
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
  const tableRows: CmdbDetailRow[] = [
    ...detailRows.map(([label, value]) => ({ label, value: formatDetailValue(value) })),
    { label: "CMDB Record", value: cmdbRecordUrl ? "Open CMDB record" : "Not supplied", href: cmdbRecordUrl ?? undefined }
  ];

  const panel =
    isMounted && selection
      ? createPortal(
            <dialog
              ref={panelRef}
              aria-modal="true"
              aria-labelledby="cmdb-drill-through-title"
              aria-describedby="cmdb-drill-through-description"
              aria-busy={selection.state === "loading"}
              data-load-state={selection.state}
              data-cmdb-drill-through
              className={`measure-scope-panel measure-scope-panel-systems cmdb-scope-panel${isOpen ? " is-open" : ""}`}
              onCancel={event => { event.preventDefault(); close(); }}
              onClick={event => { if (event.target === event.currentTarget) close(); }}
            >
              <div className="measure-scope-content">
              <header>
                <div>
                  <p className="endpoint-eyebrow">CMDB / Read only</p>
                  <h2 id="cmdb-drill-through-title">
                    CMDB Drill Through
                  </h2>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={close}
                  aria-label="Close CMDB Drill Through"
                >
                  Close
                </button>
              </header>
              <p id="cmdb-drill-through-description" className="cmdb-scope-description">
                <span>Asset details for <strong>{details?.assetName ?? selection.assetName}</strong></span>
                {(details?.snapshotDate ?? selection.dataDate) && <span>Snapshot · {details?.snapshotDate ?? selection.dataDate}</span>}
              </p>
                {selection.state === "loading" ? (
                  <div className="cmdb-scope-state" role="status">
                    Loading CMDB details...
                  </div>
                ) : selection.state === "error" ? (
                  <div className="cmdb-scope-state is-error" role="alert">
                    <p>{selection.error}</p>
                    <button
                      type="button"
                      onClick={() => loadDetails(selection)}
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <FindingsDataTable key={`${selection.dataDate}:${selection.assetId}`} title="Asset Details" rows={tableRows} columns={detailColumns}
                    columnFilters={false}
                    className="measure-scope-table cmdb-details-table" defaultPageSize={25} pageSizeOptions={[10, 25, 50, 100]}
                    searchText={row => row.href ?? ""}
                    renderRow={row => <tr key={row.label}><td>{row.label}</td><td>{row.href
                      ? <a href={row.href} target="_blank" rel="noreferrer" className="cmdb-record-link">{row.value}</a>
                      : row.value}</td></tr>} />
                )}
              </div>
            </dialog>,
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
