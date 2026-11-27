import type {
  CardCategory,
  CardCost,
  CardEffect,
  DawnCardDef,
  EraNumber,
  WonderDef,
  WonderSide,
} from "./types";

/* ============================================================================
 *  SEVEN WONDERS OF DAWNSPIRE (Sunlit Side A & Starlit Side B)
 * ============================================================================ */

export const DAWN_WONDERS: Record<WonderSide, WonderDef[]> = {
  sunlit: [
    {
      id: "sunspire_lighthouse",
      name: "Sunspire Lighthouse",
      subtitle: "Beacon of Golden Trade",
      side: "sunlit",
      startingResource: "glass",
      accentHex: "#D49523",
      stages: [
        {
          stageIndex: 0,
          name: "Harbor Lantern",
          cost: { resources: { stone: 2 } },
          effect: { vp: 3 },
          shortEffect: "+3 ★",
        },
        {
          stageIndex: 1,
          name: "Crystal Mirror",
          cost: { resources: { ore: 2 } },
          effect: { producesChoice: ["timber", "stone", "clay", "ore"] },
          shortEffect: "Wild Raw (T/S/C/O)",
        },
        {
          stageIndex: 2,
          name: "Solar Crown",
          cost: { resources: { glass: 2 } },
          effect: { vp: 7 },
          shortEffect: "+7 ★",
        },
      ],
    },
    {
      id: "hanging_terraces",
      name: "Hanging Terraces",
      subtitle: "Gardens of Scholars",
      side: "sunlit",
      startingResource: "clay",
      accentHex: "#2E8A57",
      stages: [
        {
          stageIndex: 0,
          name: "Terraced Arches",
          cost: { resources: { clay: 2 } },
          effect: { vp: 3 },
          shortEffect: "+3 ★",
        },
        {
          stageIndex: 1,
          name: "Botanical Archive",
          cost: { resources: { timber: 3 } },
          effect: { wildScience: true },
          shortEffect: "+1 Wild Science",
        },
        {
          stageIndex: 2,
          name: "Sky Pavilion",
          cost: { resources: { clay: 4 } },
          effect: { vp: 7 },
          shortEffect: "+7 ★",
        },
      ],
    },
    {
      id: "iron_colossus",
      name: "Iron Colossus",
      subtitle: "Guardian of the Strait",
      side: "sunlit",
      startingResource: "ore",
      accentHex: "#C7463E",
      stages: [
        {
          stageIndex: 0,
          name: "Bronze Pedestal",
          cost: { resources: { timber: 2 } },
          effect: { vp: 3 },
          shortEffect: "+3 ★",
        },
        {
          stageIndex: 1,
          name: "Aegis Shield",
          cost: { resources: { clay: 3 } },
          effect: { shields: 2 },
          shortEffect: "+2 Shields ⚔",
        },
        {
          stageIndex: 2,
          name: "Radiant Torch",
          cost: { resources: { ore: 4 } },
          effect: { vp: 7 },
          shortEffect: "+7 ★",
        },
      ],
    },
    {
      id: "sunken_library",
      name: "Sunken Library",
      subtitle: "Vault of Silk & Lore",
      side: "sunlit",
      startingResource: "silk",
      accentHex: "#7E3F8F",
      stages: [
        {
          stageIndex: 0,
          name: "Marble Cloister",
          cost: { resources: { stone: 2 } },
          effect: { vp: 3 },
          shortEffect: "+3 ★",
        },
        {
          stageIndex: 1,
          name: "Artisan Rotunda",
          cost: { resources: { timber: 2 } },
          effect: { producesChoice: ["glass", "silk"] },
          shortEffect: "Wild Craft (Glass/Silk)",
        },
        {
          stageIndex: 2,
          name: "Grand Athenaeum",
          cost: { resources: { silk: 2 } },
          effect: { vp: 7 },
          shortEffect: "+7 ★",
        },
      ],
    },
    {
      id: "citadel_of_dawn",
      name: "Citadel of Dawn",
      subtitle: "Stone Bastion of Kings",
      side: "sunlit",
      startingResource: "stone",
      accentHex: "#2D6BB0",
      stages: [
        {
          stageIndex: 0,
          name: "Outer Ramparts",
          cost: { resources: { stone: 2 } },
          effect: { vp: 3 },
          shortEffect: "+3 ★",
        },
        {
          stageIndex: 1,
          name: "Sunlit Treasury",
          cost: { resources: { timber: 3 } },
          effect: { shields: 1, coins: 4, vp: 2 },
          shortEffect: "+1 ⚔ · +4g · +2 ★",
        },
        {
          stageIndex: 2,
          name: "Gilded Keep",
          cost: { resources: { stone: 4 } },
          effect: { vp: 7 },
          shortEffect: "+7 ★",
        },
      ],
    },
    {
      id: "grove_sanctuary",
      name: "Grove Sanctuary",
      subtitle: "Heart of Free Craft",
      side: "sunlit",
      startingResource: "timber",
      accentHex: "#4C8A56",
      stages: [
        {
          stageIndex: 0,
          name: "Cedar Steps",
          cost: { resources: { timber: 2 } },
          effect: { vp: 3 },
          shortEffect: "+3 ★",
        },
        {
          stageIndex: 1,
          name: "Master Blueprint",
          cost: { resources: { stone: 2 } },
          effect: { freeBuildPerEra: true },
          shortEffect: "1 Free Build / Era",
        },
        {
          stageIndex: 2,
          name: "Canopy Spire",
          cost: { resources: { ore: 2 } },
          effect: { vp: 7 },
          shortEffect: "+7 ★",
        },
      ],
    },
    {
      id: "golden_bazaar",
      name: "Golden Bazaar",
      subtitle: "Crossroads of Coin",
      side: "sunlit",
      startingResource: "timber",
      accentHex: "#B86E2E",
      stages: [
        {
          stageIndex: 0,
          name: "Merchant Gate",
          cost: { resources: { clay: 2 } },
          effect: { vp: 3 },
          shortEffect: "+3 ★",
        },
        {
          stageIndex: 1,
          name: "Royal Mint",
          cost: { resources: { ore: 2 } },
          effect: { coins: 9 },
          shortEffect: "+9 Gold",
        },
        {
          stageIndex: 2,
          name: "Emperor Arcade",
          cost: { resources: { stone: 3 } },
          effect: { vp: 7 },
          shortEffect: "+7 ★",
        },
      ],
    },
  ],

  starlit: [
    {
      id: "sunspire_lighthouse",
      name: "Sunspire Lighthouse",
      subtitle: "Starlit Sea Routes",
      side: "starlit",
      startingResource: "glass",
      accentHex: "#D49523",
      stages: [
        {
          stageIndex: 0,
          name: "Toll Wharf",
          cost: { resources: { clay: 2 } },
          effect: { vp: 2, coins: 4 },
          shortEffect: "+2 ★ · +4g",
        },
        {
          stageIndex: 1,
          name: "Freeport Charter",
          cost: { resources: { timber: 2 } },
          effect: { rawTradeLeft: true, rawTradeRight: true, vp: 3 },
          shortEffect: "Raw Trade 1g (Both) · +3 ★",
        },
        {
          stageIndex: 2,
          name: "Starlight Beacon",
          cost: { resources: { stone: 3 } },
          effect: { vp: 6, shields: 1 },
          shortEffect: "+6 ★ · +1 ⚔",
        },
      ],
    },
    {
      id: "hanging_terraces",
      name: "Hanging Terraces",
      subtitle: "Starlit Observatory",
      side: "starlit",
      startingResource: "clay",
      accentHex: "#2E8A57",
      stages: [
        {
          stageIndex: 0,
          name: "Moonlit Cistern",
          cost: { resources: { clay: 1, silk: 1 } },
          effect: { vp: 3, coins: 2 },
          shortEffect: "+3 ★ · +2g",
        },
        {
          stageIndex: 1,
          name: "Celestial Astrolabe",
          cost: { resources: { timber: 2, glass: 1 } },
          effect: { wildScience: true },
          shortEffect: "+1 Wild Science",
        },
        {
          stageIndex: 2,
          name: "Starlight Canopy",
          cost: { resources: { clay: 3, silk: 1 } },
          effect: { vp: 5, shields: 1 },
          shortEffect: "+5 ★ · +1 ⚔",
        },
      ],
    },
    {
      id: "iron_colossus",
      name: "Iron Colossus",
      subtitle: "Starlit Vanguard",
      side: "starlit",
      startingResource: "ore",
      accentHex: "#C7463E",
      stages: [
        {
          stageIndex: 0,
          name: "War Forge",
          cost: { resources: { stone: 3 } },
          effect: { shields: 1, vp: 3, coins: 3 },
          shortEffect: "+1 ⚔ · +3 ★ · +3g",
        },
        {
          stageIndex: 1,
          name: "Titan Halberd",
          cost: { resources: { ore: 4 } },
          effect: { shields: 2, vp: 5, coins: 4 },
          shortEffect: "+2 ⚔ · +5 ★ · +4g",
        },
      ],
    },
    {
      id: "sunken_library",
      name: "Sunken Library",
      subtitle: "Starlit Scriptoria",
      side: "starlit",
      startingResource: "silk",
      accentHex: "#7E3F8F",
      stages: [
        {
          stageIndex: 0,
          name: "Quarry Annex",
          cost: { resources: { clay: 2 } },
          effect: { producesChoice: ["timber", "stone", "clay", "ore"], vp: 2 },
          shortEffect: "Wild Raw · +2 ★",
        },
        {
          stageIndex: 1,
          name: "Patron Blueprints",
          cost: { resources: { timber: 2, glass: 1 } },
          effect: { freeBuildPerEra: true, vp: 3 },
          shortEffect: "1 Free Build / Era · +3 ★",
        },
        {
          stageIndex: 2,
          name: "Astral Dome",
          cost: { resources: { ore: 3, silk: 1 } },
          effect: { vp: 6 },
          shortEffect: "+6 ★",
        },
      ],
    },
    {
      id: "citadel_of_dawn",
      name: "Citadel of Dawn",
      subtitle: "Starlit Fortress",
      side: "starlit",
      startingResource: "stone",
      accentHex: "#2D6BB0",
      stages: [
        {
          stageIndex: 0,
          name: "Vaulted Gate",
          cost: { resources: { timber: 2 } },
          effect: { vp: 2, coins: 6 },
          shortEffect: "+2 ★ · +6g",
        },
        {
          stageIndex: 1,
          name: "Watchtower Bastion",
          cost: { resources: { stone: 3 } },
          effect: { shields: 2, vp: 4 },
          shortEffect: "+2 ⚔ · +4 ★",
        },
        {
          stageIndex: 2,
          name: "Crown Spire",
          cost: { resources: { clay: 3, ore: 1 } },
          effect: { producesChoice: ["glass", "silk"], vp: 5 },
          shortEffect: "Wild Craft · +5 ★",
        },
      ],
    },
    {
      id: "grove_sanctuary",
      name: "Grove Sanctuary",
      subtitle: "Starlit Elderwood",
      side: "starlit",
      startingResource: "timber",
      accentHex: "#4C8A56",
      stages: [
        {
          stageIndex: 0,
          name: "Sunwood Arch",
          cost: { resources: { stone: 2 } },
          effect: { vp: 4 },
          shortEffect: "+4 ★",
        },
        {
          stageIndex: 1,
          name: "Architect Shrine",
          cost: { resources: { clay: 2, glass: 1 } },
          effect: { freeBuildPerEra: true, coins: 3 },
          shortEffect: "1 Free Build / Era · +3g",
        },
        {
          stageIndex: 2,
          name: "World Tree Hall",
          cost: { resources: { ore: 2, silk: 1 } },
          effect: { vp: 6 },
          shortEffect: "+6 ★",
        },
      ],
    },
    {
      id: "golden_bazaar",
      name: "Golden Bazaar",
      subtitle: "Starlit Guildhall",
      side: "starlit",
      startingResource: "timber",
      accentHex: "#B86E2E",
      stages: [
        {
          stageIndex: 0,
          name: "Silk Exchange",
          cost: { resources: { timber: 2 } },
          effect: { vp: 2, coins: 5 },
          shortEffect: "+2 ★ · +5g",
        },
        {
          stageIndex: 1,
          name: "Guild Embassy",
          cost: { resources: { stone: 2, glass: 1 } },
          effect: { copyNeighborGuild: true },
          shortEffect: "Copy Best Neighbor Guild",
        },
        {
          stageIndex: 2,
          name: "Imperial Vault",
          cost: { resources: { ore: 3, silk: 1 } },
          effect: { vp: 6 },
          shortEffect: "+6 ★",
        },
      ],
    },
  ],
};

