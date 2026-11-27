import crypto from "node:crypto";
import colyseus, { type Client } from "colyseus";
const { Room } = colyseus;
import { eq, gamePlayers, gameSessions, getDb } from "@tablefolk/db";
import {
  LANTERN_QUICK_LINES,
  LanternActionSchema,
  LanternWatchModule,
  pickLanternBotAction,
  type LanternAction,
  type LanternConfig,
  type LanternEvent,
  type LanternMode,
  type LanternState,
} from "@tablefolk/game-lantern-watch";
import { verifyAuthToken } from "../services/auth.js";
import {
  notifyCafeTableFinished,
  notifyCafeTableRestarted,
  registerGameRoom,
  unregisterGameRoom,
} from "../services/roomRegistry.js";

interface LanternWatchRoomCreateOptions {
  cafeRoomId: string;
  tableId: string;
  gameSlug: string;
  config: Partial<LanternConfig> & { watchMode?: LanternMode; turnSeconds?: number };
  players: Array<{
    userId: string;
    displayName: string;
    seatIndex: number;
    isBot: boolean;
  }>;
}

interface LanternJoinOptions {
  token?: string;
}

interface LanternAuthedClient {
  userId: string;
  displayName: string;
  isSpectator: boolean;
}

export class LanternWatchRoom extends Room {
  private cafeRoomId = "";
  private tableId = "";
  private gameSlug = "lantern-watch";
  private sessionId = "";
  private initialPlayers: LanternWatchRoomCreateOptions["players"] = [];
  private initialMode: LanternMode = "oracle";
  private turnSeconds = 60;
  private gameState!: LanternState;
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

