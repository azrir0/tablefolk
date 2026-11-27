import crypto from "node:crypto";
import colyseus, { type Client } from "colyseus";
const { Room } = colyseus;
import { eq, gamePlayers, gameSessions, getDb } from "@tablefolk/db";
import {
  SUNSTONE_QUICK_LINES,
  SunstoneActionSchema,
  SunstoneGuildModule,
  clearSunstoneAfk,
  pickSunstoneBotAction,
  type SunstoneAction,
  type SunstoneConfig,
  type SunstoneEvent,
  type SunstoneState,
} from "@tablefolk/game-sunstone-guild";
import { verifyAuthToken } from "../services/auth.js";
import {
  notifyCafeTableFinished,
  notifyCafeTableRestarted,
  registerGameRoom,
  unregisterGameRoom,
} from "../services/roomRegistry.js";

interface SunstoneRoomCreateOptions {
  cafeRoomId: string;
  tableId: string;
  gameSlug: string;
  config: Partial<SunstoneConfig>;
  players: Array<{
    userId: string;
    displayName: string;
    seatIndex: number;
    isBot: boolean;
  }>;
}

interface SunstoneJoinOptions {
  token?: string;
}

interface SunstoneAuthedClient {
  userId: string;
  displayName: string;
  isSpectator: boolean;
}

export class SunstoneGuildRoom extends Room {
  private cafeRoomId = "";
  private tableId = "";
  private gameSlug = "sunstone-guild";
  private sessionId = "";
  private initialPlayers: SunstoneRoomCreateOptions["players"] = [];
  private initialConfig: Partial<SunstoneConfig> = {};
  private gameState!: SunstoneState;
  private botUserIds = new Set<string>();
  private botControlledHumans = new Set<string>();
  private botTakeoverTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private allowedUserIds = new Set<string>();
  private userIdToClient = new Map<string, Client>();
  private spectators = new Map<string, { userId: string; displayName: string }>();
  private rematchVotes = new Set<string>();
  private turnEndsAt = 0;
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private emptyHumansTimer: ReturnType<typeof setTimeout> | null = null;
  private completedIdleTimer: ReturnType<typeof setTimeout> | null = null;
  private persistedFinish = false;
  private aborted = false;