/* ============================================================================
 *  CARD TEMPLATES (EXACT 7*N SCALING FOR 3..7 HANDS — 2p USES 3 HANDS)
 * ============================================================================ */

interface CardTemplate {
  baseId: string;
  name: string;
  era: EraNumber;
  category: CardCategory;
  cost: CardCost;
  freeFrom?: string[];
  chainsTo?: string[];
  effect: CardEffect;
  shortEffect: string;
  /** Each number `p` adds 1 copy when `numHands >= p` */
  copiesAt: number[];
}

const ERA_1_TEMPLATES: CardTemplate[] = [
  // Raw Materials (Brown)
  {
    baseId: "timber_yard",
    name: "Timber Yard",
    era: 1,
    category: "raw",
    cost: {},
    effect: { producesFixed: ["timber"] },
    shortEffect: "+1 Timber",
    copiesAt: [3, 4],
  },
  {
    baseId: "stone_pit",
    name: "Stone Pit",
    era: 1,
    category: "raw",
    cost: {},
    effect: { producesFixed: ["stone"] },
    shortEffect: "+1 Stone",
    copiesAt: [3, 5],
  },
  {
    baseId: "clay_pool",
    name: "Clay Pool",
    era: 1,
    category: "raw",
    cost: {},
    effect: { producesFixed: ["clay"] },
    shortEffect: "+1 Clay",
    copiesAt: [3, 5],
  },
  {
    baseId: "ore_vein",
    name: "Ore Vein",
    era: 1,
    category: "raw",
    cost: {},
    effect: { producesFixed: ["ore"] },
    shortEffect: "+1 Ore",
    copiesAt: [3, 4],
  },
  {
    baseId: "tree_farm",
    name: "Tree Farm",
    era: 1,
    category: "raw",
    cost: { coins: 1 },
    effect: { producesChoice: ["timber", "clay"] },
    shortEffect: "Timber / Clay",
    copiesAt: [3, 6],
  },
  {
    baseId: "mine_cut",
    name: "Mountain Mine",
    era: 1,
    category: "raw",
    cost: { coins: 1 },
    effect: { producesChoice: ["stone", "ore"] },
    shortEffect: "Stone / Ore",
    copiesAt: [3, 6],
  },
  {
    baseId: "excavation",
    name: "Excavation",
    era: 1,
    category: "raw",
    cost: { coins: 1 },
    effect: { producesChoice: ["stone", "clay"] },
    shortEffect: "Stone / Clay",
    copiesAt: [4],
  },
  {
    baseId: "forest_cave",
    name: "Forest Cave",
    era: 1,
    category: "raw",
    cost: { coins: 1 },
    effect: { producesChoice: ["timber", "ore"] },
    shortEffect: "Timber / Ore",
    copiesAt: [5],
  },
  {
    baseId: "clay_pit",
    name: "Clay Pit",
    era: 1,
    category: "raw",
    cost: { coins: 1 },
    effect: { producesChoice: ["clay", "ore"] },
    shortEffect: "Clay / Ore",
    copiesAt: [7],
  },

  // Fine Crafts (Silver)
  {
    baseId: "glassworks",
    name: "Glassworks",
    era: 1,
    category: "craft",
    cost: {},
    effect: { producesFixed: ["glass"] },
    shortEffect: "+1 Glass",
    copiesAt: [3, 5],
  },
  {
    baseId: "silk_loom",
    name: "Silk Loom",
    era: 1,
    category: "craft",
    cost: {},
    effect: { producesFixed: ["silk"] },
    shortEffect: "+1 Silk",
    copiesAt: [3, 6],
  },

  // Civic (Blue)
  {
    baseId: "sunlit_altar",
    name: "Sunlit Altar",
    era: 1,
    category: "civic",
    cost: {},
    chainsTo: ["temple"],
    effect: { vp: 2 },
    shortEffect: "+2 ★",
    copiesAt: [3, 5],
  },
  {
    baseId: "meadow_baths",
    name: "Meadow Baths",
    era: 1,
    category: "civic",
    cost: { resources: { stone: 1 } },
    chainsTo: ["aqueduct"],
    effect: { vp: 3 },
    shortEffect: "+3 ★",
    copiesAt: [3, 7],
  },
  {
    baseId: "stone_theater",
    name: "Stone Theater",
    era: 1,
    category: "civic",
    cost: {},
    chainsTo: ["statue"],
    effect: { vp: 2 },
    shortEffect: "+2 ★",
    copiesAt: [3, 6],
  },
  {
    baseId: "pawnshop",
    name: "Civic Arch",
    era: 1,
    category: "civic",
    cost: {},
    effect: { vp: 3 },
    shortEffect: "+3 ★",
    copiesAt: [4, 7],
  },

  // Commerce (Yellow)
  {
    baseId: "west_post",
    name: "West Trading Post",
    era: 1,
    category: "commerce",
    cost: {},
    chainsTo: ["forum"],
    effect: { rawTradeLeft: true },
    shortEffect: "Left Raw = 1g",
    copiesAt: [3, 7],
  },
  {
    baseId: "east_post",
    name: "East Trading Post",
    era: 1,
    category: "commerce",
    cost: {},
    chainsTo: ["forum"],
    effect: { rawTradeRight: true },
    shortEffect: "Right Raw = 1g",
    copiesAt: [3, 7],
  },
  {
    baseId: "craft_market",
    name: "Craft Market",
    era: 1,
    category: "commerce",
    cost: {},
    chainsTo: ["caravansery"],
    effect: { craftTradeBoth: true },
    shortEffect: "All Craft = 1g",
    copiesAt: [3, 6],
  },
  {
    baseId: "tavern",
    name: "Oak Tavern",
    era: 1,
    category: "commerce",
    cost: {},
    effect: { coins: 5 },
    shortEffect: "+5 Gold",
    copiesAt: [3, 4, 5, 7],
  },

  // Military (Red)
  {
    baseId: "stockade",
    name: "Stockade",
    era: 1,
    category: "military",
    cost: { resources: { timber: 1 } },
    effect: { shields: 1 },
    shortEffect: "+1 Shield ⚔",
    copiesAt: [3, 7],
  },
  {
    baseId: "barracks",
    name: "Barracks",
    era: 1,
    category: "military",
    cost: { resources: { ore: 1 } },
    effect: { shields: 1 },
    shortEffect: "+1 Shield ⚔",
    copiesAt: [3, 5],
  },
  {
    baseId: "guard_tower",
    name: "Guard Tower",
    era: 1,
    category: "military",
    cost: { resources: { clay: 1 } },
    effect: { shields: 1 },
    shortEffect: "+1 Shield ⚔",
    copiesAt: [3, 4],
  },

  // Science (Green)
  {
    baseId: "apothecary",
    name: "Apothecary",
    era: 1,
    category: "science",
    cost: { resources: { silk: 1 } },
    chainsTo: ["stables", "dispensary"],
    effect: { science: "compass" },
    shortEffect: "Compass 🧭",
    copiesAt: [3, 4],
  },
  {
    baseId: "workshop",
    name: "Workshop",
    era: 1,
    category: "science",
    cost: { resources: { glass: 1 } },
    chainsTo: ["archery_range", "laboratory"],
    effect: { science: "gear" },
    shortEffect: "Gear ⚙",
    copiesAt: [3, 6],
  },
  {
    baseId: "scriptorium",
    name: "Scriptorium",
    era: 1,
    category: "science",
    cost: { resources: { clay: 1 } },
    chainsTo: ["courthouse", "library"],
    effect: { science: "tablet" },
    shortEffect: "Tablet 📜",
    copiesAt: [3, 6],
  },
];

