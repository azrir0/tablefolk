import { getTileTemplate } from "./tiles.js";
import type {
  CardinalDir,
  ClaimableSegmentOption,
  EdgeKind,
  PlacedFolk,
  PlacedTile,
  SegmentKind,
  TileRotation,
  TileSegmentDef,
} from "./types.js";

export const CARDINAL_DIRS: readonly CardinalDir[] = ["N", "E", "S", "W"] as const;

export const DIR_DELTAS: Record<CardinalDir, { dx: number; dy: number }> = {
  N: { dx: 0, dy: -1 },
  E: { dx: 1, dy: 0 },
  S: { dx: 0, dy: 1 },
  W: { dx: -1, dy: 0 },
};

export function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function parseTileKey(key: string): { x: number; y: number } {
  const [xStr, yStr] = key.split(",");
  return { x: Number(xStr), y: Number(yStr) };
}

export function rotateDir(dir: CardinalDir, rotation: TileRotation): CardinalDir {
  const idx = CARDINAL_DIRS.indexOf(dir);
  const steps = ((rotation / 90) % 4 + 4) % 4;
  return CARDINAL_DIRS[(idx + steps) % 4]!;
}

export function oppositeDir(dir: CardinalDir): CardinalDir {
  switch (dir) {
    case "N":
      return "S";
    case "S":
      return "N";
    case "E":
      return "W";
    case "W":
      return "E";
  }
}

export function rotateAnchor(
  ax: number,
  ay: number,
  rotation: TileRotation
): { ax: number; ay: number } {
  switch (rotation) {
    case 0:
      return { ax, ay };
    case 90:
      return { ax: 100 - ay, ay: ax };
    case 180:
      return { ax: 100 - ax, ay: 100 - ay };
    case 270:
      return { ax: ay, ay: 100 - ax };
  }
}

export function getRotatedEdges(
  templateId: string,
  rotation: TileRotation
): Record<CardinalDir, EdgeKind> {
  const tpl = getTileTemplate(templateId);
  const out: Record<CardinalDir, EdgeKind> = {
    N: "FIELD",
    E: "FIELD",
    S: "FIELD",
    W: "FIELD",
  };
  for (const baseDir of CARDINAL_DIRS) {
    out[rotateDir(baseDir, rotation)] = tpl.edges[baseDir];
  }
  return out;
}

export function getSegmentRotatedEdges(
  segment: TileSegmentDef,
  rotation: TileRotation
): CardinalDir[] {
  return segment.edges.map((d) => rotateDir(d, rotation));
}

export function findSegmentTouchingWorldEdge(
  tile: PlacedTile,
  worldDir: CardinalDir
): TileSegmentDef | null {
  const tpl = getTileTemplate(tile.templateId);
  for (const seg of tpl.segments) {
    const rotEdges = getSegmentRotatedEdges(seg, tile.rotation);
    if (rotEdges.includes(worldDir)) {
      return seg;
    }
  }
  return null;
}

export function canPlaceTileAt(
  board: Record<string, PlacedTile>,
  templateId: string,
  x: number,
  y: number,
  rotation: TileRotation
): boolean {
  const key = tileKey(x, y);
  if (board[key]) return false;

  const myEdges = getRotatedEdges(templateId, rotation);
  let touchesAtLeastOne = false;

  for (const dir of CARDINAL_DIRS) {
    const { dx, dy } = DIR_DELTAS[dir];
    const neighbor = board[tileKey(x + dx, y + dy)];
    if (!neighbor) continue;
    touchesAtLeastOne = true;
    const neighborEdges = getRotatedEdges(neighbor.templateId, neighbor.rotation);
    if (myEdges[dir] !== neighborEdges[oppositeDir(dir)]) {
      return false;
    }
  }

  return touchesAtLeastOne;
}

export interface ValidPlacement {
  x: number;
  y: number;
  rotations: TileRotation[];
}

