import crypto from "node:crypto";
import colyseus, { type Client } from "colyseus";
const { Room, matchMaker } = colyseus;
import { eq, gameCatalogue, getDb } from "@tablefolk/db";
import {
  COZY_CAFE_MAP,
  ChatSendPayloadSchema,
  PlayerCarryGamePayloadSchema,
  PlayerEmotePayloadSchema,
  PlayerMovePayloadSchema,
  TableReadyPayloadSchema,
  TableReserveSeatPayloadSchema,
  TableSetGamePayloadSchema,
  TableStartGamePayloadSchema,
  isWalkableWorldPos,
  type ChatMessageDTO,
} from "@tablefolk/shared";
import { getUserProfile, verifyAuthToken } from "../services/auth.js";
import {
  abortGameRoom,
  getActiveGameForUser,
  registerCafeRoom,
  registerPrivateCafeCode,
  unregisterCafeRoom,
} from "../services/roomRegistry.js";
import { CafeRoomState, PlayerSchema, SeatSchema, TableSchema } from "./CafeState.js";

const BOT_NAMES = ["Barista Bean", "Maple Fox", "Matcha Bot", "Latte Owl", "Scone Bear"];

const BAD_WORDS = ["slur", "idiot", "stupid"]; // Minimal MVP profanity filter placeholder

function sanitizeChat(raw: string): string {
  let text = raw.trim().slice(0, 240);
  for (const w of BAD_WORDS) {
    text = text.replace(new RegExp(`\\b${w}\\b`, "gi"), "***");
  }
  return text;
}

let publicInstanceCounter = 0;

interface CafeJoinOptions {
  token?: string;
  accessCode?: string;
  isPrivate?: boolean;
  cafeName?: string;
  ownerUserId?: string;
  maxPlayers?: number;
}

interface AuthedClientData {
  userId: string;
  displayName: string;
  avatarJson: string;
  isGuest: boolean;
}

export class CafeRoom extends Room<CafeRoomState> {
  private chatTimestamps = new Map<string, number[]>();
  private lastMoveAt = new Map<string, number>();
  private privateExpireTimer: ReturnType<typeof setTimeout> | null = null;

  onCreate(options: CafeJoinOptions) {
    const state = new CafeRoomState();
    const isPrivate = Boolean(options.isPrivate);

    state.isPrivate = isPrivate;
    state.mapId = COZY_CAFE_MAP.id;

    if (isPrivate) {
      state.cafeName = (options.cafeName || "Private Board Game Café").slice(0, 40);
      state.instanceLabel = "Private Room";
      state.accessCode = (
        options.accessCode || crypto.randomBytes(3).toString("hex").toUpperCase()
      ).toUpperCase();
      state.ownerUserId = options.ownerUserId || "";
      this.maxClients = Math.min(Math.max(options.maxPlayers || 16, 4), 30);
      this.autoDispose = false;
      void this.setPrivate(true);
      registerPrivateCafeCode(state.accessCode, this.roomId);
      // Expire after 5 minutes if nobody joins
      this.schedulePrivateExpiry(5 * 60 * 1000);
    } else {
      publicInstanceCounter += 1;
      state.cafeName = COZY_CAFE_MAP.name;
      state.instanceLabel = `Public #${String(publicInstanceCounter).padStart(3, "0")}`;
      this.maxClients = 30;
    }

    // Initialize every physical table & chair from the single-source-of-truth Cozy Café map
    for (const tableDef of COZY_CAFE_MAP.tables) {
      const tbl = new TableSchema();
      tbl.tableId = tableDef.id;
      tbl.name = tableDef.name;
      tbl.category = tableDef.category;
      tbl.capacity = tableDef.capacity;
      tbl.status = "AVAILABLE";
      tbl.selectedGameSlug = tableDef.capacity >= 3 ? "treasure-trails" : "";

      for (const seatDef of tableDef.seats) {
        const seat = new SeatSchema();
        seat.seatIndex = seatDef.seatIndex;
        seat.status = "AVAILABLE";
        tbl.seats.push(seat);
      }

      state.tables.set(tbl.tableId, tbl);
    }

    this.setState(state);
    void this.setMetadata({
      cafeName: state.cafeName,
      instanceLabel: state.instanceLabel,
      isPrivate: state.isPrivate,
    });

    registerCafeRoom(
      this.roomId,
      (tableId) => {
        this.handleGameFinished(tableId);
      },
      (tableId, gameRoomId) => {
        this.handleGameRestarted(tableId, gameRoomId);
      }
    );

    this.registerMessageHandlers();
  }