const ERA_2_TEMPLATES: CardTemplate[] = [
  // Double Raw (Brown)
  {
    baseId: "sawmill",
    name: "Sawmill",
    era: 2,
    category: "raw",
    cost: { coins: 1 },
    effect: { producesFixed: ["timber", "timber"] },
    shortEffect: "+2 Timber",
    copiesAt: [3, 4],
  },
  {
    baseId: "quarry",
    name: "Quarry",
    era: 2,
    category: "raw",
    cost: { coins: 1 },
    effect: { producesFixed: ["stone", "stone"] },
    shortEffect: "+2 Stone",
    copiesAt: [3, 4],
  },
  {
    baseId: "brickyard",
    name: "Brickyard",
    era: 2,
    category: "raw",
    cost: { coins: 1 },
    effect: { producesFixed: ["clay", "clay"] },
    shortEffect: "+2 Clay",
    copiesAt: [3, 4],
  },
  {
    baseId: "foundry",
    name: "Foundry",
    era: 2,
    category: "raw",
    cost: { coins: 1 },
    effect: { producesFixed: ["ore", "ore"] },
    shortEffect: "+2 Ore",
    copiesAt: [3, 4],
  },

  // Fine Crafts (Silver)
  {
    baseId: "glassworks_ii",
    name: "Crystal Kiln",
    era: 2,
    category: "craft",
    cost: {},
    effect: { producesFixed: ["glass"] },
    shortEffect: "+1 Glass",
    copiesAt: [3, 5],
  },
  {
    baseId: "silk_loom_ii",
    name: "Royal Weaver",
    era: 2,
    category: "craft",
    cost: {},
    effect: { producesFixed: ["silk"] },
    shortEffect: "+1 Silk",
    copiesAt: [3, 5],
  },

  // Civic (Blue)
  {
    baseId: "aqueduct",
    name: "Aqueduct",
    era: 2,
    category: "civic",
    cost: { resources: { stone: 3 } },
    freeFrom: ["meadow_baths"],
    effect: { vp: 5 },
    shortEffect: "+5 ★",
    copiesAt: [3, 7],
  },
  {
    baseId: "temple",
    name: "Sun Temple",
    era: 2,
    category: "civic",
    cost: { resources: { timber: 1, clay: 1, glass: 1 } },
    freeFrom: ["sunlit_altar"],
    chainsTo: ["pantheon"],
    effect: { vp: 3 },
    shortEffect: "+3 ★",
    copiesAt: [3, 6],
  },
  {
    baseId: "statue",
    name: "Marble Statue",
    era: 2,
    category: "civic",
    cost: { resources: { ore: 2, timber: 1 } },
    freeFrom: ["stone_theater"],
    chainsTo: ["gardens"],
    effect: { vp: 4 },
    shortEffect: "+4 ★",
    copiesAt: [3, 7],
  },
  {
    baseId: "courthouse",
    name: "Courthouse",
    era: 2,
    category: "civic",
    cost: { resources: { clay: 2, silk: 1 } },
    freeFrom: ["scriptorium"],
    effect: { vp: 4 },
    shortEffect: "+4 ★",
    copiesAt: [3, 5],
  },

  // Commerce (Yellow)
  {
    baseId: "forum",
    name: "Grand Forum",
    era: 2,
    category: "commerce",
    cost: { resources: { clay: 2 } },
    freeFrom: ["west_post", "east_post"],
    chainsTo: ["haven"],
    effect: { producesChoice: ["glass", "silk"] },
    shortEffect: "Wild Craft (Glass/Silk)",
    copiesAt: [3, 6, 7],
  },
  {
    baseId: "caravansery",
    name: "Caravansery",
    era: 2,
    category: "commerce",
    cost: { resources: { timber: 2 } },
    freeFrom: ["craft_market"],
    chainsTo: ["lighthouse"],
    effect: { producesChoice: ["timber", "stone", "clay", "ore"] },
    shortEffect: "Wild Raw (T/S/C/O)",
    copiesAt: [3, 5, 6],
  },
  {
    baseId: "vineyard",
    name: "Sun Vineyard",
    era: 2,
    category: "commerce",
    cost: {},
    effect: { coinsPerCategory: { categories: ["raw"], scope: "all", amount: 1 } },
    shortEffect: "+1g / Brown (All)",
    copiesAt: [3, 6],
  },
  {
    baseId: "bazaar",
    name: "Craft Bazaar",
    era: 2,
    category: "commerce",
    cost: {},
    effect: { coinsPerCategory: { categories: ["craft"], scope: "all", amount: 2 } },
    shortEffect: "+2g / Craft (All)",
    copiesAt: [3, 4, 7],
  },

  // Military (Red)
  {
    baseId: "walls",
    name: "City Walls",
    era: 2,
    category: "military",
    cost: { resources: { stone: 3 } },
    chainsTo: ["fortifications"],
    effect: { shields: 2 },
    shortEffect: "+2 Shields ⚔",
    copiesAt: [3, 6, 7],
  },
  {
    baseId: "stables",
    name: "Cavalry Stables",
    era: 2,
    category: "military",
    cost: { resources: { clay: 1, timber: 1, ore: 1 } },
    freeFrom: ["apothecary"],
    effect: { shields: 2 },
    shortEffect: "+2 Shields ⚔",
    copiesAt: [3, 5],
  },
  {
    baseId: "archery_range",
    name: "Archery Range",
    era: 2,
    category: "military",
    cost: { resources: { timber: 2, ore: 1 } },
    freeFrom: ["workshop"],
    effect: { shields: 2 },
    shortEffect: "+2 Shields ⚔",
    copiesAt: [3, 6],
  },
  {
    baseId: "training_ground",
    name: "Training Ground",
    era: 2,
    category: "military",
    cost: { resources: { ore: 2, timber: 1 } },
    chainsTo: ["circus"],
    effect: { shields: 2 },
    shortEffect: "+2 Shields ⚔",
    copiesAt: [4, 5, 7],
  },

  // Science (Green)
  {
    baseId: "dispensary",
    name: "Dispensary",
    era: 2,
    category: "science",
    cost: { resources: { ore: 2, glass: 1 } },
    freeFrom: ["apothecary"],
    chainsTo: ["arena", "lodge"],
    effect: { science: "compass" },
    shortEffect: "Compass 🧭",
    copiesAt: [3, 4],
  },
  {
    baseId: "laboratory",
    name: "Laboratory",
    era: 2,
    category: "science",
    cost: { resources: { clay: 2, silk: 1 } },
    freeFrom: ["workshop"],
    chainsTo: ["siege_workshop", "observatory"],
    effect: { science: "gear" },
    shortEffect: "Gear ⚙",
    copiesAt: [3, 5],
  },
  {
    baseId: "library",
    name: "Grand Library",
    era: 2,
    category: "science",
    cost: { resources: { stone: 2, silk: 1 } },
    freeFrom: ["scriptorium"],
    chainsTo: ["senate", "university"],
    effect: { science: "tablet" },
    shortEffect: "Tablet 📜",
    copiesAt: [3, 6],
  },
  {
    baseId: "school",
    name: "Academy Hall",
    era: 2,
    category: "science",
    cost: { resources: { timber: 1, silk: 1 } },
    chainsTo: ["academy", "study"],
    effect: { science: "tablet" },
    shortEffect: "Tablet 📜",
    copiesAt: [3, 7],
  },
];

