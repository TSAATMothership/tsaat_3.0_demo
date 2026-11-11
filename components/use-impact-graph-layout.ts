"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { interpolateImpactPositions, type ImpactNodePosition } from "@/lib/topology-layout";

/** One animation clock for nodes, edges and camera bounds; rapid changes start at the current frame. */
export function useImpactGraphLayout(target: Map<string, ImpactNodePosition>, layoutKey: string) {
  const [displayed, setDisplayed] = useState(target);
  const current = useRef(target);
  const previousKey = useRef(layoutKey);
  const [animating, setAnimating] = useState(false);
  useEffect(() => {
    const changedLayout = previousKey.current !== layoutKey;
    previousKey.current = layoutKey;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const finish = () => { cancelAnimationFrame(frame); current.current = target; setDisplayed(target); setAnimating(false); };
    if (!changedLayout || media.matches || !current.current.size || !target.size) { finish(); return; }
    const start = current.current, startedAt = performance.now();
    setDisplayed(start);
    setAnimating(true);
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 650);
      current.current = interpolateImpactPositions(start, target, progress);
      setDisplayed(current.current);
      if (progress < 1) frame = requestAnimationFrame(tick); else setAnimating(false);
    };
    const onPreference = () => { if (media.matches) finish(); };
    media.addEventListener("change", onPreference);
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); media.removeEventListener("change", onPreference); };
  }, [target, layoutKey]);
  // New scene nodes can render before the effect; removed ones must not linger in bounds or edges.
  const frame = previousKey.current !== layoutKey ? current.current : displayed;
  const positions = useMemo(() => new Map([...target].map(([id, point]) => [id, frame.get(id) ?? point])), [target, frame]);
  const recordPosition = (id: string, point: ImpactNodePosition) => { current.current = new Map(current.current).set(id, point); };
  return { positions, animating, recordPosition };
}
