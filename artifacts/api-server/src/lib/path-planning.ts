export interface GridPoint {
  x: number;
  y: number;
}

export interface PathPlanningRequest {
  width: number;
  height: number;
  start: GridPoint;
  goal: GridPoint;
  obstacles?: GridPoint[];
  diagonal?: boolean;
  algorithm?: "astar" | "dijkstra";
}

export interface PathPlanningResult {
  algorithm: "astar" | "dijkstra";
  path: GridPoint[];
  visited: GridPoint[];
  cost: number;
  found: boolean;
}

interface QueueNode extends GridPoint {
  g: number;
  f: number;
}

function key(point: GridPoint): string {
  return `${point.x},${point.y}`;
}

function heuristic(a: GridPoint, b: GridPoint, diagonal: boolean): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return diagonal ? Math.max(dx, dy) : dx + dy;
}

function neighbors(point: GridPoint, width: number, height: number, diagonal: boolean): GridPoint[] {
  const directions = diagonal
    ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
    : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  return directions
    .map(([dx, dy]) => ({ x: point.x + dx!, y: point.y + dy! }))
    .filter((candidate) => candidate.x >= 0 && candidate.y >= 0 && candidate.x < width && candidate.y < height);
}

function reconstruct(cameFrom: Map<string, GridPoint>, current: GridPoint): GridPoint[] {
  const path = [current];
  while (cameFrom.has(key(current))) {
    current = cameFrom.get(key(current))!;
    path.push(current);
  }
  return path.reverse();
}

export function planGridPath(request: PathPlanningRequest): PathPlanningResult {
  const width = Math.max(1, Math.min(1000, Math.floor(request.width)));
  const height = Math.max(1, Math.min(1000, Math.floor(request.height)));
  const diagonal = Boolean(request.diagonal);
  const algorithm = request.algorithm ?? "astar";
  const blocked = new Set((request.obstacles ?? []).map(key));
  const open: QueueNode[] = [{ ...request.start, g: 0, f: 0 }];
  const cameFrom = new Map<string, GridPoint>();
  const gScore = new Map<string, number>([[key(request.start), 0]]);
  const closed = new Set<string>();
  const visited: GridPoint[] = [];

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f || a.g - b.g);
    const current = open.shift()!;
    const currentKey = key(current);
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);
    visited.push({ x: current.x, y: current.y });

    if (current.x === request.goal.x && current.y === request.goal.y) {
      return { algorithm, path: reconstruct(cameFrom, current), visited, cost: current.g, found: true };
    }

    for (const next of neighbors(current, width, height, diagonal)) {
      const nextKey = key(next);
      if (blocked.has(nextKey) || closed.has(nextKey)) continue;
      const isDiagonal = next.x !== current.x && next.y !== current.y;
      const tentativeG = current.g + (isDiagonal ? Math.SQRT2 : 1);
      if (tentativeG >= (gScore.get(nextKey) ?? Number.POSITIVE_INFINITY)) continue;
      cameFrom.set(nextKey, { x: current.x, y: current.y });
      gScore.set(nextKey, tentativeG);
      const h = algorithm === "astar" ? heuristic(next, request.goal, diagonal) : 0;
      open.push({ ...next, g: tentativeG, f: tentativeG + h });
    }
  }

  return { algorithm, path: [], visited, cost: Number.POSITIVE_INFINITY, found: false };
}
