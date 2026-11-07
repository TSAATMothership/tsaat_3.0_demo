import { isAssetType, type CanonicalAssetType } from "@/lib/asset-taxonomy";

/** Model CIs have their own recorded identities; they are not endpoint inventory. */
export const MODEL_CI_TYPES = ["business-service", "mission-capability"] as const;
export type ModelCiType = typeof MODEL_CI_TYPES[number];
export type CmdbCiType = CanonicalAssetType | ModelCiType;
export const isModelCiType = (value: unknown): value is ModelCiType =>
  value === "business-service" || value === "mission-capability";
export const isCmdbCiType = (value: unknown): value is CmdbCiType => isAssetType(value) || isModelCiType(value);
export const modelCiTopologyId = (type: ModelCiType, id: string) => `${type === "business-service" ? "business" : "mission"}:${id}`;