const ERA_3_STANDARD_TEMPLATES: CardTemplate[] = [
  // Civic (Blue)
  {
    baseId: "pantheon",
    name: "Pantheon",
    era: 3,
    category: "civic",
    cost: { resources: { clay: 2, ore: 1, glass: 1, silk: 1 } },
    freeFrom: ["temple"],
    effect: { vp: 7 },
    shortEffect: "+7 ★",
    copiesAt: [3, 6],
  },
  {
    baseId: "gardens",
    name: "Royal Gardens",
    era: 3,
    category: "civic",
    cost: { resources: { clay: 2, timber: 1 } },
    freeFrom: ["statue"],
    effect: { vp: 5 },
    shortEffect: "+5 ★",
    copiesAt: [3, 4],
  },
  {
    baseId: "town_hall",
    name: "Town Hall",
    era: 3,
    category: "civic",
    cost: { resources: { stone: 2, ore: 1, glass: 1 } },
    effect: { vp: 6 },
    shortEffect: "+6 ★",
    copiesAt: [3, 5, 6],
  },
  {
    baseId: "palace",
    name: "Dawn Palace",
    era: 3,
    category: "civic",
    cost: { resources: { stone: 1, timber: 1, ore: 1, clay: 1, glass: 1, silk: 1 } },
    effect: { vp: 8 },
    shortEffect: "+8 ★",
    copiesAt: [3, 7],
  },
  {
    baseId: "senate",
    name: "Senate",
    era: 3,
    category: "civic",
    cost: { resources: { timber: 2, stone: 1, ore: 1 } },
    freeFrom: ["library"],
    effect: { vp: 6 },
    shortEffect: "+6 ★",
    copiesAt: [3, 5],
  },

  // Commerce (Yellow)
  {
    baseId: "haven",
    name: "Grand Haven",
    era: 3,
    category: "commerce",
    cost: { resources: { timber: 1, ore: 1, silk: 1 } },
    freeFrom: ["forum"],
    effect: {
      coinsPerCategory: { categories: ["raw"], scope: "self", amount: 1 },
      vpPerCategory: { categories: ["raw"], scope: "self", amount: 1 },
    },
    shortEffect: "+1g & +1★ / Brown",
    copiesAt: [3, 4],
  },
  {
    baseId: "lighthouse",
    name: "Trade Lighthouse",
    era: 3,
    category: "commerce",
    cost: { resources: { stone: 1, glass: 1 } },
    freeFrom: ["caravansery"],
    effect: {
      coinsPerCategory: { categories: ["commerce"], scope: "self", amount: 1 },
      vpPerCategory: { categories: ["commerce"], scope: "self", amount: 1 },
    },
    shortEffect: "+1g & +1★ / Yellow",
    copiesAt: [3, 6],
  },
  {
    baseId: "arena",
    name: "Sun Arena",
    era: 3,
    category: "commerce",
    cost: { resources: { stone: 2, ore: 1 } },
    freeFrom: ["dispensary"],
    effect: {
      coinsPerWonderStage: 3,
      vpPerWonderStage: { scope: "self", amount: 1 },
    },
    shortEffect: "+3g & +1★ / Stage",
    copiesAt: [3, 5, 7],
  },
  {
    baseId: "chamber_commerce",
    name: "Chamber of Trade",
    era: 3,
    category: "commerce",
    cost: { resources: { clay: 2, silk: 1 } },
    effect: {
      coinsPerCategory: { categories: ["craft"], scope: "self", amount: 2 },
      vpPerCategory: { categories: ["craft"], scope: "self", amount: 2 },
    },
    shortEffect: "+2g & +2★ / Craft",
    copiesAt: [4, 6],
  },

  // Military (Red)
  {
    baseId: "fortifications",
    name: "Fortifications",
    era: 3,
    category: "military",
    cost: { resources: { ore: 3, stone: 1 } },
    freeFrom: ["walls"],
    effect: { shields: 3 },
    shortEffect: "+3 Shields ⚔",
    copiesAt: [3, 7],
  },
  {
    baseId: "arsenal",
    name: "Royal Arsenal",
    era: 3,
    category: "military",
    cost: { resources: { timber: 2, ore: 1, silk: 1 } },
    effect: { shields: 3 },
    shortEffect: "+3 Shields ⚔",
    copiesAt: [3, 4, 7],
  },
  {
    baseId: "siege_workshop",
    name: "Siege Workshop",
    era: 3,
    category: "military",
    cost: { resources: { clay: 3, timber: 1 } },
    freeFrom: ["laboratory"],
    effect: { shields: 3 },
    shortEffect: "+3 Shields ⚔",
    copiesAt: [3, 5],
  },
  {
    baseId: "circus",
    name: "Grand Circus",
    era: 3,
    category: "military",
    cost: { resources: { stone: 3, ore: 1 } },
    freeFrom: ["training_ground"],
    effect: { shields: 3 },
    shortEffect: "+3 Shields ⚔",
    copiesAt: [4, 5, 6],
  },

  // Science (Green)
  {
    baseId: "lodge",
    name: "Scholars Lodge",
    era: 3,
    category: "science",
    cost: { resources: { clay: 2, silk: 1 } },
    freeFrom: ["dispensary"],
    effect: { science: "compass" },
    shortEffect: "Compass 🧭",
    copiesAt: [3, 6],
  },
  {
    baseId: "observatory",
    name: "Observatory",
    era: 3,
    category: "science",
    cost: { resources: { ore: 2, glass: 1, silk: 1 } },
    freeFrom: ["laboratory"],
    effect: { science: "gear" },
    shortEffect: "Gear ⚙",
    copiesAt: [3, 7],
  },
  {
    baseId: "university",
    name: "University",
    era: 3,
    category: "science",
    cost: { resources: { timber: 2, glass: 1, silk: 1 } },
    freeFrom: ["library"],
    effect: { science: "tablet" },
    shortEffect: "Tablet 📜",
    copiesAt: [3, 4],
  },
  {
    baseId: "academy",
    name: "Royal Academy",
    era: 3,
    category: "science",
    cost: { resources: { stone: 3, glass: 1 } },
    freeFrom: ["school"],
    effect: { science: "compass" },
    shortEffect: "Compass 🧭",
    copiesAt: [3, 7],
  },
  {
    baseId: "study",
    name: "Grand Study",
    era: 3,
    category: "science",
    cost: { resources: { timber: 1, glass: 1, silk: 1 } },
    freeFrom: ["school"],
    effect: { science: "gear" },
    shortEffect: "Gear ⚙",
    copiesAt: [3, 5],
  },
];

