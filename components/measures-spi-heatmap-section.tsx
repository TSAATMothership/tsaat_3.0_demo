"use client";

import { useState } from "react";
import { MeasuresSpiFilters } from "@/components/measures-spi-filters";
import { MeasuresSpiHeatmap } from "@/components/measures-spi-heatmap";
import { PerformanceReportModel } from "@/lib/performance-report-model";
import { type SpiId } from "@/lib/types";

export function MeasuresSpiHeatmapSection({
  model,
  selectedSpiId,
  initialSearchValue,
  placeholder
}: {
  model: PerformanceReportModel;
  selectedSpiId?: SpiId;
  initialSearchValue: string;
  placeholder: string;
}) {
  const [searchValue, setSearchValue] = useState(initialSearchValue);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
      <MeasuresSpiFilters
        selectedSpiId={selectedSpiId}
        searchValue={searchValue}
        placeholder={placeholder}
        dynamicSearch
        onSearchValueChange={setSearchValue}
      />
      <div className="min-h-0 flex-1">
        <MeasuresSpiHeatmap model={model} selectedSpiId={selectedSpiId} searchValue={searchValue} />
      </div>
    </div>
  );
}
