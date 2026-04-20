import { ASSET_TYPES, createAssetTypeRecord } from "@/lib/asset-taxonomy";
import { AssetType } from "@/lib/types";

export type DiscoveryToolAssetSetting = "required" | "na";

export interface DiscoveryToolSetting {
  id: string;
  name: string;
  description: string;
  el2Owner: string;
  el2OperationsManager: string;
  assetTypeScope: Record<AssetType, DiscoveryToolAssetSetting>;
}

export interface DiscoveryToolsSettings {
  updatedAt: string;
  tools: DiscoveryToolSetting[];
}

export interface DiscoveryToolScopeUpdate {
  id: string;
  assetTypeScope: Record<AssetType, DiscoveryToolAssetSetting>;
}

const DEFAULT_TOOL_DEFINITIONS: Array<{
  id: string;
  name: string;
  description: string;
  el2Owner: string;
  el2OperationsManager: string;
  assetTypeScope: Record<AssetType, DiscoveryToolAssetSetting>;
}> = [
  {
    id: "ucmdb",
    name: "UCMDB",
    description: "Authoritative CMDB records for managed assets and relationships.",
    el2Owner: "EL2 Configuration Management",
    el2OperationsManager: "EL2 CMDB Operations",
    assetTypeScope: createAssetTypeRecord(() => "required")
  },
  {
    id: "tanium",
    name: "Tanium",
    description: "Endpoint visibility and management telemetry for server and workstation assets.",
    el2Owner: "EL2 Endpoint Security",
    el2OperationsManager: "EL2 Endpoint Operations",
    assetTypeScope: createAssetTypeRecord(() => "required")
  },
  {
    id: "tenable",
    name: "Tenable",
    description: "Vulnerability scanner coverage and findings for in-scope assets.",
    el2Owner: "EL2 Vulnerability Management",
    el2OperationsManager: "EL2 Vulnerability Operations",
    assetTypeScope: createAssetTypeRecord(() => "required")
  },
  {
    id: "snow",
    name: "SNOW",
    description: "ServiceNow asset lifecycle and warranty coverage data.",
    el2Owner: "EL2 Service Management",
    el2OperationsManager: "EL2 ITSM Operations",
    assetTypeScope: createAssetTypeRecord(() => "required")
  },
  {
    id: "servicenow",
    name: "ServiceNow",
    description: "Service catalogue and lifecycle state integration.",
    el2Owner: "EL2 Service Management",
    el2OperationsManager: "EL2 ITSM Operations",
    assetTypeScope: createAssetTypeRecord(() => "required")
  },
  {
    id: "dsoc-siem",
    name: "DSOC SIEM",
    description: "Security event telemetry and correlation coverage.",
    el2Owner: "EL2 SOC Services",
    el2OperationsManager: "EL2 SIEM Operations",
    assetTypeScope: createAssetTypeRecord(() => "required")
  },
  {
    id: "elastic",
    name: "Elastic",
    description: "Endpoint and system telemetry indexing and observability coverage.",
    el2Owner: "EL2 SOC Services",
    el2OperationsManager: "EL2 Elastic Operations",
    assetTypeScope: createAssetTypeRecord(() => "required")
  }
];

const FALLBACK_SCOPE: Record<AssetType, DiscoveryToolAssetSetting> = createAssetTypeRecord(() => "required");

function sanitizeText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }
  return value.trim();
}

function isAssetSetting(value: unknown): value is DiscoveryToolAssetSetting {
  return value === "required" || value === "na";
}

