import "server-only";
import type { CmdbAttributeDefinition } from "@/lib/cmdb-attributes";
import { isCmdbCiType, type CmdbCiType } from "@/lib/cmdb-ci-types";
import { reference } from "./references";
export async function loadCmdbAttributeDefinitions(assetType: CmdbCiType): Promise<CmdbAttributeDefinition[]> {
  if (!isCmdbCiType(assetType)) throw new Error("Unsupported CMDB CI type.");
  const mappings = await reference<Record<CmdbCiType, CmdbAttributeDefinition[]>>("cmdb-attributes");
  if (!Array.isArray(mappings[assetType])) throw new Error("Missing JSON CMDB attribute mapping: " + assetType);
  return mappings[assetType];
}
