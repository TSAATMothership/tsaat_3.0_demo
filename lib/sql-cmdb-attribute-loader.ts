import "server-only";

import { isCmdbCiType, isModelCiType, type CmdbCiType } from "@/lib/cmdb-ci-types";
import type { CmdbAttributeDefinition } from "@/lib/cmdb-attributes";
import { executeSqlJson, toSqlUnicodeLiteral } from "@/lib/sql-server";

/** Read current mappings each time so SQL changes apply when a device is reopened. */
export async function loadCmdbAttributeDefinitions(assetType: CmdbCiType): Promise<CmdbAttributeDefinition[]> {
  if (!isCmdbCiType(assetType)) throw new Error("Unsupported CMDB CI type.");
  return executeSqlJson<CmdbAttributeDefinition[]>(`
    ${isModelCiType(assetType) ? `IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'tsaat.cmdb_asset_type_attribute') AND minor_id = 0 AND name = N'TSAAT_Model_CI_Mappings_v1') THROW 51032, 'Apply the model CI CMDB migration.', 1;` : ""}
    SELECT d.[attribute_key] AS [key], d.[label], m.[display_order] AS [displayOrder]
    FROM [tsaat].[cmdb_asset_type_attribute] AS m
    INNER JOIN [tsaat].[cmdb_attribute_definition] AS d ON d.[attribute_key] = m.[attribute_key]
    WHERE m.[asset_type] = ${toSqlUnicodeLiteral(assetType)} AND m.[is_enabled] = 1
    ORDER BY m.[display_order], d.[attribute_key]
    FOR JSON PATH;
  `);
}
