export type Direction = "north" | "south" | "east" | "west";
export type TableCategory = "small" | "standard" | "large" | "floor";
export type InteractableType = "cashier" | "wardrobe" | "notice_board" | "exit";

export interface SeatDefinition {
  seatIndex: number;
  x: number;
  y: number;
  facing: Direction;
}

export interface TableDefinition {
  id: string;
  name: string;
  category: TableCategory;
  capacity: number;
  /** Top-left tile coordinates and tile span for solid tabletop collision & rendering */
  tileX: number;
  tileY: number;
  tileW: number;
  tileH: number;
  /** World center & interaction trigger radius */
  x: number;
  y: number;
  interactionRadius: number;
  seats: SeatDefinition[];
}

export interface InteractableDefinition {
  id: string;
  type: InteractableType;
  label: string;
  subtitle: string;
  tileX: number;
  tileY: number;
  tileW: number;
  tileH: number;
  interactX: number;
  interactY: number;
  interactRadius: number;
}

export interface DecorationZone {
  id: string;
  kind: "rug" | "sofa" | "plant" | "counter_npc" | "window" | "lamp";
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
  solid?: boolean;
  tileX?: number;
  tileY?: number;
  tileW?: number;
  tileH?: number;
}

export interface CafeMapDefinition {
  id: string;
  name: string;
  cols: number;
  rows: number;
  tileSize: number;
  width: number;
  height: number;
  spawnPoint: { x: number; y: number };
  tables: TableDefinition[];
  interactables: InteractableDefinition[];
  decorations: DecorationZone[];
}

const T = 48;

