import type {
  GearType,
  PathEdges,
  RoleType,
  TreasureTrailsCard,
} from "./types.js";

export function rotateEdges180(edges: PathEdges): PathEdges {
  return {
    N: edges.S,
    S: edges.N,
    E: edges.W,
    W: edges.E,
  };
}

export function getOrientedEdges(edges: PathEdges, rotation: 0 | 180): PathEdges {
  return rotation === 180 ? rotateEdges180(edges) : { ...edges };
}

export function getStartingHandSize(playerCount: number): number {
  if (playerCount <= 5) return 6;
  if (playerCount <= 7) return 5;
  return 4;
}

/**
 * Generates the role pool for 3-8 players.
 * When `mysteryRoles` is true on 5-7 player tables, an extra role card is placed in the pool
 * so 1 card remains hidden in the envelope.
 */
export function createRolePool(playerCount: number, mysteryRoles: boolean): RoleType[] {
  const pushMany = (arr: RoleType[], role: RoleType, count: number) => {
    for (let i = 0; i < count; i++) arr.push(role);
  };
  const pool: RoleType[] = [];

  if (playerCount === 3) {
    pushMany(pool, "TRAILBLAZER", 2);
    pushMany(pool, "TRICKSTER", 1);
  } else if (playerCount === 4) {
    pushMany(pool, "TRAILBLAZER", 3);
    pushMany(pool, "TRICKSTER", 1);
  } else if (playerCount === 5) {
    pushMany(pool, "TRAILBLAZER", mysteryRoles ? 4 : 3);
    pushMany(pool, "TRICKSTER", 2);
  } else if (playerCount === 6) {
    pushMany(pool, "TRAILBLAZER", mysteryRoles ? 5 : 4);
    pushMany(pool, "TRICKSTER", 2);
  } else if (playerCount === 7) {
    pushMany(pool, "TRAILBLAZER", 5);
    pushMany(pool, "TRICKSTER", mysteryRoles ? 3 : 2);
  } else {
    pushMany(pool, "TRAILBLAZER", 5);
    pushMany(pool, "TRICKSTER", 3);
  }

  return pool;
}

const GEAR_LABEL: Record<GearType, string> = {
  lantern: "Lantern",
  compass: "Compass",
  grapple: "Grapple",
};

/**
 * Creates the exact balanced 66-card Expedition Deck:
 * - 40 Path cards (31 Open Paths + 9 Dead-End Blockers)
 * - 26 Action cards (9 Hazards, 6 Single Repairs, 3 Dual Multi-Tools, 5 Spyglasses, 3 Boulder Clears)
 */
export function createExpeditionDeck(): TreasureTrailsCard[] {
  const cards: TreasureTrailsCard[] = [];
  let seq = 1;
  const nextId = (prefix: string) => `${prefix}_${seq++}`;

  const addPath = (
    variant: string,
    label: string,
    edges: PathEdges,
    connectedCenter: boolean,
    qty: number
  ) => {
    for (let i = 0; i < qty; i++) {
      cards.push({
        id: nextId("path"),
        kind: "PATH",
        variant,
        label,
        edges: { ...edges },
        connectedCenter,
      });
    }
  };

  // --- 31 Open Path Cards ---
  addPath("crossroads", "Crossroads", { N: true, E: true, S: true, W: true }, true, 5);
  addPath("t_horiz", "Horizontal Fork", { N: true, E: true, S: false, W: true }, true, 5);
  addPath("t_vert", "Vertical Fork", { N: true, E: true, S: true, W: false }, true, 5);
  addPath("straight_h", "East-West Trail", { N: false, E: true, S: false, W: true }, true, 4);
  addPath("straight_v", "North-South Trail", { N: true, E: false, S: true, W: false }, true, 3);
  addPath("curve_se", "Bend (E-S)", { N: false, E: true, S: true, W: false }, true, 5);
  addPath("curve_ne", "Bend (N-E)", { N: true, E: true, S: false, W: false }, true, 4);

  // --- 9 Dead-End / Blocker Path Cards ---
  addPath("dead_n", "Bramble End (N)", { N: true, E: false, S: false, W: false }, false, 1);
  addPath("dead_e", "Bramble End (E)", { N: false, E: true, S: false, W: false }, false, 1);
  addPath("dead_ne", "Blocked Bend (N-E)", { N: true, E: true, S: false, W: false }, false, 1);
  addPath("dead_es", "Blocked Bend (E-S)", { N: false, E: true, S: true, W: false }, false, 1);
  addPath("dead_ns", "Split Trail (N-S)", { N: true, E: false, S: true, W: false }, false, 1);
  addPath("dead_ew", "Split Trail (E-W)", { N: false, E: true, S: false, W: true }, false, 1);
  addPath("dead_new", "Rockfall Fork (H)", { N: true, E: true, S: false, W: true }, false, 1);
  addPath("dead_nes", "Rockfall Fork (V)", { N: true, E: true, S: true, W: false }, false, 1);
  addPath("dead_all", "Boulder Cross", { N: true, E: true, S: true, W: true }, false, 1);

  // --- 9 Hazard Cards ---
  const hazards: Array<[GearType, string]> = [
    ["lantern", "Dim Lantern"],
    ["compass", "Scrambled Compass"],
    ["grapple", "Snapped Grapple"],
  ];
  for (const [gear, label] of hazards) {
    for (let i = 0; i < 3; i++) {
      cards.push({ id: nextId("haz"), kind: "HAZARD", gear, label });
    }
  }

  // --- 6 Single-Gear Repair Cards ---
  const singleRepairs: Array<[GearType, string]> = [
    ["lantern", "Fresh Wick"],
    ["compass", "Calibrate Needle"],
    ["grapple", "Splice Rope"],
  ];
  for (const [gear, label] of singleRepairs) {
    for (let i = 0; i < 2; i++) {
      cards.push({ id: nextId("rep"), kind: "REPAIR", gears: [gear], label });
    }
  }

  // --- 3 Dual-Gear Multi-Tool Cards ---
  const dualPairs: Array<[GearType, GearType]> = [
    ["lantern", "compass"],
    ["compass", "grapple"],
    ["grapple", "lantern"],
  ];
  for (const [g1, g2] of dualPairs) {
    cards.push({
      id: nextId("multi"),
      kind: "REPAIR",
      gears: [g1, g2],
      label: `Multi-Tool (${GEAR_LABEL[g1]}/${GEAR_LABEL[g2]})`,
    });
  }

  // --- 5 Spyglass (Vault Scout) Cards ---
  for (let i = 0; i < 5; i++) {
    cards.push({ id: nextId("spy"), kind: "SPYGLASS", label: "Spyglass" });
  }

  // --- 3 Boulder Clear Cards ---
  for (let i = 0; i < 3; i++) {
    cards.push({ id: nextId("clr"), kind: "BOULDER_CLEAR", label: "Boulder Clear" });
  }

  return cards;
}