  async onCreate(options: SunstoneRoomCreateOptions) {
    this.autoDispose = false;
    void this.setPrivate(true);

    this.cafeRoomId = options.cafeRoomId;
    this.tableId = options.tableId;
    this.gameSlug = "sunstone-guild";
    this.initialPlayers = options.players;
    this.initialConfig = options.config;
    this.sessionId = `sg_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

    const humanUserIds: string[] = [];
    for (const p of options.players) {
      this.allowedUserIds.add(p.userId);
      if (p.isBot) this.botUserIds.add(p.userId);
      else humanUserIds.push(p.userId);
    }

    const rngSeed = crypto.randomInt(1, 2_000_000_000);
    this.gameState = SunstoneGuildModule.createInitialState(
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
    this.resetTurnClock();
    this.scheduleEmptyHumansAbort(25_000);

    // 1-second authoritative turn clock (paused when 0 humans connected)
    this.setSimulationInterval(() => {
      if (this.aborted || this.gameState.phase !== "IN_PROGRESS") return;
      if (this.userIdToClient.size === 0) return;
      if (Date.now() >= this.turnEndsAt) {
        const res = SunstoneGuildModule.onTurnTimeout(this.gameState);
        this.gameState = res.state;
        void this.persistSnapshot();
        if (this.gameState.phase === "IN_PROGRESS") {
          this.resetTurnClock();
        }
        this.broadcastStateAndEvents(res.events);
        this.handlePostStateChange();
      }
    }, 1000);

    this.registerMessageHandlers();
  }

  async onAuth(_client: Client, options: SunstoneJoinOptions): Promise<SunstoneAuthedClient> {
    if (!options?.token) {
      throw new Error("Authentication required to join Sunstone Guild.");
    }
    const verified = await verifyAuthToken(options.token);
    const isParticipant = this.allowedUserIds.has(verified.sub);
    return {
      userId: verified.sub,
      displayName: verified.displayName,
      isSpectator: !isParticipant,
    };
  }

  onJoin(client: Client, _options?: SunstoneJoinOptions, auth?: SunstoneAuthedClient) {
    if (!auth) return;

    let reclaimedFromBot = false;
    let returnedFromGrace = false;
    const wasEmpty = this.userIdToClient.size === 0;

    if (!auth.isSpectator) {
      this.userIdToClient.set(auth.userId, client);
      this.gameState = clearSunstoneAfk(this.gameState, auth.userId);

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

      const active = this.gameState.players[this.gameState.activePlayerIndex];
      if (
        wasEmpty &&
        this.gameState.phase === "IN_PROGRESS" &&
        Date.now() >= this.turnEndsAt - 5000
      ) {
        this.resetTurnClock();
      }

      if (
        reclaimedFromBot &&
        active?.userId === auth.userId &&
        this.gameState.phase === "IN_PROGRESS"
      ) {
        if (this.botTimer) {
          clearTimeout(this.botTimer);
          this.botTimer = null;
        }
        this.resetTurnClock();
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
      this.broadcastSystemChat(`👁️ ${auth.displayName} started watching the atelier!`);
      this.broadcastStateAndEvents([]);
    } else {
      if (reclaimedFromBot) {
        this.broadcastSystemChat(`👋 ${auth.displayName} rejoined and resumed control!`);
        this.broadcastStateAndEvents([]);
      } else if (returnedFromGrace) {
        this.broadcastSystemChat(`👋 ${auth.displayName} is back!`);
      }
      this.scheduleBotIfNeeded();
    }
  }

  onLeave(client: Client, _consented: boolean) {
    const auth = client.auth as SunstoneAuthedClient | undefined;
    if (!auth) return;

    if (auth.isSpectator) {
      if (this.spectators.delete(client.sessionId)) {
        this.broadcastStateAndEvents([]);
      }
      return;
    }

    if (this.userIdToClient.get(auth.userId)?.sessionId !== client.sessionId) {
      return;
    }

    this.userIdToClient.delete(auth.userId);

    if (this.userIdToClient.size === 0) {
      if (this.botTimer) {
        clearTimeout(this.botTimer);
        this.botTimer = null;
      }
      for (const t of this.botTakeoverTimers.values()) clearTimeout(t);
      this.botTakeoverTimers.clear();

      if (this.gameState.phase === "GAME_END") {
        void this.disconnect();
      } else {
        this.scheduleEmptyHumansAbort(60_000);
      }
      return;
    }

    if (this.gameState.phase === "GAME_END") {
      this.rematchVotes.delete(auth.userId);
      const remaining = Array.from(this.userIdToClient.keys());
      if (remaining.length > 0 && remaining.every((uid) => this.rematchVotes.has(uid))) {
        this.startRematch();
      } else {
        this.broadcastStateAndEvents([]);
      }
      return;
    }

    if (!this.botControlledHumans.has(auth.userId)) {
      this.broadcastSystemChat(
        `⏳ ${auth.displayName} stepped away — a Café Bot will sub in after 15s if they don't return.`
      );
      const prevTimer = this.botTakeoverTimers.get(auth.userId);
      if (prevTimer) clearTimeout(prevTimer);

      const timer = setTimeout(() => {
        this.botTakeoverTimers.delete(auth.userId);
        if (this.aborted || this.gameState.phase === "GAME_END") return;
        if (this.userIdToClient.has(auth.userId)) return;
        if (this.userIdToClient.size === 0) return;

        this.botControlledHumans.add(auth.userId);
        this.broadcastSystemChat(
          `🤖 Café Bot took over for ${auth.displayName} (they can rejoin anytime!).`
        );
        this.broadcastStateAndEvents([]);
        this.scheduleBotIfNeeded();
      }, 15_000);

