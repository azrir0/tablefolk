import { z } from "zod";
import type { GameResultSummary } from "@tablefolk/game-engine";

export const RESOURCES = ["timber", "clay", "wool", "grain", "ore"] as const;
export type ResourceType = (typeof RESOURCES)[number];

export type TerrainType = ResourceType | "desert";
export type HarborKind = ResourceType | "any";

export type ResourcePool = Record<ResourceType, number>;

export type ScrollKind =
  | "knight"
  | "victory_point"
  | "road_builder"
  | "year_of_plenty"
  | "monopoly";

export interface ScrollCard {
  id: string;
  kind: ScrollKind;
  boughtOnTurn: number;
}

export interface HexTile {
  id: number;
  q: number;
  r: number;
  cx: number;
  cy: number;
  terrain: TerrainType;
  numberToken: number | null;
  vertexIds: number[];
  edgeIds: number[];
}

export interface IslandVertex {
  id: number;
  x: number;
  y: number;
  hexIds: number[];
  edgeIds: number[];
  neighborVertexIds: number[];
  harbor: HarborKind | null;
}

export interface IslandEdge {
  id: number;
  v1: number;
  v2: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  hexIds: number[];
}

export interface IslandHarbor {
  id: number;
  edgeId: number;
  v1: number;
  v2: number;
  kind: HarborKind;
  /** Outward ocean badge coordinate for crisp SVG rendering */
  badgeX: number;
  badgeY: number;
}

export interface IslandBoard {
  hexes: HexTile[];
  vertices: IslandVertex[];
  edges: IslandEdge[];
  harbors: IslandHarbor[];
}

export interface BuildingPiece {
  ownerId: string;
  kind: "cottage" | "town";
}

export interface TradeOffer {
  id: string;
  fromUserId: string;
  fromName: string;
  give: ResourcePool;
  want: ResourcePool;
  declinedByUserIds: string[];
  createdAtTurn: number;
}

export type HarborPhase = "IN_PROGRESS" | "GAME_END";

export type HarborStep =
  | "SETUP_SETTLE"
  | "SETUP_ROAD"
  | "ROLL_DICE"
  | "DISCARD_RESOURCES"
  | "MOVE_BANDIT"
  | "FREE_ROADS"
  | "MAIN_PHASE";

export interface HarborPlayerState {
  userId: string;
  displayName: string;
  seatIndex: number;
  colorIndex: number;
  resources: ResourcePool;
  scrolls: ScrollCard[];
  knightsPlayed: number;
  vpScrollsCount: number;
  compassCharges: number;
  roadsRemaining: number;
  cottagesRemaining: number;
  townsRemaining: number;
  longestRoadLength: number;
  consecutiveTimeouts: number;
}

export interface HarborPublicPlayer {
  userId: string;
  displayName: string;
  seatIndex: number;
  colorIndex: number;
  resourceCount: number;
  scrollCount: number;
  knightsPlayed: number;
  compassCharges: number;
  roadsRemaining: number;
  cottagesRemaining: number;
  townsRemaining: number;
  longestRoadLength: number;
  publicVP: number;
  /** Revealed at GAME_END (includes hidden Landmark VP scrolls). */
  finalVP: number | null;
  hasLongestRoad: boolean;
  hasLargestWatch: boolean;
  consecutiveTimeouts: number;
}

export interface HarborConfig {
  /** Target victory points: 8 (Quick) or 10 (Classic). */
  targetVP: 8 | 10;
  turnSeconds: number;
}

export interface HarborLogEntry {
  id: number;
  turn: number;
  actorId: string | null;
  actorName: string;
  text: string;
  kind: "dice" | "build" | "trade" | "bandit" | "scroll" | "compass" | "system";
}

export interface HarborState {
  config: HarborConfig;
  phase: HarborPhase;
  step: HarborStep;
  roundNumber: number;
  turnNumber: number;
  /** Setup snake order indices (e.g. [0,1,2,2,1,0]). */
  setupOrder: number[];
  setupCursor: number;
  setupLastVertexId: number | null;
  activePlayerIndex: number;
  board: IslandBoard;
  buildings: Record<number, BuildingPiece>;
  roads: Record<number, string>;
  banditHexId: number;
  scrollDeck: ScrollCard[];
  lastDice: [number, number] | null;
  playedScrollThisTurn: boolean;
  freeRoadsLeft: number;
  pendingDiscardUserIds: string[];
  longestRoadOwnerId: string | null;
  longestRoadLength: number;
  largestWatchOwnerId: string | null;
  largestWatchCount: number;
  activeTrade: TradeOffer | null;
  players: HarborPlayerState[];
  winnerIds: string[];
  results: GameResultSummary | null;
  log: HarborLogEntry[];
  nextLogId: number;
  nextTradeId: number;
  rngState: number;
}

