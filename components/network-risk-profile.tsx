"use client";

import { RiskProfile } from "@/components/risk-profile";
import type { NetworkRiskProfileModel } from "@/lib/network-risk-profile";
import type { Filters } from "@/lib/types";

export function NetworkRiskProfile({ model, filters, initialNetworkId }: { model: NetworkRiskProfileModel; filters: Filters; initialNetworkId?: string }) {
  return <RiskProfile model={model} filters={filters} initialNetworkId={initialNetworkId} />;
}
