import crypto from "node:crypto";
import colyseus, { type Client } from "colyseus";
const { Room } = colyseus;
import { eq, gamePlayers, gameSessions, getDb } from "@tablefolk/db";
import {
  BoardMarkerAddPayloadSchema,
  BoardMarkerClearPayloadSchema,
  getPlayerColorMeta,
  type BoardMarkerStroke,
} from "@tablefolk/shared";
import {
  VELVET_MASQUE_QUICK_BLUFFS,
  VelvetMasqueActionSchema,
  VelvetMasqueModule,
  clearVelvetMasqueAfk,
  pickVelvetMasqueBotAction,
  type VelvetMasqueAction,
  type VelvetMasqueConfig,
  type VelvetMasqueEvent,
  type VelvetMasqueState,
} from "@tablefolk/game-velvet-masque";
import { verifyAuthToken } from "../services/auth.js";
import {
  notifyCafeTableFinished,
  notifyCafeTableRestarted,
  registerGameRoom,
  unregisterGameRoom,
} from "../services/roomRegistry.js";

interface VelvetMasqueRoomCreateOptions {
  cafeRoomId: string;
  tableId: string;
  gameSlug: string;
  config: Partial<VelvetMasqueConfig>;
  players: Array<{
    userId: string;
    displayName: string;
    seatIndex: number;
    isBot: boolean;
  }>;
}

interface VelvetMasqueJoinOptions {
  token?: string;
}

interface VelvetMasqueAuthedClient {
  userId: string;
  displayName: string;
  isSpectator: boolean;
}

const DISCONNECT_BOT_GRACE_MS = 18_000;
const MARKER_FADE_MS = 9_500;
const MAX_ROOM_MARKERS = 35;

export class VelvetMasqueRoom extends Room {
  private sessionId = "";
  private cafeRoomId = "";
  private tableId = "";
  private gameSlug = "velvet-masque";
  private initialPlayers: VelvetMasqueRoomCreateOptions["players"] = [];
  private initialConfig: Partial<VelvetMasqueConfig> = {};
  private gameState!: VelvetMasqueState;
  private botUserIds = new Set<string>();
  private botControlledHumans = new Set<string>();
  private botTakeoverTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private allowedUserIds = new Set<string>();
  private userIdToClient = new Map<string, Client>();
  private spectators = new Map<string, { userId: string; displayName: string }>();
  private markers: BoardMarkerStroke[] = [];
  private markerTimestamps = new Map<string, number[]>();
  private rematchVotes = new Set<string>();
  private turnEndsAt = 0;
  private botTimers = new Set<ReturnType<typeof setTimeout>>();
  private emptyHumansTimer: ReturnType<typeof setTimeout> | null = null;
  private completedIdleTimer: ReturnType<typeof setTimeout> | null = null;
  private persistedFinish = false;
  private aborted = false;