export interface HarborPublicState {
  phase: HarborPhase;
  step: HarborStep;
  roundNumber: number;
  turnNumber: number;
  targetVP: number;
  turnSeconds: number;
  activePlayerId: string;
  activePlayerIndex: number;
  setupLastVertexId: number | null;
  board: IslandBoard;
  buildings: Record<number, BuildingPiece>;
  roads: Record<number, string>;
  banditHexId: number;
  scrollDeckCount: number;
  lastDice: [number, number] | null;
  playedScrollThisTurn: boolean;
  freeRoadsLeft: number;
  pendingDiscardUserIds: string[];
  longestRoadOwnerId: string | null;
  longestRoadLength: number;
  largestWatchOwnerId: string | null;
  largestWatchCount: number;
  activeTrade: TradeOffer | null;
  players: HarborPublicPlayer[];
  winnerIds: string[];
  results: GameResultSummary | null;
  log: HarborLogEntry[];
}

export interface HarborPrivateState {
  userId: string;
  resources: ResourcePool;
  scrolls: ScrollCard[];
  vpScrollsCount: number;
  totalVP: number;
  tradeRates: Record<ResourceType, number>;
  isYourTurn: boolean;
  mustDiscardCount: number;
}

export interface HarborDisplayState {
  phase: HarborPhase;
  roundNumber: number;
  targetVP: number;
  activePlayerName: string;
  lastDice: [number, number] | null;
  leaderboard: Array<{
    userId: string;
    displayName: string;
    publicVP: number;
    hasLongestRoad: boolean;
    hasLargestWatch: boolean;
  }>;
  results: GameResultSummary | null;
}

export const ResourceTypeSchema = z.enum(RESOURCES);
export const ResourcePoolSchema = z.object({
  timber: z.number().int().min(0).max(20),
  clay: z.number().int().min(0).max(20),
  wool: z.number().int().min(0).max(20),
  grain: z.number().int().min(0).max(20),
  ore: z.number().int().min(0).max(20),
});

export const HarborActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SETUP_PLACE_COTTAGE"), vertexId: z.number().int().min(0).max(53) }),
  z.object({ type: z.literal("SETUP_PLACE_ROAD"), edgeId: z.number().int().min(0).max(71) }),
  z.object({ type: z.literal("ROLL_DICE") }),
  z.object({ type: z.literal("DISCARD_RESOURCES"), resources: ResourcePoolSchema }),
  z.object({
    type: z.literal("MOVE_BANDIT"),
    hexId: z.number().int().min(0).max(18),
    stealFromUserId: z.string().nullable().optional(),
  }),
  z.object({ type: z.literal("BUILD_ROAD"), edgeId: z.number().int().min(0).max(71) }),
  z.object({ type: z.literal("BUILD_COTTAGE"), vertexId: z.number().int().min(0).max(53) }),
  z.object({ type: z.literal("UPGRADE_TOWN"), vertexId: z.number().int().min(0).max(53) }),
  z.object({ type: z.literal("BUY_SCROLL") }),
  z.object({
    type: z.literal("PLAY_SCROLL"),
    scrollId: z.string().min(1),
    /** Used when playing Harvest Plenty (2 resources) */
    plentyResources: z.tuple([ResourceTypeSchema, ResourceTypeSchema]).optional(),
    /** Used when playing Guild Monopoly (1 resource) */
    monopolyResource: ResourceTypeSchema.optional(),
  }),
  z.object({
    type: z.literal("BANK_TRADE"),
    give: ResourceTypeSchema,
    receive: ResourceTypeSchema,
  }),
  z.object({
    type: z.literal("OFFER_TRADE"),
    give: ResourcePoolSchema,
    want: ResourcePoolSchema,
  }),
  z.object({
    type: z.literal("RESPOND_TRADE"),
    tradeId: z.string().min(1),
    accept: z.boolean(),
  }),
  z.object({ type: z.literal("CANCEL_TRADE") }),
  z.object({
    type: z.literal("REDEEM_COMPASS"),
    receive: ResourceTypeSchema,
  }),
  z.object({ type: z.literal("END_TURN") }),
]);

