import type { HearthvaleTile, TileTemplate } from "./types.js";

export const START_TILE_TEMPLATE: TileTemplate = {
  templateId: "start_town_road",
  name: "Valley Gate",
  edges: { N: "TOWN", E: "ROAD", S: "FIELD", W: "ROAD" },
  segments: [
    { id: "town_n", kind: "TOWN", edges: ["N"], ax: 50, ay: 18 },
    { id: "road_ew", kind: "ROAD", edges: ["E", "W"], ax: 50, ay: 56 },
  ],
  count36: 0,
  count54: 0,
};

export const HEARTHVALE_TILE_TEMPLATES: readonly TileTemplate[] = [
  // --- ROADS (12 in Cozy / 17 in Grand) ---
  {
    templateId: "road_straight",
    name: "Cobble Lane",
    edges: { N: "ROAD", E: "FIELD", S: "ROAD", W: "FIELD" },
    segments: [{ id: "road_ns", kind: "ROAD", edges: ["N", "S"], ax: 50, ay: 50 }],
    count36: 2,
    count54: 3,
  },
  {
    templateId: "road_straight_lantern",
    name: "Lantern Lane",
    edges: { N: "ROAD", E: "FIELD", S: "ROAD", W: "FIELD" },
    segments: [
      { id: "road_ns", kind: "ROAD", edges: ["N", "S"], hasLantern: true, ax: 50, ay: 50 },
    ],
    hasLantern: true,
    count36: 2,
    count54: 3,
  },
  {
    templateId: "road_curve",
    name: "Meadow Bend",
    edges: { N: "FIELD", E: "ROAD", S: "ROAD", W: "FIELD" },
    segments: [{ id: "road_es", kind: "ROAD", edges: ["E", "S"], ax: 64, ay: 64 }],
    count36: 3,
    count54: 4,
  },
  {
    templateId: "road_curve_lantern",
    name: "Lantern Bend",
    edges: { N: "FIELD", E: "ROAD", S: "ROAD", W: "FIELD" },
    segments: [
      { id: "road_es", kind: "ROAD", edges: ["E", "S"], hasLantern: true, ax: 64, ay: 64 },
    ],
    hasLantern: true,
    count36: 2,
    count54: 3,
  },
  {
    templateId: "road_t_junction",
    name: "Village Fork",
    edges: { N: "FIELD", E: "ROAD", S: "ROAD", W: "ROAD" },
    segments: [
      { id: "road_e", kind: "ROAD", edges: ["E"], ax: 78, ay: 52 },
      { id: "road_s", kind: "ROAD", edges: ["S"], ax: 50, ay: 78 },
      { id: "road_w", kind: "ROAD", edges: ["W"], ax: 22, ay: 52 },
    ],
    count36: 2,
    count54: 3,
  },
  {
    templateId: "road_crossroads",
    name: "Market Cross",
    edges: { N: "ROAD", E: "ROAD", S: "ROAD", W: "ROAD" },
    segments: [
      { id: "road_n", kind: "ROAD", edges: ["N"], ax: 50, ay: 22 },
      { id: "road_e", kind: "ROAD", edges: ["E"], ax: 78, ay: 50 },
      { id: "road_s", kind: "ROAD", edges: ["S"], ax: 50, ay: 78 },
      { id: "road_w", kind: "ROAD", edges: ["W"], ax: 22, ay: 50 },
    ],
    count36: 1,
    count54: 1,
  },

  // --- TOWN CAPS (9 in Cozy / 15 in Grand) ---
  {
    templateId: "town_cap",
    name: "Town Wall",
    edges: { N: "TOWN", E: "FIELD", S: "FIELD", W: "FIELD" },
    segments: [{ id: "town_n", kind: "TOWN", edges: ["N"], ax: 50, ay: 18 }],
    count36: 2,
    count54: 4,
  },
  {
    templateId: "town_cap_road_straight",
    name: "Gatehouse Lane",
    edges: { N: "TOWN", E: "ROAD", S: "FIELD", W: "ROAD" },
    segments: [
      { id: "town_n", kind: "TOWN", edges: ["N"], ax: 50, ay: 18 },
      { id: "road_ew", kind: "ROAD", edges: ["E", "W"], ax: 50, ay: 56 },
    ],
    count36: 2,
    count54: 3,
  },
  {
    templateId: "town_cap_road_right",
    name: "Eastbound Gate",
    edges: { N: "TOWN", E: "ROAD", S: "ROAD", W: "FIELD" },
    segments: [
      { id: "town_n", kind: "TOWN", edges: ["N"], ax: 50, ay: 18 },
      { id: "road_es", kind: "ROAD", edges: ["E", "S"], ax: 66, ay: 66 },
    ],
    count36: 2,
    count54: 3,
  },
  {
    templateId: "town_cap_road_left",
    name: "Westbound Gate",
    edges: { N: "TOWN", E: "FIELD", S: "ROAD", W: "ROAD" },
    segments: [
      { id: "town_n", kind: "TOWN", edges: ["N"], ax: 50, ay: 18 },
      { id: "road_sw", kind: "ROAD", edges: ["S", "W"], ax: 34, ay: 66 },
    ],
    count36: 2,
    count54: 3,
  },
  {
    templateId: "town_cap_t_road",
    name: "Town Crossroads",
    edges: { N: "TOWN", E: "ROAD", S: "ROAD", W: "ROAD" },
    segments: [
      { id: "town_n", kind: "TOWN", edges: ["N"], ax: 50, ay: 18 },
      { id: "road_e", kind: "ROAD", edges: ["E"], ax: 78, ay: 56 },
      { id: "road_s", kind: "ROAD", edges: ["S"], ax: 50, ay: 80 },
      { id: "road_w", kind: "ROAD", edges: ["W"], ax: 22, ay: 56 },
    ],
    count36: 1,
    count54: 2,
  },

  // --- MULTI-EDGE TOWNS (11 in Cozy / 16 in Grand) ---
  {
    templateId: "town_corner",
    name: "Corner Quarter",
    edges: { N: "TOWN", E: "TOWN", S: "FIELD", W: "FIELD" },
    segments: [{ id: "town_ne", kind: "TOWN", edges: ["N", "E"], ax: 68, ay: 32 }],
    count36: 2,
    count54: 3,
  },
  {
    templateId: "town_corner_crest",
    name: "Banner Quarter",
    edges: { N: "TOWN", E: "TOWN", S: "FIELD", W: "FIELD" },
    segments: [
      { id: "town_ne", kind: "TOWN", edges: ["N", "E"], hasCrest: true, ax: 68, ay: 32 },
    ],
    hasCrest: true,
    count36: 2,
    count54: 3,
  },
  {
    templateId: "town_corner_road",
    name: "Harbor Bend",
    edges: { N: "TOWN", E: "TOWN", S: "ROAD", W: "ROAD" },
    segments: [
      { id: "town_ne", kind: "TOWN", edges: ["N", "E"], ax: 68, ay: 32 },
      { id: "road_sw", kind: "ROAD", edges: ["S", "W"], ax: 32, ay: 68 },
    ],
    count36: 2,
    count54: 3,
  },
  {
    templateId: "town_band_crest",
    name: "Grand Bridge",
    edges: { N: "FIELD", E: "TOWN", S: "FIELD", W: "TOWN" },
    segments: [
      { id: "town_ew", kind: "TOWN", edges: ["E", "W"], hasCrest: true, ax: 50, ay: 50 },
    ],
    hasCrest: true,
    count36: 1,
    count54: 2,
  },
  {
    templateId: "town_split_opposite",
    name: "Twin Walls",
    edges: { N: "TOWN", E: "FIELD", S: "TOWN", W: "FIELD" },
    segments: [
      { id: "town_n", kind: "TOWN", edges: ["N"], ax: 50, ay: 18 },
      { id: "town_s", kind: "TOWN", edges: ["S"], ax: 50, ay: 82 },
    ],
    count36: 1,
    count54: 2,
  },
  {
    templateId: "town_keep_crest",
    name: "Sunlit Keep",
    edges: { N: "TOWN", E: "TOWN", S: "FIELD", W: "TOWN" },
    segments: [
      { id: "town_new", kind: "TOWN", edges: ["N", "E", "W"], hasCrest: true, ax: 50, ay: 38 },
    ],
    hasCrest: true,
    count36: 1,
    count54: 1,
  },
  {
    templateId: "town_keep_road",
    name: "Keep Archway",
    edges: { N: "TOWN", E: "TOWN", S: "ROAD", W: "TOWN" },
    segments: [
      { id: "town_new", kind: "TOWN", edges: ["N", "E", "W"], ax: 50, ay: 36 },
      { id: "road_s", kind: "ROAD", edges: ["S"], ax: 50, ay: 82 },
    ],
    count36: 1,
    count54: 1,
  },
  {
    templateId: "town_citadel_crest",
    name: "Heart Citadel",
    edges: { N: "TOWN", E: "TOWN", S: "TOWN", W: "TOWN" },
    segments: [
      {
        id: "town_all",
        kind: "TOWN",
        edges: ["N", "E", "S", "W"],
        hasCrest: true,
        ax: 50,
        ay: 50,
      },
    ],
    hasCrest: true,
    count36: 1,
    count54: 1,
  },

  // --- HILLTOP WINDMILLS (4 in Cozy / 6 in Grand) ---
  {
    templateId: "windmill_meadow",
    name: "Hilltop Windmill",
    edges: { N: "FIELD", E: "FIELD", S: "FIELD", W: "FIELD" },
    segments: [{ id: "shrine", kind: "SHRINE", edges: [], ax: 50, ay: 50 }],
    hasShrine: true,
    count36: 2,
    count54: 3,
  },
  {
    templateId: "windmill_road",
    name: "Millstone Path",
    edges: { N: "FIELD", E: "FIELD", S: "ROAD", W: "FIELD" },
    segments: [
      { id: "shrine", kind: "SHRINE", edges: [], ax: 50, ay: 42 },
      { id: "road_s", kind: "ROAD", edges: ["S"], ax: 50, ay: 82 },
    ],
    hasShrine: true,
    count36: 2,
    count54: 3,
  },
] as const;

const TEMPLATE_MAP = new Map<string, TileTemplate>();
TEMPLATE_MAP.set(START_TILE_TEMPLATE.templateId, START_TILE_TEMPLATE);
for (const tpl of HEARTHVALE_TILE_TEMPLATES) {
  TEMPLATE_MAP.set(tpl.templateId, tpl);
}

export function getTileTemplate(templateId: string): TileTemplate {
  const tpl = TEMPLATE_MAP.get(templateId);
  if (!tpl) {
    throw new Error(`Unknown Hearthvale tile template: ${templateId}`);
  }
  return tpl;
}

export function buildHearthvaleDeck(deckSize: 36 | 54): HearthvaleTile[] {
  const tiles: HearthvaleTile[] = [];
  let seq = 1;
  for (const tpl of HEARTHVALE_TILE_TEMPLATES) {
    const count = deckSize === 54 ? tpl.count54 : tpl.count36;
    for (let i = 0; i < count; i++) {
      tiles.push({
        id: `hv_${seq++}_${tpl.templateId}`,
        templateId: tpl.templateId,
      });
    }
  }
  return tiles;
}
