import { z } from "zod";
import type { GameResultSummary } from "@tablefolk/game-engine";

export const BASE_GEM_COLORS = [
  "ruby",
  "sapphire",
  "emerald",
  "amethyst",
  "pearl",
] as const;

export type BaseGemColor = (typeof BASE_GEM_COLORS)[number];

export const TOKEN_COLORS = [
  "ruby",
  "sapphire",
  "emerald",
  "amethyst",
  "pearl",
  "gold",
] as const;

export type TokenColor = (typeof TOKEN_COLORS)[number];

export type GemCost = Partial<Record<BaseGemColor, number>>;
export type TokenPool = Record<TokenColor, number>;
export type GemBonuses = Record<BaseGemColor, number>;

export type RelicTier = 1 | 2 | 3;

export interface RelicCard {
  id: string;
  tier: RelicTier;
  name: string;
  gem: BaseGemColor;
  /** Permanent gem discount value: 1 normally, or 2 for Tier III Grand Masterworks! */
  bonusCount: 1 | 2;
  prestige: number;
  cost: GemCost;
  /** Tier I Catalyst twist: immediately awards +1 matching gem from bank if available. */
  catalyst?: boolean;
}

export interface GuildPatron {
  id: string;
  name: string;
  title: string;
  prestige: number;
  requirements: GemCost;
  icon: string;
}

export interface ReservedSlot {
  card: RelicCard;
  /** True when reserved blind from a tier deck top — hidden from rivals until crafted. */
  isBlind: boolean;
}

export interface PublicReservedSlot {
  cardId: string;
  tier: RelicTier;
  isBlind: boolean;
  /** Present when face-up reserve; null for blind reserves owned by opponents. */
  card: RelicCard | null;
}

export type SunstoneTurnStep = "MAIN_ACTION" | "DISCARD_GEMS" | "CLAIM_PATRON";

export type SunstonePhase = "IN_PROGRESS" | "GAME_END";

export interface SunstonePlayerState {
  userId: string;
  displayName: string;
  seatIndex: number;
  colorIndex: number;
  tokens: TokenPool;
  bonuses: GemBonuses;
  craftedCardIds: string[];
  craftedCount: number;
  reserved: ReservedSlot[];
  patronIds: string[];
  prestige: number;
  consecutiveTimeouts: number;
}

export interface SunstonePublicPlayer {
  userId: string;
  displayName: string;
  seatIndex: number;
  colorIndex: number;
  tokens: TokenPool;
  tokenCount: number;
  bonuses: GemBonuses;
  craftedCount: number;
  recentCrafted: RelicCard[];
  reserved: PublicReservedSlot[];
  patrons: GuildPatron[];
  prestige: number;
  consecutiveTimeouts: number;
}

export interface SunstoneConfig {
  /** Target prestige triggering Final Round (12 Quick, 15 Classic). */
  targetPrestige: 12 | 15;
  turnSeconds: number;
}

export interface SunstoneLogEntry {
  id: number;
  turn: number;
  actorId: string | null;
  actorName: string;
  text: string;
  kind: "gem" | "craft" | "reserve" | "patron" | "discard" | "system";
}

export interface SunstoneState {
  config: SunstoneConfig;
  phase: SunstonePhase;
  step: SunstoneTurnStep;
  roundNumber: number;
  turnNumber: number;
  activePlayerIndex: number;
  finalRoundTriggered: boolean;
  finalRoundTriggerPlayerId: string | null;
  bank: TokenPool;
  decks: Record<RelicTier, RelicCard[]>;
  market: Record<RelicTier, Array<RelicCard | null>>;
  patrons: GuildPatron[];
  pendingPatronIds: string[];
  players: SunstonePlayerState[];
  cardCatalogById: Record<string, RelicCard>;
  patronCatalogById: Record<string, GuildPatron>;
  winnerIds: string[];
  results: GameResultSummary | null;
  log: SunstoneLogEntry[];
  nextLogId: number;
  rngState: number;
}

export interface SunstonePublicState {
  phase: SunstonePhase;
  step: SunstoneTurnStep;
  roundNumber: number;
  turnNumber: number;
  targetPrestige: number;
  turnSeconds: number;
  activePlayerId: string;
  activePlayerIndex: number;
  finalRoundTriggered: boolean;
  bank: TokenPool;
  deckCounts: Record<RelicTier, number>;
  market: Record<RelicTier, Array<RelicCard | null>>;
  patrons: GuildPatron[];
  pendingPatronIds: string[];
  players: SunstonePublicPlayer[];
  winnerIds: string[];
  results: GameResultSummary | null;
  log: SunstoneLogEntry[];
}