  async onCreate(options: LanternWatchRoomCreateOptions) {
    this.autoDispose = false;
    void this.setPrivate(true);

    this.cafeRoomId = options.cafeRoomId;
    this.tableId = options.tableId;
    this.gameSlug = "lantern-watch";
    this.initialPlayers = options.players;
    this.initialMode =
      (options.config.mode ?? options.config.watchMode) === "classic"
        ? "classic"
        : "oracle";
    this.turnSeconds = options.config.turnSeconds ?? 60;
    this.sessionId = `lw_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

    const humanUserIds: string[] = [];
    for (const p of options.players) {
      this.allowedUserIds.add(p.userId);
      if (p.isBot) this.botUserIds.add(p.userId);
      else humanUserIds.push(p.userId);
    }

    const rngSeed = crypto.randomInt(1, 2_000_000_000);
    this.gameState = LanternWatchModule.createInitialState(
      options.players.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        seatIndex: p.seatIndex,
      })),
      { mode: this.initialMode, turnSeconds: this.turnSeconds },
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

    this.setSimulationInterval(() => {
      if (this.aborted || this.gameState.phase === "FINISHED") return;
      if (this.userIdToClient.size === 0) return;
      if (Date.now() >= this.turnEndsAt) {
        const res = LanternWatchModule.onTurnTimeout(this.gameState);
        this.gameState = res.state;
        void this.persistSnapshot();
        if (this.gameState.phase !== "FINISHED") {
          this.resetTurnClock();
        }
        this.broadcastStateAndEvents(res.events);
        this.handlePostStateChange();
      }
    }, 1000);

    this.registerMessageHandlers();
  }

  async onAuth(_client: Client, options: LanternJoinOptions): Promise<LanternAuthedClient> {
    if (!options?.token) {
      throw new Error("Authentication required to join Lantern Watch.");
    }
    const verified = await verifyAuthToken(options.token);
    const isParticipant = this.allowedUserIds.has(verified.sub);
    return {
      userId: verified.sub,
      displayName: verified.displayName,
      isSpectator: !isParticipant,
    };
  }

  onJoin(client: Client, _options?: LanternJoinOptions, auth?: LanternAuthedClient) {
    if (!auth) return;

    let reclaimedFromBot = false;
    let returnedFromGrace = false;
    const wasEmpty = this.userIdToClient.size === 0;

    if (!auth.isSpectator) {
      this.userIdToClient.set(auth.userId, client);

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
    } else {
      this.spectators.set(client.sessionId, {
        userId: auth.userId,
        displayName: auth.displayName,
      });
    }

    if (wasEmpty && !auth.isSpectator && this.gameState.phase !== "FINISHED") {
      this.resetTurnClock();
    }

    this.sendFullStateToClient(client, auth);
    this.broadcastPresence();

    if (reclaimedFromBot) {
      this.broadcast("game.chat", {
        id: `sys_${Date.now()}`,
        senderUserId: "system",
        senderName: "Harbor Lantern",
        message: `${auth.displayName} rejoined and took back their council seat from the Café Bot!`,
        createdAt: new Date().toISOString(),
      });
    } else if (returnedFromGrace) {
      this.broadcast("game.chat", {
        id: `sys_${Date.now()}`,
        senderUserId: "system",
        senderName: "Harbor Lantern",
        message: `${auth.displayName} reconnected to the council!`,
        createdAt: new Date().toISOString(),
      });
    }

    if (!auth.isSpectator) {
      this.scheduleBotsIfNeeded();
    }
  }

  onLeave(client: Client) {
    const auth = client.auth as LanternAuthedClient | undefined;
    if (!auth) return;

    if (auth.isSpectator) {
      this.spectators.delete(client.sessionId);
      this.broadcastPresence();
      return;
    }

    if (this.userIdToClient.get(auth.userId) === client) {
      this.userIdToClient.delete(auth.userId);
    }

    if (this.gameState.phase !== "FINISHED" && !this.aborted) {
      const graceMs = 10_000;
      const timer = setTimeout(() => {
        this.botTakeoverTimers.delete(auth.userId);
        if (this.aborted || this.gameState.phase === "FINISHED") return;
        if (this.userIdToClient.has(auth.userId)) return;
        this.botControlledHumans.add(auth.userId);
        this.broadcastPresence();
        this.broadcast("game.chat", {
          id: `sys_${Date.now()}`,
          senderUserId: "system",
          senderName: "Harbor Lantern",
          message: `Café Bot is standing watch for ${auth.displayName} until they return.`,
          createdAt: new Date().toISOString(),
        });
        this.scheduleBotsIfNeeded();
      }, graceMs);
      this.botTakeoverTimers.set(auth.userId, timer);

      if (this.userIdToClient.size === 0) {
        this.scheduleEmptyHumansAbort(60_000);
      }
    }

    this.broadcastPresence();
  }

  onDispose() {
    this.clearAllTimers();
    unregisterGameRoom(this.roomId);
  }

  private registerMessageHandlers() {
    this.onMessage("game.action", (client, raw) => {
      const auth = client.auth as LanternAuthedClient | undefined;
      if (!auth || auth.isSpectator || this.aborted) return;

      const parsed = LanternActionSchema.safeParse(raw);
      if (!parsed.success) {
        client.send("game.error", { message: "Invalid Lantern Watch action." });
        return;
      }

      const check = LanternWatchModule.validateAction(
        this.gameState,
        auth.userId,
        parsed.data
      );
      if (!check.valid) {
        client.send("game.error", { message: check.message });
        return;
      }

      this.executeAction(auth.userId, parsed.data);
    });

    this.onMessage("game.chat", (client, raw: { message?: string; quickIndex?: number }) => {
      const auth = client.auth as LanternAuthedClient | undefined;
      if (!auth) return;

      let text = "";
      if (typeof raw?.quickIndex === "number") {
        text = LANTERN_QUICK_LINES[raw.quickIndex] ?? "";
      } else if (typeof raw?.message === "string") {
        text = raw.message.trim().slice(0, 220);
      }
      if (!text) return;

      this.broadcast("game.chat", {
        id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        senderUserId: auth.userId,
        senderName: auth.isSpectator ? `${auth.displayName} (Spectator)` : auth.displayName,
        message: text,
        createdAt: new Date().toISOString(),
      });
    });

    this.onMessage("game.rematch", (client) => {
      const auth = client.auth as LanternAuthedClient | undefined;
      if (!auth || auth.isSpectator || this.gameState.phase !== "FINISHED") return;

      this.rematchVotes.add(auth.userId);
      const connectedHumans = Array.from(this.userIdToClient.keys());
      this.broadcast("game.rematchUpdate", {
        votes: Array.from(this.rematchVotes),
        needed: Math.max(1, connectedHumans.length),
      });

      if (connectedHumans.every((uid) => this.rematchVotes.has(uid))) {
        this.restartMatch();
      }
    });
  }

  private executeAction(playerId: string, action: LanternAction) {
    const prevPhase = this.gameState.phase;
    const prevRejects = this.gameState.rejectTrack;
    const prevMission = this.gameState.missionIndex;

    const res = LanternWatchModule.applyAction(this.gameState, playerId, action);
    this.gameState = res.state;

    if (
      this.gameState.phase !== "FINISHED" &&
      (this.gameState.phase !== prevPhase ||
        this.gameState.rejectTrack !== prevRejects ||
        this.gameState.missionIndex !== prevMission)
    ) {
      this.resetTurnClock();
    }

    void this.persistSnapshot();
    this.broadcastStateAndEvents(res.events);
    this.handlePostStateChange();
  }

  private handlePostStateChange() {
    if (this.gameState.phase === "FINISHED") {
      if (this.botTimer) {
        clearTimeout(this.botTimer);
        this.botTimer = null;
      }
      if (!this.persistedFinish) {
        this.persistedFinish = true;
        void this.persistFinalResults();
        notifyCafeTableFinished(this.cafeRoomId, this.tableId);
      }
      this.scheduleCompletedRoomCleanup(180_000);
      return;
    }

    this.scheduleBotsIfNeeded();
  }

  private findPendingBotId(): string | null {
    for (const p of this.gameState.players) {
      if (!this.botUserIds.has(p.userId) && !this.botControlledHumans.has(p.userId)) {
        continue;
      }
      const priv = LanternWatchModule.getPrivateState(this.gameState, p.userId);
      if (
        priv.canPropose ||
        priv.canVote ||
        priv.canPlayMissionCard ||
        priv.canUseSpyglass ||
        priv.canAssassinate
      ) {
        return p.userId;
      }
    }
    return null;
  }

  private scheduleBotsIfNeeded() {
    if (this.aborted || this.gameState.phase === "FINISHED") return;
    if (this.botTimer) return;

    const botId = this.findPendingBotId();
    if (!botId) return;

    const isSimultaneous =
      this.gameState.phase === "VOTE_TEAM" || this.gameState.phase === "EXECUTE_MISSION";
    const delayMs = isSimultaneous
      ? 450 + Math.floor(Math.random() * 350)
      : 900 + Math.floor(Math.random() * 450);

    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      if (this.aborted || this.gameState.phase === "FINISHED") return;

      const nextBotId = this.findPendingBotId();
      if (!nextBotId) return;

      const pub = LanternWatchModule.getPublicState(this.gameState);
      const priv = LanternWatchModule.getPrivateState(this.gameState, nextBotId);
      const action = pickLanternBotAction(
        pub,
        priv,
        nextBotId,
        crypto.randomInt(1, 2_000_000_000)
      );
      if (!action) return;

      const check = LanternWatchModule.validateAction(this.gameState, nextBotId, action);
      if (check.valid) {
        this.executeAction(nextBotId, action);
      }
    }, delayMs);
  }

  private restartMatch() {
    if (this.completedIdleTimer) {
      clearTimeout(this.completedIdleTimer);
      this.completedIdleTimer = null;
    }
    this.rematchVotes.clear();
    this.persistedFinish = false;
    this.sessionId = `lw_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

    const rngSeed = crypto.randomInt(1, 2_000_000_000);
    this.gameState = LanternWatchModule.createInitialState(
      this.initialPlayers.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        seatIndex: p.seatIndex,
      })),
      { mode: this.initialMode, turnSeconds: this.turnSeconds },
      rngSeed
    );

    void this.persistInitialSession();
    notifyCafeTableRestarted(this.cafeRoomId, this.tableId, this.roomId);
    this.resetTurnClock();
    this.broadcastStateAndEvents([]);
    this.scheduleBotsIfNeeded();
  }

  private resetTurnClock() {
    this.turnEndsAt = Date.now() + this.turnSeconds * 1000;
  }

  private sendFullStateToClient(client: Client, auth: LanternAuthedClient) {
    const publicState = LanternWatchModule.getPublicState(this.gameState);
    const privateState = auth.isSpectator
      ? null
      : LanternWatchModule.getPrivateState(this.gameState, auth.userId);

    client.send("game.state", {
      publicState,
      privateState,
      turnEndsAt: this.turnEndsAt,
      isSpectator: auth.isSpectator,
      botControlledUserIds: Array.from(this.botControlledHumans),
      results: LanternWatchModule.getResults(this.gameState),
    });
  }

  private broadcastStateAndEvents(events: LanternEvent[]) {
    const publicState = LanternWatchModule.getPublicState(this.gameState);
    const results = LanternWatchModule.getResults(this.gameState);
    const botControlledUserIds = Array.from(this.botControlledHumans);

    for (const client of this.clients) {
      const auth = client.auth as LanternAuthedClient | undefined;
      if (!auth) continue;
      const privateState = auth.isSpectator
        ? null
        : LanternWatchModule.getPrivateState(this.gameState, auth.userId);
      client.send("game.state", {
        publicState,
        privateState,
        turnEndsAt: this.turnEndsAt,
        isSpectator: auth.isSpectator,
        botControlledUserIds,
        results,
        events,
      });
    }
  }

  private broadcastPresence() {
    this.broadcast("game.presence", {
      onlineUserIds: Array.from(this.userIdToClient.keys()),
      botControlledUserIds: Array.from(this.botControlledHumans),
      spectatorCount: this.spectators.size,
    });
  }

  private scheduleEmptyHumansAbort(delayMs: number) {
    if (this.emptyHumansTimer) clearTimeout(this.emptyHumansTimer);
    this.emptyHumansTimer = setTimeout(() => {
      this.emptyHumansTimer = null;
      if (this.userIdToClient.size === 0) {
        this.abortAbandonedGame();
      }
    }, delayMs);
  }

  private scheduleCompletedRoomCleanup(delayMs: number) {
    if (this.completedIdleTimer) clearTimeout(this.completedIdleTimer);
    this.completedIdleTimer = setTimeout(() => {
      this.completedIdleTimer = null;
      void this.disconnect();
    }, delayMs);
  }

  private abortAbandonedGame() {
    if (this.aborted) return;
    this.aborted = true;
    this.clearAllTimers();
    notifyCafeTableFinished(this.cafeRoomId, this.tableId);
    void this.disconnect();
  }

  private clearAllTimers() {
    if (this.botTimer) clearTimeout(this.botTimer);
    if (this.emptyHumansTimer) clearTimeout(this.emptyHumansTimer);
    if (this.completedIdleTimer) clearTimeout(this.completedIdleTimer);
    for (const t of this.botTakeoverTimers.values()) clearTimeout(t);
    this.botTimer = null;
    this.emptyHumansTimer = null;
    this.completedIdleTimer = null;
    this.botTakeoverTimers.clear();
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
        configJson: {
          mode: this.gameState.mode,
          turnSeconds: this.turnSeconds,
        },
        stateSnapshotJson: this.gameState as unknown as Record<string, unknown>,
      });
    } catch (err) {
      console.error("[LanternWatchRoom] persistInitialSession error:", err);
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
      console.error("[LanternWatchRoom] persistSnapshot error:", err);
    }
  }

  private async persistFinalResults() {
    try {
      const db = await getDb();
      const results = LanternWatchModule.getResults(this.gameState);
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
      console.error("[LanternWatchRoom] persistFinalResults error:", err);
    }
  }
}
