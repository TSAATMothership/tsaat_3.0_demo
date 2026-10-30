import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoadingOverlay } from "@/components/loading-overlay";
import { cancelRouteNavigation, ROUTE_LOADING_START_EVENT, startRouteLoading } from "@/lib/route-loading";

afterEach(() => vi.unstubAllGlobals());

describe("cancellable workspace loading", () => {
  it("publishes the destination and the original location for cancellation", () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { location: { href: "http://localhost/measures?network=net-a" }, dispatchEvent });
    startRouteLoading({ href: "/findings?network=net-a", cancelHref: "/measures?network=net-a", message: "Opening Findings Register..." });
    const event = dispatchEvent.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe(ROUTE_LOADING_START_EVENT);
    expect(event.detail).toMatchObject({ targetLocationKey: "/findings?network=net-a", cancelHref: "/measures?network=net-a", waitForRouteReady: true });
  });
  it("abandons pending work before restoring the previous view, filters, date and anchor", () => {
    const calls: string[] = [];
    vi.stubGlobal("window", {
      stop: () => calls.push("stop"),
      location: { href: "http://localhost/findings", origin: "http://localhost", replace: (href: string) => calls.push(href) }
    });
    cancelRouteNavigation("/measures?network=net-a%2Cnet-b&dataDate=2026-10-30#chart");
    expect(calls).toEqual(["stop", "/measures?network=net-a%2Cnet-b&dataDate=2026-10-30#chart"]);
    cancelRouteNavigation("https://example.org/");
    expect(calls).toHaveLength(2);
  });
  it("renders an accessible full-page modal with progress and a cancel button", () => {
    const html = renderToStaticMarkup(React.createElement(LoadingOverlay, { progress: 42, message: "Opening Cyber COP...", blocking: true, onCancel: () => {} }));
    expect(html).toContain("<dialog");
    expect(html).toContain('aria-label="Loading view"');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="42"');
    expect(html).toContain("fixed inset-0");
    expect(html).toContain(">Cancel</button>");
    const cancelling = renderToStaticMarkup(React.createElement(LoadingOverlay, { progress: 42, message: "Cancelling", blocking: true, cancelling: true, onCancel: () => {} }));
    expect(cancelling).toMatch(/<button[^>]*disabled/);
  });
  it("does not unblock slow sidebar navigation before readiness or cancellation", () => {
    const source = readFileSync(path.join(process.cwd(), "components/filter-loading-overlay.tsx"), "utf8");
    expect(source).toContain("if (!options.cancelHref)");
    expect(source).toContain("hasRouteReadyMarker(readyLocationKey)");
    expect(source).toContain("cancelRouteNavigation(cancelHref)");
  });
});

describe("settings popup integration", () => {
  it("opens settings through a modal button and keeps tab selection local", () => {
    const read = (name: string) => readFileSync(path.join(process.cwd(), name), "utf8");
    const menu = read("components/menu-navigation.tsx");
    const popup = read("components/settings-popup.tsx");
    const tabs = read("components/settings-tabs.tsx");
    expect(menu).toContain('aria-haspopup="dialog"');
    expect(menu).toContain("setIsSettingsOpen(true)");
    expect(menu).not.toContain('workspaceHref("/settings"');
    expect(popup).toContain("dialog.showModal()");
    expect(popup).toContain("controller.abort()");
    expect(popup).toContain("<PasswordSettingsPanel />");
    expect(popup).toContain("<DatabaseSettingsPanel initialSettings={settings}");
    expect(tabs).not.toContain("router.replace");
    expect(read("app/settings/page.tsx")).toContain("<SettingsRoutePopup");
    expect(read("app/settings/page.tsx")).not.toContain("<DatabaseSettingsPanel");
  });
});
