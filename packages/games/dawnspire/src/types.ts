import { z } from "zod";

export const RAW_RESOURCES = ["timber", "stone", "clay", "ore"] as const;
export const CRAFT_RESOURCES = ["glass", "silk"] as const;
export const ALL_RESOURCES = [...RAW_RESOURCES, ...CRAFT_RESOURCES] as const;

export type RawResource = (typeof RAW_RESOURCES)[number];
export type CraftResource = (typeof CRAFT_RESOURCES)[number];
export type DawnResource = (typeof ALL_RESOURCES)[number];

export type CardCategory =
  | "raw"
  | "craft"
  | "civic"
  | "commerce"
  | "military"
  | "science"
  | "guild";

export type ScienceSymbol = "tablet" | "compass" | "gear";
export type WonderSide = "sunlit" | "starlit";
export type EraNumber = 1 | 2 | 3;

export interface ResourceMeta {
  id: DawnResource;
  label: string;
  short: string;
  kind: "raw" | "craft";
  hex: string;
  softBg: string;
  text: string;
}

export const RESOURCE_META: Record<DawnResource, ResourceMeta> = {
  timber: {
    id: "timber",
    label: "Timber",
    short: "T",
    kind: "raw",
    hex: "#4C8A56",
    softBg: "#E6F4E8",
    text: "#23532B",
  },
  stone: {
    id: "stone",
    label: "Stone",
    short: "S",
    kind: "raw",
    hex: "#78808C",
    softBg: "#ECEFF3",
    text: "#353B45",
  },
  clay: {
    id: "clay",
    label: "Clay",
    short: "C",
    kind: "raw",
    hex: "#C86747",
    softBg: "#FCEBE4",
    text: "#873820",
  },
  ore: {
    id: "ore",
    label: "Ore",
    short: "O",
    kind: "raw",
    hex: "#586274",
    softBg: "#E8ECF2",
    text: "#2A3241",
  },
  glass: {
    id: "glass",
    label: "Glass",
    short: "G",
    kind: "craft",
    hex: "#3A97B5",
    softBg: "#E2F4FA",
    text: "#185970",
  },
  silk: {
    id: "silk",
    label: "Silk",
    short: "Si",
    kind: "craft",
    hex: "#9B5BA8",
    softBg: "#F4E8F8",
    text: "#5A2866",
  },
};

export const CATEGORY_META: Record<
  CardCategory,
  { label: string; hex: string; softBg: string; border: string; text: string }
> = {
  raw: {
    label: "Raw Material",
    hex: "#8E5A3B",
    softBg: "#F6ECE4",
    border: "#B78361",
    text: "#5A331C",
  },
  craft: {
    label: "Fine Craft",
    hex: "#6B7280",
    softBg: "#EFF1F4",
    border: "#9CA3AF",
    text: "#374151",
  },
  civic: {
    label: "Civic",
    hex: "#2D6BB0",
    softBg: "#E8F2FC",
    border: "#689FD8",
    text: "#1B4677",
  },
  commerce: {
    label: "Commerce",
    hex: "#D49523",
    softBg: "#FDF5DF",
    border: "#E6B655",
    text: "#7B500B",
  },
  military: {
    label: "Military",
    hex: "#C7463E",
    softBg: "#FDEAE8",
    border: "#E27D76",
    text: "#84241F",
  },
  science: {
    label: "Science",
    hex: "#2E8A57",
    softBg: "#E6F6EC",
    border: "#65B988",
    text: "#1A5936",
  },
  guild: {
    label: "Grand Guild",
    hex: "#7E3F8F",
    softBg: "#F4E9F8",
    border: "#B178C1",
    text: "#4F1F5C",
  },
};

export const SCIENCE_META: Record<
  ScienceSymbol,
  { label: string; short: string; hex: string }
> = {
  tablet: { label: "Tablet", short: "TAB", hex: "#2A7B50" },
  compass: { label: "Compass", short: "CMP", hex: "#1F6E75" },
  gear: { label: "Gear", short: "GER", hex: "#437530" },
};

