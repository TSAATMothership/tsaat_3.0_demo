import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { locationKeyForHref } from "@/lib/route-loading";

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("route loading readiness", () => {
  it("normalizes target location keys so query order does not affect readiness", () => {
    expect(locationKeyForHref("/measures?b=2&a=1", "http://localhost/cyber-cop")).toBe("/measures?a=1&b=2");
    expect(locationKeyForHref("/measures?a=1&b=2", "http://localhost/cyber-cop")).toBe("/measures?a=1&b=2");
  });

  it("uses one shared full-screen loading overlay shell", () => {
    const sharedOverlay = readRepoFile("components/loading-overlay.tsx");
    expect(sharedOverlay).toContain('className = "fixed inset-0 z-[9999]"');

    const routeLoadingComponents = [
      "components/menu-navigation.tsx",
      "components/filter-bar.tsx",
      "components/discovery-coverage-tabs.tsx",
      "components/discovery-coverage-search-form.tsx",
      "components/drillthrough-back-link.tsx",
      "components/findings-history-drillthrough.tsx",
      "components/findings-spi-tiles.tsx",
      "components/findings-status-tabs.tsx",
      "components/findings-timeline-filter.tsx",
      "components/findings-view-tabs.tsx",
      "components/measures-spi-filters.tsx",
      "components/measures-tabs.tsx",
      "components/network-detail-tabs.tsx",
      "components/networks-tabs.tsx",
      "components/settings-tabs.tsx",
      "components/system-detail-tabs.tsx",
      "components/systems-tabs.tsx"
    ];

    for (const componentPath of routeLoadingComponents) {
      const source = readRepoFile(componentPath);
      expect(source, componentPath).toContain("startRouteLoading");
      expect(source, componentPath).not.toContain("fixed inset-0 z-[9999]");
      expect(source, componentPath).not.toContain("nextProgressValue");
    }
  });

  it("keeps the global overlay open until the target route-ready marker is present", () => {
    const source = readRepoFile("components/filter-loading-overlay.tsx");

    expect(source).toContain("ROUTE_LOADING_START_EVENT");
    expect(source).toContain("const readyLocationKey = targetLocationKey ?? currentLocationKey");
    expect(source).toContain("hasRouteReadyMarker(readyLocationKey)");
    expect(source).toContain("setProgress((current) => Math.max(current, 97))");
    expect(source).toContain("event.metaKey || event.ctrlKey || event.shiftKey || event.altKey");
    expect(source).toContain("targetUrl.pathname === pathname && currentQuery === nextQuery");
  });

  it("renders route-ready markers on authenticated pages after server data loading", () => {
    const pages = [
      ["app/cyber-cop/page.tsx", 'pathname="/cyber-cop"'],
      ["app/discovery-coverage/page.tsx", 'pathname="/discovery-coverage"'],
      ["app/findings/page.tsx", 'pathname="/findings"'],
      ["app/measures/page.tsx", 'pathname="/measures"'],
      ["app/networks/page.tsx", 'pathname="/networks"'],
      ["app/report/page.tsx", 'pathname="/report"'],
      ["app/settings/page.tsx", 'pathname="/settings"'],
      ["app/systems/page.tsx", 'pathname="/systems"']
    ];

    for (const [pagePath, markerPath] of pages) {
      const source = readRepoFile(pagePath);
      expect(source, pagePath).toContain("RouteReadyMarker");
      expect(source, pagePath).toContain(markerPath);
    }

    expect(readRepoFile("app/networks/[networkId]/page.tsx")).toContain("RouteReadyMarker");
    expect(readRepoFile("app/systems/[systemId]/page.tsx")).toContain("RouteReadyMarker");
  });
});
