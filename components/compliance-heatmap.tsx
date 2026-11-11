"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { CmdbDeviceName } from "@/components/cmdb-drill-through";
import { formatAssetTypeLabel } from "@/lib/asset-taxonomy";
import { HEATMAP_COLORS, HEATMAP_HEADER_HEIGHT, HEATMAP_STATUSES, heatmapCellSize, heatmapRowWindow,
  type ComplianceHeatmapModel } from "@/lib/compliance-heatmap";

const symbols = ["✓", "×", "?", "—"];
const number = (value: number) => value.toLocaleString("en-AU");

export function ComplianceHeatmap({ model, active }: { model: ComplianceHeatmapModel; active: boolean }) {
  const id = useId();
  const viewportRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [includedStatuses, setIncludedStatuses] = useState([true, true, true]);
  const searchEntries = useMemo(() => model.devices.map(device => ({ device,
    text: [device.name, device.ip, device.id, device.assetType, formatAssetTypeLabel(device.assetType)].join(" ").toLowerCase()
  })), [model.devices]);
  const query = search.trim().toLowerCase();
  const searchedDevices = useMemo(() => query ? searchEntries.filter(entry => entry.text.includes(query)).map(entry => entry.device)
    : model.devices, [model.devices, query, searchEntries]);
  const statusCounts = useMemo(() => [0, 1, 2].map(status => searchedDevices.filter(device => device.status === status).length), [searchedDevices]);
  const devices = useMemo(() => searchedDevices.filter(device => includedStatuses[device.status]), [searchedDevices, includedStatuses]);
  const groups = useMemo(() => ({
    compliant: devices.filter(device => device.status === 0).length,
    nonCompliant: devices.filter(device => device.status === 1).length,
    unknown: devices.filter(device => device.status === 2).length
  }), [devices]);
  const [viewport, setViewport] = useState({ width: 900, height: 560 });
  const [scrollTop, setScrollTop] = useState(0);
  const [sizing, setSizing] = useState("40");
  const [cursor, setCursor] = useState({ row: 0, column: 0 });
  const labelWidth = viewport.width < 600 ? 156 : 232;
  const cellSize = sizing === "auto" ? heatmapCellSize(devices.length, model.spis.length, viewport.width, viewport.height, labelWidth) : Number(sizing);
  const previousCellSize = useRef(cellSize);
  const { start, end } = heatmapRowWindow(devices.length, cellSize, scrollTop, viewport.height);
  const rowIndex = Math.min(cursor.row, Math.max(0, devices.length - 1));
  const columnIndex = Math.min(cursor.column, Math.max(0, model.spis.length - 1));
  const device = devices[rowIndex];
  const spi = model.spis[columnIndex];
  const status = device?.cells[columnIndex];
  const cellId = (row: number, column: number) => `${id}-cell-${row}-${column}`;
  useEffect(() => {
    if (!active || !viewportRef.current) return;
    const element = viewportRef.current;
    const measure = () => setViewport({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [active, devices.length, model.spis.length]);
  useEffect(() => {
    setCursor({ row: 0, column: 0 });
    setScrollTop(0);
    if (viewportRef.current) viewportRef.current.scrollTop = 0;
  }, [model]);
  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (element && previousCellSize.current !== cellSize) {
      const oldSize = previousCellSize.current;
      const bodyHeight = element.clientHeight - HEATMAP_HEADER_HEIGHT;
      let nextTop = scrollTop / oldSize * cellSize;
      if (rowIndex * oldSize >= scrollTop && rowIndex * oldSize < scrollTop + bodyHeight) {
        nextTop = Math.max((rowIndex + 1) * cellSize - bodyHeight, Math.min(nextTop, rowIndex * cellSize));
      }
      element.scrollTop = nextTop;
      setScrollTop(element.scrollTop);
    }
    previousCellSize.current = cellSize;
  }, [cellSize, rowIndex, scrollTop]);

  const resetSelection = () => {
    setCursor(current => ({ row: 0, column: current.column }));
    setScrollTop(0);
    if (viewportRef.current) viewportRef.current.scrollTop = 0;
  };
  const changeSearch = (value: string) => {
    setSearch(value);
    resetSelection();
  };

  const inspect = (row: number, column: number) => {
    const element = viewportRef.current;
    setCursor({ row, column });
    if (!element) return;
    const bodyHeight = element.clientHeight - HEATMAP_HEADER_HEIGHT;
    if (row * cellSize < element.scrollTop) element.scrollTop = row * cellSize;
    else if ((row + 1) * cellSize > element.scrollTop + bodyHeight) element.scrollTop = (row + 1) * cellSize - bodyHeight;
    const left = labelWidth + column * cellSize;
    if (left < element.scrollLeft + labelWidth) element.scrollLeft = column * cellSize;
    else if (left + cellSize > element.scrollLeft + element.clientWidth) element.scrollLeft = left + cellSize - element.clientWidth;
    element.focus({ preventScroll: true });
  };
  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    let row = rowIndex, column = columnIndex;
    if (event.key === "ArrowDown") row++;
    else if (event.key === "ArrowUp") row--;
    else if (event.key === "ArrowRight") column++;
    else if (event.key === "ArrowLeft") column--;
    else if (event.key === "Home") { column = 0; if (event.ctrlKey || event.metaKey) row = 0; }
    else if (event.key === "End") { column = model.spis.length - 1; if (event.ctrlKey || event.metaKey) row = devices.length - 1; }
    else return;
    event.preventDefault();
    inspect(Math.max(0, Math.min(devices.length - 1, row)), Math.max(0, Math.min(model.spis.length - 1, column)));
  };

  return <section className="discovery-overview-panel compliance-heatmap" aria-labelledby={`${id}-title`}>
    <header className="compliance-heatmap-heading"><div><h2 id={`${id}-title`}>Compliance Heatmap</h2>
      <p role="status">{number(devices.length)} of {number(model.devices.length)} devices × {number(model.spis.length)} SPIs · current header scope and snapshot</p></div>
      <div className="compliance-heatmap-controls">
        <label className="compliance-heatmap-search">Search devices
          <input ref={searchInputRef} type="search" aria-label="Search compliance heatmap devices" placeholder="Name, IP, CI ID or asset type..."
            maxLength={500} value={search} onChange={event => changeSearch(event.target.value)} />
        </label>
        <button type="button" className="compliance-heatmap-clear" aria-label="Clear heatmap search" disabled={!search}
          onClick={() => { changeSearch(""); searchInputRef.current?.focus(); }}>Clear</button>
        <label>Square size <select className="report-sort" aria-label="Heatmap square size" value={sizing} onChange={event => setSizing(event.target.value)}>
        <option value="auto">Auto ({cellSize}px)</option><option value="20">20px</option><option value="28">28px</option><option value="40">40px</option>
      </select></label></div></header>
    <fieldset className="compliance-heatmap-filters">
      <legend>Show devices by status</legend>
      <div>{([0, 1, 2] as const).map(value => <label key={value} data-selected={includedStatuses[value]}>
        <input type="checkbox" checked={includedStatuses[value]} aria-label={`Show ${HEATMAP_STATUSES[value].toLowerCase()} devices`}
          style={{ accentColor: HEATMAP_COLORS[value] }} onChange={() => {
            setIncludedStatuses(current => current.map((included, index) => index === value ? !included : included));
            resetSelection();
          }} />
        {HEATMAP_STATUSES[value]} <span>{number(statusCounts[value])}</span>
      </label>)}
        <button type="button" className="compliance-heatmap-clear" aria-label="Show all device statuses" disabled={includedStatuses.every(Boolean)}
          onClick={() => { setIncludedStatuses([true, true, true]); resetSelection(); }}>Show all</button>
      </div>
    </fieldset>
    <div className="compliance-heatmap-legend" aria-label="Heatmap colour key">{HEATMAP_STATUSES.map((label, index) =>
      <span key={label}><i style={{ backgroundColor: HEATMAP_COLORS[index] }} aria-hidden="true">{symbols[index]}</i>{label}</span>)}</div>
    <div className="compliance-heatmap-order"><p>Devices: {([
      { label: "compliant", count: groups.compliant, first: 0 },
      { label: "non-compliant", count: groups.nonCompliant, first: groups.compliant },
      { label: "unknown", count: groups.unknown, first: groups.compliant + groups.nonCompliant }
    ]).map((group, index) => <span key={group.label}>{index > 0 && " → "}<button type="button" disabled={!group.count || !model.spis.length}
      title={`Jump to ${group.label} devices`} onClick={() => inspect(group.first, columnIndex)}>{number(group.count)} {group.label}</button></span>)}</p>
      <p>SPI severity: lowest <span aria-hidden="true">→</span> <strong>highest on the right</strong></p></div>
    {!devices.length || !model.spis.length ? <div className="endpoint-empty"><strong>{!model.devices.length ? "No devices in this scope"
      : !includedStatuses.some(Boolean) ? "No device statuses selected" : !devices.length ? "No matching devices" : "No enabled SPIs"}</strong>
      <p>{!model.devices.length ? "Select networks or ICT systems with devices, or choose another snapshot."
        : !includedStatuses.some(Boolean) ? "Select a device status or use Show all to restore all statuses."
        : !devices.length ? "Change the search or selected statuses to see matching devices." : "Enable SPIs to display device compliance."}</p></div> : <>
      <p className="discovery-overview-note" id={`${id}-instructions`}>Select a square to inspect its device and SPI. Use arrow keys to move between squares; Ctrl+Home / Ctrl+End moves to the first / last device. Scroll to review all devices.</p>
      <div className="compliance-heatmap-layout">
        <div ref={viewportRef} className="compliance-heatmap-viewport" role="grid" tabIndex={0} aria-label="Device compliance by SPI"
          aria-describedby={`${id}-instructions`} aria-rowcount={devices.length + 1} aria-colcount={model.spis.length + 1}
          aria-activedescendant={rowIndex >= start && rowIndex < end ? cellId(rowIndex, columnIndex) : undefined}
          onKeyDown={navigate} onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
          style={{ "--heatmap-cell": `${cellSize}px`, "--heatmap-label": `${labelWidth}px`, "--heatmap-header": `${HEATMAP_HEADER_HEIGHT}px` } as CSSProperties}>
          <table role="presentation" style={{ width: labelWidth + model.spis.length * cellSize }}>
            <colgroup><col style={{ width: labelWidth }} />{model.spis.map(column => <col key={column.id} style={{ width: cellSize }} />)}</colgroup>
            <thead role="rowgroup"><tr role="row" aria-rowindex={1}><th role="columnheader" scope="col" className="compliance-heatmap-corner">Device name<span>Grouped by compliance</span></th>
              {model.spis.map(column => <th role="columnheader" scope="col" key={column.id} title={`SPI-${column.id}: ${column.name}\nSeverity: ${column.severity}`}
                aria-label={`SPI-${column.id}: ${column.name}. Severity: ${column.severity}`}>
                <span className="compliance-heatmap-spi-label">SPI-{column.id} · {column.name}</span>
              </th>)}
            </tr></thead>
            <tbody role="rowgroup">
              {start > 0 && <tr aria-hidden="true" role="presentation"><td colSpan={model.spis.length + 1} style={{ height: start * cellSize }} /></tr>}
              {devices.slice(start, end).map((row, offset) => {
                const index = start + offset;
                return <tr role="row" aria-rowindex={index + 2} key={row.id} style={{ height: cellSize }}>
                  <th role="rowheader" scope="row" className="compliance-heatmap-device" title={`${row.name}\n${row.ip}\n${HEATMAP_STATUSES[row.status]}`}>
                    <span style={{ fontSize: cellSize < 20 ? 10 : 12 }}><i style={{ backgroundColor: HEATMAP_COLORS[row.status] }} aria-hidden="true" />{row.name}</span>
                  </th>
                  {row.cells.map((value, column) => {
                    const label = `${row.name} · SPI-${model.spis[column].id}: ${model.spis[column].name} · ${HEATMAP_STATUSES[value]}`;
                    return <td role="gridcell" id={cellId(index, column)} key={model.spis[column].id} aria-colindex={column + 2}
                      aria-selected={index === rowIndex && column === columnIndex} aria-label={label} title={label} onClick={() => inspect(index, column)}>
                      <span className="compliance-heatmap-square" style={{ backgroundColor: HEATMAP_COLORS[value], color: value === 3 ? "#a8c4d6" : undefined, fontSize: cellSize < 20 ? 9 : 13 }} aria-hidden="true">{symbols[value]}</span>
                    </td>;
                  })}
                </tr>;
              })}
              {end < devices.length && <tr aria-hidden="true" role="presentation"><td colSpan={model.spis.length + 1} style={{ height: (devices.length - end) * cellSize }} /></tr>}
            </tbody>
          </table>
        </div>
        <aside className="compliance-heatmap-detail" aria-label="Selected compliance result" aria-live="polite" aria-atomic="true">
          <p className="endpoint-eyebrow">Selected result</p>
          <h3><CmdbDeviceName assetId={device.id} name={device.name} /></h3>
          <p>{device.ip} · {formatAssetTypeLabel(device.assetType)}</p>
          <div className="compliance-heatmap-result"><i style={{ backgroundColor: HEATMAP_COLORS[status], color: status === 3 ? "#a8c4d6" : undefined }} aria-hidden="true">{symbols[status]}</i><strong>{HEATMAP_STATUSES[status]}</strong></div>
          <h4>SPI-{spi.id} · {spi.name}</h4><p>{spi.description}</p>
          <dl><div><dt>Severity for this device</dt><dd>{status === 3 ? "Not applicable" : spi.severityByAssetType[device.assetType] ?? spi.severity}</dd></div>
            <div><dt>Device results</dt><dd>{device.compliant} compliant · {device.nonCompliant} non-compliant · {device.unknown} unknown</dd></div></dl>
        </aside>
      </div>
      <p className="discovery-overview-note compliance-heatmap-method">A device is non-compliant if any applicable SPI fails, unknown if an applicable result is unknown or missing, and compliant when all applicable SPIs pass. Devices with no applicable checks are grouped under unknown. Dashes mean the SPI does not apply to that device type. Column order uses the highest configured SPI severity across applicable device types in scope; saved SPI Risk Matrix settings determine this order.</p>
    </>}
  </section>;
}