export interface CardCost {
  coins?: number;
  resources?: Partial<Record<DawnResource, number>>;
}

export type CardScope = "self" | "neighbors" | "all";

export interface CardEffect {
  /** Direct resource production — fixed array (e.g. ["timber","timber"]) */
  producesFixed?: DawnResource[];
  /** Flexible choice production (pick 1 per turn — tradable only if category is raw/craft!) */
  producesChoice?: DawnResource[];
  /** Victory points */
  vp?: number;
  /** Military shields */
  shields?: number;
  /** Immediate gold gained on build */
  coins?: number;
  /** Science symbol */
  science?: ScienceSymbol;
  /** Wild science symbol (Scholar Guild / Hanging Terraces) */
  wildScience?: boolean;
  /** Neighbor trade discounts (2g -> 1g) */
  rawTradeLeft?: boolean;
  rawTradeRight?: boolean;
  craftTradeBoth?: boolean;
  /** Immediate gold per matching category in scope */
  coinsPerCategory?: { categories: CardCategory[]; scope: CardScope; amount: number };
  /** Immediate gold per built Wonder stage in self */
  coinsPerWonderStage?: number;
  /** Endgame VP per matching category in scope */
  vpPerCategory?: { categories: CardCategory[]; scope: CardScope; amount: number };
  /** Endgame VP per built Wonder stage in scope */
  vpPerWonderStage?: { scope: CardScope; amount: number };
  /** Endgame VP per Military Defeat token on neighbors */
  vpPerNeighborDefeat?: number;
  /** Wonder-only: 1 free structure build per Era */
  freeBuildPerEra?: boolean;
  /** Wonder-only: copy highest-scoring Guild from either neighbor at endgame */
  copyNeighborGuild?: boolean;
}

export interface DawnCardDef {
  /** Unique card instance ID within a match (e.g. "e1_timber_yard_1") */
  id: string;
  /** Template base ID (duplicate rule forbids building same baseId twice) */
  baseId: string;
  name: string;
  era: EraNumber;
  category: CardCategory;
  cost: CardCost;
  /** Prerequisite baseIds that allow building this card completely FREE! */
  freeFrom?: string[];
  /** Hint list of Era II/III baseIds this card unlocks for free */
  chainsTo?: string[];
  effect: CardEffect;
  shortEffect: string;
}

export interface WonderStageDef {
  stageIndex: number;
  name: string;
  cost: CardCost;
  effect: CardEffect;
  shortEffect: string;
}

export interface WonderDef {
  id: string;
  name: string;
  subtitle: string;
  side: WonderSide;
  startingResource: DawnResource;
  accentHex: string;
  stages: WonderStageDef[];
}

export interface TradePlan {
  affordable: boolean;
  isDuplicate: boolean;
  isFreeChain: boolean;
  chainSourceName?: string;
  ownCoinsCost: number;
  leftTradeCoins: number;
  rightTradeCoins: number;
  totalCoins: number;
  missingResources: DawnResource[];
}

export interface ScoreBreakdown {
  military: number;
  treasury: number;
  wonder: number;
  civic: number;
  commerce: number;
  guild: number;
  science: number;
  total: number;
}

export interface EraMilitaryClash {
  era: EraNumber;
  playerId: string;
  opponentId: string;
  opponentName: string;
  side: "left" | "right";
  myShields: number;
  oppShields: number;
  outcome: "win" | "loss" | "tie";
  vpDelta: number;
}

export interface TurnRevealEntry {
  playerId: string;
  playerName: string;
  actionType: "build" | "wonder" | "sell";
  cardName?: string;
  cardCategory?: CardCategory;
  wonderStageIndex?: number;
  coinsEarned?: number;
  caravanBonus?: boolean;
  tradePaidLeft?: number;
  tradePaidRight?: number;
  freeChain?: boolean;
  usedWonderFreeBuild?: boolean;
}

