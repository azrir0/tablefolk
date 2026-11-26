import { z } from "zod";

export type MasqueId =
  | "monarch"
  | "patron"
  | "magistrate"
  | "trickster"
  | "illusionist"
  | "jester"
  | "taxmaster"
  | "smuggler";

export const MasqueIdSchema = z.enum([
  "monarch",
  "patron",
  "magistrate",
  "trickster",
  "illusionist",
  "jester",
  "taxmaster",
  "smuggler",
]);

export type MasqueColorId =
  | "terracotta"
  | "sage"
  | "ocean"
  | "honey"
  | "plum"
  | "teal"
  | "rose"
  | "amber";

export const MASQUE_PLAYER_COLORS: readonly MasqueColorId[] = [
  "terracotta",
  "sage",
  "ocean",
  "honey",
  "plum",
  "teal",
  "rose",
  "amber",
] as const;

export interface MasqueDefinition {
  id: MasqueId;
  name: string;
  emoji: string;
  shortPower: string;
  fullPower: string;
  accentHex: string;
  bgHex: string;
}

export const MASQUE_DEFINITIONS: Record<MasqueId, MasqueDefinition> = {
  monarch: {
    id: "monarch",
    name: "Monarch",
    emoji: "👑",
    shortPower: "+3 Gold",
    fullPower: "Collect 3 Gold from the Royal Bank.",
    accentHex: "#D99B16",
    bgHex: "#FEF3C7",
  },
  patron: {
    id: "patron",
    name: "Patron",
    emoji: "🦢",
    shortPower: "+2 Gold + Peek",
    fullPower: "Collect 2 Gold from the Bank AND secretly peek at any 1 other mask.",
    accentHex: "#2F855A",
    bgHex: "#DEF7EC",
  },
  magistrate: {
    id: "magistrate",
    name: "Magistrate",
    emoji: "⚖️",
    shortPower: "Fine Box (≤4)",
    fullPower: "Take up to 4 Gold from the Fine Box (or +1 Gold from the Bank if empty).",
    accentHex: "#4C51BF",
    bgHex: "#E0E7FF",
  },
  trickster: {
    id: "trickster",
    name: "Trickster",
    emoji: "🗡️",
    shortPower: "Steal ±1 Neighbors",
    fullPower: "Steal 1 Gold from your left neighbor and 1 Gold from your right neighbor.",
    accentHex: "#C53030",
    bgHex: "#FEE2E2",
  },
  illusionist: {
    id: "illusionist",
    name: "Illusionist",
    emoji: "🔮",
    shortPower: "Swap Gold (≤4)",
    fullPower: "Choose any rival and swap Gold totals (capped at 4 Gold transferred).",
    accentHex: "#7E3AF2",
    bgHex: "#EDE9FE",
  },
  jester: {
    id: "jester",
    name: "Jester",
    emoji: "🃏",
    shortPower: "+1 Gold + Swap 2",
    fullPower: "Collect 1 Gold from the Bank AND secretly swap (or fake-swap) any 2 other masks!",
    accentHex: "#D97706",
    bgHex: "#FFEDD5",
  },
  taxmaster: {
    id: "taxmaster",
    name: "Taxmaster",
    emoji: "🦅",
    shortPower: "Tax Richest +2",
    fullPower: "Collect 2 Gold directly from the richest rival (choose if tied).",
    accentHex: "#0E7490",
    bgHex: "#CFFAFE",
  },
  smuggler: {
    id: "smuggler",
    name: "Smuggler",
    emoji: "🦊",
    shortPower: "Win at 10+ Gold",
    fullPower:
      "If you hold 10+ Gold (8+ in Blitz), WIN IMMEDIATELY! Otherwise gain +1 Gold & Peek your mask.",
    accentHex: "#BE185D",
    bgHex: "#FCE7F3",
  },
};

export const CORE_SIX_MASQUES: readonly MasqueId[] = [
  "monarch",
  "patron",
  "magistrate",
  "trickster",
  "illusionist",
  "jester",
] as const;

export function getRosterForPlayerCount(playerCount: number): MasqueId[] {
  if (playerCount <= 6) return [...CORE_SIX_MASQUES];
  if (playerCount === 7) return [...CORE_SIX_MASQUES, "taxmaster"];
  return [...CORE_SIX_MASQUES, "taxmaster", "smuggler"];
}