export function getFrontierCoords(
  board: Record<string, PlacedTile>
): Array<{ x: number; y: number }> {
  const seen = new Set<string>();
  const coords: Array<{ x: number; y: number }> = [];

  for (const tile of Object.values(board)) {
    for (const dir of CARDINAL_DIRS) {
      const nx = tile.x + DIR_DELTAS[dir].dx;
      const ny = tile.y + DIR_DELTAS[dir].dy;
      const nKey = tileKey(nx, ny);
      if (board[nKey] || seen.has(nKey)) continue;
      seen.add(nKey);
      coords.push({ x: nx, y: ny });
    }
  }

  return coords;
}

export function getValidPlacementsForTemplate(
  board: Record<string, PlacedTile>,
  templateId: string
): ValidPlacement[] {
  const frontier = getFrontierCoords(board);
  const allRots: readonly TileRotation[] = [0, 90, 180, 270];
  const results: ValidPlacement[] = [];

  for (const { x, y } of frontier) {
    const validRots: TileRotation[] = [];
    for (const rot of allRots) {
      if (canPlaceTileAt(board, templateId, x, y, rot)) {
        validRots.push(rot);
      }
    }
    if (validRots.length > 0) {
      results.push({ x, y, rotations: validRots });
    }
  }

  return results;
}

export interface EvaluatedFeature {
  canonicalKey: string;
  kind: SegmentKind;
  isComplete: boolean;
  tileCoords: Array<{ x: number; y: number }>;
  crestCount: number;
  lanternCount: number;
  folkEntries: Array<{ x: number; y: number; folk: PlacedFolk }>;
  /** Neighbor count (including self, 1..9) for SHRINE */
  shrineFillCount: number;
}

export function countShrineFill(
  board: Record<string, PlacedTile>,
  x: number,
  y: number
): { count: number; coords: Array<{ x: number; y: number }> } {
  const coords: Array<{ x: number; y: number }> = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (board[tileKey(x + dx, y + dy)]) {
        coords.push({ x: x + dx, y: y + dy });
      }
    }
  }
  return { count: coords.length, coords };
}

/**
 * BFS connected component evaluator for any TOWN, ROAD, or SHRINE segment on the board.
 */