  private schedulePrivateExpiry(ms: number) {
    if (!this.state?.isPrivate) return;
    if (this.privateExpireTimer) clearTimeout(this.privateExpireTimer);
    this.privateExpireTimer = setTimeout(() => {
      if (this.clients.length === 0) {
        void this.disconnect();
      }
    }, ms);
  }

  async onAuth(client: Client, options: CafeJoinOptions): Promise<AuthedClientData> {
    if (!options?.token) {
      throw new Error("Authentication token required.");
    }
    const verified = await verifyAuthToken(options.token);
    if (this.state.isPrivate) {
      const provided = (options.accessCode || "").trim().toUpperCase();
      if (provided !== this.state.accessCode && verified.sub !== this.state.ownerUserId) {
        throw new Error("Invalid private café access code.");
      }
    }

    const profile = await getUserProfile(verified.sub);
    if (!profile) {
      throw new Error("Player profile not found.");
    }

    return {
      userId: profile.userId,
      displayName: profile.displayName,
      avatarJson: JSON.stringify(profile.avatarConfig),
      isGuest: profile.isGuest,
    };
  }

  onJoin(client: Client, _options?: CafeJoinOptions, auth?: AuthedClientData) {
    if (!auth) return;
    if (this.privateExpireTimer) {
      clearTimeout(this.privateExpireTimer);
      this.privateExpireTimer = null;
    }

    const player = new PlayerSchema();
    player.sessionId = client.sessionId;
    player.userId = auth.userId;
    player.displayName = auth.displayName;
    player.avatarJson = auth.avatarJson;

    // Preserve state & seat seamlessly if the same user reconnected on a fresh socket
    let restoredFromPrevious = false;
    for (const [sid, existing] of this.state.players.entries()) {
      if (existing.userId === auth.userId && sid !== client.sessionId) {
        if (!restoredFromPrevious) {
          player.x = existing.x;
          player.y = existing.y;
          player.facing = existing.facing;
          player.carryingGameSlug = existing.carryingGameSlug;
          player.inGameSessionId = existing.inGameSessionId;
          player.isReady = existing.isReady;

          if (existing.seatedTableId) {
            const table = this.state.tables.get(existing.seatedTableId);
            const seat = table?.seats.at(existing.seatIndex);
            if (table && seat && seat.occupantSessionId === sid) {
              seat.occupantSessionId = client.sessionId;
              seat.occupantName = auth.displayName;
              player.seatedTableId = existing.seatedTableId;
              player.seatIndex = existing.seatIndex;
            }
          }
          restoredFromPrevious = true;
        } else {
          this.releasePlayerSeat(existing, false);
        }

        this.state.players.delete(sid);
        this.chatTimestamps.delete(sid);
        this.lastMoveAt.delete(sid);
      }
    }

    if (!restoredFromPrevious) {
      // Slight jitter around spawn rug so multiple joining players don't stack identically
      const jitterX = (Math.random() - 0.5) * 64;
      const jitterY = (Math.random() - 0.5) * 28;
      const spawnX = COZY_CAFE_MAP.spawnPoint.x + jitterX;
      const spawnY = COZY_CAFE_MAP.spawnPoint.y + jitterY;
      player.x = isWalkableWorldPos(spawnX, spawnY) ? spawnX : COZY_CAFE_MAP.spawnPoint.x;
      player.y = isWalkableWorldPos(spawnX, spawnY) ? spawnY : COZY_CAFE_MAP.spawnPoint.y;
      player.facing = "north";
    }

    // Check if this user has an active in-progress game match they can rejoin
    const activeGame = getActiveGameForUser(auth.userId);
    if (activeGame) {
      if (activeGame.cafeRoomId === this.roomId && !player.seatedTableId) {
        const table = this.state.tables.get(activeGame.tableId);
        const tableDef = COZY_CAFE_MAP.tables.find((t) => t.id === activeGame.tableId);
        if (table && tableDef && table.activeGameRoomId === activeGame.gameRoomId) {
          const openSeat = table.seats.find((s) => s.status === "AVAILABLE");
          if (openSeat) {
            const seatDef = tableDef.seats[openSeat.seatIndex];
            openSeat.status = "OCCUPIED";
            openSeat.occupantSessionId = client.sessionId;
            openSeat.occupantUserId = player.userId;
            openSeat.occupantName = player.displayName;
            openSeat.isBot = false;
            openSeat.isReady = true;
            player.seatedTableId = table.tableId;
            player.seatIndex = openSeat.seatIndex;
            player.inGameSessionId = activeGame.gameRoomId;
            if (!table.hostUserId) table.hostUserId = player.userId;
            if (seatDef) {
              player.x = seatDef.x;
              player.y = seatDef.y;
              player.facing = seatDef.facing;
            }
          }
        }
      }
      client.send("game.rejoinAvailable", activeGame);
    }

    this.state.players.set(client.sessionId, player);

    this.broadcast("player.joined", {
      sessionId: client.sessionId,
      userId: player.userId,
      displayName: player.displayName,
    });
  }

