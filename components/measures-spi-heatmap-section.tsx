"use client";

import { useEffect, useState } from "react";
import { MeasuresSpiFilters } from "@/components/measures-spi-filters";
import { MeasuresSpiHeatmap } from "@/components/measures-spi-heatmap";
import { PerformanceReportModel } from "@/lib/performance-report-model";
import { type SpiId } from "@/lib/types";

export function MeasuresSpiHeatmapSection({
  model,
  selectedSpiId,
  initialSearchValue,
  placeholder,
  localSpiFilter = false
}: {
  model: PerformanceReportModel;
  selectedSpiId?: SpiId;
  initialSearchValue: string;
  placeholder: string;
  localSpiFilter?: boolean;
}) {
  const [searchValue, setSearchValue] = useState(initialSearchValue);
  const [localSelectedSpiId, setLocalSelectedSpiId] = useState<SpiId | undefined>(selectedSpiId);
  const effectiveSelectedSpiId = localSpiFilter ? localSelectedSpiId : selectedSpiId;

  useEffect(() => {
    if (localSpiFilter) {
      setLocalSelectedSpiId(selectedSpiId);
    }
  }, [localSpiFilter, selectedSpiId]);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
      <MeasuresSpiFilters
        selectedSpiId={effectiveSelectedSpiId}
        searchValue={searchValue}
        placeholder={placeholder}
        dynamicSearch
        localSpiFilter={localSpiFilter}
        onSearchValueChange={setSearchValue}
        onSelectedSpiIdChange={setLocalSelectedSpiId}
      />
      <div className="min-h-0 flex-1">
        <MeasuresSpiHeatmap model={model} selectedSpiId={effectiveSelectedSpiId} searchValue={searchValue} />
      </div>
    </div>
  );
}
