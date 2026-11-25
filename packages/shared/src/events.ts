import { z } from "zod";
import { AvatarConfigSchema } from "./avatar.js";

export const QUICK_CHAT_MESSAGES = [
  "Hello!",
  "Let's play!",
  "Good game!",
  "Nice move!",
  "Your turn!",
  "Wait a moment.",
  "Well played!",
  "Thank you!",
] as const;

export const EMOTE_LIST = [
  { id: "wave", label: "Wave", icon: "👋" },
  { id: "laugh", label: "Laugh", icon: "😄" },
  { id: "dance", label: "Dance", icon: "💃" },
  { id: "celebrate", label: "Celebrate", icon: "🎉" },
  { id: "cry", label: "Cry", icon: "😢" },
  { id: "love", label: "Love", icon: "❤️" },
  { id: "surprise", label: "Surprise", icon: "😮" },
  { id: "highfive", label: "High-Five", icon: "🙌" },
] as const;

export type EmoteId = (typeof EMOTE_LIST)[number]["id"];

export const EmoteIdSchema = z.enum([
  "wave",
  "laugh",
  "dance",
  "celebrate",
  "cry",
  "love",
  "surprise",
  "highfive",
]);

export const DirectionSchema = z.enum(["north", "south", "east", "west"]);

// --- Client -> Server CafeRoom event schemas ---

export const PlayerMovePayloadSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  facing: DirectionSchema,
  isMoving: z.boolean(),
});

export const PlayerEmotePayloadSchema = z.object({
  emote: EmoteIdSchema,
});

export const PlayerCarryGamePayloadSchema = z.object({
  gameSlug: z.string().min(1).max(64).nullable(),
});

export const TableReserveSeatPayloadSchema = z.object({
  tableId: z.string().min(1).max(64),
  seatIndex: z.number().int().min(0).max(12),
});

export const TableSetGamePayloadSchema = z.object({
  tableId: z.string().min(1).max(64),
  gameSlug: z.string().min(1).max(64),
});

export const TableReadyPayloadSchema = z.object({
  ready: z.boolean(),
});

export const TableStartGamePayloadSchema = z.object({
  tableId: z.string().min(1).max(64),
  rounds: z.union([z.literal(1), z.literal(3)]).default(1),
  turnSeconds: z.union([z.literal(30), z.literal(45), z.literal(60), z.literal(90)]).default(45),
  mysteryRoles: z.boolean().default(false),
});

export const ChatSendPayloadSchema = z.object({
  scope: z.enum(["cafe", "table"]),
  message: z.string().trim().min(1).max(240),
  isQuickChat: z.boolean().optional(),
});

export const ProfileUpdateAvatarPayloadSchema = z.object({
  avatarConfig: AvatarConfigSchema,
  displayName: z.string().trim().min(2).max(24).optional(),
});

// --- Shared REST DTOs ---

export interface UserProfileDTO {
  userId: string;
  displayName: string;
  email: string | null;
  isGuest: boolean;
  avatarConfig: z.infer<typeof AvatarConfigSchema>;
}

export interface GameCatalogueItemDTO {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  category: string;
  minPlayers: number;
  maxPlayers: number;
  estimatedMinutes: number;
  difficulty: "Easy" | "Medium" | "Strategic";
  coverTheme: string;
  isAvailable: boolean;
  tutorialAvailable: boolean;
}

export interface GameTutorialDTO {
  gameSlug: string;
  title: string;
  summary: string;
  rulesMarkdown: string;
  cardReference: Array<{
    name: string;
    category: string;
    description: string;
    icon: string;
  }>;
  faq: Array<{ q: string; a: string }>;
  videoUrl: string | null;
}

export interface CafeInstanceSummaryDTO {
  roomId: string;
  name: string;
  instanceLabel: string;
  isPrivate: boolean;
  accessCode?: string;
  playerCount: number;
  maxPlayers: number;
}

export interface ChatMessageDTO {
  id: string;
  scope: "cafe" | "table" | "game";
  tableId?: string;
  senderUserId: string;
  senderName: string;
  message: string;
  isQuickChat?: boolean;
  timestamp: number;
}