  async onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    if (!consented) {
      try {
        await this.allowReconnection(client, 30);
        return;
      } catch {
        // Timed out — clean up below
      }
    }

    // Re-check in case a newer socket already replaced this player entry
    const currentPlayer = this.state.players.get(client.sessionId);
    if (!currentPlayer) return;

    this.releasePlayerSeat(currentPlayer, false);
    this.state.players.delete(client.sessionId);
    this.chatTimestamps.delete(client.sessionId);
    this.lastMoveAt.delete(client.sessionId);

    this.broadcast("player.left", {
      sessionId: client.sessionId,
      userId: currentPlayer.userId,
      displayName: currentPlayer.displayName,
    });

    if (this.state.isPrivate && this.clients.length === 0) {
      this.schedulePrivateExpiry(5 * 60 * 1000);
    }
  }

  onDispose() {
    if (this.privateExpireTimer) clearTimeout(this.privateExpireTimer);
    unregisterCafeRoom(this.roomId, this.state.accessCode);
  }

  private registerMessageHandlers() {
    // 0. Liveness ping so mobile browsers waking from background detect zombie half-open sockets
    this.onMessage("cafe.ping", (client) => {
      client.send("cafe.pong", { ts: Date.now() });
    });

    // 1. Movement with server-side speed & walkability validation
    this.onMessage("player.move", (client, raw) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.seatedTableId) return;

      const parsed = PlayerMovePayloadSchema.safeParse(raw);
      if (!parsed.success) return;

      const now = Date.now();
      const prevTime = this.lastMoveAt.get(client.sessionId) ?? now - 100;
      const dtSec = Math.max((now - prevTime) / 1000, 0.016);
      this.lastMoveAt.set(client.sessionId, now);

      const { x, y, facing, isMoving } = parsed.data;
      const dist = Math.hypot(x - player.x, y - player.y);
      const maxAllowedDist = Math.max(280 * dtSec + 42, 72);

      if (dist <= maxAllowedDist && isWalkableWorldPos(x, y, 10)) {
        player.x = x;
        player.y = y;
      }
      player.facing = facing;
      player.isMoving = isMoving;
    });

    // 2. Character Emotes
    this.onMessage("player.emote", (client, raw) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const parsed = PlayerEmotePayloadSchema.safeParse(raw);
      if (!parsed.success) return;

      player.emote = parsed.data.emote;
      player.emoteSeq += 1;
      this.broadcast("player.emoted", {
        sessionId: client.sessionId,
        userId: player.userId,
        emote: parsed.data.emote,
      });
    });

    // 3. Wardrobe: Carry selected game box
    this.onMessage("player.carryGame", async (client, raw) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const parsed = PlayerCarryGamePayloadSchema.safeParse(raw);
      if (!parsed.success) return;

      const slug = parsed.data.gameSlug;
      if (!slug) {
        player.carryingGameSlug = "";
        return;
      }

      const db = await getDb();
      const [game] = await db
        .select()
        .from(gameCatalogue)
        .where(eq(gameCatalogue.slug, slug))
        .limit(1);

      if (!game || !game.isAvailable) {
        client.send("cafe.error", { message: "That board game is coming soon!" });
        return;
      }

      player.carryingGameSlug = game.slug;
      client.send("cafe.notice", {
        message: `You picked up ${game.title}! Walk to a 3–8 seat table and tap a chair.`,
      });
    });

    // 4. Refresh avatar live after saving in Avatar Customizer
    this.onMessage("player.refreshProfile", async (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const profile = await getUserProfile(player.userId);
      if (!profile) return;
      player.displayName = profile.displayName;
      player.avatarJson = JSON.stringify(profile.avatarConfig);
    });

    // 5. Hybrid Table Seating: Atomic Seat Reservation
    this.onMessage("table.reserveSeat", (client, raw) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const parsed = TableReserveSeatPayloadSchema.safeParse(raw);
      if (!parsed.success) return;

      const { tableId, seatIndex } = parsed.data;
      const table = this.state.tables.get(tableId);
      const tableDef = COZY_CAFE_MAP.tables.find((t) => t.id === tableId);
      if (!table || !tableDef) return;

      if (table.status === "IN_PROGRESS") {
        const activeGame = getActiveGameForUser(player.userId);
        if (activeGame && activeGame.gameRoomId === table.activeGameRoomId) {
          client.send("table.gameStarted", {
            tableId: table.tableId,
            gameRoomId: activeGame.gameRoomId,
            gameSlug: activeGame.gameSlug,
          });
          return;
        }
        client.send("cafe.error", { message: "A game is currently in progress at this table." });
        return;
      }

      // Physical proximity validation (unless switching chairs at the same table)
      if (player.seatedTableId !== tableId) {
        const dist = Math.hypot(player.x - tableDef.x, player.y - tableDef.y);
        if (dist > tableDef.interactionRadius + 80) {
          client.send("cafe.error", {
            message: `Walk closer to ${tableDef.name} to choose a seat!`,
          });
          return;
        }
      }

      const seat = table.seats.at(seatIndex);
      const seatDef = tableDef.seats[seatIndex];
      if (!seat || !seatDef) return;

      if (seat.status !== "AVAILABLE") {
        client.send("cafe.error", { message: "That chair is already taken." });
        return;
      }

      // Release any previous seat cleanly before occupying the new one
      this.releasePlayerSeat(player, true);

      seat.status = "OCCUPIED";
      seat.occupantSessionId = client.sessionId;
      seat.occupantUserId = player.userId;
      seat.occupantName = player.displayName;
      seat.isBot = false;
      seat.isReady = false;

      player.seatedTableId = tableId;
      player.seatIndex = seatIndex;
      player.x = seatDef.x;
      player.y = seatDef.y;
      player.facing = seatDef.facing;
      player.isMoving = false;
      player.isReady = false;

      // Assign host if table had no human host yet
      if (!table.hostUserId) {
        table.hostUserId = player.userId;
      }

      // If player walked over carrying a compatible game box, place it on the table!
      if (player.carryingGameSlug) {
        if (player.carryingGameSlug === "treasure-trails" && table.capacity < 3) {
          client.send("cafe.notice", {
            message: `${table.name} only fits ${table.capacity} players — Treasure Trails needs 3–8 seats!`,
          });
        } else {
          table.selectedGameSlug = player.carryingGameSlug;
          player.carryingGameSlug = "";
        }
      }

      this.recomputeTableStatus(table);
    });

    // 6. Stand up / Leave Table
    this.onMessage("table.releaseSeat", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.seatedTableId) return;
      this.releasePlayerSeat(player, true);
    });

    // 7. Quick Game Switcher at Table
    this.onMessage("table.setGame", (client, raw) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const parsed = TableSetGamePayloadSchema.safeParse(raw);
      if (!parsed.success) return;

      const table = this.state.tables.get(parsed.data.tableId);
      if (!table || table.hostUserId !== player.userId || table.status === "IN_PROGRESS") return;
      if (parsed.data.gameSlug === "treasure-trails" && table.capacity < 3) {
        client.send("cafe.error", { message: "Treasure Trails requires a 3–8 seat table." });
        return;
      }
      table.selectedGameSlug = parsed.data.gameSlug;
    });

    // 8. Ready Up Toggle
    this.onMessage("table.ready", (client, raw) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.seatedTableId) return;
      const parsed = TableReadyPayloadSchema.safeParse(raw);
      if (!parsed.success) return;

      const table = this.state.tables.get(player.seatedTableId);
      if (!table || table.status === "IN_PROGRESS") return;

      const seat = table.seats.at(player.seatIndex);
      if (!seat || seat.occupantSessionId !== client.sessionId) return;

      player.isReady = parsed.data.ready;
      seat.isReady = parsed.data.ready;
    });

    // 9. Practice Bot Controls (Host can fill empty chairs with Café Bots for instant solo/duo play!)
    this.onMessage("table.addBot", (client, raw: { tableId?: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !raw?.tableId) return;
      const table = this.state.tables.get(raw.tableId);
      if (!table || table.hostUserId !== player.userId || table.status === "IN_PROGRESS") return;

      const openSeat = table.seats.find((s) => s.status === "AVAILABLE");
      if (!openSeat) {
        client.send("cafe.error", { message: "No empty chairs left at this table." });
        return;
      }

      const existingBots = table.seats.filter((s) => s.isBot).length;
      const botName = BOT_NAMES[existingBots % BOT_NAMES.length]!;
      const botId = `bot_${table.tableId}_${openSeat.seatIndex}`;

      openSeat.status = "BOT";
      openSeat.occupantSessionId = botId;
      openSeat.occupantUserId = botId;
      openSeat.occupantName = botName;
      openSeat.isBot = true;
      openSeat.isReady = true;

      this.recomputeTableStatus(table);
    });

    this.onMessage("table.removeBot", (client, raw: { tableId?: string; seatIndex?: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !raw?.tableId) return;
      const table = this.state.tables.get(raw.tableId);
      if (!table || table.hostUserId !== player.userId || table.status === "IN_PROGRESS") return;

      const targetSeat =
        typeof raw.seatIndex === "number"
          ? table.seats.at(raw.seatIndex)
          : [...table.seats].reverse().find((s) => Boolean(s?.isBot));

      if (!targetSeat || !targetSeat.isBot) return;
      this.clearSeat(targetSeat);
      this.recomputeTableStatus(table);
    });

    // 10. Start Board Game Session (Spawns GameRoom while keeping avatars seated in CafeRoom!)
    this.onMessage("table.startGame", async (client, raw) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const parsed = TableStartGamePayloadSchema.safeParse(raw);
      if (!parsed.success) return;

      const { tableId, rounds, turnSeconds, mysteryRoles } = parsed.data;
      const table = this.state.tables.get(tableId);
      if (!table || table.status === "IN_PROGRESS") return;

      if (table.hostUserId !== player.userId) {
        client.send("cafe.error", { message: "Only the table host can start the game." });
        return;
      }

      if (table.selectedGameSlug !== "treasure-trails") {
        client.send("cafe.error", { message: "Select Treasure Trails to play!" });
        return;
      }

      const occupiedSeats = table.seats.filter((s) => s.status !== "AVAILABLE");
      if (occupiedSeats.length < 3 || occupiedSeats.length > 8) {
        client.send("cafe.error", {
          message: `Treasure Trails needs 3–8 players (currently ${occupiedSeats.length}). Invite friends or add a Practice Bot!`,
        });
        return;
      }

      const unreadyHumans = occupiedSeats.filter(
        (s) => !s.isBot && s.occupantUserId !== table.hostUserId && !s.isReady
      );
      if (unreadyHumans.length > 0) {
        client.send("cafe.error", {
          message: "Waiting for all seated players to click Ready.",
        });
        return;
      }

      const seatedPlayers = occupiedSeats.map((s) => ({
        userId: s.occupantUserId,
        displayName: s.occupantName,
        seatIndex: s.seatIndex,
        isBot: s.isBot,
      }));

      const gameRoom = await matchMaker.createRoom("game", {
        cafeRoomId: this.roomId,
        tableId: table.tableId,
        gameSlug: table.selectedGameSlug,
        config: {
          totalRounds: rounds,
          turnSeconds,
          mysteryRoles,
        },
        players: seatedPlayers,
      });

      table.status = "IN_PROGRESS";
      table.activeGameRoomId = gameRoom.roomId;

      for (const s of occupiedSeats) {
        if (!s.isBot) {
          const p = this.state.players.get(s.occupantSessionId);
          if (p) {
            p.inGameSessionId = gameRoom.roomId;
          }
          const targetClient = this.clients.find((c) => c.sessionId === s.occupantSessionId);
          targetClient?.send("table.gameStarted", {
            tableId: table.tableId,
            gameRoomId: gameRoom.roomId,
            gameSlug: table.selectedGameSlug,
          });
        }
      }
    });

    // 11. Chat (Café-wide or Table-scoped) with Rate Limiting + Overhead Speech Bubbles
    this.onMessage("chat.send", (client, raw) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const parsed = ChatSendPayloadSchema.safeParse(raw);
      if (!parsed.success) return;

      const now = Date.now();
      const recent = (this.chatTimestamps.get(client.sessionId) ?? []).filter(
        (t) => now - t < 5000
      );
      if (recent.length >= 5) {
        client.send("cafe.error", { message: "Slow down a bit — chat rate limit reached." });
        return;
      }
      recent.push(now);
      this.chatTimestamps.set(client.sessionId, recent);

      const cleanText = sanitizeChat(parsed.data.message);
      player.speechText = cleanText.slice(0, 80);
      player.speechSeq += 1;

      const msg: ChatMessageDTO = {
        id: `msg_${crypto.randomUUID().slice(0, 10)}`,
        scope: parsed.data.scope,
        tableId: parsed.data.scope === "table" ? player.seatedTableId || undefined : undefined,
        senderUserId: player.userId,
        senderName: player.displayName,
        message: cleanText,
        isQuickChat: parsed.data.isQuickChat,
        timestamp: now,
      };

      if (parsed.data.scope === "table" && player.seatedTableId) {
        const table = this.state.tables.get(player.seatedTableId);
        if (table) {
          for (const seat of table.seats) {
            if (seat.status === "OCCUPIED") {
              const target = this.clients.find((c) => c.sessionId === seat.occupantSessionId);
              target?.send("chat.received", msg);
            }
          }
          return;
        }
      }

      this.broadcast("chat.received", msg);
    });
  }

  private clearSeat(seat: SeatSchema) {
    seat.status = "AVAILABLE";
    seat.occupantSessionId = "";
    seat.occupantUserId = "";
    seat.occupantName = "";
    seat.isBot = false;
    seat.isReady = false;
  }

  private releasePlayerSeat(player: PlayerSchema, explicitStandUp = false) {
    if (!player.seatedTableId) return;
    const table = this.state.tables.get(player.seatedTableId);
    const tableDef = COZY_CAFE_MAP.tables.find((t) => t.id === player.seatedTableId);

    if (table) {
      const seat = table.seats.at(player.seatIndex);
      if (seat && seat.occupantSessionId === player.sessionId) {
        this.clearSeat(seat);
      }

      const remainingHumans = table.seats.filter((s) => s.status === "OCCUPIED");
      if (remainingHumans.length === 0) {
        const runningGameId = table.activeGameRoomId;
        if (table.status === "IN_PROGRESS" && runningGameId && !explicitStandUp) {
          // Do not abort an active GameRoom on an unconsented CafeRoom socket timeout
          // (e.g. minimized mobile browser). GameRoom handles its own 60s empty-human grace timer.
          table.hostUserId = "";
        } else {
          // Explicit stand-up or pre-game lobby: reset table immediately and stop any bot-only match!
          for (const s of table.seats) this.clearSeat(s);
          table.hostUserId = "";
          table.status = "AVAILABLE";
          table.activeGameRoomId = "";
          if (runningGameId) {
            abortGameRoom(runningGameId);
          }
        }
      } else if (table.hostUserId === player.userId) {
        table.hostUserId = remainingHumans[0]!.occupantUserId;
      }

      this.recomputeTableStatus(table);
    }

    // Nudge player slightly outward from chair back onto walkable aisle
    if (tableDef && player.seatIndex >= 0) {
      const seatDef = tableDef.seats[player.seatIndex];
      if (seatDef) {
        const dx = seatDef.facing === "east" ? -20 : seatDef.facing === "west" ? 20 : 0;
        const dy = seatDef.facing === "south" ? -20 : seatDef.facing === "north" ? 20 : 0;
        if (isWalkableWorldPos(seatDef.x + dx, seatDef.y + dy, 10)) {
          player.x = seatDef.x + dx;
          player.y = seatDef.y + dy;
        }
      }
    }

    player.seatedTableId = "";
    player.seatIndex = -1;
    player.isReady = false;
    player.inGameSessionId = "";
  }

  private recomputeTableStatus(table: TableSchema) {
    if (table.status === "IN_PROGRESS") return;
    const occupied = table.seats.filter((s) => s.status !== "AVAILABLE").length;
    if (occupied === 0) {
      table.status = "AVAILABLE";
    } else if (occupied >= table.capacity) {
      table.status = "FULL";
    } else {
      table.status = "WAITING";
    }
  }

  private handleGameFinished(tableId: string) {
    const table = this.state.tables.get(tableId);
    if (!table) return;

    table.activeGameRoomId = "";

    const remainingHumans = table.seats.filter((s) => s.status === "OCCUPIED");
    if (remainingHumans.length === 0) {
      for (const s of table.seats) this.clearSeat(s);
      table.hostUserId = "";
      table.status = "AVAILABLE";
      return;
    }

    table.status = "WAITING";
    for (const seat of table.seats) {
      if (!seat.isBot) {
        seat.isReady = false;
        const p = this.state.players.get(seat.occupantSessionId);
        if (p) {
          p.isReady = false;
          p.inGameSessionId = "";
        }
      }
    }

    this.recomputeTableStatus(table);
  }

  private handleGameRestarted(tableId: string, gameRoomId: string) {
    const table = this.state.tables.get(tableId);
    if (!table) return;
    table.status = "IN_PROGRESS";
    table.activeGameRoomId = gameRoomId;
    for (const seat of table.seats) {
      if (seat.status === "OCCUPIED") {
        const p = this.state.players.get(seat.occupantSessionId);
        if (p) {
          p.inGameSessionId = gameRoomId;
        }
      }
    }
  }
}