export type HarborAction = z.infer<typeof HarborActionSchema>;

export interface HarborEvent {
  type:
    | "SETUP_PLACED"
    | "DICE_ROLLED"
    | "RESOURCES_DISCARDED"
    | "BANDIT_MOVED"
    | "BUILT_ROAD"
    | "BUILT_COTTAGE"
    | "UPGRADED_TOWN"
    | "BOUGHT_SCROLL"
    | "PLAYED_SCROLL"
    | "TRADE_COMPLETED"
    | "TRADE_OFFERED"
    | "COMPASS_REDEEMED"
    | "AWARD_CLAIMED"
    | "TURN_TIMEOUT"
    | "GAME_FINISHED";
  actorId?: string;
  actorName?: string;
  summary: string;
  payload?: Record<string, unknown>;
}

export const HARBOR_QUICK_LINES = [
  "Anyone have Ore to trade?",
  "Need Timber or Clay!",
  "Keep that Fox away from my Town!",
  "Longest Route is mine!",
  "Sweet 6 roll!",
  "Great trade, partner!",
] as const;

export const RESOURCE_META: Record<
  ResourceType,
  {
    label: string;
    terrainLabel: string;
    hex: string;
    terrainFill: string;
    softBg: string;
    border: string;
    text: string;
  }
> = {
  timber: {
    label: "Timber",
    terrainLabel: "Pine Forest",
    hex: "#2D8A56",
    terrainFill: "#7EC089",
    softBg: "#E8F7EE",
    border: "#79C99B",
    text: "#185E37",
  },
  clay: {
    label: "Clay",
    terrainLabel: "Clay Hills",
    hex: "#C85A3F",
    terrainFill: "#E0977B",
    softBg: "#FCEEE9",
    border: "#E59E88",
    text: "#8F341D",
  },
  wool: {
    label: "Wool",
    terrainLabel: "Clover Pasture",
    hex: "#6AA84F",
    terrainFill: "#B8DD8E",
    softBg: "#F0F9E8",
    border: "#9DD17D",
    text: "#3C6E26",
  },
  grain: {
    label: "Grain",
    terrainLabel: "Golden Fields",
    hex: "#D99B26",
    terrainFill: "#F2D17A",
    softBg: "#FEF7E2",
    border: "#E8BE63",
    text: "#8B5C07",
  },
  ore: {
    label: "Ore",
    terrainLabel: "Alpine Peaks",
    hex: "#5B6F82",
    terrainFill: "#ABB8C6",
    softBg: "#EEF2F6",
    border: "#9FB0C2",
    text: "#354657",
  },
};

export const BUILD_COSTS: Record<
  "road" | "cottage" | "town" | "scroll",
  Partial<Record<ResourceType, number>>
> = {
  road: { timber: 1, clay: 1 },
  cottage: { timber: 1, clay: 1, wool: 1, grain: 1 },
  town: { grain: 2, ore: 3 },
  scroll: { wool: 1, grain: 1, ore: 1 },
};

export const SCROLL_META: Record<
  ScrollKind,
  { title: string; badge: string; description: string }
> = {
  knight: {
    title: "Ranger Scout",
    badge: "Watch +1",
    description: "Move the Bandit Fox to another hex & steal 1 resource. 3+ Scouts claim Largest Watch (+2 VP)!",
  },
  victory_point: {
    title: "Landmark Charter",
    badge: "+1 Secret VP",
    description: "Worth +1 hidden Victory Point! Stays secret until you reach the winning score.",
  },
  road_builder: {
    title: "Road Builder",
    badge: "2 Free Roads",
    description: "Immediately place up to 2 Roads along your network for free!",
  },
  year_of_plenty: {
    title: "Harvest Plenty",
    badge: "+2 Any",
    description: "Immediately claim any 2 resources of your choice from the island supply!",
  },
  monopoly: {
    title: "Guild Monopoly",
    badge: "Collect All",
    description: "Name 1 resource type — every rival hands over ALL cards of that resource!",
  },
};
