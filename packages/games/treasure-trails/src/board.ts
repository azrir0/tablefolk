import { getOrientedEdges } from "./cards.js";
import type { BoardCell, CardinalDir, PathCard, PathEdges } from "./types.js";

export const BOARD_COLS = 9;
export const BOARD_ROWS = 5;

export const BASE_CAMP_COORD = { x: 0, y: 2 } as const;

export const VAULT_COORDS = [
  { x: 8, y: 0 },
  { x: 8, y: 2 },
  { x: 8, y: 4 },
] as const;

export function coordKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function isInBounds(x: number, y: number): boolean {
  return x >= 0 && x < BOARD_COLS && y >= 0 && y < BOARD_ROWS;
}

const NEIGHBOR_DELTAS: ReadonlyArray<{
  dir: CardinalDir;
  opp: CardinalDir;
  dx: number;
  dy: number;
}> = [
  { dir: "N", opp: "S", dx: 0, dy: -1 },
  { dir: "E", opp: "W", dx: 1, dy: 0 },
  { dir: "S", opp: "N", dx: 0, dy: 1 },
  { dir: "W", opp: "E", dx: -1, dy: 0 },
];

/**
 * Returns the set of coordKeys of all tiles currently reachable from Base Camp (0,2)
 * via uninterrupted open paths (`connectedCenter === true` and matching open edges).
 */
export function computeReachableFromCamp(board: Record<string, BoardCell>): Set<string> {
  const startKey = coordKey(BASE_CAMP_COORD.x, BASE_CAMP_COORD.y);
  const visited = new Set<string>();
  const startCell = board[startKey];
  if (!startCell || !startCell.connectedCenter) return visited;

  const queue: BoardCell[] = [startCell];
  visited.add(startKey);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (!curr.connectedCenter) continue;

    for (const { dir, opp, dx, dy } of NEIGHBOR_DELTAS) {
      if (!curr.edges[dir]) continue;
      const nx = curr.x + dx;
      const ny = curr.y + dy;
      const nKey = coordKey(nx, ny);
      if (visited.has(nKey)) continue;

      const neighbor = board[nKey];
      if (!neighbor) continue;
      // Cannot traverse through unrevealed vaults
      if (neighbor.kind === "VAULT" && !neighbor.vaultRevealed) continue;
      if (!neighbor.edges[opp]) continue;

      // Only add open-center tiles to further expansion (dead-ends terminate travel)
      if (neighbor.connectedCenter) {
        visited.add(nKey);
        queue.push(neighbor);
      }
    }
  }

  return visited;
}

/**
 * Checks whether a PathCard at `(x, y)` with `rotation` is legally placeable.
 * Works identically on full server `BoardCell` and client `PublicBoardCell`.
 */
export function canPlacePathTile(
  board: Record<
    string,
    {
      x: number;
      y: number;
      kind: "BASE_CAMP" | "PATH" | "VAULT";
      edges: PathEdges | null;
      connectedCenter: boolean;
      vaultRevealed?: boolean;
    }
  >,
  card: Pick<PathCard, "edges" | "connectedCenter">,
  x: number,
  y: number,
  rotation: 0 | 180
): { ok: true } | { ok: false; reason: string } {
  if (!isInBounds(x, y)) {
    return { ok: false, reason: "Coordinates are outside the 9x5 expedition grid." };
  }

  const targetKey = coordKey(x, y);
  if (board[targetKey]) {
    return { ok: false, reason: "That cell is already occupied." };
  }

  const oriented = getOrientedEdges(card.edges, rotation);

  // Build normalized board view for BFS reachability check
  const normalized: Record<string, BoardCell> = {};
  for (const [k, cell] of Object.entries(board)) {
    normalized[k] = {
      x: cell.x,
      y: cell.y,
      kind: cell.kind,
      edges: cell.edges ?? { N: false, E: false, S: false, W: false },
      connectedCenter: cell.connectedCenter,
      vaultRevealed: cell.vaultRevealed,
    };
  }
  const reachable = computeReachableFromCamp(normalized);

  let connectsToReachableCampPath = false;

  for (const { dir, opp, dx, dy } of NEIGHBOR_DELTAS) {
    const nx = x + dx;
    const ny = y + dy;
    const nKey = coordKey(nx, ny);
    const neighbor = board[nKey];
    if (!neighbor) continue;

    // Unrevealed vaults do NOT constrain borders until flipped
    if (neighbor.kind === "VAULT" && !neighbor.vaultRevealed) {
      continue;
    }

    const nEdges = neighbor.edges;
    if (!nEdges) continue;

    if (oriented[dir] !== nEdges[opp]) {
      return {
        ok: false,
        reason: `Tile edge (${dir}) does not match the adjacent tile.`,
      };
    }

    if (oriented[dir] && nEdges[opp] && reachable.has(nKey)) {
      connectsToReachableCampPath = true;
    }
  }

  if (!connectsToReachableCampPath) {
    return {
      ok: false,
      reason: "Trail must connect to an unbroken path leading from Base Camp.",
    };
  }

  return { ok: true };
}

export function getValidPlacementsForCard(
  board: Record<
    string,
    {
      x: number;
      y: number;
      kind: "BASE_CAMP" | "PATH" | "VAULT";
      edges: PathEdges | null;
      connectedCenter: boolean;
      vaultRevealed?: boolean;
    }
  >,
  card: Pick<PathCard, "edges" | "connectedCenter">,
  rotation: 0 | 180
): Array<{ x: number; y: number }> {
  const results: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < BOARD_ROWS; y++) {
    for (let x = 0; x < BOARD_COLS; x++) {
      if (canPlacePathTile(board, card, x, y, rotation).ok) {
        results.push({ x, y });
      }
    }
  }
  return results;
}

/**
 * After placing an open tile at (x, y) connected to Base Camp, finds any adjacent
 * unrevealed Vaults that receive an open path edge from this tile.
 */
export function findTouchedUnrevealedVaults(
  board: Record<string, BoardCell>,
  x: number,
  y: number,
  edges: PathEdges,
  connectedCenter: boolean
): BoardCell[] {
  if (!connectedCenter) return [];
  const touched: BoardCell[] = [];
  for (const { dir, dx, dy } of NEIGHBOR_DELTAS) {
    if (!edges[dir]) continue;
    const neighbor = board[coordKey(x + dx, y + dy)];
    if (neighbor && neighbor.kind === "VAULT" && !neighbor.vaultRevealed) {
      touched.push(neighbor);
    }
  }
  return touched;
}

/**
 * Computes consistent open edges for a newly revealed Decoy Vault so it seamlessly
 * matches any already-placed neighbors while remaining open on empty sides.
 */
export function computeRevealedDecoyEdges(
  board: Record<string, BoardCell>,
  vx: number,
  vy: number
): PathEdges {
  const edges: PathEdges = { N: true, E: true, S: true, W: true };
  for (const { dir, opp, dx, dy } of NEIGHBOR_DELTAS) {
    const neighbor = board[coordKey(vx + dx, vy + dy)];
    if (neighbor && !(neighbor.kind === "VAULT" && !neighbor.vaultRevealed)) {
      edges[dir] = neighbor.edges[opp];
    }
  }
  return edges;
}
