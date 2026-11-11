import { ASSET_TYPES, formatAssetTypeLabel } from "@/lib/asset-taxonomy";
import type { Asset, ICTSystem, ManagedNetwork } from "@/lib/types";

export interface RiskEntityDetailsModel {
  id: string;
  name: string;
  securityDomain: ManagedNetwork["securityDomain"];
  description: string;
  owner: string;
  supportEmail: string;
  serviceCatalogueUrl: string;
  atoNumber: string;
  grcUrl: string;
  diisId: string;
  diisUrl: string;
  assetCount: number;
  assetFootprint: Array<{ type: Asset["type"]; label: string; count: number }>;
}

export function buildRiskEntityDetails(entity: ManagedNetwork | ICTSystem, assets: Asset[]): RiskEntityDetailsModel {
  const counts = new Map<Asset["type"], number>();
  for (const asset of assets) counts.set(asset.type, (counts.get(asset.type) ?? 0) + 1);
  return {
    id: entity.id, name: entity.name, securityDomain: entity.securityDomain,
    description: entity.description?.trim() || "", owner: entity.owner?.trim() || "",
    supportEmail: entity.supportEmail?.trim() || "", serviceCatalogueUrl: entity.serviceCatalogueUrl?.trim() || "",
    atoNumber: entity.atoNumber?.trim() || "", grcUrl: entity.grcUrl?.trim() || "",
    diisId: entity.diisId?.trim() || "", diisUrl: entity.diisUrl?.trim() || "",
    assetCount: assets.length,
    assetFootprint: ASSET_TYPES.map(type => ({ type, label: formatAssetTypeLabel(type), count: counts.get(type) ?? 0 }))
  };
}
