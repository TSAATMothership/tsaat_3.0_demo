import "server-only";

import { isAssetType, type CanonicalAssetType } from "@/lib/asset-taxonomy";
import type { CmdbAttributeDefinition } from "@/lib/cmdb-attributes";
import { executeSqlJson, toSqlUnicodeLiteral } from "@/lib/sql-server";

/** Read current mappings each time so SQL changes apply when a device is reopened. */
export async function loadCmdbAttributeDefinitions(assetType: CanonicalAssetType): Promise<CmdbAttributeDefinition[]> {
  if (!isAssetType(assetType)) throw new Error("Unsupported CMDB asset type.");
  return executeSqlJson<CmdbAttributeDefinition[]>(`
    SELECT d.[attribute_key] AS [key], d.[label], m.[display_order] AS [displayOrder]
    FROM [tsaat].[cmdb_asset_type_attribute] AS m
    INNER JOIN [tsaat].[cmdb_attribute_definition] AS d ON d.[attribute_key] = m.[attribute_key]
    WHERE m.[asset_type] = ${toSqlUnicodeLiteral(assetType)} AND m.[is_enabled] = 1
    ORDER BY m.[display_order], d.[attribute_key]
    FOR JSON PATH;
  `);
}
