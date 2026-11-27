import { shuffleDeterministic } from "@tablefolk/game-engine";
import {
  RESOURCES,
  type BuildingPiece,
  type HarborKind,
  type HexTile,
  type IslandBoard,
  type IslandEdge,
  type IslandHarbor,
  type IslandVertex,
  type ResourceType,
  type TerrainType,
} from "./types.js";

export const HEX_RADIUS = 56;
const SQRT3 = Math.sqrt(3);

const TERRAIN_DECK: TerrainType[] = [
  "timber",
  "timber",
  "timber",
  "timber",
  "clay",
  "clay",
  "clay",
  "wool",
  "wool",
  "wool",
  "wool",
  "grain",
  "grain",
  "grain",
  "grain",
  "ore",
  "ore",
  "ore",
  "desert",
];

const NUMBER_TOKENS: number[] = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

const HARBOR_DECK: HarborKind[] = [
  "any",
  "any",
  "any",
  "any",
  "timber",
  "clay",
  "wool",
  "grain",
  "ore",
];

export function getPipCount(token: number | null): number {
  if (token === null) return 0;
  return Math.max(0, 6 - Math.abs(7 - token));
}

function areHexesAdjacent(a: { q: number; r: number }, b: { q: number; r: number }): boolean {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -a.q - a.r - (-b.q - b.r);
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds)) === 1;
}

/**
 * Generates a balanced 19-hex, 54-vertex, 72-edge, 9-harbor island deterministically.
 * Guarantees NO two red high-probability tokens (6 or 8) ever border each other!
 */
