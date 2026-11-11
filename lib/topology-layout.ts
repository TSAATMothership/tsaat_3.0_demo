export type ImpactNodeKind = "business" | "mission" | "system" | "asset";
export interface ImpactGraphNode { id: string; kind: ImpactNodeKind; name: string }
export interface ImpactGraphEdge { id: string; source: string; target: string; label: string; weight?: number }
export interface ImpactGraph { nodes: ImpactGraphNode[]; edges: ImpactGraphEdge[] }
export function impactGraphNeighbours(graph: ImpactGraph, id: string): Set<string> {
  const neighbours = new Set([id]);
  for (const edge of graph.edges) {
    if (edge.source === id) neighbours.add(edge.target);
    if (edge.target === id) neighbours.add(edge.source);
  }
  return neighbours;
}

export interface ImpactNodePosition { x: number; y: number }
export type ImpactLayout = "force" | "hierarchical" | "circular" | "spatial";
export type ImpactDirection = "left-right" | "right-left" | "top-down" | "bottom-up";
export type ImpactCircularMode = "circle" | "radial";
export interface ImpactLayoutOptions {
  kind?: ImpactLayout;
  direction?: ImpactDirection;
  circularMode?: ImpactCircularMode;
  coordinates?: ReadonlyMap<string, ImpactNodePosition>;
}

/** Generate custom workspace coordinates once from the full scope, before any scene/risk filters. */
export function generateImpactCoordinates(graph: ImpactGraph): Map<string, ImpactNodePosition> {
  const nodes = [...graph.nodes].sort((a, b) => a.id.localeCompare(b.id));
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length * 1.8)));
  return new Map(nodes.map((node, index) => [node.id, { x: (index % columns) * 180, y: Math.floor(index / columns) * 130 }]));
}

const hierarchyLevel = (node: ImpactGraphNode) => node.kind === "asset" ? 2 : node.kind === "system" ? 1 : 0;

/** Deterministic presentation layouts, with no changes to associations or inventory evidence. */
export function layoutTopologyGraph(input: ImpactGraph, options: ImpactLayoutOptions = {}): Map<string, ImpactNodePosition> {
  const graph = { ...input, nodes: [...input.nodes].sort((a, b) => a.id.localeCompare(b.id)) };
  if (options.kind === "spatial") {
    const generated = generateImpactCoordinates(graph);
    return new Map(graph.nodes.map(node => {
      const point = options.coordinates?.get(node.id);
      return [node.id, point && Number.isFinite(point.x) && Number.isFinite(point.y) ? { ...point } : generated.get(node.id)!];
    }));
  }
  if (options.kind === "hierarchical") {
    const levels = [0, 1, 2].map(level => graph.nodes.filter(node => hierarchyLevel(node) === level));
    // Order children by the average position of recorded parents, keeping multi-parent relationships.
    for (let level = 1; level < levels.length; level++) {
      const parentIndices = new Map(levels[level - 1].map((node, index) => [node.id, index]));
      const rank = (node: ImpactGraphNode) => {
        const parents = graph.edges.filter(edge => edge.target === node.id && parentIndices.has(edge.source));
        return parents.length ? parents.reduce((sum, edge) => sum + parentIndices.get(edge.source)!, 0) / parents.length : Number.MAX_SAFE_INTEGER;
      };
      levels[level].sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
    }
    const direction = options.direction ?? "left-right";
    const vertical = direction === "top-down" || direction === "bottom-up";
    const breadthSlots = vertical ? 7 : 4, breadthSpacing = vertical ? 180 : 105, depthSpacing = vertical ? 110 : 190;
    let depthOffset = 0;
    const result = new Map<string, ImpactNodePosition>();
    for (const nodes of levels) {
      // Wrap wide tiers into bands while keeping every source strictly before its children.
      const slots = Math.min(breadthSlots, nodes.length);
      nodes.forEach((node, index) => {
        const breadth = ((index % slots) - (slots - 1) / 2) * breadthSpacing;
        const depth = depthOffset + Math.floor(index / slots) * depthSpacing;
        result.set(node.id, direction === "top-down" ? { x: breadth, y: depth } : direction === "bottom-up" ? { x: breadth, y: -depth }
          : direction === "right-left" ? { x: -depth, y: breadth } : { x: depth, y: breadth });
      });
      if (nodes.length) depthOffset += Math.floor((nodes.length - 1) / slots) * depthSpacing + (vertical ? 230 : 340);
    }
    return result;
  }
  if (options.kind === "circular") {
    if (options.circularMode !== "radial") {
      const radius = Math.max(110, graph.nodes.length * 12);
      return new Map(graph.nodes.map((node, index) => {
        const angle = -Math.PI / 2 + index * Math.PI * 2 / Math.max(1, graph.nodes.length);
        return [node.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }];
      }));
    }
    const degree = new Map(graph.nodes.map(node => [node.id, graph.edges.filter(edge => edge.source === node.id || edge.target === node.id).length]));
    const hub = [...graph.nodes].sort((a, b) => degree.get(b.id)! - degree.get(a.id)! || a.id.localeCompare(b.id))[0];
    if (!hub) return new Map();
    const rings = new Map([[hub.id, 0]]);
    const adjacency = new Map(graph.nodes.map(node => [node.id, impactGraphNeighbours(graph, node.id)]));
    const queue = [hub.id];
    for (let index = 0; index < queue.length; index++) for (const neighbour of adjacency.get(queue[index]) ?? []) {
      if (!rings.has(neighbour)) { rings.set(neighbour, rings.get(queue[index])! + 1); queue.push(neighbour); }
    }
    // Keep the hub and its immediate neighbours distinct; collect longer paths on the next ring.
    // One ring per hop can make sparse dependency chains unreadably large at Fit graph scale.
    for (const [id, distance] of rings) rings.set(id, Math.min(2, distance));
    const outside = Math.max(...rings.values()) + 1;
    for (const node of graph.nodes) if (!rings.has(node.id)) rings.set(node.id, outside);
    let previousRadius = 0;
    const result = new Map<string, ImpactNodePosition>();
    for (let ring = 0; ring <= outside; ring++) {
      const nodes = graph.nodes.filter(node => rings.get(node.id) === ring);
      if (!nodes.length) continue;
      const radius = ring === 0 ? 0 : Math.max(previousRadius + (ring === 1 ? 105 : 125), nodes.length * 16);
      nodes.forEach((node, index) => {
        const angle = -Math.PI / 2 + ring * 2.39996 + index * Math.PI * 2 / nodes.length;
        result.set(node.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
      });
      previousRadius = radius;
    }
    return result;
  }
  return forceLayout(graph);
}

