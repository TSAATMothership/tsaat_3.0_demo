"use client";

import { RiskProfile } from "@/components/risk-profile";
import type { IctSystemRiskProfileModel } from "@/lib/ict-system-risk-profile";
import type { Filters } from "@/lib/types";

export function IctSystemRiskProfile({ model, filters, initialSystemId }: { model: IctSystemRiskProfileModel; filters: Filters; initialSystemId?: string }) {
  return <RiskProfile model={model} filters={filters} initialSystemId={initialSystemId} />;
}
