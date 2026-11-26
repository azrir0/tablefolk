import { z } from "zod";

export type CardinalDir = "N" | "E" | "S" | "W";
export type EdgeKind = "FIELD" | "ROAD" | "TOWN";
export type SegmentKind = "TOWN" | "ROAD" | "SHRINE";
export type TileRotation = 0 | 90 | 180 | 270;
export type FolkKind = "VILLAGER" | "MAYOR";

export type PlayerColorId = "terracotta" | "sage" | "ocean" | "honey" | "plum";

export const PLAYER_COLORS: readonly PlayerColorId[] = [
  "terracotta",
  "sage",
  "ocean",
  "honey",
  "plum",
] as const;

export const HEARTHVALE_QUICK_REACTIONS = [
  "Nice town! 🏰",
  "Hands off my road! 😂",
  "Mayor incoming! 👑",
  "Let's share it! 🤝",
  "Nooo my windmill! 😱",
  "Big brain move! 🧠",
  "Lantern road! 🏮",
  "Good game! ✨",
] as const;

export interface TileSegmentDef {
  id: string;
  kind: SegmentKind;
  edges: CardinalDir[];
  hasCrest?: boolean;
  hasLantern?: boolean;
  /** Default SVG anchor position (0..100) at 0° rotation for placing Folk pins */
  ax: number;
  ay: number;
}

export interface TileTemplate {
  templateId: string;
  name: string;
  edges: Record<CardinalDir, EdgeKind>;
  segments: TileSegmentDef[];
  hasShrine?: boolean;
  hasCrest?: boolean;
  hasLantern?: boolean;
  count36: number;
  count54: number;
}

export interface HearthvaleTile {
  id: string;
  templateId: string;
}

export interface PlacedFolk {
  userId: string;
  color: PlayerColorId;
  kind: FolkKind;
  segmentId: string;
}

export interface PlacedTile {
  tileId: string;
  templateId: string;
  x: number;
  y: number;
  rotation: TileRotation;
  placedBy: string;
  folk?: PlacedFolk;
}

export interface HearthvaleConfig {
  deckSize: 36 | 54;
  turnSeconds: 30 | 45 | 60 | 90;
}

export interface HearthvalePlayerState {
  userId: string;
  displayName: string;
  seatIndex: number;
  color: PlayerColorId;
  score: number;
  completedFeatures: number;
  villagersLeft: number;
  mayorsLeft: number;
  hand: HearthvaleTile[];
  consecutiveTimeouts: number;
  autoPass: boolean;
}

export type HearthvalePhase = "IN_PROGRESS" | "COMPLETED";
export type HearthvaleTurnStep = "PLACE_TILE" | "PLACE_FOLK";

export interface ScoreLogEntry {
  kind: SegmentKind;
  points: number;
  winners: string[];
  coords: Array<{ x: number; y: number }>;
  isEndGame: boolean;
}

export interface HearthvaleState {
  config: HearthvaleConfig;
  phase: HearthvalePhase;
  turnStep: HearthvaleTurnStep;
  turnNumber: number;
  activePlayerIndex: number;
  rngState: number;
  players: HearthvalePlayerState[];
  board: Record<string, PlacedTile>;
  deck: HearthvaleTile[];
  /** Coordinate of tile placed during Step 1 when waiting for Step 2 (PLACE_FOLK) */
  pendingTileCoord: string | null;
  recentEvents: HearthvaleEvent[];
  endGameSummary: {
    winners: string[];
    scores: Record<string, number>;
    endGameAwards: ScoreLogEntry[];
  } | null;
}

export const HearthvaleActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("PLACE_TILE"),
    tileId: z.string().min(1),
    x: z.number().int().min(-30).max(30),
    y: z.number().int().min(-30).max(30),
    rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  }),
  z.object({
    type: z.literal("CLAIM_FEATURE"),
    segmentId: z.string().min(1),
    folkKind: z.enum(["VILLAGER", "MAYOR"]),
  }),
  z.object({
    type: z.literal("SKIP_CLAIM"),
  }),
]);

export type HearthvaleAction = z.infer<typeof HearthvaleActionSchema>;

export type HearthvaleEvent =
  | { type: "MATCH_STARTED"; startingPlayerId: string; deckCount: number }
  | {
      type: "TILE_PLACED";
      actorId: string;
      x: number;
      y: number;
      templateId: string;
      rotation: TileRotation;
      timedOut?: boolean;
    }
  | {
      type: "FOLK_PLACED";
      actorId: string;
      x: number;
      y: number;
      segmentId: string;
      folkKind: FolkKind;
    }
  | {
      type: "FEATURE_SCORED";
      kind: SegmentKind;
      coords: Array<{ x: number; y: number }>;
      points: number;
      winners: string[];
      returnedFolk: Array<{ userId: string; kind: FolkKind; x: number; y: number }>;
      isEndGame: boolean;
    }
  | { type: "TILE_REDRAWN"; actorId: string }
  | {
      type: "MATCH_ENDED";
      winners: string[];
      scores: Record<string, number>;
    };

export interface PublicHearthvalePlayer {
  userId: string;
  displayName: string;
  seatIndex: number;
  color: PlayerColorId;
  score: number;
  completedFeatures: number;
  villagersLeft: number;
  mayorsLeft: number;
  handCount: number;
  autoPass: boolean;
}

export interface ClaimableSegmentOption {
  segmentId: string;
  kind: SegmentKind;
  ax: number;
  ay: number;
}

export interface HearthvalePublicState {
  config: HearthvaleConfig;
  phase: HearthvalePhase;
  turnStep: HearthvaleTurnStep;
  turnNumber: number;
  activePlayerId: string;
  deckCount: number;
  board: Record<string, PlacedTile>;
  pendingTileCoord: string | null;
  claimableSegments: ClaimableSegmentOption[];
  players: PublicHearthvalePlayer[];
  recentEvents: HearthvaleEvent[];
  endGameSummary: HearthvaleState["endGameSummary"];
}

export interface HearthvalePrivateState {
  userId: string;
  hand: HearthvaleTile[];
}
