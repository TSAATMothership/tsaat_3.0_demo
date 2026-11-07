"use client";

import { PersonaPopupButton } from "@/components/persona-popup-button";
import { usePersonaAccess } from "@/components/persona-provider";

import { browserWorkspaceSearch } from "@/lib/browser-location";

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
import type { CmdbAssetView, CmdbAttributeRow } from "@/lib/cmdb-attributes";
import { DATA_DATE_PARAM, normalizeDataDate } from "@/lib/data-date";
import type { ExplorerColumn } from "@/lib/explorer-table";
import { cmdbTopologyHref } from "@/lib/cmdb-topology-navigation";
import type { ModelCiType } from "@/lib/cmdb-ci-types";

const PANEL_TWEEN_MS = 220;
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface CmdbRequest {
  assetId: string;
  assetName: string;
  dataDate: string | null;
  workspaceSearch: string;
  topologyNetworkId?: string;
  ciType?: ModelCiType;
  topologySystemIds?: string;
}

interface CmdbSelection extends CmdbRequest {
  state: "loading" | "ready" | "error";
  details: CmdbAssetView | null;
  error: string | null;
}

interface CmdbDrillThroughContextValue {
  openCmdbDrillThrough: (assetId: string, assetName?: string, topologyNetworkId?: string, modelCi?: { ciType: ModelCiType; topologySystemIds?: string }) => void;
}

const CmdbDrillThroughContext = createContext<CmdbDrillThroughContextValue | null>(null);

const detailColumns: ExplorerColumn<CmdbAttributeRow>[] = [
  { key: "label", label: "Field", value: row => row.label },
  { key: "value", label: "Value", value: row => row.value }
];

function currentDataDate(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const params = new URLSearchParams(browserWorkspaceSearch(window.location));
  return normalizeDataDate(params.get(DATA_DATE_PARAM)) ?? null;
}

function detailsEndpoint(request: CmdbRequest): string {
  const params = new URLSearchParams({ assetId: request.assetId });
  if (request.ciType) {
    params.set("ciType", request.ciType);
    const source = new URLSearchParams(request.workspaceSearch);
    for (const key of ["network", "system", "securityDomain"]) for (const value of source.getAll(key)) params.append(key, value);
    if (request.topologySystemIds) { params.delete("network"); params.set("system", request.topologySystemIds); }
  }
  if (request.dataDate) {
    params.set(DATA_DATE_PARAM, request.dataDate);
  }
  return `/api/assets/cmdb-details?${params.toString()}`;
}

export function CmdbDrillThroughProvider({ children }: { children: ReactNode }) {
  const { canOpenPopup, canNavigate } = usePersonaAccess();
  const cmdbAllowed = canOpenPopup("cmdb-details");
  const [selection, setSelection] = useState<CmdbSelection | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDialogElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const loadDetails = useCallback((request: CmdbRequest) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSelection({ ...request, state: "loading", details: null, error: null });
    void fetch(detailsEndpoint(request), { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          asset?: CmdbAssetView;
          error?: string;
        };
        if (controller.signal.aborted) return;
        if (!response.ok || !payload.asset || payload.asset.assetId !== request.assetId || (request.ciType && payload.asset.assetType !== request.ciType) || !Array.isArray(payload.asset.attributes)) {
          throw new Error(payload.error || "Unable to load CMDB details for this CI.");
        }
        setSelection((current) =>
          current?.assetId === request.assetId && current.ciType === request.ciType && current.dataDate === request.dataDate
            ? { ...request, state: "ready", details: payload.asset ?? null, error: null }
            : current
        );
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        setSelection((current) =>
          current?.assetId === request.assetId && current.ciType === request.ciType && current.dataDate === request.dataDate
            ? {
                ...request,
                state: "error",
                details: null,
                error: error instanceof Error ? error.message : "Unable to load CMDB details for this CI."
              }
            : current
        );
      });
  }, []);

  const openCmdbDrillThrough = useCallback(
    (assetId: string, assetName?: string, topologyNetworkId?: string, modelCi?: { ciType: ModelCiType; topologySystemIds?: string }) => {
      if (!cmdbAllowed) return;
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
        dataDate: currentDataDate(),
        workspaceSearch: browserWorkspaceSearch(window.location),
        topologyNetworkId, ...modelCi
      };
      loadDetails(request);
      window.requestAnimationFrame(() => setIsOpen(true));
    },
    [loadDetails, cmdbAllowed]
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
  const hasSelection = selection !== null && cmdbAllowed;
  const selectedAssetId = `${selection?.ciType ?? "asset"}:${selection?.assetId ?? ""}`;

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
  const tableRows = details?.attributes ?? [];
  const topologyHref = details && selection ? cmdbTopologyHref(details, selection.workspaceSearch, selection.topologyNetworkId, selection.topologySystemIds) : null;
  const topologyAllowed = canNavigate(topologyHref ?? "/discovery-coverage?discoveryView=topology");

  const panel =
    isMounted && selection && cmdbAllowed
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
                <span>{selection.ciType ? "CI" : "Asset"} details for <strong>{details?.assetName ?? selection.assetName}</strong></span>
                {(details?.snapshotDate ?? selection.dataDate) && <span>Snapshot · {details?.snapshotDate ?? selection.dataDate}</span>}
              </p>
              <div className="cmdb-scope-actions">
                <button type="button" className="endpoint-export" data-cmdb-explore-topology
                  disabled={!topologyHref || !topologyAllowed} data-persona-disabled={!topologyAllowed || undefined}
                  title={!topologyAllowed ? "Unavailable for the active persona" : !topologyHref ? "Load the CI details to explore its topology" : "Open Topology Explorer with this CI selected"}
                  onClick={() => {
                    // A document navigation also clears any underlying stacked dialogs and
                    // initializes the selected CI when already viewing Topology Explorer.
                    if (topologyHref && topologyAllowed) window.location.assign(topologyHref);
                  }}>Explore Topology</button>
              </div>
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
                  <FindingsDataTable key={`${selection.dataDate}:${selectedAssetId}`} title={selection.ciType ? "CI Details" : "Asset Details"} rows={tableRows} columns={detailColumns}
                    columnFilters={false}
                    className="measure-scope-table cmdb-details-table" defaultPageSize={25} pageSizeOptions={[10, 25, 50, 100]}
                    searchText={row => row.href ?? ""}
                    renderRow={row => <tr key={row.key}><td>{row.label}</td><td>{row.href
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
  topologyNetworkId,
  ciType,
  topologySystemIds,
  className = "text-cyan-200 underline decoration-cyan-300/55 underline-offset-2 hover:text-cyan-100"
}: {
  assetId: string;
  name: string;
  topologyNetworkId?: string;
  ciType?: ModelCiType;
  topologySystemIds?: string;
  className?: string;
}) {
  const { openCmdbDrillThrough } = useCmdbDrillThrough();
  return (
    <PersonaPopupButton popup="cmdb-details"
      type="button"
      data-cmdb-asset-id={assetId}
      data-cmdb-ci-type={ciType}
      aria-label={`Open CMDB Drill Through for ${name}`}
      title={`Open CMDB Drill Through for ${name}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openCmdbDrillThrough(assetId, name, topologyNetworkId, ciType ? { ciType, topologySystemIds } : undefined);
      }}
      className={`cursor-pointer text-left ${className}`}
    >
      {name}
    </PersonaPopupButton>
  );
}