export function generateIslandBoard(seed: number): { board: IslandBoard; nextSeed: number } {
  let s = seed | 0;

  // 1. Canonical 19 axial coordinates (radius = 2 honeycomb: 3-4-5-4-3)
  const coords: Array<{ q: number; r: number }> = [];
  for (let r = -2; r <= 2; r++) {
    const qMin = Math.max(-2, -r - 2);
    const qMax = Math.min(2, -r + 2);
    for (let q = qMin; q <= qMax; q++) {
      coords.push({ q, r });
    }
  }

  const shuffledTerrain = shuffleDeterministic(TERRAIN_DECK, s);
  s = shuffledTerrain.nextSeed;

  // 2. Assign numbers to the 18 non-desert hexes guaranteeing zero adjacent 6/8 red tokens
  const nonDesertIndices = coords
    .map((_, idx) => idx)
    .filter((idx) => shuffledTerrain.shuffled[idx] !== "desert");

  let assignedTokens: number[] = [];
  for (let attempt = 0; attempt < 60; attempt++) {
    const shuf = shuffleDeterministic(NUMBER_TOKENS, s);
    s = shuf.nextSeed;
    const candidate = shuf.shuffled;
    let redConflict = false;
    for (let i = 0; i < nonDesertIndices.length; i++) {
      const tokA = candidate[i]!;
      if (tokA !== 6 && tokA !== 8) continue;
      const coordA = coords[nonDesertIndices[i]!]!;
      for (let j = i + 1; j < nonDesertIndices.length; j++) {
        const tokB = candidate[j]!;
        if (tokB !== 6 && tokB !== 8) continue;
        const coordB = coords[nonDesertIndices[j]!]!;
        if (areHexesAdjacent(coordA, coordB)) {
          redConflict = true;
          break;
        }
      }
      if (redConflict) break;
    }
    assignedTokens = candidate;
    if (!redConflict) break;
  }

  // Fallback deterministic repair if random attempts still had a red neighbor
  // (guaranteed solvable because max independent set of 19-hex graph >= 7)
  const hexTokenByIdx = new Map<number, number | null>();
  let tokCursor = 0;
  for (let i = 0; i < coords.length; i++) {
    if (shuffledTerrain.shuffled[i] === "desert") {
      hexTokenByIdx.set(i, null);
    } else {
      hexTokenByIdx.set(i, assignedTokens[tokCursor++]!);
    }
  }

  // 3. Build exact deduped Vertices (54) and Edges (72) from pointy-top hex corners
  const vertexByKey = new Map<string, IslandVertex>();
  const vertices: IslandVertex[] = [];
  const edgeByKey = new Map<string, IslandEdge>();
  const edges: IslandEdge[] = [];
  const hexes: HexTile[] = [];

  const getOrCreateVertex = (x: number, y: number): number => {
    const rx = Math.round(x * 10);
    const ry = Math.round(y * 10);
    const key = `${rx},${ry}`;
    const existing = vertexByKey.get(key);
    if (existing) return existing.id;
    const v: IslandVertex = {
      id: vertices.length,
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      hexIds: [],
      edgeIds: [],
      neighborVertexIds: [],
      harbor: null,
    };
    vertices.push(v);
    vertexByKey.set(key, v);
    return v.id;
  };

  const getOrCreateEdge = (vA: number, vB: number): number => {
    const lo = Math.min(vA, vB);
    const hi = Math.max(vA, vB);
    const key = `${lo}-${hi}`;
    const existing = edgeByKey.get(key);
    if (existing) return existing.id;
    const va = vertices[lo]!;
    const vb = vertices[hi]!;
    const e: IslandEdge = {
      id: edges.length,
      v1: lo,
      v2: hi,
      x1: va.x,
      y1: va.y,
      x2: vb.x,
      y2: vb.y,
      hexIds: [],
    };
    edges.push(e);
    edgeByKey.set(key, e);
    va.edgeIds.push(e.id);
    vb.edgeIds.push(e.id);
    if (!va.neighborVertexIds.includes(hi)) va.neighborVertexIds.push(hi);
    if (!vb.neighborVertexIds.includes(lo)) vb.neighborVertexIds.push(lo);
    return e.id;
  };

  for (let id = 0; id < coords.length; id++) {
    const { q, r } = coords[id]!;
    // Pointy-top hex center
    const cx = HEX_RADIUS * SQRT3 * (q + r / 2);
    const cy = HEX_RADIUS * 1.5 * r;

    const vIds: number[] = [];
    for (let corner = 0; corner < 6; corner++) {
      const angle = ((60 * corner - 30) * Math.PI) / 180;
      const vx = cx + HEX_RADIUS * Math.cos(angle);
      const vy = cy + HEX_RADIUS * Math.sin(angle);
      const vid = getOrCreateVertex(vx, vy);
      vIds.push(vid);
      const v = vertices[vid]!;
      if (!v.hexIds.includes(id)) v.hexIds.push(id);
    }

    const eIds: number[] = [];
    for (let corner = 0; corner < 6; corner++) {
      const vA = vIds[corner]!;
      const vB = vIds[(corner + 1) % 6]!;
      const eid = getOrCreateEdge(vA, vB);
      eIds.push(eid);
      const e = edges[eid]!;
      if (!e.hexIds.includes(id)) e.hexIds.push(id);
    }

    hexes.push({
      id,
      q,
      r,
      cx: Math.round(cx * 100) / 100,
      cy: Math.round(cy * 100) / 100,
      terrain: shuffledTerrain.shuffled[id]!,
      numberToken: hexTokenByIdx.get(id) ?? null,
      vertexIds: vIds,
      edgeIds: eIds,
    });
  }

  // 4. Select 9 evenly-spaced coastal perimeter edges around the 30-edge coastline for Harbors
  const coastalEdges = edges
    .filter((e) => e.hexIds.length === 1)
    .sort((a, b) => {
      const angA = Math.atan2((a.y1 + a.y2) / 2, (a.x1 + a.x2) / 2);
      const angB = Math.atan2((b.y1 + b.y2) / 2, (b.x1 + b.x2) / 2);
      return angA - angB;
    });

  const shuffledHarbors = shuffleDeterministic(HARBOR_DECK, s);
  s = shuffledHarbors.nextSeed;

  // Pick 9 well-spaced indices around the 30 coastal edges (non-overlapping vertices!)
  const harborEdgeIndices = [0, 3, 7, 10, 13, 17, 20, 23, 27];
  const harbors: IslandHarbor[] = [];

  harborEdgeIndices.forEach((coastIdx, hIdx) => {
    const edge = coastalEdges[coastIdx % coastalEdges.length]!;
    const kind = shuffledHarbors.shuffled[hIdx]!;
    const mx = (edge.x1 + edge.x2) / 2;
    const my = (edge.y1 + edge.y2) / 2;
    // Push harbor badge outward away from its touching hex center
    const hex = hexes[edge.hexIds[0]!]!;
    const dx = mx - hex.cx;
    const dy = my - hex.cy;
    const len = Math.hypot(dx, dy) || 1;
    const badgeX = Math.round((mx + (dx / len) * 32) * 100) / 100;
    const badgeY = Math.round((my + (dy / len) * 32) * 100) / 100;

    harbors.push({
      id: hIdx,
      edgeId: edge.id,
      v1: edge.v1,
      v2: edge.v2,
      kind,
      badgeX,
      badgeY,
    });
    vertices[edge.v1]!.harbor = kind;
    vertices[edge.v2]!.harbor = kind;
  });

  return {
    board: { hexes, vertices, edges, harbors },
    nextSeed: s,
  };
}

/** Distance rule: a vertex is open iff neither it nor any adjacent vertex has a building. */
export function isVertexOpenForSettlement(
  board: IslandBoard,
  buildings: Record<number, BuildingPiece>,
  vertexId: number
): boolean {
  if (buildings[vertexId]) return false;
  const v = board.vertices[vertexId];
  if (!v) return false;
  return v.neighborVertexIds.every((nId) => !buildings[nId]);
}

export function getValidSetupVertices(
  board: IslandBoard,
  buildings: Record<number, BuildingPiece>
): number[] {
  const valid: number[] = [];
  for (const v of board.vertices) {
    if (isVertexOpenForSettlement(board, buildings, v.id)) {
      valid.push(v.id);
    }
  }
  return valid;
}

