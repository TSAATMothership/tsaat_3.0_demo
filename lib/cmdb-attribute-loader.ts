import "server-only";
import { IS_JSON_BUILD } from "@/lib/data-provider-mode";
import { loadCmdbAttributeDefinitions as sql } from "@/lib/sql-cmdb-attribute-loader";
import { loadCmdbAttributeDefinitions as json } from "@/lib/json-store/cmdb-attributes";
export const loadCmdbAttributeDefinitions: typeof sql = IS_JSON_BUILD ? json : sql;