      this.botTakeoverTimers.set(auth.userId, timer);
    }
  }

  onDispose() {
    if (this.botTimer) clearTimeout(this.botTimer);
    if (this.emptyHumansTimer) clearTimeout(this.emptyHumansTimer);
    if (this.completedIdleTimer) clearTimeout(this.completedIdleTimer);
    for (const t of this.botTakeoverTimers.values()) clearTimeout(t);
    this.botTakeoverTimers.clear();
    unregisterGameRoom(this.roomId);
    notifyCafeTableFinished(this.cafeRoomId, this.tableId);
  }

  private getUniqueSpectatorCount(): number {
    const unique = new Set<string>();
    for (const s of this.spectators.values()) unique.add(s.userId);
    return unique.size;
  }

  private sendFullSyncToClient(client: Client, auth: SunstoneAuthedClient) {
    client.send("game.publicState", {
      sessionId: this.sessionId,
      state: SunstoneGuildModule.getPublicState(this.gameState),
      turnEndsAt: this.turnEndsAt,
      botControlledUserIds: Array.from(this.botControlledHumans),
      rematchVotes: Array.from(this.rematchVotes),
      connectedHumanCount: this.userIdToClient.size,
      spectatorCount: this.getUniqueSpectatorCount(),
      isSpectator: auth.isSpectator,
    });

    if (!auth.isSpectator) {
      client.send(
        "game.privateState",
        SunstoneGuildModule.getPrivateState(this.gameState, auth.userId)
      );
    }
  }

  private broadcastSystemChat(message: string) {
    this.broadcast("game.chatReceived", {
      id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderUserId: "system",
      senderName: "Sunstone Guild",
      message,
      isQuickBluff: true,
      timestamp: Date.now(),
    });
  }

  private scheduleEmptyHumansAbort(delayMs: number) {
    if (this.emptyHumansTimer) clearTimeout(this.emptyHumansTimer);
    this.emptyHumansTimer = setTimeout(() => {
      if (this.userIdToClient.size === 0 && !this.aborted) {
        this.abortAbandonedGame();
      }
    }, delayMs);
  }

  private abortAbandonedGame() {
    if (this.aborted) return;
    this.aborted = true;

    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
    if (this.emptyHumansTimer) {
      clearTimeout(this.emptyHumansTimer);
      this.emptyHumansTimer = null;
    }
    if (this.completedIdleTimer) {
      clearTimeout(this.completedIdleTimer);
      this.completedIdleTimer = null;
    }
    for (const t of this.botTakeoverTimers.values()) clearTimeout(t);
    this.botTakeoverTimers.clear();

    if (!this.persistedFinish && this.gameState?.phase !== "GAME_END") {
      this.persistedFinish = true;
      void (async () => {
        try {
          const db = await getDb();
          await db
            .update(gameSessions)
            .set({ status: "ABANDONED", endedAt: new Date() })
            .where(eq(gameSessions.id, this.sessionId));
        } catch (err) {
          console.error("[SunstoneGuildRoom] Failed to mark abandoned session:", err);
        }
      })();
    }

    unregisterGameRoom(this.roomId);
    notifyCafeTableFinished(this.cafeRoomId, this.tableId);
    void this.disconnect();
  }

  private registerMessageHandlers() {
    this.onMessage("game.sync", (client) => {
      const auth = client.auth as SunstoneAuthedClient | undefined;
      if (!auth) return;
      this.sendFullSyncToClient(client, auth);
    });

    this.onMessage("game.action", (client, raw) => {
      const auth = client.auth as SunstoneAuthedClient | undefined;
      if (!auth || auth.isSpectator) {
        client.send("game.actionRejected", {
          code: "SPECTATOR",
          message: "Spectators cannot perform game actions.",
        });
        return;
      }

      const parsed = SunstoneActionSchema.safeParse(raw);
      if (!parsed.success) {
        client.send("game.actionRejected", {
          code: "INVALID_SCHEMA",
          message: "Malformed Sunstone Guild action payload.",
        });
        return;
      }

      const check = SunstoneGuildModule.validateAction(this.gameState, auth.userId, parsed.data);
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
      const auth = client.auth as SunstoneAuthedClient | undefined;
      if (!auth || auth.isSpectator) return;
      this.gameState = clearSunstoneAfk(this.gameState, auth.userId);
      const active = this.gameState.players[this.gameState.activePlayerIndex];
      if (active?.userId === auth.userId && this.gameState.phase === "IN_PROGRESS") {
        this.resetTurnClock();
      }
      this.broadcastStateAndEvents([]);
    });

    this.onMessage("game.quickBluff", (client, raw: { text?: string }) => {
      const auth = client.auth as SunstoneAuthedClient | undefined;
      if (!auth) return;
      const text = raw?.text || "";
      if (!(SUNSTONE_QUICK_LINES as readonly string[]).includes(text)) return;
      this.broadcast("game.chatReceived", {
        id: `sgmsg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        senderUserId: auth.userId,
        senderName: auth.displayName,
        message: text,
        isQuickBluff: true,
        isSpectator: auth.isSpectator,
        timestamp: Date.now(),
      });
    });

    this.onMessage("game.chat", (client, raw: { message?: string }) => {
      const auth = client.auth as SunstoneAuthedClient | undefined;
      if (!auth) return;
      const text = (raw?.message || "").trim().slice(0, 220);
      if (!text) return;
      this.broadcast("game.chatReceived", {
        id: `sgmsg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        senderUserId: auth.userId,
        senderName: auth.displayName,
        message: text,
        isQuickBluff: false,
        isSpectator: auth.isSpectator,
        timestamp: Date.now(),
      });
    });

    this.onMessage("game.playAgain", (client) => {
      const auth = client.auth as SunstoneAuthedClient | undefined;
      if (!auth || auth.isSpectator) return;
      if (this.gameState.phase !== "GAME_END") return;

      this.rematchVotes.add(auth.userId);
      const connectedHumans = Array.from(this.userIdToClient.keys());
      if (
        connectedHumans.length > 0 &&
        connectedHumans.every((uid) => this.rematchVotes.has(uid))
      ) {
        this.startRematch();
      } else {
        this.broadcastSystemChat(
          `🔄 ${auth.displayName} wants a rematch! (${this.rematchVotes.size}/${connectedHumans.length})`
        );
        this.broadcastStateAndEvents([]);
      }
    });
  }

  private startRematch() {
    if (this.completedIdleTimer) {
      clearTimeout(this.completedIdleTimer);
      this.completedIdleTimer = null;
    }
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }

    this.rematchVotes.clear();
    this.persistedFinish = false;
    this.sessionId = `sg_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

    this.botControlledHumans.clear();
    const humanUserIds: string[] = [];
    for (const p of this.initialPlayers) {
      if (!p.isBot) {
        humanUserIds.push(p.userId);
        if (!this.userIdToClient.has(p.userId)) {
          this.botControlledHumans.add(p.userId);
        }
      }
    }

    const rngSeed = crypto.randomInt(1, 2_000_000_000);
    this.gameState = SunstoneGuildModule.createInitialState(
      this.initialPlayers.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        seatIndex: p.seatIndex,
      })),
      this.initialConfig,
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
    notifyCafeTableRestarted(this.cafeRoomId, this.tableId, this.roomId);
    void this.persistInitialSession();

    this.resetTurnClock();
    this.broadcastSystemChat("✨ Fresh Sunstone Market dealt! Let's craft!");
    this.broadcastStateAndEvents([]);
    this.handlePostStateChange();
  }

  private executeValidatedAction(userId: string, action: SunstoneAction) {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }

    const res = SunstoneGuildModule.applyAction(this.gameState, userId, action);
    this.gameState = res.state;
    void this.persistSnapshot();

    if (this.gameState.phase === "IN_PROGRESS") {
      this.resetTurnClock();
    }

    this.broadcastStateAndEvents(res.events);
    this.handlePostStateChange();
  }

  private handlePostStateChange() {
    if (this.gameState.phase === "GAME_END") {
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

    this.scheduleBotIfNeeded();
  }

  private resetTurnClock() {
    const active = this.gameState.players[this.gameState.activePlayerIndex];
    const isAfk = (active?.consecutiveTimeouts ?? 0) >= 2;
    const baseSec = isAfk ? 8 : this.gameState.config.turnSeconds;
    const seconds =
      this.gameState.step === "DISCARD_GEMS" || this.gameState.step === "CLAIM_PATRON"
        ? Math.min(baseSec, 20)
        : baseSec;
    this.turnEndsAt = Date.now() + seconds * 1000;
  }

  private broadcastStateAndEvents(events: SunstoneEvent[]) {
    const publicState = SunstoneGuildModule.getPublicState(this.gameState);
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
        SunstoneGuildModule.getPrivateState(this.gameState, userId)
      );
    }
  }

  private scheduleBotIfNeeded() {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
    if (this.aborted || this.gameState.phase !== "IN_PROGRESS") return;
    if (this.userIdToClient.size === 0) return;

    const active = this.gameState.players[this.gameState.activePlayerIndex];
    const isBotTurn =
      Boolean(active) &&
      (this.botUserIds.has(active!.userId) || this.botControlledHumans.has(active!.userId));
    if (!active || !isBotTurn) return;

    const delayMs = this.gameState.step === "MAIN_ACTION" ? 1350 : 750;

    this.botTimer = setTimeout(() => {
      if (this.aborted || this.userIdToClient.size === 0) return;
      if (this.gameState.phase !== "IN_PROGRESS") return;
      const current = this.gameState.players[this.gameState.activePlayerIndex];
      if (!current || current.userId !== active.userId) return;
      if (
        !this.botUserIds.has(active.userId) &&
        !this.botControlledHumans.has(active.userId)
      ) {
        return;
      }

      const chosen = pickSunstoneBotAction(this.gameState, active.userId);
      if (chosen) {
        const check = SunstoneGuildModule.validateAction(this.gameState, active.userId, chosen);
        if (check.valid) {
          this.executeValidatedAction(active.userId, chosen);
          return;
        }
      }

      // Safety fallback
      const res = SunstoneGuildModule.onTurnTimeout(this.gameState);
      this.gameState = res.state;
      void this.persistSnapshot();
      if (this.gameState.phase === "IN_PROGRESS") {
        this.resetTurnClock();
      }
      this.broadcastStateAndEvents(res.events);
      this.handlePostStateChange();
    }, delayMs);
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
      console.error("[SunstoneGuildRoom] Failed to persist initial session:", err);
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
      console.error("[SunstoneGuildRoom] Failed to persist snapshot:", err);
    }
  }

  private async persistCompletedResults() {
    if (this.persistedFinish) return;
    this.persistedFinish = true;
    try {
      const db = await getDb();
      const results = SunstoneGuildModule.getResults(this.gameState);
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
      console.error("[SunstoneGuildRoom] Failed to persist completed results:", err);
    }
  }
}