export const VELVET_MASQUE_QUICK_BLUFFS = [
  "I swear I'm the Monarch!",
  "Did you actually swap me?!",
  "Challenge them!!",
  "I forgot who I am...",
  "Touch my gold and see!",
  "Fine Box looking juicy",
  "Pure bluff!",
  "Trust me on this!",
] as const;

export const MasqueSlotRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("PLAYER"), userId: z.string().min(1) }),
  z.object({ kind: z.literal("STAGE"), stageIndex: z.number().int().min(0).max(5) }),
]);

export type MasqueSlotRef = z.infer<typeof MasqueSlotRefSchema>;

export function slotKey(slot: MasqueSlotRef): string {
  return slot.kind === "PLAYER" ? `P:${slot.userId}` : `S:${slot.stageIndex}`;
}

export function slotsEqual(a: MasqueSlotRef, b: MasqueSlotRef): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind === "PLAYER" && b.kind === "PLAYER"
    ? a.userId === b.userId
    : a.kind === "STAGE" && b.kind === "STAGE"
      ? a.stageIndex === b.stageIndex
      : false;
}

export interface VelvetMasqueConfig {
  targetCoins: 10 | 13;
  turnSeconds: 30 | 45 | 60 | 90;
}

export type VelvetMasquePhase = "IN_PROGRESS" | "COMPLETED";

export type VelvetMasqueStep =
  | "CURTAIN_CALL"
  | "CHOOSE_ACTION"
  | "RESOLVE_SWAP"
  | "CHALLENGE_WINDOW"
  | "RESOLVE_POWER";

export interface VelvetMasquePlayerInternal {
  userId: string;
  displayName: string;
  seatIndex: number;
  color: MasqueColorId;
  coins: number;
  mask: MasqueId;
  finesPaid: number;
  bluffsWon: number;
  juggledTurn: number; // last turn number when this player's mask was under the cloak
  afkStrikes: number;
  autoPass: boolean;
}

export interface VelvetMasquePublicPlayer {
  userId: string;
  displayName: string;
  seatIndex: number;
  color: MasqueColorId;
  coins: number;
  finesPaid: number;
  bluffsWon: number;
  juggledTurn: number;
  afkStrikes: number;
  autoPass: boolean;
  /** Only populated during CURTAIN_CALL, COMPLETED, or if revealed in the current Showdown */
  revealedMask?: MasqueId;
}

export interface PendingSwapState {
  actorId: string;
  slotA: MasqueSlotRef;
  slotB: MasqueSlotRef;
  isJesterBonus: boolean;
}

export type ChallengeDecision = "PENDING" | "PASS" | "CHALLENGE";

export interface PendingClaimState {
  announcerId: string;
  maskId: MasqueId;
  responses: Record<string, ChallengeDecision>;
}

export interface PendingPowerState {
  executorId: string;
  maskId: "patron" | "illusionist" | "jester" | "taxmaster";
  eligibleTargetUserIds?: string[]; // populated for tied taxmaster
}

export interface ShowdownResult {
  id: string;
  turnNumber: number;
  announcedMaskId: MasqueId;
  announcerId: string;
  wasChallenged: boolean;
  winnerId: string | null;
  revealed: Array<{
    userId: string;
    actualMaskId: MasqueId;
    wonClaim: boolean;
    paidFine: boolean;
  }>;
}

export interface PrivatePeekRecord {
  id: string;
  turnNumber: number;
  slot: MasqueSlotRef;
  maskId: MasqueId;
  reason: "SELF_PEEK" | "PATRON_PEEK" | "SMUGGLER_PEEK";
}

export interface PrivateSwapRecord {
  turnNumber: number;
  slotA: MasqueSlotRef;
  slotB: MasqueSlotRef;
  actuallySwap: boolean;
}