export interface DawnPlayerState {
  userId: string;
  displayName: string;
  seatIndex: number;
  wonder: WonderDef;
  wonderStagesBuilt: number;
  coins: number;
  builtCards: DawnCardDef[];
  militaryWinsVP: number;
  militaryDefeats: number;
  /** Tracks whether Wonder's 1/Era Free Build power was already used this Era */
  freeBuildUsedThisEra: boolean;
  /** Private hand in current draft turn */
  hand: DawnCardDef[];
  /** Staged simultaneous action for the current draft turn */
  pendingAction: DawnspirePlayChoice | null;
  finalScore: ScoreBreakdown | null;
}

export type DawnspirePlayChoice =
  | { type: "BUILD_CARD"; cardId: string; useFreeBuild?: boolean }
  | { type: "BUILD_WONDER"; cardId: string }
  | { type: "SELL_CARD"; cardId: string };

export const DawnspireActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("BUILD_CARD"),
    cardId: z.string().min(1),
    useFreeBuild: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("BUILD_WONDER"),
    cardId: z.string().min(1),
  }),
  z.object({
    type: z.literal("SELL_CARD"),
    cardId: z.string().min(1),
  }),
]);

export type DawnspireAction = z.infer<typeof DawnspireActionSchema>;

export interface DawnspireState {
  phase: "IN_PROGRESS" | "FINISHED";
  wonderSide: WonderSide;
  era: EraNumber;
  /** 1..6 within each Era */
  turnInEra: number;
  /** Global turn 1..18 */
  totalTurn: number;
  /** Direction hands pass after this turn */
  passDirection: "left" | "right";
  players: DawnPlayerState[];
  /** Used in 2-player mode as the 3rd Caravan draft hand */
  caravanHand: DawnCardDef[];
  discardPile: DawnCardDef[];
  /** Most recent simultaneous turn reveals */
  lastReveals: TurnRevealEntry[];
  /** Military clash log across eras */
  militaryHistory: EraMilitaryClash[];
  /** Cozy event chronicle */
  log: string[];
  winnerIds: string[];
}

export interface DawnPublicPlayerView {
  userId: string;
  displayName: string;
  seatIndex: number;
  wonder: WonderDef;
  wonderStagesBuilt: number;
  coins: number;
  builtCards: DawnCardDef[];
  militaryWinsVP: number;
  militaryDefeats: number;
  shields: number;
  hasLockedIn: boolean;
  freeBuildAvailable: boolean;
  liveScoreEstimate: ScoreBreakdown;
  finalScore: ScoreBreakdown | null;
}

export interface DawnPublicState {
  phase: "IN_PROGRESS" | "FINISHED";
  wonderSide: WonderSide;
  era: EraNumber;
  turnInEra: number;
  totalTurn: number;
  passDirection: "left" | "right";
  players: DawnPublicPlayerView[];
  discardCount: number;
  lastReveals: TurnRevealEntry[];
  militaryHistory: EraMilitaryClash[];
  log: string[];
  winnerIds: string[];
  isTwoPlayerCaravan: boolean;
}

export interface DawnHandCardEvaluation {
  card: DawnCardDef;
  buildPlan: TradePlan;
  canUseWonderFreeBuild: boolean;
}

export interface DawnPrivateState {
  userId: string;
  hand: DawnHandCardEvaluation[];
  nextWonderStagePlan: TradePlan | null;
  pendingAction: DawnspirePlayChoice | null;
  sellGoldAmount: number;
  hasCaravanBonus: boolean;
  leftNeighborId: string;
  rightNeighborId: string;
}

export const DAWNSPIRE_QUICK_LINES = [
  "Passing a spicy hand! 🃏",
  "Please don't buy my Stone! 🪨",
  "Enjoy the trade Gold! 🪙",
  "Raising my Wonder! 🏛️",
  "Science is cooking... 🔬",
  "Watch your Shields! ⚔️",
] as const;