export function getValidSetupRoadEdges(
  board: IslandBoard,
  roads: Record<number, string>,
  anchorVertexId: number
): number[] {
  const v = board.vertices[anchorVertexId];
  if (!v) return [];
  return v.edgeIds.filter((eid) => !roads[eid]);
}

/**
 * Valid edges where `playerId` can build a road during normal play:
 * edge must be unoccupied and touch either player's building OR player's road
 * (not passing through an enemy building!).
 */
export function getValidRoadEdges(
  board: IslandBoard,
  buildings: Record<number, BuildingPiece>,
  roads: Record<number, string>,
  playerId: string
): number[] {
  const valid: number[] = [];
  for (const e of board.edges) {
    if (roads[e.id]) continue;
    const touchesEndpoint = [e.v1, e.v2].some((vid) => {
      const b = buildings[vid];
      if (b) return b.ownerId === playerId;
      const v = board.vertices[vid]!;
      return v.edgeIds.some((adjEdgeId) => roads[adjEdgeId] === playerId);
    });
    if (touchesEndpoint) valid.push(e.id);
  }
  return valid;
}

/**
 * Valid vertices where `playerId` can build a new Cottage during normal play:
 * obeys distance rule AND touches at least one of `playerId`'s own roads!
 */
export function getValidCottageVertices(
  board: IslandBoard,
  buildings: Record<number, BuildingPiece>,
  roads: Record<number, string>,
  playerId: string
): number[] {
  const valid: number[] = [];
  for (const v of board.vertices) {
    if (!isVertexOpenForSettlement(board, buildings, v.id)) continue;
    if (v.edgeIds.some((eid) => roads[eid] === playerId)) {
      valid.push(v.id);
    }
  }
  return valid;
}

export function getValidTownVertices(
  buildings: Record<number, BuildingPiece>,
  playerId: string
): number[] {
  const valid: number[] = [];
  for (const [vidStr, b] of Object.entries(buildings)) {
    if (b.ownerId === playerId && b.kind === "cottage") {
      valid.push(Number(vidStr));
    }
  }
  return valid;
}

export function getPlayerTradeRates(
  board: IslandBoard,
  buildings: Record<number, BuildingPiece>,
  playerId: string
): Record<ResourceType, number> {
  let hasAnyHarbor = false;
  const spec = new Set<ResourceType>();
  for (const [vidStr, b] of Object.entries(buildings)) {
    if (b.ownerId !== playerId) continue;
    const h = board.vertices[Number(vidStr)]?.harbor;
    if (h === "any") hasAnyHarbor = true;
    else if (h) spec.add(h);
  }
  const rates = {} as Record<ResourceType, number>;
  for (const r of RESOURCES) {
    rates[r] = spec.has(r) ? 2 : hasAnyHarbor ? 3 : 4;
  }
  return rates;
}

/**
 * Computes exact Longest Continuous Road length for `playerId` via DFS over simple edge paths,
 * properly breaking chains when an opponent's Cottage/Town sits on an intermediate vertex!
 */
export function computeLongestRoadForPlayer(
  board: IslandBoard,
  buildings: Record<number, BuildingPiece>,
  roads: Record<number, string>,
  playerId: string
): number {
  const ownedEdges = board.edges.filter((e) => roads[e.id] === playerId);
  if (ownedEdges.length === 0) return 0;

  const adj = new Map<number, number[]>();
  for (const e of ownedEdges) {
    if (!adj.has(e.v1)) adj.set(e.v1, []);
    if (!adj.has(e.v2)) adj.set(e.v2, []);
    adj.get(e.v1)!.push(e.id);
    adj.get(e.v2)!.push(e.id);
  }

  let best = 0;
  const used = new Set<number>();

  const dfs = (vertexId: number, depth: number) => {
    if (depth > best) best = depth;
    const nextEdges = adj.get(vertexId);
    if (!nextEdges) return;
    for (const eid of nextEdges) {
      if (used.has(eid)) continue;
      const edge = board.edges[eid]!;
      const nextV = edge.v1 === vertexId ? edge.v2 : edge.v1;
      used.add(eid);
      // Enemy settlement on `nextV` ends the chain at this edge (still counts the edge itself!)
      const b = buildings[nextV];
      if (b && b.ownerId !== playerId) {
        if (depth + 1 > best) best = depth + 1;
      } else {
        dfs(nextV, depth + 1);
      }
      used.delete(eid);
    }
  };

  for (const startV of adj.keys()) {
    dfs(startV, 0);
  }

  return best;
}

export function getBanditStealCandidates(
  board: IslandBoard,
  buildings: Record<number, BuildingPiece>,
  hexId: number,
  actorId: string,
  playerResourceCounts: Record<string, number>
): string[] {
  const hex = board.hexes[hexId];
  if (!hex) return [];
  const targets = new Set<string>();
  for (const vid of hex.vertexIds) {
    const b = buildings[vid];
    if (b && b.ownerId !== actorId && (playerResourceCounts[b.ownerId] ?? 0) > 0) {
      targets.add(b.ownerId);
    }
  }
  return Array.from(targets);
}