export function evaluateFeature(
  board: Record<string, PlacedTile>,
  startX: number,
  startY: number,
  startSegmentId: string
): EvaluatedFeature | null {
  const startTile = board[tileKey(startX, startY)];
  if (!startTile) return null;
  const startTpl = getTileTemplate(startTile.templateId);
  const startSeg = startTpl.segments.find((s) => s.id === startSegmentId);
  if (!startSeg) return null;

  // Hilltop Windmill (SHRINE) is self-contained on 1 tile, completed when all 8 surrounding spots exist
  if (startSeg.kind === "SHRINE") {
    const fill = countShrineFill(board, startX, startY);
    const folkEntries =
      startTile.folk && startTile.folk.segmentId === startSeg.id
        ? [{ x: startX, y: startY, folk: startTile.folk }]
        : [];
    return {
      canonicalKey: `SHRINE:${tileKey(startX, startY)}:${startSeg.id}`,
      kind: "SHRINE",
      isComplete: fill.count === 9,
      tileCoords: [{ x: startX, y: startY }],
      crestCount: 0,
      lanternCount: 0,
      folkEntries,
      shrineFillCount: fill.count,
    };
  }

  // BFS across shared TOWN or ROAD edges
  const visitedNodes = new Set<string>();
  const uniqueTileKeys = new Set<string>();
  const tileCoords: Array<{ x: number; y: number }> = [];
  const folkEntries: Array<{ x: number; y: number; folk: PlacedFolk }> = [];
  let crestCount = 0;
  let lanternCount = 0;
  let openEdges = 0;

  const queue: Array<{ x: number; y: number; segId: string }> = [
    { x: startX, y: startY, segId: startSeg.id },
  ];
  visitedNodes.add(`${tileKey(startX, startY)}:${startSeg.id}`);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const tKey = tileKey(curr.x, curr.y);
    const tile = board[tKey];
    if (!tile) continue;

    if (!uniqueTileKeys.has(tKey)) {
      uniqueTileKeys.add(tKey);
      tileCoords.push({ x: curr.x, y: curr.y });
    }

    const tpl = getTileTemplate(tile.templateId);
    const seg = tpl.segments.find((s) => s.id === curr.segId);
    if (!seg) continue;

    if (seg.hasCrest) crestCount += 1;
    if (seg.hasLantern) lanternCount += 1;
    if (tile.folk && tile.folk.segmentId === seg.id) {
      folkEntries.push({ x: curr.x, y: curr.y, folk: tile.folk });
    }

    const worldEdges = getSegmentRotatedEdges(seg, tile.rotation);
    for (const dir of worldEdges) {
      const nx = curr.x + DIR_DELTAS[dir].dx;
      const ny = curr.y + DIR_DELTAS[dir].dy;
      const neighbor = board[tileKey(nx, ny)];
      if (!neighbor) {
        openEdges += 1;
        continue;
      }

      const neighborSeg = findSegmentTouchingWorldEdge(neighbor, oppositeDir(dir));
      if (!neighborSeg || neighborSeg.kind !== seg.kind) {
        openEdges += 1;
        continue;
      }

      const nodeId = `${tileKey(nx, ny)}:${neighborSeg.id}`;
      if (!visitedNodes.has(nodeId)) {
        visitedNodes.add(nodeId);
        queue.push({ x: nx, y: ny, segId: neighborSeg.id });
      }
    }
  }

  const sortedNodes = Array.from(visitedNodes).sort();
  return {
    canonicalKey: `${startSeg.kind}:${sortedNodes[0]!}`,
    kind: startSeg.kind,
    isComplete: openEdges === 0,
    tileCoords,
    crestCount,
    lanternCount,
    folkEntries,
    shrineFillCount: 0,
  };
}

/**
 * Returns every segment on (x, y) whose connected feature currently has 0 Folk placed on it.
 */
export function getClaimableSegmentsAt(
  board: Record<string, PlacedTile>,
  x: number,
  y: number
): ClaimableSegmentOption[] {
  const tile = board[tileKey(x, y)];
  if (!tile) return [];
  const tpl = getTileTemplate(tile.templateId);
  const claimable: ClaimableSegmentOption[] = [];

  for (const seg of tpl.segments) {
    const feat = evaluateFeature(board, x, y, seg.id);
    if (feat && feat.folkEntries.length === 0) {
      const rotAnchor = rotateAnchor(seg.ax, seg.ay, tile.rotation);
      claimable.push({
        segmentId: seg.id,
        kind: seg.kind,
        ax: rotAnchor.ax,
        ay: rotAnchor.ay,
      });
    }
  }

  return claimable;
}

export function computeFeaturePoints(
  feature: EvaluatedFeature,
  isEndGame: boolean
): number {
  if (feature.kind === "SHRINE") {
    return feature.shrineFillCount;
  }

  if (feature.kind === "ROAD") {
    const tileCount = feature.tileCoords.length;
    if (!isEndGame && feature.isComplete && feature.lanternCount > 0) {
      return tileCount * 2;
    }
    return tileCount;
  }

  // TOWN scoring:
  // Completed 2-tile mini-town = 3 pts (+ 2 per crest if any)
  // Completed 3+ tile town = 2 pts/tile + 2 pts/crest
  // Unfinished (end-game) town = 1 pt/tile + 1 pt/crest
  const tileCount = feature.tileCoords.length;
  if (!isEndGame && feature.isComplete) {
    if (tileCount <= 2) {
      return 3 + feature.crestCount * 2;
    }
    return tileCount * 2 + feature.crestCount * 2;
  }
  return tileCount + feature.crestCount;
}