function normalizeToolId(rawId: string): string {
  return rawId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeScope(
  scopeInput: unknown,
  fallback: Record<AssetType, DiscoveryToolAssetSetting>
): Record<AssetType, DiscoveryToolAssetSetting> {
  const result: Record<AssetType, DiscoveryToolAssetSetting> = { ...fallback };
  if (!scopeInput || typeof scopeInput !== "object") {
    return result;
  }

  const scope = scopeInput as Record<string, unknown>;
  for (const assetType of ASSET_TYPES) {
    const rawValue = scope[assetType];
    if (isAssetSetting(rawValue)) {
      result[assetType] = rawValue;
    }
  }

  return result;
}

export function defaultDiscoveryToolsSettings(): DiscoveryToolsSettings {
  return {
    updatedAt: new Date().toISOString(),
    tools: DEFAULT_TOOL_DEFINITIONS.map((tool) => ({
      ...tool,
      assetTypeScope: { ...tool.assetTypeScope }
    }))
  };
}

export function normalizeDiscoveryToolsSettings(input: unknown): DiscoveryToolsSettings {
  const fallback = defaultDiscoveryToolsSettings();
  if (!input || typeof input !== "object") {
    return fallback;
  }

  const candidate = input as { updatedAt?: unknown; tools?: unknown };
  if (!Array.isArray(candidate.tools)) {
    return fallback;
  }

  const usedIds = new Set<string>();
  const tools: DiscoveryToolSetting[] = [];

  for (const rawTool of candidate.tools) {
    if (!rawTool || typeof rawTool !== "object") {
      continue;
    }
    const tool = rawTool as Record<string, unknown>;

    const rawName = sanitizeText(tool.name);
    const baseId = normalizeToolId(sanitizeText(tool.id, rawName));
    if (!rawName || !baseId) {
      continue;
    }

    let uniqueId = baseId;
    let suffix = 2;
    while (usedIds.has(uniqueId)) {
      uniqueId = `${baseId}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(uniqueId);

    const defaultScope =
      fallback.tools.find((defaultTool) => defaultTool.id === baseId)?.assetTypeScope ?? FALLBACK_SCOPE;
    const assetTypeScope = normalizeScope(tool.assetTypeScope, defaultScope);

    tools.push({
      id: uniqueId,
      name: rawName,
      description: sanitizeText(tool.description),
      el2Owner: sanitizeText(tool.el2Owner),
      el2OperationsManager: sanitizeText(tool.el2OperationsManager),
      assetTypeScope
    });
  }

  if (!tools.length) {
    return fallback;
  }

  const updatedAt =
    typeof candidate.updatedAt === "string" && !Number.isNaN(new Date(candidate.updatedAt).getTime())
      ? candidate.updatedAt
      : fallback.updatedAt;

  return {
    updatedAt,
    tools
  };
}

function parseScopeUpdates(input: unknown): DiscoveryToolScopeUpdate[] {
  if (!input || typeof input !== "object") {
    throw new Error("Discovery tool scope update payload must be an object.");
  }

  const candidate = input as { tools?: unknown };
  if (!Array.isArray(candidate.tools)) {
    throw new Error("Discovery tool scope update payload must include a tools array.");
  }

  const updates: DiscoveryToolScopeUpdate[] = [];
  for (const rawTool of candidate.tools) {
    if (!rawTool || typeof rawTool !== "object") {
      throw new Error("Each discovery tool scope update must be an object.");
    }

    const tool = rawTool as Record<string, unknown>;
    const id = sanitizeText(tool.id);
    if (!id) {
      throw new Error("Each discovery tool scope update must include a tool id.");
    }

    updates.push({
      id,
      assetTypeScope: normalizeScope(tool.assetTypeScope, FALLBACK_SCOPE)
    });
  }

  return updates;
}

export function normalizeDiscoveryToolsScopeUpdate(
  input: unknown,
  existing: DiscoveryToolsSettings
): DiscoveryToolsSettings {
  const updates = parseScopeUpdates(input);
  const existingById = new Map(existing.tools.map((tool) => [tool.id, tool]));
  const updatedScopes = new Map<string, Record<AssetType, DiscoveryToolAssetSetting>>();
  const duplicateIds = new Set<string>();

  for (const update of updates) {
    if (updatedScopes.has(update.id)) {
      duplicateIds.add(update.id);
      continue;
    }
    const current = existingById.get(update.id);
    if (!current) {
      throw new Error(`Unknown discovery tool id in update payload: ${update.id}`);
    }
    updatedScopes.set(update.id, normalizeScope(update.assetTypeScope, current.assetTypeScope));
  }

  if (duplicateIds.size > 0) {
    throw new Error(`Duplicate discovery tool ids in update payload: ${Array.from(duplicateIds).join(", ")}`);
  }

  const missingIds = existing.tools.map((tool) => tool.id).filter((id) => !updatedScopes.has(id));
  if (missingIds.length > 0) {
    throw new Error(`Missing discovery tool ids in update payload: ${missingIds.join(", ")}`);
  }

  return {
    updatedAt: existing.updatedAt,
    tools: existing.tools.map((tool) => ({
      ...tool,
      assetTypeScope: { ...updatedScopes.get(tool.id)! }
    }))
  };
}

