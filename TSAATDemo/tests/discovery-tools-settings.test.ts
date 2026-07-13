import { describe, expect, it } from "vitest";
import { ASSET_TYPES } from "@/lib/asset-taxonomy";
import {
  defaultDiscoveryToolsSettings,
  normalizeDiscoveryToolsScopeUpdate,
  type DiscoveryToolAssetSetting
} from "@/lib/discovery-tools-settings";
import { AssetType } from "@/lib/types";

function cloneScope(scope: Record<AssetType, DiscoveryToolAssetSetting>) {
  return { ...scope };
}

describe("discovery tools scope update normalization", () => {
  it("rejects unknown tool ids in update payload", () => {
    const existing = defaultDiscoveryToolsSettings();
    const updates = existing.tools.map((tool) => ({
      id: tool.id,
      assetTypeScope: cloneScope(tool.assetTypeScope)
    }));

    updates[0] = {
      ...updates[0],
      id: "unknown-tool"
    };

    expect(() => normalizeDiscoveryToolsScopeUpdate({ tools: updates }, existing)).toThrow(
      "Unknown discovery tool id in update payload: unknown-tool"
    );
  });

  it("rejects payloads missing any existing tool id", () => {
    const existing = defaultDiscoveryToolsSettings();
    const updates = existing.tools.slice(0, -1).map((tool) => ({
      id: tool.id,
      assetTypeScope: cloneScope(tool.assetTypeScope)
    }));

    const missingId = existing.tools[existing.tools.length - 1]?.id ?? "";
    expect(() => normalizeDiscoveryToolsScopeUpdate({ tools: updates }, existing)).toThrow(
      `Missing discovery tool ids in update payload: ${missingId}`
    );
  });

  it("persists scope updates while preserving tool metadata", () => {
    const existing = defaultDiscoveryToolsSettings();
    const firstTool = existing.tools[0];
    const updates = existing.tools.map((tool) => ({
      id: tool.id,
      assetTypeScope: cloneScope(tool.assetTypeScope)
    }));

    updates[0] = {
      id: firstTool.id,
      assetTypeScope: {
        ...cloneScope(firstTool.assetTypeScope),
        server: "na",
        workstation: "na"
      }
    };

    const normalized = normalizeDiscoveryToolsScopeUpdate({ tools: updates }, existing);
    const normalizedFirst = normalized.tools[0];

    expect(normalized.updatedAt).toBe(existing.updatedAt);
    expect(normalizedFirst.id).toBe(firstTool.id);
    expect(normalizedFirst.name).toBe(firstTool.name);
    expect(normalizedFirst.description).toBe(firstTool.description);
    expect(normalizedFirst.el2Owner).toBe(firstTool.el2Owner);
    expect(normalizedFirst.el2OperationsManager).toBe(firstTool.el2OperationsManager);
    expect(normalizedFirst.assetTypeScope.server).toBe("na");
    expect(normalizedFirst.assetTypeScope.workstation).toBe("na");
  });

  it("preserves all six asset type keys for every tool update", () => {
    const existing = defaultDiscoveryToolsSettings();
    const updates = existing.tools.map((tool) => ({
      id: tool.id,
      assetTypeScope: cloneScope(tool.assetTypeScope)
    }));
    const normalized = normalizeDiscoveryToolsScopeUpdate({ tools: updates }, existing);

    for (const tool of normalized.tools) {
      for (const assetType of ASSET_TYPES) {
        expect(tool.assetTypeScope[assetType]).toMatch(/^(required|na)$/);
      }
    }
  });
});
