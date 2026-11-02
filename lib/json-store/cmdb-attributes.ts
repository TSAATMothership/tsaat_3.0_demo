import "server-only";
import type { CmdbAttributeDefinition } from "@/lib/cmdb-attributes";
import type { CanonicalAssetType } from "@/lib/asset-taxonomy";
import { reference } from "./references";
export async function loadCmdbAttributeDefinitions(assetType: CanonicalAssetType): Promise<CmdbAttributeDefinition[]> {
  const mappings = await reference<Record<CanonicalAssetType, CmdbAttributeDefinition[]>>("cmdb-attributes");
  if (!Array.isArray(mappings[assetType])) throw new Error("Missing JSON CMDB attribute mapping: " + assetType);
  return mappings[assetType];
}