export type VelvetMasqueEvent =
  | { type: "CURTAIN_CLOSED" }
  | { type: "PLAYER_PEEKED"; actorId: string }
  | { type: "CLOAK_SWAP_STARTED"; actorId: string; slotA: MasqueSlotRef; slotB: MasqueSlotRef }
  | { type: "CLOAK_SWAP_RESOLVED"; actorId: string; slotA: MasqueSlotRef; slotB: MasqueSlotRef }
  | { type: "MASK_ANNOUNCED"; announcerId: string; maskId: MasqueId }
  | { type: "CHALLENGE_DECLARED"; challengerId: string; maskId: MasqueId }
  | { type: "CLAIM_UNCHALLENGED"; announcerId: string; maskId: MasqueId }
  | { type: "SHOWDOWN_RESOLVED"; showdown: ShowdownResult }
  | {
      type: "COINS_CHANGED";
      deltas: Array<{ userId: string; delta: number }>;
      fineBoxDelta: number;
      reason: string;
    }
  | { type: "PATRON_PEEKED"; executorId: string; target: MasqueSlotRef }
  | { type: "MATCH_ENDED"; winnerIds: string[]; reason: string };

export interface VelvetMasqueState {
  phase: VelvetMasquePhase;
  step: VelvetMasqueStep;
  config: VelvetMasqueConfig;
  rngSeed: number;
  turnNumber: number;
  maxTurns: number;
  activePlayerIndex: number;
  roster: MasqueId[];
  players: VelvetMasquePlayerInternal[];
  stageMasks: MasqueId[];
  fineBox: number;
  curtainReadyIds: string[];
  pendingSwap: PendingSwapState | null;
  pendingClaim: PendingClaimState | null;
  pendingPower: PendingPowerState | null;
  lastShowdown: ShowdownResult | null;
  /** Latest private peek per userId (stripped from publicState!) */
  privatePeeks: Record<string, PrivatePeekRecord>;
  /** Latest private swap decision per userId (stripped from publicState!) */
  privateSwaps: Record<string, PrivateSwapRecord>;
  recentEvents: VelvetMasqueEvent[];
  winnerIds: string[];
  endReason: string | null;
}

export interface VelvetMasquePublicState {
  phase: VelvetMasquePhase;
  step: VelvetMasqueStep;
  config: VelvetMasqueConfig;
  turnNumber: number;
  maxTurns: number;
  activePlayerId: string;
  roster: MasqueId[];
  players: VelvetMasquePublicPlayer[];
  stageCount: number;
  /** Only populated during CURTAIN_CALL or COMPLETED */
  revealedStageMasks?: MasqueId[];
  fineBox: number;
  curtainReadyIds: string[];
  pendingSwap: PendingSwapState | null;
  pendingClaim: PendingClaimState | null;
  pendingPower: PendingPowerState | null;
  lastShowdown: ShowdownResult | null;
  recentEvents: VelvetMasqueEvent[];
  winnerIds: string[];
  endReason: string | null;
}

export interface VelvetMasquePrivateState {
  userId: string;
  latestPeek: PrivatePeekRecord | null;
  latestSwap: PrivateSwapRecord | null;
}

export interface VelvetMasqueDisplayState extends VelvetMasquePublicState {
  displayMode: true;
}

export const VelvetMasqueActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("CURTAIN_READY") }),
  z.object({ type: z.literal("PEEK_SELF") }),
  z.object({ type: z.literal("INITIATE_SWAP"), target: MasqueSlotRefSchema }),
  z.object({ type: z.literal("COMMIT_SWAP"), actuallySwap: z.boolean() }),
  z.object({ type: z.literal("ANNOUNCE_MASK"), maskId: MasqueIdSchema }),
  z.object({
    type: z.literal("RESPOND_CHALLENGE"),
    decision: z.enum(["PASS", "CHALLENGE"]),
  }),
  z.object({ type: z.literal("RESOLVE_PATRON_PEEK"), target: MasqueSlotRefSchema }),
  z.object({
    type: z.literal("RESOLVE_ILLUSIONIST_SWAP"),
    targetUserId: z.string().min(1),
  }),
  z.object({
    type: z.literal("RESOLVE_JESTER_SELECT"),
    slotA: MasqueSlotRefSchema,
    slotB: MasqueSlotRefSchema,
  }),
  z.object({
    type: z.literal("RESOLVE_TAXMASTER_TARGET"),
    targetUserId: z.string().min(1),
  }),
]);

export type VelvetMasqueAction = z.infer<typeof VelvetMasqueActionSchema>;
