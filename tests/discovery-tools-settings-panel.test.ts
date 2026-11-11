import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ASSET_TYPES, ASSET_TYPE_LABELS } from "@/lib/asset-taxonomy";
import { defaultDiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import {
  DiscoveryToolsSettingsPanel,
  filterDiscoveryToolsByName,
  formatDiscoveryToolsTimestamp,
  scopeStatusPresentation
} from "@/components/discovery-tools-settings-panel";
afterEach(() => vi.unstubAllGlobals());

describe("discovery tools settings panel helpers", () => {
  it("formats saved timestamps deterministically for hydration", () => {
    expect(formatDiscoveryToolsTimestamp("2026-03-15T19:19:52.000Z")).toBe("15/03/2026, 19:19:52");
    expect(formatDiscoveryToolsTimestamp("not-a-date")).toBe("not-a-date");
  });

  it("maps required scope to green tick status", () => {
    const status = scopeStatusPresentation("required");
    expect(status.symbol).toBe("✓");
    expect(status.label).toBe("Yes");
    expect(status.className).toContain("emerald");
  });

  it("maps na scope to red cross status", () => {
    const status = scopeStatusPresentation("na");
    expect(status.symbol).toBe("✕");
    expect(status.label).toBe("No");
    expect(status.className).toContain("red");
  });

  it("filters tools by selected tool id", () => {
    const settings = defaultDiscoveryToolsSettings();
    const firstToolId = settings.tools[0]?.id ?? "";
    const filtered = filterDiscoveryToolsByName(settings.tools, firstToolId);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe(firstToolId);
  });

  it("renders every saved mapping as read-only text", () => {
    vi.stubGlobal("React", React);
    const settings = defaultDiscoveryToolsSettings();
    const html = renderToStaticMarkup(React.createElement(DiscoveryToolsSettingsPanel, { initialSettings: settings }));
    expect(html).toContain("Read-only");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("Save");
    for (const tool of settings.tools) {
      expect(html).toContain(tool.name);
      for (const assetType of ASSET_TYPES) {
        expect(html).toContain(ASSET_TYPE_LABELS[assetType] + " coverage for " + tool.name + ": " + scopeStatusPresentation(tool.assetTypeScope[assetType]).label);
      }
    }
  });
  it("explains an empty saved tool catalogue", () => {
    vi.stubGlobal("React", React);
    const html = renderToStaticMarkup(React.createElement(DiscoveryToolsSettingsPanel, { initialSettings: { ...defaultDiscoveryToolsSettings(), tools: [] } }));
    expect(html).toContain("No discovery tools are configured.");
  });
});
