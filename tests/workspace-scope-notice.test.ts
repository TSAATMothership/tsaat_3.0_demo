import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WorkspaceShell } from "@/components/workspace-shell";
import { WORKSPACE_GROUPS } from "@/lib/workspace-navigation";

const route = vi.hoisted(() => ({ pathname: "/", query: "" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname, useSearchParams: () => new URLSearchParams(route.query), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/persona-provider", () => ({ usePersona: () => ({ settings: null, activePersona: null, error: "", loading: false }) }));
beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());

function render(href: string) {
  const target = new URL(href, "http://localhost");
  route.pathname = target.pathname; route.query = target.search;
  return renderToStaticMarkup(React.createElement(WorkspaceShell, { children: React.createElement("i", { "data-route-ready-key": href }) }));
}

it.each(WORKSPACE_GROUPS.flatMap(group => group.items))("guides an unscoped $label while retaining the readiness marker", item => {
  const html = render(item.href);
  expect(html).toContain('class="workspace-scope-notice"');
  expect(html).toContain('data-route-ready-key=');
  expect(html).toContain("Select a network or ICT system");
  expect(html).toContain("Select managed networks");
  expect(html).toContain("Select ICT systems");
  expect(html).toContain('role="status"');
  expect(html).toContain('aria-labelledby="workspace-scope-title"');
  expect(html).toContain('aria-hidden="true"');
  expect(html).not.toContain('role="progressbar"');
});

it.each([
  ["/discovery-coverage?network=%20,%20&system=", true],
  ["/discovery-coverage?network=net-a&network=", false],
  ["/discovery-coverage?system=sys-a&system=%20", false],
  ["/discovery-coverage?network=unknown-id", false],
  ["/discovery-coverage?discoveryView=retired", false],
  ["/settings", false],
  ["/", false],
  ["/?network=net-a", false]
] as const)("only presents missing-scope guidance for applicable route %s", (href, expected) => {
  expect(render(href).includes('class="workspace-scope-notice"')).toBe(expected);
});
