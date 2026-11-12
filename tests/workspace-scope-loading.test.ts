import { afterEach, describe, expect, it, vi } from "vitest";
import { ROUTE_LOADING_START_EVENT, shouldShowRouteLoading, startRouteLoading } from "@/lib/route-loading";
import { WORKSPACE_GROUPS, WORKSPACE_LINKS } from "@/lib/workspace-navigation";

const baseHref = "http://localhost:3000/discovery-coverage?discoveryView=endpoints&network=net-a&dataDate=2026-11-07";
const workspaceItems = [...WORKSPACE_GROUPS.flatMap(group => group.items), ...WORKSPACE_LINKS];

function withQuery(href: string, query: string): string {
  const target = new URL(href, baseHref);
  for (const [key, value] of new URLSearchParams(query)) target.searchParams.append(key, value);
  return target.pathname + target.search;
}

afterEach(() => vi.unstubAllGlobals());

describe("workspace loading reflects applied scope", () => {
  it.each(workspaceItems)("only loads $label when at least one network or system is applied", item => {
    expect(shouldShowRouteLoading(item.href, baseHref)).toBe(false);
    expect(shouldShowRouteLoading(withQuery(item.href, "dataDate=2026-09-19&securityDomain=SECRET"), baseHref)).toBe(false);
    expect(shouldShowRouteLoading(withQuery(item.href, "network=net-a&dataDate=2026-09-19"), baseHref)).toBe(true);
    expect(shouldShowRouteLoading(withQuery(item.href, "system=sys-a&dataDate=2026-09-19"), baseHref)).toBe(true);
  });

  it.each([
    ["network=", false],
    ["system=", false],
    ["network=%20%20&system=%20", false],
    ["network=%20,%20,,&system=,,", false],
    ["network=&network=%20&system=&system=,", false],
    ["network=net-a&network=", true],
    ["system=sys-a&system=%20", true],
    ["network=&network=net-a", true],
    ["network=%20net-a%20,net-b,,", true],
    ["network=%20&system=%20sys-a%20", true],
    ["network=unknown-id", true],
    ["system=unknown-id&securityDomain=", true]
  ] as const)("handles scope query %s without mistaking selected IDs for empty scope", (query, expected) => {
    expect(shouldShowRouteLoading(`/discovery-coverage?discoveryView=topology&${query}`, baseHref)).toBe(expected);
  });

  it.each(["/", "/?dataDate=2026-11-07", "/?network=net-a", "/?system=sys-a&securityDomain=SECRET"])("does not animate the landing workspace %s", href => {
    expect(shouldShowRouteLoading(href, baseHref)).toBe(false);
  });

  it.each([
    undefined,
    "http://[invalid",
    "/settings?dataDate=2026-09-19",
    "/findings?network=net-a",
    "/cmdb/endpoints/asset-1?dataDate=2026-11-07",
    "/discovery-coverage?discoveryView=unsupported",
    "https://example.org/discovery-coverage?discoveryView=topology",
    "https://example.org/"
  ])("preserves the existing loading contract outside known workspace pages: %s", href => {
    expect(shouldShowRouteLoading(href, baseHref)).toBe(true);
  });

  it("uses the current origin to classify a relative destination, without inheriting current scope", () => {
    vi.stubGlobal("window", { location: { href: baseHref } });
    expect(shouldShowRouteLoading("/governance/end-point-insights")).toBe(false);
    expect(shouldShowRouteLoading("/governance/end-point-insights?system=sys-a")).toBe(true);
  });

  it("does not dispatch a loading event when navigating or updating to an empty scope", () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { location: { href: baseHref }, dispatchEvent });
    for (const href of [
      "/discovery-coverage?discoveryView=topology&dataDate=2026-11-07",
      "/governance/end-point-insights?network=&network=%20&system=,",
      "/discovery-coverage?discoveryView=endpoints&dataDate=2026-09-19&securityDomain=SECRET",
      "/?network=net-a&dataDate=2026-09-19"
    ]) startRouteLoading({ href, cancelHref: baseHref, message: "Opening selected view..." });
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it("keeps destination readiness and cancellation details for scoped data loading", () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { location: { href: baseHref }, dispatchEvent });
    startRouteLoading({
      href: "/discovery-coverage?system=sys-a&dataDate=2026-09-19&discoveryView=topology",
      cancelHref: "/discovery-coverage?network=net-a&dataDate=2026-11-07#inventory",
      message: "Opening Topology Explorer..."
    });
    expect(dispatchEvent).toHaveBeenCalledOnce();
    const event = dispatchEvent.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe(ROUTE_LOADING_START_EVENT);
    expect(event.detail).toMatchObject({
      targetLocationKey: "/discovery-coverage?dataDate=2026-09-19&discoveryView=topology&system=sys-a",
      cancelHref: "/discovery-coverage?network=net-a&dataDate=2026-11-07#inventory",
      message: "Opening Topology Explorer...",
      waitForRouteReady: true
    });
  });

  it("preserves explicitly supplied transition and readiness settings", () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { location: { href: baseHref }, dispatchEvent });
    startRouteLoading({ href: "/governance/end-point-insights?network=net-a", targetLocationKey: "explicit-target",
      waitForRouteReady: false, documentTransition: true });
    expect((dispatchEvent.mock.calls[0][0] as CustomEvent).detail).toMatchObject({
      targetLocationKey: "explicit-target", waitForRouteReady: false, documentTransition: true
    });
  });

  it("remains a no-op outside the browser", () => {
    vi.stubGlobal("window", undefined);
    expect(() => startRouteLoading({ href: "/discovery-coverage?network=net-a" })).not.toThrow();
  });
});