  async onCreate(options: VelvetMasqueRoomCreateOptions) {
    this.autoDispose = false;
    void this.setPrivate(true);

    this.cafeRoomId = options.cafeRoomId;
    this.tableId = options.tableId;
    this.gameSlug = "velvet-masque";
    this.initialPlayers = options.players;
    this.initialConfig = options.config;
    this.sessionId = `vm_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

    const humanUserIds: string[] = [];
    for (const p of options.players) {
      this.allowedUserIds.add(p.userId);
      if (p.isBot) this.botUserIds.add(p.userId);
      else humanUserIds.push(p.userId);
    }

    const rngSeed = crypto.randomInt(1, 2_000_000_000);
    this.gameState = VelvetMasqueModule.createInitialState(
      options.players.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        seatIndex: p.seatIndex,
      })),
      options.config,
      rngSeed
    );

    registerGameRoom(
      this.roomId,
      () => {
        this.abortAbandonedGame();
      },
      humanUserIds,
      {
        cafeRoomId: this.cafeRoomId,
        tableId: this.tableId,
        gameSlug: this.gameSlug,
      }
    );

    void this.persistInitialSession();
    this.resetStepClock();
    this.scheduleEmptyHumansAbort(25_000);

    // 500ms authoritative step clock (paused when 0 humans connected)
    this.setSimulationInterval(() => {
      if (this.aborted || this.gameState.phase !== "IN_PROGRESS") return;
      if (this.userIdToClient.size === 0) return;
      if (Date.now() >= this.turnEndsAt) {
        const res = VelvetMasqueModule.onTurnTimeout(this.gameState);
        this.gameState = res.state;
        void this.persistSnapshot();
        if (this.gameState.phase === "IN_PROGRESS") {
          this.resetStepClock();
        }
        this.broadcastStateAndEvents(res.events);
        this.handlePostStateChange(res.events);
      }
    }, 500);

    this.registerMessageHandlers();
  }

  async onAuth(
    _client: Client,
    options: VelvetMasqueJoinOptions
  ): Promise<VelvetMasqueAuthedClient> {
    if (!options?.token) {
      throw new Error("Authentication required to join Velvet Masque.");
    }
    const verified = await verifyAuthToken(options.token);
    const isParticipant = this.allowedUserIds.has(verified.sub);
    return {
      userId: verified.sub,
      displayName: verified.displayName,
      isSpectator: !isParticipant,
    };
  }

  onJoin(client: Client, _options?: VelvetMasqueJoinOptions, auth?: VelvetMasqueAuthedClient) {
    if (!auth) return;

    let reclaimedFromBot = false;
    let returnedFromGrace = false;
    const wasEmpty = this.userIdToClient.size === 0;

    if (!auth.isSpectator) {
      this.userIdToClient.set(auth.userId, client);
      this.gameState = clearVelvetMasqueAfk(this.gameState, auth.userId);

      if (this.emptyHumansTimer) {
        clearTimeout(this.emptyHumansTimer);
        this.emptyHumansTimer = null;
      }
      const pendingTakeover = this.botTakeoverTimers.get(auth.userId);
      if (pendingTakeover) {
        clearTimeout(pendingTakeover);
        this.botTakeoverTimers.delete(auth.userId);
        returnedFromGrace = true;
      }
      if (this.botControlledHumans.delete(auth.userId)) {
        reclaimedFromBot = true;
      }

      if (wasEmpty && this.gameState.phase === "IN_PROGRESS") {
        // Fresh clock when the first human lands (so Curtain Call gives full 7s!)
        this.resetStepClock();
      } else if (reclaimedFromBot && this.gameState.phase === "IN_PROGRESS") {
        this.clearBotTimers();
        this.resetStepClock();
      }
    }

    if (auth.isSpectator) {
      this.spectators.set(client.sessionId, {
        userId: auth.userId,
        displayName: auth.displayName,
      });
    }

    this.sendFullSyncToClient(client, auth);

    if (auth.isSpectator) {
      this.broadcastSystemChat(`👁️ ${auth.displayName} started watching the gala!`);
      this.broadcastStateAndEvents([]);
    } else {
      if (reclaimedFromBot) {
        this.broadcastSystemChat(`👋 ${auth.displayName} rejoined and resumed their seat!`);
        this.broadcastStateAndEvents([]);
      } else if (returnedFromGrace) {
        this.broadcastSystemChat(`👋 ${auth.displayName} is back!`);
      }
      this.scheduleBotsIfNeeded(false);
    }
  }

  onLeave(client: Client, _consented: boolean) {
    const auth = client.auth as VelvetMasqueAuthedClient | undefined;
    if (!auth) return;

    if (auth.isSpectator) {
      this.spectators.delete(client.sessionId);
      this.broadcastStateAndEvents([]);
      return;
    }

    if (this.userIdToClient.get(auth.userId) === client) {
      this.userIdToClient.delete(auth.userId);
    }

    if (this.aborted) return;

    if (this.gameState.phase === "COMPLETED") {
      this.rematchVotes.delete(auth.userId);
      const connectedHumans = Array.from(this.userIdToClient.keys());
      if (
        connectedHumans.length > 0 &&
        this.rematchVotes.size > 0 &&
        connectedHumans.every((uid) => this.rematchVotes.has(uid))
      ) {
        this.startRematch();
        return;
      }
      if (this.userIdToClient.size === 0) {
        if (this.completedIdleTimer) clearTimeout(this.completedIdleTimer);
        this.completedIdleTimer = setTimeout(() => {
          if (this.userIdToClient.size === 0) void this.disconnect();
        }, 45_000);
      } else {
        this.broadcastStateAndEvents([]);
      }
      return;
    }

    if (this.userIdToClient.size === 0) {
      this.clearBotTimers();
      this.scheduleEmptyHumansAbort(65_000);
      return;
    }

    if (!this.botTakeoverTimers.has(auth.userId)) {
      const timer = setTimeout(() => {
        this.botTakeoverTimers.delete(auth.userId);
        if (
          this.aborted ||
          this.userIdToClient.has(auth.userId) ||
          this.gameState.phase !== "IN_PROGRESS"
        ) {
          return;
        }
        this.botControlledHumans.add(auth.userId);
        this.broadcastSystemChat(
          `🤖 Café Bot stepped in for ${auth.displayName} until they return!`
        );
        this.broadcastStateAndEvents([]);
        this.scheduleBotsIfNeeded(false);
      }, DISCONNECT_BOT_GRACE_MS);
      this.botTakeoverTimers.set(auth.userId, timer);
    }
  }

  onDispose() {
    this.clearBotTimers();
    if (this.emptyHumansTimer) clearTimeout(this.emptyHumansTimer);
    if (this.completedIdleTimer) clearTimeout(this.completedIdleTimer);
    for (const t of this.botTakeoverTimers.values()) clearTimeout(t);
    this.botTakeoverTimers.clear();
    unregisterGameRoom(this.roomId);
  }

  private clearBotTimers() {
    for (const t of this.botTimers) clearTimeout(t);
    this.botTimers.clear();
  }

  private isBotControlled(userId: string): boolean {
    return this.botUserIds.has(userId) || this.botControlledHumans.has(userId);
  }

  private getUniqueSpectatorCount(): number {
    const ids = new Set<string>();
    for (const s of this.spectators.values()) ids.add(s.userId);
    return ids.size;
  }

  private pruneExpiredMarkers() {
    const now = Date.now();
    this.markers = this.markers.filter(
      (m) => m.mode === "sticky" || now - m.createdAt < MARKER_FADE_MS
    );
  }

  private clearAllMarkers() {
    if (this.markers.length === 0) return;
    this.markers = [];
    this.broadcast("game.markersCleared", { scope: "all" });
  }

  private sendFullSyncToClient(client: Client, auth: VelvetMasqueAuthedClient) {
    client.send("game.publicState", {
      sessionId: this.sessionId,
      state: VelvetMasqueModule.getPublicState(this.gameState),
      turnEndsAt: this.turnEndsAt,
      botControlledUserIds: Array.from(this.botControlledHumans),
      rematchVotes: Array.from(this.rematchVotes),
      connectedHumanCount: this.userIdToClient.size,
      spectatorCount: this.getUniqueSpectatorCount(),
      events: [],
    });

    if (!auth.isSpectator) {
      client.send(
        "game.privateState",
        VelvetMasqueModule.getPrivateState(this.gameState, auth.userId)
      );
    }

    this.pruneExpiredMarkers();
    client.send("game.markersSync", this.markers);
  }

  private broadcastSystemChat(message: string) {
    this.broadcast("game.chatReceived", {
      id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderUserId: "system",
      senderName: "Velvet Masque",
      message,
      isQuickBluff: false,
      timestamp: Date.now(),
    });
  }

  private scheduleEmptyHumansAbort(delayMs: number) {
    if (this.emptyHumansTimer) clearTimeout(this.emptyHumansTimer);
    this.emptyHumansTimer = setTimeout(() => {
      if (this.userIdToClient.size === 0 && this.gameState.phase !== "COMPLETED") {
        this.abortAbandonedGame();
      }
    }, delayMs);
  }

  private abortAbandonedGame() {
    if (this.aborted) return;
    this.aborted = true;
    this.clearBotTimers();
    if (this.emptyHumansTimer) clearTimeout(this.emptyHumansTimer);
    if (this.completedIdleTimer) clearTimeout(this.completedIdleTimer);
    for (const t of this.botTakeoverTimers.values()) clearTimeout(t);
    this.botTakeoverTimers.clear();

    if (this.gameState.phase !== "COMPLETED") {
      void (async () => {
        try {
          const db = await getDb();
          await db
            .update(gameSessions)
            .set({ status: "ABANDONED", endedAt: new Date() })
            .where(eq(gameSessions.id, this.sessionId));
        } catch (err) {
          console.error("[VelvetMasqueRoom] Failed to mark abandoned session:", err);
        }
      })();
    }

    unregisterGameRoom(this.roomId);
    notifyCafeTableFinished(this.cafeRoomId, this.tableId);
    void this.disconnect();
  }

  private registerMessageHandlers() {
    this.onMessage("game.sync", (client) => {
      const auth = client.auth as VelvetMasqueAuthedClient | undefined;
      if (!auth) return;
      this.sendFullSyncToClient(client, auth);
    });

    this.onMessage("game.action", (client, raw) => {
      const auth = client.auth as VelvetMasqueAuthedClient | undefined;
      if (!auth || auth.isSpectator) {
        client.send("game.actionRejected", {
          code: "SPECTATOR",
          message: "Spectators cannot perform game actions.",
        });
        return;
      }

      const parsed = VelvetMasqueActionSchema.safeParse(raw);
      if (!parsed.success) {
        client.send("game.actionRejected", {
          code: "INVALID_SCHEMA",
          message: "Malformed Velvet Masque action payload.",
        });
        return;
      }

      const check = VelvetMasqueModule.validateAction(
        this.gameState,
        auth.userId,
        parsed.data
      );
      if (!check.valid) {
        client.send("game.actionRejected", {
          code: check.code,
          message: check.message,
        });
        return;
      }

      this.executeValidatedAction(auth.userId, parsed.data);
    });

    this.onMessage("game.imBack", (client) => {
      const auth = client.auth as VelvetMasqueAuthedClient | undefined;
      if (!auth || auth.isSpectator) return;
      this.gameState = clearVelvetMasqueAfk(this.gameState, auth.userId);
      const active = this.gameState.players[this.gameState.activePlayerIndex];
      if (active?.userId === auth.userId && this.gameState.phase === "IN_PROGRESS") {
        this.resetStepClock();
      }
      this.broadcastStateAndEvents([]);
    });

    this.onMessage("game.quickBluff", (client, raw: { text?: string }) => {
      const auth = client.auth as VelvetMasqueAuthedClient | undefined;
      if (!auth) return;
      const text = raw?.text || "";
      if (!(VELVET_MASQUE_QUICK_BLUFFS as readonly string[]).includes(text)) return;
      this.broadcast("game.chatReceived", {
        id: `vmmsg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        senderUserId: auth.userId,
        senderName: auth.displayName,
        message: text,
        isQuickBluff: true,
        isSpectator: auth.isSpectator,
        timestamp: Date.now(),
      });
    });

    this.onMessage("game.chat", (client, raw: { message?: string }) => {
      const auth = client.auth as VelvetMasqueAuthedClient | undefined;
      if (!auth) return;
      const text = (raw?.message || "").trim().slice(0, 220);
      if (!text) return;
      this.broadcast("game.chatReceived", {
        id: `vmmsg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        senderUserId: auth.userId,
        senderName: auth.displayName,
        message: text,
        isQuickBluff: false,
        isSpectator: auth.isSpectator,
        timestamp: Date.now(),
      });
    });

    this.onMessage("game.markerAdd", (client, raw) => {
      const auth = client.auth as VelvetMasqueAuthedClient | undefined;
      if (!auth || auth.isSpectator) return;
      const parsed = BoardMarkerAddPayloadSchema.safeParse(raw);
      if (!parsed.success) return;

      const now = Date.now();
      const recent = (this.markerTimestamps.get(auth.userId) ?? []).filter(
        (ts) => now - ts < 5000
      );
      if (recent.length >= 10) return;
      recent.push(now);
      this.markerTimestamps.set(auth.userId, recent);

      this.pruneExpiredMarkers();
      const playerIdx = this.gameState.players.findIndex((p) => p.userId === auth.userId);
      const player = playerIdx >= 0 ? this.gameState.players[playerIdx] : undefined;
      const authoritativeColor = getPlayerColorMeta(
        player?.color ?? (playerIdx >= 0 ? playerIdx : 0)
      ).hex;

      const stroke: BoardMarkerStroke = {
        id: `mk_${now}_${Math.random().toString(36).slice(2, 7)}`,
        userId: auth.userId,
        displayName: auth.displayName,
        color: authoritativeColor,
        mode: parsed.data.mode,
        points: parsed.data.points,
        createdAt: now,
      };
      this.markers.push(stroke);
      if (this.markers.length > MAX_ROOM_MARKERS) {
        this.markers = this.markers.slice(-MAX_ROOM_MARKERS);
      }
      this.broadcast("game.markerAdded", stroke);
    });

    this.onMessage("game.markerClear", (client, raw) => {
      const auth = client.auth as VelvetMasqueAuthedClient | undefined;
      if (!auth || auth.isSpectator) return;
      const parsed = BoardMarkerClearPayloadSchema.safeParse(raw ?? {});
      if (!parsed.success) return;

      if (parsed.data.scope === "all") {
        this.markers = [];
        this.broadcast("game.markersCleared", { scope: "all" });
      } else {
        this.markers = this.markers.filter((m) => m.userId !== auth.userId);
        this.broadcast("game.markersCleared", {
          scope: "mine",
          userId: auth.userId,
        });
      }
    });

    this.onMessage("game.playAgain", (client) => {
      const auth = client.auth as VelvetMasqueAuthedClient | undefined;
      if (!auth || auth.isSpectator) return;
      if (this.gameState.phase !== "COMPLETED") return;

      this.rematchVotes.add(auth.userId);
      const connectedHumans = Array.from(this.userIdToClient.keys());
      if (
        connectedHumans.length > 0 &&
        connectedHumans.every((uid) => this.rematchVotes.has(uid))
      ) {
        this.startRematch();
      } else {
        this.broadcastSystemChat(
          `🔄 ${auth.displayName} wants an Encore! (${this.rematchVotes.size}/${connectedHumans.length})`
        );
        this.broadcastStateAndEvents([]);
      }
    });
  }

  private startRematch() {
    this.clearBotTimers();
    if (this.completedIdleTimer) {
      clearTimeout(this.completedIdleTimer);
      this.completedIdleTimer = null;
    }

    this.rematchVotes.clear();
    this.clearAllMarkers();
    this.persistedFinish = false;
    this.sessionId = `vm_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

    this.botControlledHumans.clear();
    for (const p of this.initialPlayers) {
      if (!p.isBot && !this.userIdToClient.has(p.userId)) {
        this.botControlledHumans.add(p.userId);
      }
    }

    const rngSeed = crypto.randomInt(1, 2_000_000_000);
    this.gameState = VelvetMasqueModule.createInitialState(
      this.initialPlayers.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        seatIndex: p.seatIndex,
      })),
      this.initialConfig,
      rngSeed
    );

    const activeHumanIds = Array.from(this.userIdToClient.keys());
    registerGameRoom(
      this.roomId,
      () => {
        this.abortAbandonedGame();
      },
      activeHumanIds,
      {
        cafeRoomId: this.cafeRoomId,
        tableId: this.tableId,
        gameSlug: this.gameSlug,
      }
    );
    notifyCafeTableRestarted(this.cafeRoomId, this.tableId, this.roomId);

    void this.persistInitialSession();
    this.resetStepClock();
    this.broadcastSystemChat("🎭 Encore Gala! Study the Masks during Curtain Call!");
    this.broadcastStateAndEvents([]);
    this.scheduleBotsIfNeeded(false);
  }

  private executeValidatedAction(userId: string, action: VelvetMasqueAction) {
    const prevStep = this.gameState.step;
    const prevTurn = this.gameState.turnNumber;

    const res = VelvetMasqueModule.applyAction(this.gameState, userId, action);
    this.gameState = res.state;
    void this.persistSnapshot();

    const stepOrTurnChanged =
      this.gameState.step !== prevStep || this.gameState.turnNumber !== prevTurn;

    if (this.gameState.phase === "IN_PROGRESS" && stepOrTurnChanged) {
      this.clearBotTimers();
      this.resetStepClock();
    }

    this.broadcastStateAndEvents(res.events);
    if (stepOrTurnChanged || this.gameState.phase === "COMPLETED") {
      this.handlePostStateChange(res.events);
    }
  }

  private handlePostStateChange(events: VelvetMasqueEvent[]) {
    if (this.gameState.phase === "COMPLETED") {
      this.clearBotTimers();
      if (this.emptyHumansTimer) {
        clearTimeout(this.emptyHumansTimer);
        this.emptyHumansTimer = null;
      }
      for (const t of this.botTakeoverTimers.values()) clearTimeout(t);
      this.botTakeoverTimers.clear();
      this.rematchVotes.clear();
      unregisterGameRoom(this.roomId);
      void this.persistCompletedResults();
      notifyCafeTableFinished(this.cafeRoomId, this.tableId);
      if (this.completedIdleTimer) clearTimeout(this.completedIdleTimer);
      this.completedIdleTimer = setTimeout(() => {
        if (this.clients.length === 0) void this.disconnect();
      }, 120_000);
      return;
    }

    const hadShowdown = events.some((e) => e.type === "SHOWDOWN_RESOLVED");
    this.scheduleBotsIfNeeded(hadShowdown);
  }

  private resetStepClock() {
    switch (this.gameState.step) {
      case "CURTAIN_CALL":
        this.turnEndsAt = Date.now() + 7_000;
        return;
      case "CHALLENGE_WINDOW":
        this.turnEndsAt = Date.now() + 8_000;
        return;
      case "RESOLVE_SWAP":
        this.turnEndsAt = Date.now() + 15_000;
        return;
      case "RESOLVE_POWER":
        this.turnEndsAt = Date.now() + 20_000;
        return;
      case "CHOOSE_ACTION": {
        const active = this.gameState.players[this.gameState.activePlayerIndex];
        const seconds = active?.autoPass ? 5 : this.gameState.config.turnSeconds;
        this.turnEndsAt = Date.now() + seconds * 1000;
        return;
      }
    }
  }

  private broadcastStateAndEvents(events: unknown[]) {
    const publicState = VelvetMasqueModule.getPublicState(this.gameState);
    this.broadcast("game.publicState", {
      sessionId: this.sessionId,
      state: publicState,
      turnEndsAt: this.turnEndsAt,
      botControlledUserIds: Array.from(this.botControlledHumans),
      rematchVotes: Array.from(this.rematchVotes),
      connectedHumanCount: this.userIdToClient.size,
      spectatorCount: this.getUniqueSpectatorCount(),
      events,
    });

    for (const [userId, client] of this.userIdToClient.entries()) {
      client.send(
        "game.privateState",
        VelvetMasqueModule.getPrivateState(this.gameState, userId)
      );
    }
  }

  private scheduleBotsIfNeeded(pauseForShowdown: boolean) {
    this.clearBotTimers();
    if (this.aborted || this.gameState.phase !== "IN_PROGRESS") return;
    if (this.userIdToClient.size === 0) return;

    // 1. Curtain Call: bots auto-ready quickly so humans can skip early if they click Ready!
    if (this.gameState.step === "CURTAIN_CALL") {
      const pendingBots = this.gameState.players.filter(
        (p) =>
          this.isBotControlled(p.userId) &&
          !this.gameState.curtainReadyIds.includes(p.userId)
      );
      pendingBots.forEach((bot, idx) => {
        const t = setTimeout(() => {
          this.botTimers.delete(t);
          if (
            this.aborted ||
            this.userIdToClient.size === 0 ||
            this.gameState.phase !== "IN_PROGRESS" ||
            this.gameState.step !== "CURTAIN_CALL"
          ) {
            return;
          }
          const check = VelvetMasqueModule.validateAction(this.gameState, bot.userId, {
            type: "CURTAIN_READY",
          });
          if (check.valid) {
            this.executeValidatedAction(bot.userId, { type: "CURTAIN_READY" });
          }
        }, 1200 + idx * 150);
        this.botTimers.add(t);
      });
      return;
    }

    // 2. Simultaneous Challenge Window: every pending bot responds naturally staggered!
    if (this.gameState.step === "CHALLENGE_WINDOW" && this.gameState.pendingClaim) {
      const pendingBotIds = Object.entries(this.gameState.pendingClaim.responses)
        .filter(([uid, decision]) => decision === "PENDING" && this.isBotControlled(uid))
        .map(([uid]) => uid);

      pendingBotIds.forEach((botId, idx) => {
        const delayMs = 1100 + idx * 450;
        const t = setTimeout(() => {
          this.botTimers.delete(t);
          if (
            this.aborted ||
            this.userIdToClient.size === 0 ||
            this.gameState.phase !== "IN_PROGRESS" ||
            this.gameState.step !== "CHALLENGE_WINDOW"
          ) {
            return;
          }
          if (!this.isBotControlled(botId)) return;
          const act = pickVelvetMasqueBotAction(this.gameState, botId, idx);
          if (act) {
            const check = VelvetMasqueModule.validateAction(this.gameState, botId, act);
            if (check.valid) {
              this.executeValidatedAction(botId, act);
            }
          }
        }, delayMs);
        this.botTimers.add(t);
      });
      return;
    }

    // 3. Single-actor steps: RESOLVE_SWAP, RESOLVE_POWER, CHOOSE_ACTION
    const actorId =
      this.gameState.step === "RESOLVE_SWAP"
        ? this.gameState.pendingSwap?.actorId
        : this.gameState.step === "RESOLVE_POWER"
          ? this.gameState.pendingPower?.executorId
          : this.gameState.players[this.gameState.activePlayerIndex]?.userId;

    if (!actorId || !this.isBotControlled(actorId)) return;

    const baseDelay =
      this.gameState.step === "RESOLVE_SWAP"
        ? 1600
        : this.gameState.step === "RESOLVE_POWER"
          ? 1400
          : 1700;
    const delayMs = pauseForShowdown ? Math.max(baseDelay, 3200) : baseDelay;

    const t = setTimeout(() => {
      this.botTimers.delete(t);
      if (
        this.aborted ||
        this.userIdToClient.size === 0 ||
        this.gameState.phase !== "IN_PROGRESS"
      ) {
        return;
      }
      if (!this.isBotControlled(actorId)) return;
      const act = pickVelvetMasqueBotAction(this.gameState, actorId);
      if (act) {
        const check = VelvetMasqueModule.validateAction(this.gameState, actorId, act);
        if (check.valid) {
          this.executeValidatedAction(actorId, act);
        }
      }
    }, delayMs);
    this.botTimers.add(t);
  }

  private async persistInitialSession() {
    try {
      const db = await getDb();
      await db.insert(gameSessions).values({
        id: this.sessionId,
        gameSlug: this.gameSlug,
        cafeRoomId: this.cafeRoomId,
        tableId: this.tableId,
        status: "IN_PROGRESS",
        configJson: this.gameState.config as unknown as Record<string, unknown>,
        stateSnapshotJson: this.gameState as unknown as Record<string, unknown>,
      });
    } catch (err) {
      console.error("[VelvetMasqueRoom] Failed to persist initial session:", err);
    }
  }

  private async persistSnapshot() {
    try {
      const db = await getDb();
      await db
        .update(gameSessions)
        .set({
          stateSnapshotJson: this.gameState as unknown as Record<string, unknown>,
        })
        .where(eq(gameSessions.id, this.sessionId));
    } catch (err) {
      console.error("[VelvetMasqueRoom] Failed to persist snapshot:", err);
    }
  }

  private async persistCompletedResults() {
    if (this.persistedFinish) return;
    this.persistedFinish = true;
    try {
      const db = await getDb();
      const results = VelvetMasqueModule.getResults(this.gameState);
      await db
        .update(gameSessions)
        .set({
          status: "COMPLETED",
          stateSnapshotJson: this.gameState as unknown as Record<string, unknown>,
          endedAt: new Date(),
        })
        .where(eq(gameSessions.id, this.sessionId));

      if (results) {
        for (const p of results.players) {
          const seat =
            this.gameState.players.find((sp) => sp.userId === p.userId)?.seatIndex ?? 0;
          await db.insert(gamePlayers).values({
            id: `gp_${this.sessionId}_${p.userId}`,
            sessionId: this.sessionId,
            userId: p.userId,
            displayName: p.displayName,
            seatIndex: seat,
            score: p.score,
            isWinner: p.isWinner,
            roleRevealed: p.roleLabel ?? null,
          });
        }
      }
    } catch (err) {
      console.error("[VelvetMasqueRoom] Failed to persist completed results:", err);
    }
  }
}
