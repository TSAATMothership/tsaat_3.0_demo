import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PersonaLink from "@/components/persona-link";
import { PersonaPopupButton } from "@/components/persona-popup-button";
import { PersonaPopup } from "@/components/persona-popup";
const access = vi.hoisted(() => ({ canNavigate: vi.fn(), canOpenPopup: vi.fn() }));
vi.mock("@/components/persona-provider", () => ({ usePersonaAccess: () => access }));
beforeEach(() => { vi.stubGlobal("React", React); access.canNavigate.mockReturnValue(true); access.canOpenPopup.mockReturnValue(true); });
afterEach(() => vi.unstubAllGlobals());
it("removes destination, new-tab behavior and tab focus from disabled drill-throughs", () => {
  access.canNavigate.mockReturnValue(false);
  const html = renderToStaticMarkup(React.createElement(PersonaLink, { href: "/findings?network=net-1", target: "_blank", children: "Review findings", onClick: vi.fn() }));
  expect(html).toContain('aria-disabled="true"'); expect(html).toContain('tabindex="-1"');
  expect(html).not.toContain("href="); expect(html).not.toContain("target=");
  expect(html).toContain("Review findings");
});
it("retains scoped URLs and new-tab behavior for allowed destinations", () => {
  const html = renderToStaticMarkup(React.createElement(PersonaLink, { href: "/findings?network=net-1&dataDate=2026-11-05", target: "_blank", children: "Review" }));
  expect(html).toContain('href="/findings?network=net-1&amp;dataDate=2026-11-05"');
  expect(html).toContain('target="_blank"'); expect(html).not.toContain('aria-disabled');
});
it("uses native disabled popup buttons and does not render denied popup content", () => {
  access.canOpenPopup.mockReturnValue(false);
  const html = renderToStaticMarkup(React.createElement(PersonaPopupButton, { popup: "impact-graph", children: "Explore" }));
  expect(html).toContain('disabled=""');
  expect(renderToStaticMarkup(React.createElement(PersonaPopup, { popup: "impact-graph", children: "Graph" }))).toBe("");
  access.canOpenPopup.mockReturnValue(true);
  expect(renderToStaticMarkup(React.createElement(PersonaPopup, { popup: "impact-graph", children: "Graph" }))).toBe("Graph");
  expect(renderToStaticMarkup(React.createElement(PersonaPopupButton, { popup: "impact-graph", disabled: true, children: "Explore" }))).toContain('disabled=""');
});
