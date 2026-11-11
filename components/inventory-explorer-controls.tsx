"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { hasExplorerNumberRange, type ExplorerNumberRange, type ExplorerSortDirection } from "@/lib/explorer-table";

type Count = { value: string; count: number };
const number = (value: number) => value.toLocaleString("en-AU");
const toggle = (values: string[], value: string) => values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
// Client placement must finish before paint; server-rendered closed controls need no layout work.
const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function FilterHeader({ column, selected, options, open, onOpen, onChange, layer, range, sort, valueLabel }: {
  layer?: number; column: { key: string; label: string }; selected: string[]; options: Count[]; open: boolean;
  onOpen: (open: boolean) => void; onChange: (values: string[]) => void;
  valueLabel?: (value: string) => string;
  range?: { selected?: ExplorerNumberRange; unit: string; min?: number; step?: number; onChange: (value: ExplorerNumberRange) => void };
  sort?: { direction?: ExplorerSortDirection; onChange: (direction?: ExplorerSortDirection) => void };
}) {
  const popupId = useId();
  const [search, setSearch] = useState("");
  const [minimum, setMinimum] = useState("");
  const [maximum, setMaximum] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0, maxHeight: 420, maxWidth: 312 });
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const minimumInput = useRef<HTMLInputElement>(null);
  useClientLayoutEffect(() => {
    if (!open) return;
    setSearch("");
    setMinimum(range?.selected?.min === undefined ? "" : String(range.selected.min));
    setMaximum(range?.selected?.max === undefined ? "" : String(range.selected.max));
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const maxHeight = Math.min(range ? 560 : 420, window.innerHeight - 24);
      const below = window.innerHeight - rect.bottom - 12;
      // A stable scrollbar gutter can reserve space even when clientWidth reports the full viewport.
      const viewportWidth = Math.min(document.documentElement.clientWidth, document.documentElement.getBoundingClientRect().width);
      setPosition({ left: Math.max(12, Math.min(rect.left, viewportWidth - 324)), maxWidth: Math.max(0, viewportWidth - 24),
        top: below >= 240 ? rect.bottom + 6 : Math.max(12, rect.top - maxHeight - 6),
        maxHeight: Math.max(180, below >= 240 ? Math.min(maxHeight, below) : Math.min(maxHeight, rect.top - 18)) });
    };
    place(); (range ? minimumInput.current : input.current)?.focus({ preventScroll: true });
    const dismiss = (event: PointerEvent) => {
      if (!popup.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) onOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onOpen(false); trigger.current?.focus(); }
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape);
    };
  // Keep the search and focus stable as a selection updates the available facets.
  }, [open]);
  const allOptions = [...options];
  for (const value of selected) if (!allOptions.some((option) => option.value === value)) allOptions.push({ value, count: 0 });
  const displayValue = (value: string) => valueLabel?.(value) ?? value;
  const matches = allOptions.filter((option) => [option.value, displayValue(option.value)].some(value => value.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())))
    .sort((a, b) => displayValue(a.value).localeCompare(displayValue(b.value), undefined, { numeric: true }));
  const rangeActive = hasExplorerNumberRange(range?.selected);
  const reversedRange = minimum !== "" && maximum !== "" && Number(minimum) > Number(maximum);
  const clearRange = () => { setMinimum(""); setMaximum(""); range?.onChange({}); };
  return <>
    <button ref={trigger} type="button" className={`endpoint-column-trigger ${selected.length || rangeActive || sort?.direction ? "is-filtered" : ""}`}
      aria-label={`Filter ${column.label}${selected.length ? `, ${selected.length} selected` : ""}${rangeActive ? ", range applied" : ""}${sort?.direction ? `, sorted ${sort.direction === "desc" ? "largest to smallest" : "smallest to largest"}` : ""}`} aria-expanded={open}
      aria-haspopup="dialog" aria-controls={`endpoint-filter-${popupId}`} onClick={() => onOpen(!open)}>
      <span>{column.label}</span>{selected.length > 0 && <span className="endpoint-filter-count">{selected.length}</span>}
      {rangeActive && <span className="endpoint-filter-count">Range</span>}
      {sort?.direction && <span aria-hidden="true">{sort.direction === "desc" ? "\u2193" : "\u2191"}</span>}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    {open && createPortal(<div ref={popup} role="dialog" id={`endpoint-filter-${popupId}`} aria-label={`Filter ${column.label}`}
      className={`endpoint-filter-popup${range ? " has-range" : ""}`} style={{ ...position, zIndex: layer }} onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget) && !trigger.current?.contains(event.relatedTarget)) onOpen(false);
      }}>
      <div className="endpoint-filter-popup-title"><strong>{column.label}</strong><button type="button" aria-label={`Close ${column.label} filter`} onClick={() => { onOpen(false); trigger.current?.focus(); }}>×</button></div>
      {sort && <div className="endpoint-filter-sort" role="group" aria-label={`${column.label} sort order`}>
        <strong>Sort</strong>
        {(["desc", "asc"] as const).map(direction => <button key={direction} type="button" aria-pressed={sort.direction === direction} onClick={() => {
          sort.onChange(direction); onOpen(false); trigger.current?.focus();
        }}><span aria-hidden="true">{direction === "desc" ? "\u2193" : "\u2191"}</span>{direction === "desc" ? "Largest to smallest" : "Smallest to largest"}</button>)}
        <button type="button" className="endpoint-clear-sort" disabled={!sort.direction} onClick={() => { sort.onChange(); onOpen(false); trigger.current?.focus(); }}>Clear sort</button>
      </div>}
      {range && <form className="endpoint-filter-range" aria-label={`${column.label} range`} onSubmit={(event) => {
        event.preventDefault();
        if (reversedRange || !event.currentTarget.checkValidity()) return;
        range.onChange({ min: minimum === "" ? undefined : Number(minimum), max: maximum === "" ? undefined : Number(maximum) });
        onOpen(false); trigger.current?.focus();
      }}>
        <strong>Range ({range.unit})</strong>
        <div className="endpoint-filter-range-inputs">
          <label>Minimum {range.unit}<input ref={minimumInput} type="number" min={range.min} step={range.step ?? "any"} placeholder="No minimum"
            value={minimum} onChange={(event) => setMinimum(event.target.value)} aria-invalid={reversedRange} aria-describedby={reversedRange ? `endpoint-range-error-${popupId}` : undefined} /></label>
          <label>Maximum {range.unit}<input type="number" min={range.min} step={range.step ?? "any"} placeholder="No maximum"
            value={maximum} onChange={(event) => setMaximum(event.target.value)} aria-invalid={reversedRange} aria-describedby={reversedRange ? `endpoint-range-error-${popupId}` : undefined} /></label>
        </div>
        {reversedRange && <p className="endpoint-filter-range-error" id={`endpoint-range-error-${popupId}`} role="alert">Maximum must be at least minimum.</p>}
        <div className="endpoint-filter-actions"><button type="button" onClick={clearRange}>Clear range</button><button type="submit" disabled={reversedRange}>Apply range</button></div>
      </form>}
      <input ref={input} type="search" aria-label={`Search ${column.label} values`} placeholder={`Search ${column.label.toLowerCase()}...`}
        value={search} onChange={(event) => setSearch(event.target.value)} />
      <div className="endpoint-filter-actions"><button type="button" onClick={() => { onChange([]); if (range) clearRange(); }}>Clear filter</button>
        <button type="button" disabled={!matches.length} onClick={() => onChange([...new Set([...selected, ...matches.map((option) => option.value)])])}>Select matches</button></div>
      <div className="endpoint-filter-values">{matches.slice(0, 150).map((option) => <label key={option.value}>
        <input type="checkbox" checked={selected.includes(option.value)} onChange={() => onChange(toggle(selected, option.value))} />
        <span title={displayValue(option.value)}>{displayValue(option.value)}</span><small>{number(option.count)}</small>
      </label>)}{matches.length === 0 && <p>No matching values.</p>}</div>
      <p className="endpoint-filter-hint">{matches.length > 150 ? `Showing 150 of ${number(matches.length)} values. Refine your search.` : `${number(matches.length)} available values · Select multiple`}</p>
    </div>, trigger.current?.closest("dialog") ?? document.body)}
  </>;
}

export function SummaryChart({ title, subtitle, counts, selected, onSelect, tone }: {
  title: string; subtitle: string; counts: Count[]; selected: string[]; onSelect: (value: string) => void; tone: string;
}) {
  const maximum = Math.max(1, ...counts.map((item) => item.count));
  return <section className={`endpoint-chart ${tone}`} aria-label={`${title} summary chart`}>
    <div className="endpoint-chart-heading"><h2>{title}</h2><span>{counts.length} groups</span></div>
    <p>{subtitle}</p>
    <div className="endpoint-chart-bars">{counts.map(({ value, count }) => <button type="button" key={value}
      aria-pressed={selected.includes(value)} aria-label={`${title}: ${value}, ${number(count)} records`}
      onClick={() => onSelect(value)} className={selected.includes(value) ? "is-selected" : ""}>
      <span className="endpoint-chart-label"><span title={value}>{value}</span><strong>{number(count)}</strong></span>
      <span className="endpoint-chart-track" aria-hidden="true"><span style={{ width: `${count / maximum * 100}%` }} /></span>
    </button>)}{!counts.length && <div className="endpoint-chart-empty">No matching records</div>}</div>
  </section>;
}
