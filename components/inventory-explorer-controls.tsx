"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Count = { value: string; count: number };
const number = (value: number) => value.toLocaleString("en-AU");
const toggle = (values: string[], value: string) => values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

export function FilterHeader({ column, selected, options, open, onOpen, onChange }: {
  column: { key: string; label: string }; selected: string[]; options: Count[]; open: boolean;
  onOpen: (open: boolean) => void; onChange: (values: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0, maxHeight: 420 });
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    setSearch("");
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const maxHeight = Math.min(420, window.innerHeight - 24);
      const below = window.innerHeight - rect.bottom - 12;
      setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - 324)),
        top: below >= 240 ? rect.bottom + 6 : Math.max(12, rect.top - maxHeight - 6),
        maxHeight: Math.max(180, below >= 240 ? Math.min(maxHeight, below) : Math.min(maxHeight, rect.top - 18)) });
    };
    place(); input.current?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!popup.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) onOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onOpen(false); trigger.current?.focus(); }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const allOptions = [...options];
  for (const value of selected) if (!allOptions.some((option) => option.value === value)) allOptions.push({ value, count: 0 });
  const matches = allOptions.filter((option) => option.value.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));
  return <>
    <button ref={trigger} type="button" className={`endpoint-column-trigger ${selected.length ? "is-filtered" : ""}`}
      aria-label={`Filter ${column.label}${selected.length ? `, ${selected.length} selected` : ""}`} aria-expanded={open}
      aria-haspopup="dialog" aria-controls={`endpoint-filter-${column.key}`} onClick={() => onOpen(!open)}>
      <span>{column.label}</span>{selected.length > 0 && <span className="endpoint-filter-count">{selected.length}</span>}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    {open && createPortal(<div ref={popup} role="dialog" id={`endpoint-filter-${column.key}`} aria-label={`Filter ${column.label}`}
      className="endpoint-filter-popup" style={position} onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget) && !trigger.current?.contains(event.relatedTarget)) onOpen(false);
      }}>
      <div className="endpoint-filter-popup-title"><strong>{column.label}</strong><button type="button" aria-label={`Close ${column.label} filter`} onClick={() => { onOpen(false); trigger.current?.focus(); }}>×</button></div>
      <input ref={input} type="search" aria-label={`Search ${column.label} values`} placeholder={`Search ${column.label.toLowerCase()}...`}
        value={search} onChange={(event) => setSearch(event.target.value)} />
      <div className="endpoint-filter-actions"><button type="button" onClick={() => onChange([])}>Clear filter</button>
        <button type="button" disabled={!matches.length} onClick={() => onChange([...new Set([...selected, ...matches.map((option) => option.value)])])}>Select matches</button></div>
      <div className="endpoint-filter-values">{matches.slice(0, 150).map((option) => <label key={option.value}>
        <input type="checkbox" checked={selected.includes(option.value)} onChange={() => onChange(toggle(selected, option.value))} />
        <span title={option.value}>{option.value}</span><small>{number(option.count)}</small>
      </label>)}{matches.length === 0 && <p>No matching values.</p>}</div>
      <p className="endpoint-filter-hint">{matches.length > 150 ? `Showing 150 of ${number(matches.length)} values. Refine your search.` : `${number(matches.length)} available values · Select multiple`}</p>
    </div>, document.body)}
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

