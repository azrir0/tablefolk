import { z } from "zod";

export type RoleType = "TRAILBLAZER" | "TRICKSTER";
export type GearType = "lantern" | "compass" | "grapple";
export type VaultKind = "TRUE_RELIC" | "DECOY";
export type CardinalDir = "N" | "E" | "S" | "W";

export interface PathEdges {
  N: boolean;
  E: boolean;
  S: boolean;
  W: boolean;
}

export interface PathCard {
  id: string;
  kind: "PATH";
  variant: string;
  label: string;
  edges: PathEdges;
  connectedCenter: boolean;
}

export interface HazardCard {
  id: string;
  kind: "HAZARD";
  gear: GearType;
  label: string;
}

export interface RepairCard {
  id: string;
  kind: "REPAIR";
  gears: GearType[]; // 1 gear for single repair, 2 gears for dual multi-tool
  label: string;
}

export interface SpyglassCard {
  id: string;
  kind: "SPYGLASS";
  label: string;
}

export interface BoulderClearCard {
  id: string;
  kind: "BOULDER_CLEAR";
  label: string;
}

export type TreasureTrailsCard =
  | PathCard
  | HazardCard
  | RepairCard
  | SpyglassCard
  | BoulderClearCard;

export interface BoardCell {
  x: number;
  y: number;
  kind: "BASE_CAMP" | "PATH" | "VAULT";
  edges: PathEdges;
  connectedCenter: boolean;
  cardVariant?: string;
  rotation?: 0 | 180;
  placedBy?: string;
  // Vault-specific fields
  vaultRevealed?: boolean;
  vaultKind?: VaultKind; // Stripped from public state until revealed!
}

export interface PublicBoardCell {
  x: number;
  y: number;
  kind: "BASE_CAMP" | "PATH" | "VAULT";
  edges: PathEdges | null; // null for unrevealed vaults
  connectedCenter: boolean;
  cardVariant?: string;
  rotation?: 0 | 180;
  placedBy?: string;
  vaultRevealed?: boolean;
  vaultKind?: VaultKind; // Only present when vaultRevealed === true
}

export interface PlayerGearState {
  lantern: boolean; // true = INTACT, false = BROKEN
  compass: boolean;
  grapple: boolean;
}

export interface PlayerInternalState {
  userId: string;
  displayName: string;
  seatIndex: number;
  role: RoleType;
  hand: TreasureTrailsCard[];
  gear: PlayerGearState;
  score: number;
  scoutedVaults: Record<string, VaultKind>; // coordKey -> VaultKind
  afkStrikes: number;
  autoPass: boolean;
}

export interface PublicPlayerView {
  userId: string;
  displayName: string;
  seatIndex: number;
  handCount: number;
  gear: PlayerGearState;
  score: number;
  afkStrikes: number;
  autoPass: boolean;
  revealedRole?: RoleType; // Only populated during ROUND_END or COMPLETED
}

export interface RoundSummary {
  roundNumber: number;
  winningTeam: RoleType;
  reason: string;
  clutchPlayerId: string | null;
  starsAwarded: Record<string, number>;
  revealedRoles: Record<string, RoleType>;
}

export interface TreasureTrailsConfig {
  totalRounds: 1 | 3;
  turnSeconds: 30 | 45 | 60 | 90;
  mysteryRoles: boolean;
}

export type TreasureTrailsEvent =
  | { type: "ROUND_STARTED"; roundNumber: number; startingPlayerId: string }
  | { type: "TILE_PLACED"; actorId: string; x: number; y: number; cardVariant: string; rotation: 0 | 180 }
  | { type: "TILE_CLEARED"; actorId: string; x: number; y: number }
  | { type: "GEAR_BROKEN"; actorId: string; targetId: string; gear: GearType }
  | { type: "GEAR_REPAIRED"; actorId: string; targetId: string; gear: GearType }
  | { type: "FIELD_PATCHED"; actorId: string; gear: GearType }
  | { type: "VAULT_SCOUTED"; actorId: string; x: number; y: number }
  | { type: "VAULT_REVEALED"; actorId: string; x: number; y: number; vaultKind: VaultKind }
  | { type: "CARD_DISCARDED"; actorId: string; timedOut?: boolean }
  | { type: "ROUND_ENDED"; summary: RoundSummary }
  | { type: "MATCH_ENDED"; winningTeam: string; topScorerIds: string[] };

export interface TreasureTrailsState {
  phase: "IN_PROGRESS" | "ROUND_END" | "COMPLETED";
  config: TreasureTrailsConfig;
  currentRound: number;
  rngSeed: number;
  turnNumber: number;
  activePlayerIndex: number;
  roundStarterIndex: number;
  players: PlayerInternalState[];
  board: Record<string, BoardCell>;
  deck: TreasureTrailsCard[];
  discardCount: number;
  recentEvents: TreasureTrailsEvent[];
  lastRoundSummary: RoundSummary | null;
  roundHistory: RoundSummary[];
}

export interface TreasureTrailsPublicState {
  phase: "IN_PROGRESS" | "ROUND_END" | "COMPLETED";
  config: TreasureTrailsConfig;
  currentRound: number;
  turnNumber: number;
  activePlayerId: string;
  players: PublicPlayerView[];
  board: Record<string, PublicBoardCell>;
  deckCount: number;
  discardCount: number;
  recentEvents: TreasureTrailsEvent[];
  lastRoundSummary: RoundSummary | null;
}

export interface TreasureTrailsPrivateState {
  userId: string;
  role: RoleType;
  hand: TreasureTrailsCard[];
  scoutedVaults: Record<string, VaultKind>;
}

export interface TreasureTrailsDisplayState extends TreasureTrailsPublicState {
  displayMode: true;
}

export const GearTypeSchema = z.enum(["lantern", "compass", "grapple"]);

export const TreasureTrailsActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("PLACE_PATH"),
    cardId: z.string().min(1),
    x: z.number().int().min(0).max(8),
    y: z.number().int().min(0).max(4),
    rotation: z.union([z.literal(0), z.literal(180)]),
  }),
  z.object({
    type: z.literal("PLAY_HAZARD"),
    cardId: z.string().min(1),
    targetUserId: z.string().min(1),
  }),
  z.object({
    type: z.literal("PLAY_REPAIR"),
    cardId: z.string().min(1),
    targetUserId: z.string().min(1),
    gear: GearTypeSchema,
  }),
  z.object({
    type: z.literal("PLAY_SPYGLASS"),
    cardId: z.string().min(1),
    x: z.number().int().min(0).max(8),
    y: z.number().int().min(0).max(4),
  }),
  z.object({
    type: z.literal("PLAY_BOULDER_CLEAR"),
    cardId: z.string().min(1),
    x: z.number().int().min(0).max(8),
    y: z.number().int().min(0).max(4),
  }),
  z.object({
    type: z.literal("DISCARD"),
    cardId: z.string().min(1),
  }),
  z.object({
    type: z.literal("FIELD_PATCH"),
    cardIds: z.tuple([z.string().min(1), z.string().min(1)]),
    gear: GearTypeSchema,
  }),
  z.object({
    type: z.literal("ADVANCE_ROUND"),
  }),
]);

export type TreasureTrailsAction = z.infer<typeof TreasureTrailsActionSchema>;

export const QUICK_BLUFF_PILLS = [
  "Trust me!",
  "Suspicious 👀",
  "Go North ↑",
  "Go Center →",
  "Go South ↓",
  "Need a fix!",
  "Nice trail!",
  "Wait, why discard?",
] as const;
