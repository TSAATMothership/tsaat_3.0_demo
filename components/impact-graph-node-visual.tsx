/** Shared presentation only: each graph supplies its own evidence and interactions. */
export const impactGraphNodeRadius = (kind: string) => kind === "asset" ? 20 : kind === "system" || kind === "network" ? 29 : 25;

export function ImpactGraphNodeVisual({ name, color, glyph, radius, badge, haloColor = "#4e6577", labelLines }: {
  name: string; color: string; glyph: string; radius: number; badge: string; haloColor?: string; labelLines?: string[];
}) {
  const badgeWidth = Math.max(24, badge.length * 6 + 12);
  return <>
    <circle className="impact-graph-halo" r={radius + 6} stroke={haloColor} />
    <circle className="impact-graph-disc" r={radius} fill={color} />
    <text className="impact-graph-glyph" y="4">{glyph}</text>
    <text className="impact-graph-label" y={radius + 24}>{labelLines
      ? labelLines.map((line, index) => <tspan key={index} x="0" dy={index ? 19 : 0}>{line}</tspan>)
      : name.length > 24 ? `${name.slice(0, 22)}…` : name}</text>
    <rect x={radius - 1 - badgeWidth / 2} y={-radius - 11} width={badgeWidth} height={24} rx={12} fill="#132a3a" stroke={color} />
    <text className="impact-graph-count" x={radius - 1} y={-radius + 5}>{badge}</text>
  </>;
}
