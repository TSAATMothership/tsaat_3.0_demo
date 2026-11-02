import type { CmdbAttributeDefinition } from "@/lib/cmdb-attributes";
import type { CanonicalAssetType } from "@/lib/asset-taxonomy";
import { demoPackage } from "./package";
export async function loadCmdbAttributeDefinitions(assetType: CanonicalAssetType): Promise<CmdbAttributeDefinition[]> {
  const mappings = demoPackage().references["cmdb-attributes"] as Record<CanonicalAssetType, CmdbAttributeDefinition[]>;
  if (!Array.isArray(mappings[assetType])) throw new Error("Missing demo CMDB attribute mapping: " + assetType);
  return mappings[assetType];
}