export const COZY_CAFE_MAP: CafeMapDefinition = {
  id: "cozy-cafe-v1",
  name: "Sunlit Oak Café",
  cols: 28,
  rows: 18,
  tileSize: T,
  width: 28 * T,
  height: 18 * T,
  spawnPoint: { x: 14 * T, y: 15.2 * T },
  tables: [
    {
      id: "table_small_1",
      name: "Window Nook",
      category: "small",
      capacity: 2,
      tileX: 3,
      tileY: 8,
      tileW: 2,
      tileH: 1,
      x: 4 * T,
      y: 8.5 * T,
      interactionRadius: 120,
      seats: [
        { seatIndex: 0, x: 2.55 * T, y: 8.5 * T, facing: "east" },
        { seatIndex: 1, x: 5.45 * T, y: 8.5 * T, facing: "west" },
      ],
    },
    {
      id: "table_std_1",
      name: "Maple Table",
      category: "standard",
      capacity: 4,
      tileX: 9,
      tileY: 7,
      tileW: 3,
      tileH: 2,
      x: 10.5 * T,
      y: 8 * T,
      interactionRadius: 155,
      seats: [
        { seatIndex: 0, x: 10.5 * T, y: 6.42 * T, facing: "south" },
        { seatIndex: 1, x: 12.52 * T, y: 8 * T, facing: "west" },
        { seatIndex: 2, x: 10.5 * T, y: 9.58 * T, facing: "north" },
        { seatIndex: 3, x: 8.48 * T, y: 8 * T, facing: "east" },
      ],
    },
    {
      id: "table_large_1",
      name: "Grand Lantern Table",
      category: "large",
      capacity: 8,
      tileX: 16,
      tileY: 7,
      tileW: 5,
      tileH: 2,
      x: 18.5 * T,
      y: 8 * T,
      interactionRadius: 195,
      seats: [
        { seatIndex: 0, x: 17.0 * T, y: 6.42 * T, facing: "south" },
        { seatIndex: 1, x: 18.5 * T, y: 6.42 * T, facing: "south" },
        { seatIndex: 2, x: 20.0 * T, y: 6.42 * T, facing: "south" },
        { seatIndex: 3, x: 21.52 * T, y: 8.0 * T, facing: "west" },
        { seatIndex: 4, x: 20.0 * T, y: 9.58 * T, facing: "north" },
        { seatIndex: 5, x: 18.5 * T, y: 9.58 * T, facing: "north" },
        { seatIndex: 6, x: 17.0 * T, y: 9.58 * T, facing: "north" },
        { seatIndex: 7, x: 15.48 * T, y: 8.0 * T, facing: "east" },
      ],
    },
    {
      id: "table_std_2",
      name: "Matcha Booth",
      category: "standard",
      capacity: 4,
      tileX: 9,
      tileY: 12,
      tileW: 3,
      tileH: 2,
      x: 10.5 * T,
      y: 13 * T,
      interactionRadius: 155,
      seats: [
        { seatIndex: 0, x: 10.5 * T, y: 11.42 * T, facing: "south" },
        { seatIndex: 1, x: 12.52 * T, y: 13 * T, facing: "west" },
        { seatIndex: 2, x: 10.5 * T, y: 14.58 * T, facing: "north" },
        { seatIndex: 3, x: 8.48 * T, y: 13 * T, facing: "east" },
      ],
    },
    {
      id: "table_floor_1",
      name: "Cushion Tatami Lounge",
      category: "floor",
      capacity: 6,
      tileX: 19,
      tileY: 13,
      tileW: 4,
      tileH: 2,
      x: 21 * T,
      y: 14 * T,
      interactionRadius: 185,
      seats: [
        { seatIndex: 0, x: 20.0 * T, y: 12.42 * T, facing: "south" },
        { seatIndex: 1, x: 22.0 * T, y: 12.42 * T, facing: "south" },
        { seatIndex: 2, x: 23.52 * T, y: 14.0 * T, facing: "west" },
        { seatIndex: 3, x: 22.0 * T, y: 15.58 * T, facing: "north" },
        { seatIndex: 4, x: 20.0 * T, y: 15.58 * T, facing: "north" },
        { seatIndex: 5, x: 18.48 * T, y: 14.0 * T, facing: "east" },
      ],
    },
  ],
  interactables: [
    {
      id: "cashier_counter",
      type: "cashier",
      label: "Cashier & Guide",
      subtitle: "Learn rules & tutorials",
      tileX: 2,
      tileY: 3,
      tileW: 6,
      tileH: 2,
      interactX: 5 * T,
      interactY: 5.5 * T,
      interactRadius: 130,
    },
    {
      id: "notice_board",
      type: "notice_board",
      label: "Open Tables",
      subtitle: "See live & open tables",
      tileX: 20,
      tileY: 2,
      tileW: 3,
      tileH: 1,
      interactX: 21.5 * T,
      interactY: 3.5 * T,
      interactRadius: 115,
    },
    {
      id: "cafe_exit",
      type: "exit",
      label: "Café Door",
      subtitle: "Switch room or leave",
      tileX: 13,
      tileY: 16,
      tileW: 2,
      tileH: 1,
      interactX: 14 * T,
      interactY: 16.4 * T,
      interactRadius: 90,
    },
  ],
  decorations: [
    // Warm rugs beneath key zones
    { id: "rug_entrance", kind: "rug", x: 12 * T, y: 15 * T, w: 4 * T, h: 2 * T, color: "#E9C7A3" },
    { id: "rug_tatami", kind: "rug", x: 17.5 * T, y: 11.6 * T, w: 7 * T, h: 4.8 * T, color: "#DCE6CE" },
    { id: "rug_social", kind: "rug", x: 1.8 * T, y: 12.2 * T, w: 4.8 * T, h: 3.8 * T, color: "#EBD5D2" },
    { id: "rug_grand", kind: "rug", x: 14.8 * T, y: 5.8 * T, w: 7.4 * T, h: 4.4 * T, color: "#EFE2CB" },
    // Social corner sofa (solid)
    {
      id: "social_sofa",
      kind: "sofa",
      x: 2 * T,
      y: 13 * T,
      w: 3 * T,
      h: 1 * T,
      color: "#C98574",
      solid: true,
      tileX: 2,
      tileY: 13,
      tileW: 3,
      tileH: 1,
    },
    // Potted plants (solid corner greenery)
    { id: "plant_tl", kind: "plant", x: 1 * T, y: 2 * T, w: T, h: T, solid: true, tileX: 1, tileY: 2, tileW: 1, tileH: 1 },
    { id: "plant_mid", kind: "plant", x: 9 * T, y: 2 * T, w: T, h: T, solid: true, tileX: 9, tileY: 2, tileW: 1, tileH: 1 },
    { id: "plant_tr", kind: "plant", x: 25 * T, y: 2 * T, w: T, h: T, solid: true, tileX: 25, tileY: 2, tileW: 1, tileH: 1 },
    { id: "plant_bl", kind: "plant", x: 1 * T, y: 15 * T, w: T, h: T, solid: true, tileX: 1, tileY: 15, tileW: 1, tileH: 1 },
    { id: "plant_br", kind: "plant", x: 25 * T, y: 15 * T, w: T, h: T, solid: true, tileX: 25, tileY: 15, tileW: 1, tileH: 1 },
    // Barista NPC marker behind cashier counter
    { id: "barista_npc", kind: "counter_npc", x: 4.5 * T, y: 2.7 * T, w: T, h: T },
  ],
};