export const GRAND_GUILD_TEMPLATES: Omit<CardTemplate, "copiesAt">[] = [
  {
    baseId: "guild_builders",
    name: "Builders Guild",
    era: 3,
    category: "guild",
    cost: { resources: { stone: 2, clay: 2, glass: 1 } },
    effect: { vpPerWonderStage: { scope: "all", amount: 1 } },
    shortEffect: "+1★ / Stage (All)",
  },
  {
    baseId: "guild_scholars",
    name: "Scholars Guild",
    era: 3,
    category: "guild",
    cost: { resources: { timber: 2, ore: 2, silk: 1 } },
    effect: { wildScience: true },
    shortEffect: "+1 Wild Science",
  },
  {
    baseId: "guild_craftsmen",
    name: "Craftsmen Guild",
    era: 3,
    category: "guild",
    cost: { resources: { ore: 2, stone: 2 } },
    effect: { vpPerCategory: { categories: ["craft"], scope: "neighbors", amount: 2 } },
    shortEffect: "+2★ / Craft (Nbrs)",
  },
  {
    baseId: "guild_workers",
    name: "Timberwrights Guild",
    era: 3,
    category: "guild",
    cost: { resources: { ore: 2, clay: 1, stone: 1, timber: 1 } },
    effect: { vpPerCategory: { categories: ["raw"], scope: "neighbors", amount: 1 } },
    shortEffect: "+1★ / Brown (Nbrs)",
  },
  {
    baseId: "guild_magistrates",
    name: "Magistrates Guild",
    era: 3,
    category: "guild",
    cost: { resources: { timber: 3, stone: 1, silk: 1 } },
    effect: { vpPerCategory: { categories: ["civic"], scope: "neighbors", amount: 1 } },
    shortEffect: "+1★ / Blue (Nbrs)",
  },
  {
    baseId: "guild_merchants",
    name: "Merchants Guild",
    era: 3,
    category: "guild",
    cost: { resources: { glass: 1, silk: 1, clay: 1 } },
    effect: { vpPerCategory: { categories: ["commerce"], scope: "neighbors", amount: 1 } },
    shortEffect: "+1★ / Yellow (Nbrs)",
  },
  {
    baseId: "guild_strategists",
    name: "Strategists Guild",
    era: 3,
    category: "guild",
    cost: { resources: { ore: 2, stone: 1, silk: 1 } },
    effect: { vpPerNeighborDefeat: 1 },
    shortEffect: "+1★ / Nbr Defeats",
  },
  {
    baseId: "guild_shipowners",
    name: "Shipowners Guild",
    era: 3,
    category: "guild",
    cost: { resources: { timber: 3, glass: 1, silk: 1 } },
    effect: {
      vpPerCategory: { categories: ["raw", "craft", "guild"], scope: "self", amount: 1 },
    },
    shortEffect: "+1★ / Own Brn/Cft/Prp",
  },
  {
    baseId: "guild_philosophers",
    name: "Philosophers Guild",
    era: 3,
    category: "guild",
    cost: { resources: { clay: 3, glass: 1, silk: 1 } },
    effect: { vpPerCategory: { categories: ["science"], scope: "neighbors", amount: 1 } },
    shortEffect: "+1★ / Green (Nbrs)",
  },
];

