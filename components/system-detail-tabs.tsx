"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DetailedTopologyView } from "@/components/detailed-topology-view";
import type { NetworkTopologyData } from "@/lib/network-topology";

export type SystemDetailTabId = "system-details" | "compliance-overview" | "discovery-compliance";

function nextProgressValue(current: number): number {
  if (current >= 92) {
    return current + 1;
  }
  if (current >= 78) {
    return current + 2;
  }
  if (current >= 55) {
    return current + 3;
  }
  return current + 5;
}

const tabs: Array<{ id: SystemDetailTabId; label: string }> = [
  { id: "system-details", label: "Details" },
  { id: "compliance-overview", label: "Compliance Overview" },
  { id: "discovery-compliance", label: "Discovery Compliance" }
];

export function SystemDetailTabs({
  activeTab,
  topologyData
}: {
  activeTab: SystemDetailTabId;
  topologyData: NetworkTopologyData;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pendingTab, setPendingTab] = useState<SystemDetailTabId | null>(null);
  const [isDetailedTopologyOpen, setIsDetailedTopologyOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isLoading || !pendingTab) {
      return;
    }
    if (activeTab !== pendingTab) {
      return;
    }

    setProgress(100);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    closeTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setPendingTab(null);
      setProgress(0);
    }, 140);
  }, [activeTab, isLoading, pendingTab]);

  const onSelectTab = (tab: SystemDetailTabId) => {
    if (tab === activeTab) {
      return;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }

    setIsLoading(true);
    setProgress(0);
    setPendingTab(tab);
    intervalRef.current = setInterval(() => {
      setProgress((current) => Math.min(96, nextProgressValue(current)));
    }, 85);

    const params = new URLSearchParams((searchParams?.toString() ?? ""));
    if (tab === "system-details") {
      params.delete("systemDetailTab");
    } else {
      params.set("systemDetailTab", tab);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  const pendingTabLabel =
    pendingTab === "compliance-overview"
      ? "Compliance Overview"
      : pendingTab === "discovery-compliance"
        ? "Discovery Compliance"
        : "Details";

  return (
    <>
      <section className="panel shrink-0 overflow-hidden">
        <div className="border-b border-sky-400/15 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectTab(tab.id)}
                  className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-[0.13em] transition ${
                    activeTab === tab.id
                      ? "border-sky-200/60 bg-sky-500/20 text-sky-100"
                      : "border-sky-400/20 bg-slate-900/40 text-slate-200 hover:border-sky-300/45 hover:bg-slate-800/70"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIsDetailedTopologyOpen(true)}
              className="ml-auto rounded-md border border-cyan-300/45 bg-cyan-500/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.13em] text-cyan-100 transition hover:bg-cyan-500/22"
            >
              Detailed Topology View
            </button>
          </div>
        </div>
      </section>

      <DetailedTopologyView
        isOpen={isDetailedTopologyOpen}
        onClose={() => setIsDetailedTopologyOpen(false)}
        data={topologyData}
      />

      {isMounted && isLoading
        ? createPortal(
            <div className="fixed inset-0 z-[9999] cursor-wait bg-slate-950/60">
              <div className="absolute left-1/2 top-1/2 w-[min(520px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-sky-300/35 bg-slate-900 p-6 shadow-[0_22px_60px_rgba(0,0,0,0.7)]">
                <div className="text-center">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-200">Loading</p>
                  <p className="mt-1 text-2xl font-semibold text-sky-100">{progress}%</p>
                </div>
                <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-700">
                  <div
                    className="h-full rounded-full bg-sky-300 transition-[width] duration-75 ease-linear"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-5 flex items-center justify-center gap-3 text-xs text-slate-200">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-sky-300 border-t-cyan-100" />
                  <span>Opening {pendingTabLabel}...</span>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