export interface SunstonePrivateState {
  userId: string;
  /** Full details of every card this player holds in reserve (including blind deck reserves). */
  reserved: ReservedSlot[];
  isYourTurn: boolean;
  step: SunstoneTurnStep;
  excessGemsToDiscard: number;
  pendingPatronIds: string[];
}

export interface SunstoneDisplayState {
  phase: SunstonePhase;
  roundNumber: number;
  targetPrestige: number;
  activePlayerName: string;
  finalRoundTriggered: boolean;
  leaderboard: Array<{
    userId: string;
    displayName: string;
    prestige: number;
    craftedCount: number;
    patrons: number;
  }>;
  bank: TokenPool;
  market: Record<RelicTier, Array<RelicCard | null>>;
  patrons: GuildPatron[];
  results: GameResultSummary | null;
}

export const BaseGemColorSchema = z.enum(BASE_GEM_COLORS);
export const TokenColorSchema = z.enum(TOKEN_COLORS);
export const RelicTierSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const SunstoneActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("TAKE_GEMS"),
    /** Either 1-3 distinct base colors, OR 2 identical base colors when stack >= 4. */
    gems: z.array(BaseGemColorSchema).min(1).max(3),
  }),
  z.object({
    type: z.literal("RESERVE_MARKET"),
    cardId: z.string().min(1),
  }),
  z.object({
    type: z.literal("RESERVE_DECK"),
    tier: RelicTierSchema,
  }),
  z.object({
    type: z.literal("BUY_CARD"),
    cardId: z.string().min(1),
    source: z.enum(["market", "reserved"]),
  }),
  z.object({
    type: z.literal("DISCARD_GEMS"),
    gems: z.array(TokenColorSchema).min(1).max(3),
  }),
  z.object({
    type: z.literal("CLAIM_PATRON"),
    patronId: z.string().min(1),
  }),
]);

export type SunstoneAction = z.infer<typeof SunstoneActionSchema>;

export interface SunstoneEvent {
  type:
    | "GEMS_TAKEN"
    | "CARD_RESERVED"
    | "CARD_CRAFTED"
    | "CATALYST_TRIGGERED"
    | "GEMS_DISCARDED"
    | "PATRON_CLAIMED"
    | "FINAL_ROUND_TRIGGERED"
    | "TURN_TIMEOUT"
    | "GAME_FINISHED";
  actorId?: string;
  actorName?: string;
  summary: string;
  payload?: Record<string, unknown>;
}

export const SUNSTONE_QUICK_LINES = [
  "Sparkling pick!",
  "Hands off that Masterwork!",
  "Need just one more gem...",
  "Nice engine!",
  "That Patron is mine!",
  "Well crafted!",
] as const;

export const GEM_META: Record<
  TokenColor,
  {
    label: string;
    short: string;
    hex: string;
    softBg: string;
    border: string;
    text: string;
  }
> = {
  ruby: {
    label: "Ruby",
    short: "R",
    hex: "#D64045",
    softBg: "#FDECEC",
    border: "#E68A8E",
    text: "#982126",
  },
  sapphire: {
    label: "Sapphire",
    short: "S",
    hex: "#2D6CDF",
    softBg: "#EBF2FE",
    border: "#86AEF2",
    text: "#1D4A9E",
  },
  emerald: {
    label: "Emerald",
    short: "E",
    hex: "#28965A",
    softBg: "#E9F8EF",
    border: "#79CFA0",
    text: "#18643A",
  },
  amethyst: {
    label: "Amethyst",
    short: "A",
    hex: "#8B4CC6",
    softBg: "#F4EDFC",
    border: "#BA92E3",
    text: "#5A2A89",
  },
  pearl: {
    label: "Pearl",
    short: "P",
    hex: "#587D8F",
    softBg: "#EEF5F8",
    border: "#9CB9C7",
    text: "#355160",
  },
  gold: {
    label: "Sunstone Gold",
    short: "★",
    hex: "#E5A020",
    softBg: "#FEF5DB",
    border: "#E8BC58",
    text: "#8C5806",
  },
};