/** Build a boolean 2D collision matrix (true = blocked, false = walkable) */
export function buildCollisionGrid(map: CafeMapDefinition = COZY_CAFE_MAP): boolean[][] {
  const grid: boolean[][] = Array.from({ length: map.rows }, () =>
    Array.from({ length: map.cols }, () => false)
  );

  // Outer perimeter walls (top wall occupies rows 0-1, bottom row 17, left col 0, right col 27)
  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.cols; x++) {
      if (y <= 1 || y === map.rows - 1 || x === 0 || x === map.cols - 1) {
        grid[y]![x] = true;
      }
    }
  }

  const blockRect = (tx: number, ty: number, tw: number, th: number) => {
    for (let y = ty; y < ty + th; y++) {
      for (let x = tx; x < tx + tw; x++) {
        if (y >= 0 && y < map.rows && x >= 0 && x < map.cols) {
          grid[y]![x] = true;
        }
      }
    }
  };

  // Solid tabletops
  for (const tbl of map.tables) {
    blockRect(tbl.tileX, tbl.tileY, tbl.tileW, tbl.tileH);
  }

  // Solid interactables (cashier counter, wardrobe shelf, notice board — NOT exit rug)
  for (const obj of map.interactables) {
    if (obj.type !== "exit") {
      blockRect(obj.tileX, obj.tileY, obj.tileW, obj.tileH);
    }
  }

  // Solid decorative furniture
  for (const dec of map.decorations) {
    if (dec.solid && dec.tileX !== undefined && dec.tileY !== undefined && dec.tileW && dec.tileH) {
      blockRect(dec.tileX, dec.tileY, dec.tileW, dec.tileH);
    }
  }

  return grid;
}

const DEFAULT_COLLISION_GRID = buildCollisionGrid(COZY_CAFE_MAP);

export function isWalkableTile(
  tx: number,
  ty: number,
  map: CafeMapDefinition = COZY_CAFE_MAP,
  grid: boolean[][] = DEFAULT_COLLISION_GRID
): boolean {
  if (tx < 0 || ty < 0 || tx >= map.cols || ty >= map.rows) return false;
  return !grid[ty]![tx];
}

export function isWalkableWorldPos(
  x: number,
  y: number,
  radius = 12,
  map: CafeMapDefinition = COZY_CAFE_MAP,
  grid: boolean[][] = DEFAULT_COLLISION_GRID
): boolean {
  const samplePoints = [
    [x, y],
    [x - radius, y - radius],
    [x + radius, y - radius],
    [x - radius, y + radius],
    [x + radius, y + radius],
  ];
  for (const [px, py] of samplePoints) {
    const tx = Math.floor(px! / map.tileSize);
    const ty = Math.floor(py! / map.tileSize);
    if (!isWalkableTile(tx, ty, map, grid)) return false;
  }
  return true;
}

export function worldToTile(x: number, y: number, tileSize = COZY_CAFE_MAP.tileSize) {
  return {
    tx: Math.floor(x / tileSize),
    ty: Math.floor(y / tileSize),
  };
}

