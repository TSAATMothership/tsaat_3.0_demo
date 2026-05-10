type FindingSeverity = "High Risk" | "Critical Exposure" | "Major" | "Moderate" | "Data Gap";
type SecurityDomain = "Secret" | "Protected" | "Unclassified";

interface ImpactAnalyser2Row {
  findingId: string;
  systemId: string;
  systemName: string;
  environmentType: string | null;
  serverId: string;
  serverName: string;
  serverHostname: string;
  securityDomain: SecurityDomain;
  severity: FindingSeverity;
  spiId: number;
  spiLabel: string;
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
  environment: string;
  securityDomain: string;
  findingCriticality: string;
  search: string;
  selectedSearchOption: ImpactAnalyser2SelectedSearchOption | null;
}

interface ImpactAnalyser2Axis {
  key: string;
  label: string;
  values: string[];
}

interface ImpactAnalyser2SearchOption {
  id: string;
  label: string;
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
const searchCategoryOrder = ["ICT System", "Environment", "Server", "Finding Severity", "SPI", "Security Domain"];

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
  if (axisKey === "system") {
    return row.systemName;
  }
  if (axisKey === "environment") {
    return row.environmentType ?? "Unassigned";
  }
  if (axisKey === "server") {
    return row.serverName;
  }
  if (axisKey === "severity") {
    return row.severity;
  }
  return row.spiLabel;
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
  if (category === "ICT System") {
    return "system";
  }
  if (category === "Environment") {
    return "environment";
  }
  if (category === "Server") {
    return "server";
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
  normalizedSearch: string,
  limit: number
) {
  const normalizedLabel = label.trim();
  if (!normalizedLabel || options.size >= limit || !labelMatchesSearch(category, normalizedLabel, normalizedSearch)) {
    return;
  }
  const id = `${category}:${normalizedLabel.toLowerCase()}`;
  if (!options.has(id)) {
    options.set(id, { id, label: normalizedLabel, category, axisKey: axisKeyForSearchCategory(category) });
  }
}

function rowMatchesSearch(row: ImpactAnalyser2Row, normalizedSearch: string): boolean {
  if (!normalizedSearch) {
    return true;
  }
  const haystack = [
    row.systemName,
    row.environmentType ?? "Unassigned",
    row.serverName,
    row.serverHostname,
    row.severity,
    row.spiLabel,
    row.securityDomain
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(normalizedSearch);
}

function filterRows(rows: ImpactAnalyser2Row[], filters: ImpactAnalyser2Filters): ImpactAnalyser2Row[] {
  const normalizedSearch = filters.search.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.environment !== "all" && (row.environmentType ?? "Unassigned") !== filters.environment) {
      return false;
    }
    if (filters.securityDomain !== "all" && row.securityDomain !== filters.securityDomain) {
      return false;
    }
    if (filters.findingCriticality !== "all" && row.severity !== filters.findingCriticality) {
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

function buildAxes(filteredRows: ImpactAnalyser2Row[]): ImpactAnalyser2Axis[] {
  return [
    { key: "system", label: "ICT System", values: uniqueSorted(filteredRows.map((row) => row.systemName)) },
    {
      key: "environment",
      label: "Environment",
      values: Array.from(new Set(filteredRows.map((row) => row.environmentType ?? "Unassigned"))).sort(sortEnvironmentLabel)
    },
    { key: "server", label: "Server", values: uniqueSorted(filteredRows.map((row) => row.serverName)) },
    {
      key: "severity",
      label: "Finding Severity",
      values: severityOrder.filter((severity) => filteredRows.some((row) => row.severity === severity))
    },
    {
      key: "spi",
      label: "SPI",
      values: Array.from(new Set(filteredRows.map((row) => row.spiLabel))).sort(
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

function buildLineBuffers(params: {
  rows: ImpactAnalyser2Row[];
  axes: ImpactAnalyser2Axis[];
  axisMaps: Array<Map<string, number>>;
  width: number;
  left: number;
  right: number;
  virtualHeight: number;
  top: number;
  bottom: number;
}) {
  const segmentCount = params.rows.length * Math.max(0, params.axes.length - 1);
  const positions = new Float32Array(segmentCount * 2 * 3);
  const colors = new Float32Array(segmentCount * 2 * 3);
  let offset = 0;
  let colorOffset = 0;

  for (const row of params.rows) {
    const rowPoints = params.axes.map((axis, axisIndex) => {
      const innerWidth = Math.max(1, params.width - params.left - params.right);
      const x = params.left + (axisIndex * innerWidth) / Math.max(1, params.axes.length - 1);
      const y = virtualYForValue(
        axis,
        params.axisMaps[axisIndex],
        rowAxisValue(row, axis.key),
        params.virtualHeight,
        params.top,
        params.bottom
      );
      return { x, y };
    });
    const [red, green, blue] = severityRgb(row.severity);

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

  return { positions, colors };
}

function buildSearchOptions(
  rows: ImpactAnalyser2Row[],
  normalizedSearch: string,
  limit: number
): ImpactAnalyser2SearchOption[] {
  const options = new Map<string, ImpactAnalyser2SearchOption>();
  for (const row of rows) {
    addSearchOption(options, "ICT System", row.systemName, normalizedSearch, limit);
    addSearchOption(options, "Environment", row.environmentType ?? "Unassigned", normalizedSearch, limit);
    addSearchOption(options, "Server", row.serverName, normalizedSearch, limit);
    addSearchOption(options, "Finding Severity", row.severity, normalizedSearch, limit);
    addSearchOption(options, "SPI", row.spiLabel, normalizedSearch, limit);
    addSearchOption(options, "Security Domain", row.securityDomain, normalizedSearch, limit);
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
  const axes = buildAxes(filteredRows);
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
    width: request.layout.width,
    left: request.layout.left,
    right: request.layout.right,
    virtualHeight,
    top: request.layout.top,
    bottom: request.layout.bottom
  });
  const spiCounts = Array.from(
    filteredRows.reduce<Map<number, number>>((counts, row) => {
      counts.set(row.spiId, (counts.get(row.spiId) ?? 0) + 1);
      return counts;
    }, new Map())
  );
  const searchOptions = buildSearchOptions(
    filteredRows,
    normalizedSearch,
    request.searchOptionLimit
  );

  workerScope.postMessage(
    {
      type: "filtered",
      requestId: request.requestId,
      axes,
      filteredRowCount: filteredRows.length,
      totalRowCount: sourceRows.length,
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
      securityDomainOptions: Array.from(new Set(sourceRows.map((row) => row.securityDomain))).sort(
        (left, right) => securityDomainOrder.indexOf(left) - securityDomainOrder.indexOf(right)
      )
    });
    return;
  }

  handleFilterRequest(request);
};

export {};
