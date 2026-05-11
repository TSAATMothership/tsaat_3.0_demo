type FindingSeverity = "High Risk" | "Critical Exposure" | "Major" | "Moderate" | "Data Gap";
type SecurityDomain = "Secret" | "Protected" | "Unclassified";

interface ImpactAnalyser2Row {
  findingId: string | null;
  systemId: string | null;
  systemName: string;
  environmentType: string | null;
  assetId: string;
  assetName: string;
  assetHostname: string;
  assetType: string;
  assetIpAddress: string;
  networkId: string;
  networkName: string;
  hasIctSystem: boolean;
  serverId: string;
  serverName: string;
  serverHostname: string;
  securityDomain: SecurityDomain;
  severity: FindingSeverity | null;
  spiId: number | null;
  spiLabel: string;
  hasOpenFinding: boolean;
}

interface ImpactAnalyser2SelectedNode {
  axisKey: string;
  value: string;
}

interface ImpactAnalyser2SelectedSearchOption {
  axisKey: string;
  value: string;
  label: string;
  category: string;
}

interface ImpactAnalyser2Filters {
  environment: string[];
  securityDomain: string[];
  findingCriticality: string[];
  assetType: string[];
  search: string;
  selectedSearchOption: ImpactAnalyser2SelectedSearchOption | null;
  systemIds: string[] | null;
}

interface ImpactAnalyser2Axis {
  key: string;
  label: string;
  values: string[];
}

interface ImpactAnalyser2SearchOption {
  id: string;
  label: string;
  value: string;
  category: string;
  axisKey: string;
}

type WorkerRequest =
  | {
      type: "init";
      rows: ImpactAnalyser2Row[];
    }
  | {
      type: "filter";
      requestId: number;
      filters: ImpactAnalyser2Filters;
      selectedNode: ImpactAnalyser2SelectedNode | null;
      layout: {
        assetAxisLabel: string;
        assetSearchCategory: string;
        includeNetworkAxis: boolean;
        width: number;
        left: number;
        right: number;
        top: number;
        bottom: number;
        rowGap: number;
        minHeight: number;
      };
      searchOptionLimit: number;
    };

const workerScope = self as unknown as {
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
};
const environmentOrder = ["Production", "Development", "UAT", "Test", "Unassigned"];
const severityOrder: FindingSeverity[] = ["Critical Exposure", "High Risk", "Major", "Moderate", "Data Gap"];
const securityDomainOrder: SecurityDomain[] = ["Secret", "Protected", "Unclassified"];
const assetTypeOrder = ["server", "workstation", "network-device", "storage-device", "printer-device", "other"];
const searchCategoryOrder = [
  "Network",
  "ICT System",
  "Environment",
  "Assets",
  "Server",
  "Asset Type",
  "Finding Severity",
  "SPI",
  "Security Domain"
];

let sourceRows: ImpactAnalyser2Row[] = [];

