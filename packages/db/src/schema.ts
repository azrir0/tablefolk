import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { AvatarConfig } from "@tablefolk/shared";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  supabaseUid: text("supabase_uid").unique(),
  isGuest: boolean("is_guest").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const playerProfiles = pgTable("player_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  bio: text("bio").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const avatarConfigs = pgTable("avatar_configs", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  configJson: jsonb("config_json").$type<AvatarConfig>().notNull(),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const cafeDefinitions = pgTable("cafe_definitions", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  mapId: text("map_id").notNull(),
  maxPlayers: integer("max_players").notNull().default(30),
  isPublic: boolean("is_public").notNull().default(true),
});

export const privateCafes = pgTable("private_cafes", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  accessCode: text("access_code").notNull().unique(),
  maxPlayers: integer("max_players").notNull().default(16),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export const gameCatalogue = pgTable("game_catalogue", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  tagline: text("tagline").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  minPlayers: integer("min_players").notNull(),
  maxPlayers: integer("max_players").notNull(),
  estimatedMinutes: integer("estimated_minutes").notNull(),
  difficulty: text("difficulty").notNull(),
  coverTheme: text("cover_theme").notNull(),
  isAvailable: boolean("is_available").notNull().default(false),
  tutorialAvailable: boolean("tutorial_available").notNull().default(true),
});

export const gameTutorials = pgTable("game_tutorials", {
  id: text("id").primaryKey(),
  gameSlug: text("game_slug")
    .notNull()
    .unique()
    .references(() => gameCatalogue.slug, { onDelete: "cascade" }),
  locale: text("locale").notNull().default("en"),
  summary: text("summary").notNull(),
  rulesMarkdown: text("rules_markdown").notNull(),
  cardReferenceJson: jsonb("card_reference_json")
    .$type<Array<{ name: string; category: string; description: string; icon: string }>>()
    .notNull(),
  faqJson: jsonb("faq_json").$type<Array<{ q: string; a: string }>>().notNull(),
  videoUrl: text("video_url"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const gameSessions = pgTable("game_sessions", {
  id: text("id").primaryKey(),
  gameSlug: text("game_slug").notNull(),
  cafeRoomId: text("cafe_room_id").notNull(),
  tableId: text("table_id").notNull(),
  status: text("status").notNull().default("IN_PROGRESS"),
  configJson: jsonb("config_json").$type<Record<string, unknown>>().notNull(),
  stateSnapshotJson: jsonb("state_snapshot_json").$type<Record<string, unknown>>(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
});

export const gamePlayers = pgTable("game_players", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => gameSessions.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  displayName: text("display_name").notNull(),
  seatIndex: integer("seat_index").notNull(),
  score: integer("score").notNull().default(0),
  isWinner: boolean("is_winner").notNull().default(false),
  roleRevealed: text("role_revealed"),
});

export const playerReports = pgTable("player_reports", {
  id: text("id").primaryKey(),
  reporterId: text("reporter_id").notNull(),
  targetId: text("target_id").notNull(),
  reason: text("reason").notNull(),
  contextJson: jsonb("context_json").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