export function tileToWorldCenter(tx: number, ty: number, tileSize = COZY_CAFE_MAP.tileSize) {
  return {
    x: (tx + 0.5) * tileSize,
    y: (ty + 0.5) * tileSize,
  };
}

/** Lightweight 4-directional (+ safe diagonal) A* grid pathfinder for smooth tap-to-move */
export function findGridPath(
  startX: number,
  startY: number,
  goalX: number,
  goalY: number,
  map: CafeMapDefinition = COZY_CAFE_MAP,
  grid: boolean[][] = DEFAULT_COLLISION_GRID
): Array<{ x: number; y: number }> {
  const start = worldToTile(startX, startY, map.tileSize);
  let goal = worldToTile(goalX, goalY, map.tileSize);

  // If the user clicked a blocked furniture tile, snap goal to the nearest walkable neighbor
  if (!isWalkableTile(goal.tx, goal.ty, map, grid)) {
    let bestTx = -1;
    let bestTy = -1;
    let bestD = Infinity;
    for (let r = 1; r <= 3; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const ntx = goal.tx + dx;
          const nty = goal.ty + dy;
          if (isWalkableTile(ntx, nty, map, grid)) {
            const center = tileToWorldCenter(ntx, nty, map.tileSize);
            const d = Math.hypot(center.x - startX, center.y - startY);
            if (d < bestD) {
              bestTx = ntx;
              bestTy = nty;
              bestD = d;
            }
          }
        }
      }
      if (bestTx >= 0) break;
    }
    if (bestTx < 0) return [];
    goal = { tx: bestTx, ty: bestTy };
  }

  if (start.tx === goal.tx && start.ty === goal.ty) {
    return [tileToWorldCenter(goal.tx, goal.ty, map.tileSize)];
  }

  const key = (tx: number, ty: number) => `${tx},${ty}`;
  const openSet = new Set<string>([key(start.tx, start.ty)]);
  const cameFrom = new Map<string, { tx: number; ty: number }>();
  const gScore = new Map<string, number>([[key(start.tx, start.ty), 0]]);
  const fScore = new Map<string, number>([
    [key(start.tx, start.ty), Math.hypot(goal.tx - start.tx, goal.ty - start.ty)],
  ]);

  const dirs = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, 1.414],
    [-1, 1, 1.414],
    [1, -1, 1.414],
    [-1, -1, 1.414],
  ] as const;

  let iterations = 0;
  while (openSet.size > 0 && iterations++ < 800) {
    let currentKey = "";
    let bestF = Infinity;
    for (const k of openSet) {
      const f = fScore.get(k) ?? Infinity;
      if (f < bestF) {
        bestF = f;
        currentKey = k;
      }
    }
    const [cx, cy] = currentKey.split(",").map(Number) as [number, number];
    if (cx === goal.tx && cy === goal.ty) {
      const path: Array<{ x: number; y: number }> = [];
      let curr: { tx: number; ty: number } | undefined = { tx: cx, ty: cy };
      while (curr && !(curr.tx === start.tx && curr.ty === start.ty)) {
        path.push(tileToWorldCenter(curr.tx, curr.ty, map.tileSize));
        curr = cameFrom.get(key(curr.tx, curr.ty));
      }
      path.reverse();
      return path;
    }

    openSet.delete(currentKey);
    const currG = gScore.get(currentKey) ?? Infinity;

    for (const [dx, dy, cost] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!isWalkableTile(nx, ny, map, grid)) continue;
      // Prevent corner cutting on diagonal moves
      if (dx !== 0 && dy !== 0) {
        if (!isWalkableTile(cx + dx, cy, map, grid) || !isWalkableTile(cx, cy + dy, map, grid)) {
          continue;
        }
      }
      const nKey = key(nx, ny);
      const tentativeG = currG + cost;
      if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
        cameFrom.set(nKey, { tx: cx, ty: cy });
        gScore.set(nKey, tentativeG);
        fScore.set(nKey, tentativeG + Math.hypot(goal.tx - nx, goal.ty - ny));
        openSet.add(nKey);
      }
    }
  }

  return [];
}
