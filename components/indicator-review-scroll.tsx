"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

export function IndicatorReviewScroll({ children, labelledBy }: { children: ReactNode; labelledBy: string }) {
  const container = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const viewport = container.current;
    const table = viewport?.querySelector("table");
    if (!viewport || !table) return;

    const rows = Array.from(table.tBodies[0]?.rows ?? []).slice(0, 5);
    const lastRow = rows.at(-1);
    if (!lastRow) return;

    // Measure actual rows so wrapped names and the mobile layout still fit five.
    const updateHeight = () => {
      const height = lastRow.getBoundingClientRect().bottom - table.getBoundingClientRect().top;
      const scrollbarHeight = viewport.offsetHeight - viewport.clientHeight;
      viewport.style.maxHeight = `${Math.ceil(height + scrollbarHeight)}px`;
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(table);
    rows.forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  }, [children]);

  return <div ref={container} className="measures-summary-review-scroll" role="region" aria-labelledby={labelledBy} tabIndex={0}>
    {children}
  </div>;
}