/** Bounded gravity, repulsion and weighted edge springs. Existing associations use weight one. */
function forceLayout(graph: ImpactGraph): Map<string, ImpactNodePosition> {
  const lanes: Record<ImpactNodeKind, number> = { business: 120, mission: 460, system: 800, asset: 1140 };
  const laneCounts = { business: graph.nodes.filter(node => node.kind === "business").length, mission: graph.nodes.filter(node => node.kind === "mission").length, system: graph.nodes.filter(node => node.kind === "system").length,
    asset: graph.nodes.filter(node => node.kind === "asset").length };
  const laneIndex = { business: 0, mission: 0, system: 0, asset: 0 };
  const points = graph.nodes.map(node => {
    const y = 80 + laneIndex[node.kind]++ * 460 / Math.max(1, laneCounts[node.kind]);
    return { id: node.id, x: lanes[node.kind], y, anchorX: lanes[node.kind], anchorY: y };
  });
  const index = new Map(points.map((point, i) => [point.id, i]));
  for (let step = 0; step < 110; step++) {
    const forces = points.map(point => ({ x: (point.anchorX - point.x) * .07, y: (point.anchorY - point.y) * .035 }));
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
      const dx = points[i].x - points[j].x || .1, dy = points[i].y - points[j].y || .1;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const repel = Math.min(18, 4000 / (distance * distance) + Math.max(0, 140 - distance) * .18);
      forces[i].x += dx / distance * repel; forces[i].y += dy / distance * repel;
      forces[j].x -= dx / distance * repel; forces[j].y -= dy / distance * repel;
    }
    for (const edge of graph.edges) {
      const a = index.get(edge.source), b = index.get(edge.target);
      if (a === undefined || b === undefined) continue;
      const dx = points[b].x - points[a].x, dy = points[b].y - points[a].y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const weight = Number.isFinite(edge.weight) ? Math.max(.1, Math.min(5, edge.weight!)) : 1;
      const spring = (distance - 185) * .035 * weight;
      forces[a].x += dx / distance * spring; forces[a].y += dy / distance * spring;
      forces[b].x -= dx / distance * spring; forces[b].y -= dy / distance * spring;
    }
    points.forEach((point, i) => { point.x += Math.max(-16, Math.min(16, forces[i].x)); point.y += Math.max(-16, Math.min(16, forces[i].y)); });
  }
  return new Map(points.map(point => [point.id, { x: point.x, y: point.y }]));
}

export function interpolateImpactPositions(from: ReadonlyMap<string, ImpactNodePosition>, to: ReadonlyMap<string, ImpactNodePosition>, progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  const eased = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  return new Map([...to].map(([id, point]) => {
    const start = from.get(id) ?? point;
    return [id, { x: start.x + (point.x - start.x) * eased, y: start.y + (point.y - start.y) * eased }];
  }));
}
