"use client";

import { RiskProfile } from "@/components/risk-profile";
import type { IctSystemRiskProfileModel } from "@/lib/ict-system-risk-profile";
import type { Filters } from "@/lib/types";

export function IctSystemRiskProfile({ model, filters }: { model: IctSystemRiskProfileModel; filters: Filters }) {
  return <RiskProfile model={model} filters={filters} />;
}
