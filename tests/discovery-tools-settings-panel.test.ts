import { describe, expect, it } from "vitest";
import { ASSET_TYPES } from "@/lib/asset-taxonomy";
import { defaultDiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import {
  buildDiscoveryToolsSavePayload,
  filterDiscoveryToolsByName,
  formatDiscoveryToolsTimestamp,
  scopeStatusPresentation
} from "@/components/discovery-tools-settings-panel";

describe("discovery tools settings panel helpers", () => {
  it("formats saved timestamps deterministically for hydration", () => {
    expect(formatDiscoveryToolsTimestamp("2026-03-15T19:19:52.000Z")).toBe("15/03/2026, 19:19:52");
    expect(formatDiscoveryToolsTimestamp("not-a-date")).toBe("not-a-date");
  });

  it("maps required scope to green tick status", () => {
    const status = scopeStatusPresentation("required");
    expect(status.symbol).toBe("✓");
    expect(status.label).toBe("Required");
    expect(status.className).toContain("emerald");
  });

  it("maps na scope to red cross status", () => {
    const status = scopeStatusPresentation("na");
    expect(status.symbol).toBe("✕");
    expect(status.label).toBe("N/A");
    expect(status.className).toContain("red");
  });

  it("filters tools by selected tool id", () => {
    const settings = defaultDiscoveryToolsSettings();
    const firstToolId = settings.tools[0]?.id ?? "";
    const filtered = filterDiscoveryToolsByName(settings.tools, firstToolId);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe(firstToolId);
  });

  it("builds full-matrix payload with all tools and asset types", () => {
    const settings = defaultDiscoveryToolsSettings();
    const payload = buildDiscoveryToolsSavePayload(settings.tools);

    expect(payload.tools).toHaveLength(settings.tools.length);
    for (const tool of payload.tools) {
      expect(typeof tool.id).toBe("string");
      for (const assetType of ASSET_TYPES) {
        expect(tool.assetTypeScope[assetType]).toMatch(/^(required|na)$/);
      }
    }
  });
});