export const CARD_NAME_BY_BASE_ID: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const t of [
    ...ERA_1_TEMPLATES,
    ...ERA_2_TEMPLATES,
    ...ERA_3_STANDARD_TEMPLATES,
    ...GRAND_GUILD_TEMPLATES,
  ]) {
    map[t.baseId] = t.name;
  }
  return map;
})();

export function shuffleArray<T>(arr: T[], rng: () => number = Math.random): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * Builds the exact shuffled deck of `numHands * 7` cards for a given Era.
 * For 2-player Caravan Duel mode, `numHands = 3` (21 cards, 3 rotating hands).
 */
export function buildEraDeck(
  era: EraNumber,
  playerCount: number,
  rng: () => number = Math.random
): DawnCardDef[] {
  const numHands = Math.max(3, Math.min(7, playerCount));
  const templates =
    era === 1
      ? ERA_1_TEMPLATES
      : era === 2
        ? ERA_2_TEMPLATES
        : ERA_3_STANDARD_TEMPLATES;

  const cards: DawnCardDef[] = [];
  for (const tpl of templates) {
    let copyNum = 0;
    for (const threshold of tpl.copiesAt) {
      if (numHands >= threshold) {
        copyNum += 1;
        cards.push({
          id: `e${era}_${tpl.baseId}_${copyNum}`,
          baseId: tpl.baseId,
          name: tpl.name,
          era: tpl.era,
          category: tpl.category,
          cost: tpl.cost,
          freeFrom: tpl.freeFrom,
          chainsTo: tpl.chainsTo,
          effect: tpl.effect,
          shortEffect: tpl.shortEffect,
        });
      }
    }
  }

  if (era === 3) {
    const guildCount = numHands + 2;
    const pickedGuilds = shuffleArray(GRAND_GUILD_TEMPLATES, rng).slice(0, guildCount);
    for (const g of pickedGuilds) {
      cards.push({
        id: `e3_${g.baseId}_1`,
        baseId: g.baseId,
        name: g.name,
        era: 3,
        category: "guild",
        cost: g.cost,
        effect: g.effect,
        shortEffect: g.shortEffect,
      });
    }
  }

  return shuffleArray(cards, rng);
}
