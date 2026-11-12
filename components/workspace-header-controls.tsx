"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { WorkspaceFilters } from "@/components/workspace-filters";
import { normalizeDataDate, todayDateKey } from "@/lib/data-date";
import { startRouteLoading } from "@/lib/route-loading";

export function WorkspaceHeaderControls() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const selectedDataDate = normalizeDataDate(searchParams?.get("dataDate")) ?? todayDateKey();
  return <div className="workspace-header-controls">
    <WorkspaceFilters dataDate={selectedDataDate} />
    <label className="workspace-date"><span className="workspace-field-label">Date</span>
      <input type="date" aria-label="Data date" value={selectedDataDate} disabled={pending} onChange={(event) => {
        if (!normalizeDataDate(event.target.value)) return;
        const params = new URLSearchParams(searchParams?.toString());
        params.set("dataDate", event.target.value);
        const href = `${pathname}?${params}`;
        startRouteLoading({ href, message: "Loading selected date…" });
        startTransition(() => router.replace(href, { scroll: false }));
      }} />
    </label>
  </div>;
}
