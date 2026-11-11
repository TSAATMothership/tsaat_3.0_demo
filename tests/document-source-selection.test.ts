import { afterAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { documentSourceMatchesHeader } from "@/lib/documents/protocol";
import { DocumentGenerationPage } from "@/components/document-generation-page";

const state = vi.hoisted(() => ({ query: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(state.query) }));
// This Node-only suite uses the repository's classic JSX test transform.
vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());
const source = "/api/governance/end-point-insights/report?kind=spi&id=10&network=net-1&dataDate=2026-11-07&results=non-compliant";

describe("saved document selection", () => {
  it.each([
    ["network=net-2&dataDate=2026-11-07"],
    ["system=sys-1&dataDate=2026-11-07"],
    ["dataDate=2026-11-07"],
    ["network=net-1&dataDate=2026-10-31"],
    ["network=net-1"],
    ["network=net-1&dataDate=2026-11-07&securityDomain=NONE"]
  ])("detects a changed header selection: %s", query => {
    expect(documentSourceMatchesHeader(source, new URLSearchParams(query))).toBe(false);
  });
  it("compares canonical repeated/comma scope values and domain sets without remapping the source", () => {
    const saved = "/api/governance/end-point-insights/report?kind=spi&id=10&network=net-2,net-1&network=net-1&system=sys-2,sys-1&securityDomain=SECRET&securityDomain=PROTECTED&dataDate=2026-11-07";
    const header = new URLSearchParams("network=net-1&network=net-2&system=sys-1,sys-2&securityDomain=PROTECTED,SECRET&dataDate=2026-11-07&source=unused");
    expect(documentSourceMatchesHeader(saved, header)).toBe(true);
    expect(saved).toContain("kind=spi&id=10&network=net-2,net-1&network=net-1");
    expect(documentSourceMatchesHeader(source, new URLSearchParams("network=net-1,net-1&dataDate=2026-11-07&securityDomain=UNKNOWN,SECRET,PROTECTED"))).toBe(true);
  });
  it.each(["", "https://evil.example/api/governance/end-point-insights/report", "/api/settings/personas", "/%"])("rejects unsupported sources before parsing their selection: %s", invalid => {
    expect(documentSourceMatchesHeader(invalid, new URLSearchParams())).toBe(false);
  });
  it("disables a mismatched dynamic-entity report and restores its exact original URL", () => {
    const saved = "/api/discovery/installed-software-insights/report?system=sys-1&securityDomain=PROTECTED&dataDate=2026-11-07&search=mail%20server";
    state.query = "system=sys-2&securityDomain=SECRET&dataDate=2026-10-31";
    const html = renderToStaticMarkup(createElement(DocumentGenerationPage, { source: saved }));
    expect(html).toContain("The current header selection differs from this saved report");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Generate document<\/button>/);
    expect(html).toContain(`href="${saved.replaceAll("&", "&amp;")}"`);
    expect(html).toContain("Restore report selection</a>");
    expect(html).not.toContain("/api/systems/sys-2/");
  });
  it("enables the saved report for its matching header without changing kind/results filters", () => {
    state.query = "network=net-1&dataDate=2026-11-07";
    const html = renderToStaticMarkup(createElement(DocumentGenerationPage, { source }));
    expect(html).not.toContain("data-document-selection-warning");
    expect(html).not.toContain('disabled=""');
    expect(html).toContain('data-document-source="' + source.replaceAll("&", "&amp;") + '"');
  });
});