function sortEnvironmentLabel(left: string, right: string): number {
  const leftIndex = environmentOrder.indexOf(left);
  const rightIndex = environmentOrder.indexOf(right);
  if (leftIndex !== rightIndex) {
    return (leftIndex === -1 ? environmentOrder.length : leftIndex) - (rightIndex === -1 ? environmentOrder.length : rightIndex);
  }
  return left.localeCompare(right);
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function rowAxisValue(row: ImpactAnalyser2Row, axisKey: string): string {
  if (axisKey === "network") {
    return row.networkName;
  }
  if (axisKey === "system") {
    return row.hasIctSystem ? row.systemName : "";
  }
  if (axisKey === "environment") {
    return row.hasIctSystem ? row.environmentType ?? "Unassigned" : "";
  }
  if (axisKey === "asset") {
    return row.assetId;
  }
  if (axisKey === "server") {
    return row.serverName;
  }
  if (axisKey === "severity") {
    return row.severity ?? "";
  }
  if (axisKey === "assetType") {
    return row.assetType;
  }
  return row.spiLabel;
}

function rowHasFindingPath(row: ImpactAnalyser2Row): boolean {
  return Boolean(row.findingId && row.hasOpenFinding && row.severity && row.spiId && row.spiLabel);
}

function severityRgb(severity: FindingSeverity): [number, number, number] {
  if (severity === "Critical Exposure") {
    return [239 / 255, 68 / 255, 68 / 255];
  }
  if (severity === "High Risk") {
    return [249 / 255, 115 / 255, 22 / 255];
  }
  if (severity === "Major") {
    return [245 / 255, 158 / 255, 11 / 255];
  }
  if (severity === "Moderate") {
    return [56 / 255, 189 / 255, 248 / 255];
  }
  return [148 / 255, 163 / 255, 184 / 255];
}

function labelMatchesSearch(category: string, label: string, normalizedSearch: string): boolean {
  return !normalizedSearch || `${category} ${label}`.toLowerCase().includes(normalizedSearch);
}

function axisKeyForSearchCategory(category: string): string {
  if (category === "Network") {
    return "network";
  }
  if (category === "ICT System") {
    return "system";
  }
  if (category === "Environment") {
    return "environment";
  }
  if (category === "Assets" || category === "Server") {
    return "asset";
  }
  if (category === "Asset Type") {
    return "assetType";
  }
  if (category === "Finding Severity") {
    return "severity";
  }
  if (category === "SPI") {
    return "spi";
  }
  return "securityDomain";
}

function addSearchOption(
  options: Map<string, ImpactAnalyser2SearchOption>,
  category: string,
  label: string,
  value: string,
  normalizedSearch: string,
  limit: number
) {
  const normalizedLabel = label.trim();
  if (!normalizedLabel || options.size >= limit || !labelMatchesSearch(category, normalizedLabel, normalizedSearch)) {
    return;
  }
  const normalizedValue = value.trim();
  const id = `${category}:${normalizedValue.toLowerCase()}`;
  if (!options.has(id)) {
    options.set(id, { id, label: normalizedLabel, value: normalizedValue, category, axisKey: axisKeyForSearchCategory(category) });
  }
}

function rowMatchesSearch(row: ImpactAnalyser2Row, normalizedSearch: string): boolean {
  if (!normalizedSearch) {
    return true;
  }
  const haystack = [
    row.networkName,
    row.systemName,
    row.hasIctSystem ? row.environmentType ?? "Unassigned" : "",
    row.assetName,
    row.assetHostname,
    row.assetType,
    row.serverName,
    row.serverHostname,
    row.severity ?? "",
    row.spiLabel,
    row.securityDomain
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(normalizedSearch);
}

function matchesMultiFilter(values: string[], rowValue: string | null | undefined): boolean {
  return !values.length || values.includes(rowValue ?? "");
}

function filterRows(rows: ImpactAnalyser2Row[], filters: ImpactAnalyser2Filters): ImpactAnalyser2Row[] {
  const normalizedSearch = filters.search.trim().toLowerCase();
  const systemIdFilter = filters.systemIds ? new Set(filters.systemIds) : null;
  return rows.filter((row) => {
    if (systemIdFilter && (!row.systemId || !systemIdFilter.has(row.systemId))) {
      return false;
    }
    if (!matchesMultiFilter(filters.assetType, row.assetType)) {
      return false;
    }
    if (!matchesMultiFilter(filters.environment, row.environmentType ?? "Unassigned")) {
      return false;
    }
    if (!matchesMultiFilter(filters.securityDomain, row.securityDomain)) {
      return false;
    }
    if (!matchesMultiFilter(filters.findingCriticality, row.severity)) {
      return false;
    }
    if (filters.selectedSearchOption) {
      return rowAxisValue(row, filters.selectedSearchOption.axisKey) === filters.selectedSearchOption.value;
    }
    if (!rowMatchesSearch(row, normalizedSearch)) {
      return false;
    }
    return true;
  });
}

function buildAxes(filteredRows: ImpactAnalyser2Row[], includeNetworkAxis: boolean): ImpactAnalyser2Axis[] {
  const assetNameById = new Map(filteredRows.map((row) => [row.assetId, row.assetName || row.assetHostname || row.assetId]));
  const findingRows = filteredRows.filter(rowHasFindingPath);
  return [
    ...(includeNetworkAxis
      ? [
          {
            key: "network",
            label: "Network",
            values: uniqueSorted(filteredRows.map((row) => row.networkName).filter(Boolean))
          }
        ]
      : []),
    {
      key: "system",
      label: "ICT System",
      values: uniqueSorted(
        filteredRows
          .filter((row) => !includeNetworkAxis || row.hasIctSystem)
          .map((row) => row.systemName)
          .filter(Boolean)
      )
    },
    {
      key: "environment",
      label: "Environment",
      values: Array.from(
        new Set(
          filteredRows
            .filter((row) => !includeNetworkAxis || row.hasIctSystem)
            .map((row) => row.environmentType ?? "Unassigned")
        )
      ).sort(sortEnvironmentLabel)
    },
    {
      key: "asset",
      label: "Assets",
      values: uniqueSorted(filteredRows.map((row) => row.assetId)).sort((left, right) =>
        (assetNameById.get(left) ?? left).localeCompare(assetNameById.get(right) ?? right)
      )
    },
    {
      key: "severity",
      label: "Finding Severity",
      values: severityOrder.filter((severity) => findingRows.some((row) => row.severity === severity))
    },
    {
      key: "spi",
      label: "SPI",
      values: Array.from(new Set(findingRows.map((row) => row.spiLabel).filter(Boolean))).sort(
        (left, right) => Number(left.replace("SPI ", "")) - Number(right.replace("SPI ", ""))
      )
    }
  ];
}

function buildAxisMaps(axes: ImpactAnalyser2Axis[]): Array<Map<string, number>> {
  return axes.map((axis) => new Map(axis.values.map((value, index) => [value, index])));
}

function virtualYForValue(
  axis: ImpactAnalyser2Axis,
  axisMap: Map<string, number>,
  value: string,
  virtualHeight: number,
  top: number,
  bottom: number
): number {
  const valueIndex = Math.max(0, axisMap.get(value) ?? 0);
  const innerHeight = Math.max(1, virtualHeight - top - bottom);
  if (axis.values.length <= 1) {
    return top + innerHeight / 2;
  }
  return top + (valueIndex * innerHeight) / (axis.values.length - 1);
}

function rowPathAxisKeys(row: ImpactAnalyser2Row, includeNetworkAxis: boolean): string[] {
  const keys: string[] = [];
  if (includeNetworkAxis) {
    keys.push("network");
  }
  if (!includeNetworkAxis || row.hasIctSystem) {
    keys.push("system", "environment");
  }
  keys.push("asset");
  if (rowHasFindingPath(row)) {
    keys.push("severity", "spi");
  }
  return keys;
}

function buildLineBuffers(params: {
  rows: ImpactAnalyser2Row[];
  axes: ImpactAnalyser2Axis[];
  axisMaps: Array<Map<string, number>>;
  includeNetworkAxis: boolean;
  width: number;
  left: number;
  right: number;
  virtualHeight: number;
  top: number;
  bottom: number;
}) {
  const axisIndexByKey = new Map(params.axes.map((axis, index) => [axis.key, index]));
  const drawableRows = params.rows
    .map((row) => ({ row, pathKeys: rowPathAxisKeys(row, params.includeNetworkAxis) }))
    .filter(({ pathKeys }) => pathKeys.length > 1);
  const segmentCount = drawableRows.reduce((total, { pathKeys }) => total + Math.max(0, pathKeys.length - 1), 0);
  const positions = new Float32Array(segmentCount * 2 * 3);
  const colors = new Float32Array(segmentCount * 2 * 3);
  let offset = 0;
  let colorOffset = 0;

  for (const { row, pathKeys } of drawableRows) {
    const rowPoints: Array<{ x: number; y: number }> = [];
    let rowCanDraw = true;
    for (const axisKey of pathKeys) {
      const axisIndex = axisIndexByKey.get(axisKey);
      if (axisIndex === undefined) {
        rowCanDraw = false;
        break;
      }
      const axis = params.axes[axisIndex];
      const value = rowAxisValue(row, axis.key);
      if (!value || !params.axisMaps[axisIndex].has(value)) {
        rowCanDraw = false;
        break;
      }
      const innerWidth = Math.max(1, params.width - params.left - params.right);
      const x = params.left + (axisIndex * innerWidth) / Math.max(1, params.axes.length - 1);
      const y = virtualYForValue(
        axis,
        params.axisMaps[axisIndex],
        value,
        params.virtualHeight,
        params.top,
        params.bottom
      );
      rowPoints.push({ x, y });
    }
    if (!rowCanDraw || rowPoints.length < 2) {
      continue;
    }
    const [red, green, blue] = rowHasFindingPath(row)
      ? severityRgb(row.severity ?? "Data Gap")
      : [56 / 255, 189 / 255, 248 / 255];

    for (let index = 0; index < rowPoints.length - 1; index += 1) {
      const from = rowPoints[index];
      const to = rowPoints[index + 1];
      positions[offset++] = from.x;
      positions[offset++] = from.y;
      positions[offset++] = 0;
      positions[offset++] = to.x;
      positions[offset++] = to.y;
      positions[offset++] = 0;
      colors[colorOffset++] = red;
      colors[colorOffset++] = green;
      colors[colorOffset++] = blue;
      colors[colorOffset++] = red;
      colors[colorOffset++] = green;
      colors[colorOffset++] = blue;
    }
  }

  return { positions: positions.slice(0, offset), colors: colors.slice(0, colorOffset) };
}

function buildSearchOptions(
  rows: ImpactAnalyser2Row[],
  normalizedSearch: string,
  limit: number,
  assetSearchCategory: string,
  includeNetworkAxis: boolean
): ImpactAnalyser2SearchOption[] {
  const options = new Map<string, ImpactAnalyser2SearchOption>();
  for (const row of rows) {
    if (includeNetworkAxis) {
      addSearchOption(options, "Network", row.networkName, row.networkName, normalizedSearch, limit);
    }
    if (!includeNetworkAxis || row.hasIctSystem) {
      addSearchOption(options, "ICT System", row.systemName, row.systemName, normalizedSearch, limit);
      addSearchOption(options, "Environment", row.environmentType ?? "Unassigned", row.environmentType ?? "Unassigned", normalizedSearch, limit);
    }
    addSearchOption(options, assetSearchCategory, row.assetName || row.assetHostname || row.assetId, row.assetId, normalizedSearch, limit);
    addSearchOption(options, "Asset Type", row.assetType, row.assetType, normalizedSearch, limit);
    if (row.severity) {
      addSearchOption(options, "Finding Severity", row.severity, row.severity, normalizedSearch, limit);
    }
    if (row.spiLabel) {
      addSearchOption(options, "SPI", row.spiLabel, row.spiLabel, normalizedSearch, limit);
    }
    addSearchOption(options, "Security Domain", row.securityDomain, row.securityDomain, normalizedSearch, limit);
    if (options.size >= limit) {
      break;
    }
  }
  return Array.from(options.values()).sort((left, right) => {
    const categoryDelta = searchCategoryOrder.indexOf(left.category) - searchCategoryOrder.indexOf(right.category);
    return categoryDelta || left.label.localeCompare(right.label);
  });
}

function handleFilterRequest(request: Extract<WorkerRequest, { type: "filter" }>) {
  const filteredRows = filterRows(sourceRows, request.filters);
  const normalizedSearch = request.filters.search.trim().toLowerCase();
  const axes = buildAxes(filteredRows, request.layout.includeNetworkAxis);
  const assetAxis = axes.find((axis) => axis.key === "asset");
  if (assetAxis) {
    assetAxis.label = request.layout.assetAxisLabel;
  }
  const axisMaps = buildAxisMaps(axes);
  const maxAxisCount = Math.max(1, ...axes.map((axis) => axis.values.length));
  const virtualHeight = Math.max(request.layout.minHeight, maxAxisCount * request.layout.rowGap + request.layout.top + request.layout.bottom);
  const selectedRows = request.selectedNode
    ? filteredRows.filter((row) => rowAxisValue(row, request.selectedNode?.axisKey ?? "") === request.selectedNode?.value)
    : [];
  const baseBuffers = buildLineBuffers({
    rows: filteredRows,
    axes,
    axisMaps,
    includeNetworkAxis: request.layout.includeNetworkAxis,
    width: request.layout.width,
    left: request.layout.left,
    right: request.layout.right,
    virtualHeight,
    top: request.layout.top,
    bottom: request.layout.bottom
  });
  const highlightBuffers = buildLineBuffers({
    rows: selectedRows,
    axes,
    axisMaps,
    includeNetworkAxis: request.layout.includeNetworkAxis,
    width: request.layout.width,
    left: request.layout.left,
    right: request.layout.right,
    virtualHeight,
    top: request.layout.top,
    bottom: request.layout.bottom
  });
  const spiCounts = Array.from(
    filteredRows.reduce<Map<number, number>>((counts, row) => {
      if (!row.spiId) {
        return counts;
      }
      counts.set(row.spiId, (counts.get(row.spiId) ?? 0) + 1);
      return counts;
    }, new Map())
  );
  const searchOptions = buildSearchOptions(
    filteredRows,
    normalizedSearch,
    request.searchOptionLimit,
    request.layout.assetSearchCategory,
    request.layout.includeNetworkAxis
  );
  const filteredFindingRowCount = filteredRows.filter(rowHasFindingPath).length;
  const filteredAssetCount = new Set(filteredRows.map((row) => row.assetId)).size;

  workerScope.postMessage(
    {
      type: "filtered",
      requestId: request.requestId,
      axes,
      filteredRowCount: filteredRows.length,
      totalRowCount: sourceRows.length,
      filteredFindingRowCount,
      filteredAssetCount,
      highlightedRowCount: selectedRows.length,
      virtualHeight,
      basePositions: baseBuffers.positions,
      baseColors: baseBuffers.colors,
      highlightPositions: highlightBuffers.positions,
      highlightColors: highlightBuffers.colors,
      spiCounts,
      searchOptions
    },
    [
      baseBuffers.positions.buffer,
      baseBuffers.colors.buffer,
      highlightBuffers.positions.buffer,
      highlightBuffers.colors.buffer
    ]
  );
}

workerScope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request.type === "init") {
    sourceRows = request.rows;
    workerScope.postMessage({
      type: "initialized",
      totalRowCount: sourceRows.length,
      environmentOptions: Array.from(new Set(sourceRows.map((row) => row.environmentType ?? "Unassigned"))).sort(sortEnvironmentLabel),
      assetTypeOptions: assetTypeOrder.filter((assetType) => sourceRows.some((row) => row.assetType === assetType)),
      securityDomainOptions: Array.from(new Set(sourceRows.map((row) => row.securityDomain))).sort(
        (left, right) => securityDomainOrder.indexOf(left) - securityDomainOrder.indexOf(right)
      )
    });
    return;
  }

  handleFilterRequest(request);
};

export {};
