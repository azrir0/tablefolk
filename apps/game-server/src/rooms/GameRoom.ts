import crypto from "node:crypto";
import colyseus, { type Client } from "colyseus";
const { Room } = colyseus;
import { eq, gamePlayers, gameSessions, getDb } from "@tablefolk/db";
import {
  QUICK_BLUFF_PILLS,
  TreasureTrailsActionSchema,
  TreasureTrailsModule,
  VAULT_COORDS,
  clearPlayerAfk,
  coordKey,
  getValidPlacementsForCard,
  type GearType,
  type TreasureTrailsAction,
  type TreasureTrailsConfig,
  type TreasureTrailsState,
} from "@tablefolk/game-treasure-trails";
import { verifyAuthToken } from "../services/auth.js";
import {
  notifyCafeTableFinished,
  registerGameRoom,
  unregisterGameRoom,
} from "../services/roomRegistry.js";

interface GameRoomCreateOptions {
  cafeRoomId: string;
  tableId: string;
  gameSlug: string;
  config: Partial<TreasureTrailsConfig>;
  players: Array<{
    userId: string;
    displayName: string;
    seatIndex: number;
    isBot: boolean;
  }>;
}

interface GameJoinOptions {
  token?: string;
}

interface GameAuthedClient {
  userId: string;
  displayName: string;
  isSpectator: boolean;
}

export class GameRoom extends Room {
  private cafeRoomId = "";
  private tableId = "";
  private gameSlug = "treasure-trails";
  private sessionId = "";
  private gameState!: TreasureTrailsState;
  private botUserIds = new Set<string>();
  private botControlledHumans = new Set<string>();
  private botTakeoverTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private allowedUserIds = new Set<string>();
  private userIdToClient = new Map<string, Client>();
  private turnEndsAt = 0;
  private introEndsAt = 0;
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private roundAdvanceTimer: ReturnType<typeof setTimeout> | null = null;
  private emptyHumansTimer: ReturnType<typeof setTimeout> | null = null;
  private persistedFinish = false;
  private aborted = false;

  async onCreate(options: GameRoomCreateOptions) {
    this.autoDispose = false;
    void this.setPrivate(true);

    this.cafeRoomId = options.cafeRoomId;
    this.tableId = options.tableId;
    this.gameSlug = options.gameSlug || "treasure-trails";
    this.sessionId = `sess_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

    const humanUserIds: string[] = [];
    for (const p of options.players) {
      this.allowedUserIds.add(p.userId);
      if (p.isBot) this.botUserIds.add(p.userId);
      else humanUserIds.push(p.userId);
    }

    const rngSeed = crypto.randomInt(1, 2_000_000_000);
    this.gameState = TreasureTrailsModule.createInitialState(
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

    // Persist session record to PostgreSQL
    void this.persistInitialSession();

    this.beginRoundIntroWindow(5800);

    // If no human ever finishes connecting within 25s, clean up automatically
    this.scheduleEmptyHumansAbort(25_000);

    // 1-second authoritative turn clock (paused while intro plays or 0 humans connected)
    this.setSimulationInterval(() => {
      if (this.aborted || this.gameState.phase !== "IN_PROGRESS") return;
      if (this.userIdToClient.size === 0) return;
      if (Date.now() < this.introEndsAt) return;
      if (Date.now() >= this.turnEndsAt) {
        const res = TreasureTrailsModule.onTurnTimeout(this.gameState);
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

  private beginRoundIntroWindow(durationMs: number) {
    this.introEndsAt = Date.now() + durationMs;
    const active = this.gameState.players[this.gameState.activePlayerIndex];
    const seconds = active?.autoPass ? 5 : this.gameState.config.turnSeconds;
    this.turnEndsAt = this.introEndsAt + seconds * 1000;
  }

  async onAuth(_client: Client, options: GameJoinOptions): Promise<GameAuthedClient> {
    if (!options?.token) {
      throw new Error("Authentication required to join game session.");
    }
    const verified = await verifyAuthToken(options.token);
    const isParticipant = this.allowedUserIds.has(verified.sub);
    return {
      userId: verified.sub,
      displayName: verified.displayName,
      isSpectator: !isParticipant,
    };
  }

  onJoin(client: Client, _options?: GameJoinOptions, auth?: GameAuthedClient) {
    if (!auth) return;

    let reclaimedFromBot = false;
    let returnedFromGrace = false;
    const wasEmpty = this.userIdToClient.size === 0;

    if (!auth.isSpectator) {
      this.userIdToClient.set(auth.userId, client);
      this.gameState = clearPlayerAfk(this.gameState, auth.userId);

      // Cancel any pending empty-room abort or bot takeover for this player
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

      // If all humans were briefly away (e.g. minimized browser) and the clock expired while paused,
      // give a fresh turn timer before resuming simulation!
      if (
        wasEmpty &&
        this.gameState.phase === "IN_PROGRESS" &&
        Date.now() >= this.turnEndsAt - 5000
      ) {
        this.resetTurnClock();
      }

      // If it's currently this returning player's turn, cancel any bot move & give full clock!
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

    // Send authoritative public + private state immediately to the joining/rejoining client
    this.sendFullSyncToClient(client, auth);

    if (!auth.isSpectator) {
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
    const auth = client.auth as GameAuthedClient | undefined;
    if (!auth || auth.isSpectator) return;

    // Ignore stale socket closing if the player already reconnected on a fresh socket!
    if (this.userIdToClient.get(auth.userId)?.sessionId !== client.sessionId) {
      return;
    }

    this.userIdToClient.delete(auth.userId);

    // If 0 humans remain connected, pause bots & give a 60s window for mobile minimize / rejoin
    if (this.userIdToClient.size === 0) {
      if (this.botTimer) {
        clearTimeout(this.botTimer);
        this.botTimer = null;
      }
      for (const t of this.botTakeoverTimers.values()) clearTimeout(t);
      this.botTakeoverTimers.clear();

      if (this.gameState.phase === "COMPLETED") {
        void this.disconnect();
      } else {
        this.scheduleEmptyHumansAbort(60_000);
      }
      return;
    }

    // Other humans are still playing! Give 15s grace window, then Substitute Bot takes over smoothly
    if (this.gameState.phase !== "COMPLETED" && !this.botControlledHumans.has(auth.userId)) {
      this.broadcastSystemChat(
        `⏳ ${auth.displayName} stepped away — a Café Bot will sub in after 15s if they don't return.`
      );
      const prevTimer = this.botTakeoverTimers.get(auth.userId);
      if (prevTimer) clearTimeout(prevTimer);

      const timer = setTimeout(() => {
        this.botTakeoverTimers.delete(auth.userId);
        if (this.aborted || this.gameState.phase === "COMPLETED") return;
        if (this.userIdToClient.has(auth.userId)) return; // Already rejoined!
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
    if (this.roundAdvanceTimer) clearTimeout(this.roundAdvanceTimer);
    if (this.emptyHumansTimer) clearTimeout(this.emptyHumansTimer);
    for (const t of this.botTakeoverTimers.values()) clearTimeout(t);
    this.botTakeoverTimers.clear();
    unregisterGameRoom(this.roomId);
    notifyCafeTableFinished(this.cafeRoomId, this.tableId);
  }

  private sendFullSyncToClient(client: Client, auth: GameAuthedClient) {
    client.send("game.publicState", {
      sessionId: this.sessionId,
      state: TreasureTrailsModule.getPublicState(this.gameState),
      turnEndsAt: this.turnEndsAt,
      introEndsAt: this.introEndsAt,
      botControlledUserIds: Array.from(this.botControlledHumans),
      isSpectator: auth.isSpectator,
    });

    if (!auth.isSpectator) {
      client.send(
        "game.privateState",
        TreasureTrailsModule.getPrivateState(this.gameState, auth.userId)
      );
    }
  }

  private broadcastSystemChat(message: string) {
    this.broadcast("game.chatReceived", {
      id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderUserId: "system",
      senderName: "TableFolk",
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
    if (this.roundAdvanceTimer) {
      clearTimeout(this.roundAdvanceTimer);
      this.roundAdvanceTimer = null;
    }
    if (this.emptyHumansTimer) {
      clearTimeout(this.emptyHumansTimer);
      this.emptyHumansTimer = null;
    }
    for (const t of this.botTakeoverTimers.values()) clearTimeout(t);
    this.botTakeoverTimers.clear();

    if (!this.persistedFinish && this.gameState?.phase !== "COMPLETED") {
      this.persistedFinish = true;
      void (async () => {
        try {
          const db = await getDb();
          await db
            .update(gameSessions)
            .set({ status: "ABANDONED", endedAt: new Date() })
            .where(eq(gameSessions.id, this.sessionId));
        } catch (err) {
          console.error("[GameRoom] Failed to mark abandoned session:", err);
        }
      })();
    }

    unregisterGameRoom(this.roomId);
    notifyCafeTableFinished(this.cafeRoomId, this.tableId);
    void this.disconnect();
  }

  private registerMessageHandlers() {
    // Instant full-state resync when a mobile browser wakes up from background
    this.onMessage("game.sync", (client) => {
      const auth = client.auth as GameAuthedClient | undefined;
      if (!auth) return;
      this.sendFullSyncToClient(client, auth);
    });

    this.onMessage("game.action", (client, raw) => {
      const auth = client.auth as GameAuthedClient | undefined;
      if (!auth || auth.isSpectator) {
        client.send("game.actionRejected", {
          code: "SPECTATOR",
          message: "Spectators cannot perform game actions.",
        });
        return;
      }

      const parsed = TreasureTrailsActionSchema.safeParse(raw);
      if (!parsed.success) {
        client.send("game.actionRejected", {
          code: "INVALID_SCHEMA",
          message: "Malformed game action payload.",
        });
        return;
      }

      const check = TreasureTrailsModule.validateAction(
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
      const auth = client.auth as GameAuthedClient | undefined;
      if (!auth || auth.isSpectator) return;
      this.gameState = clearPlayerAfk(this.gameState, auth.userId);
      const active = this.gameState.players[this.gameState.activePlayerIndex];
      if (active?.userId === auth.userId && this.gameState.phase === "IN_PROGRESS") {
        this.resetTurnClock();
      }
      this.broadcastStateAndEvents([]);
    });

    this.onMessage("game.quickBluff", (client, raw: { text?: string }) => {
      const auth = client.auth as GameAuthedClient | undefined;
      if (!auth) return;
      const text = raw?.text || "";
      if (!(QUICK_BLUFF_PILLS as readonly string[]).includes(text)) return;
      this.broadcast("game.chatReceived", {
        id: `gmsg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        senderUserId: auth.userId,
        senderName: auth.displayName,
        message: text,
        isQuickBluff: true,
        timestamp: Date.now(),
      });
    });

    this.onMessage("game.chat", (client, raw: { message?: string }) => {
      const auth = client.auth as GameAuthedClient | undefined;
      if (!auth) return;
      const text = (raw?.message || "").trim().slice(0, 220);
      if (!text) return;
      this.broadcast("game.chatReceived", {
        id: `gmsg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        senderUserId: auth.userId,
        senderName: auth.displayName,
        message: text,
        isQuickBluff: false,
        timestamp: Date.now(),
      });
    });
  }

  private executeValidatedAction(userId: string, action: TreasureTrailsAction) {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
    if (this.roundAdvanceTimer) {
      clearTimeout(this.roundAdvanceTimer);
      this.roundAdvanceTimer = null;
    }

    const res = TreasureTrailsModule.applyAction(this.gameState, userId, action);
    this.gameState = res.state;
    void this.persistSnapshot();

    // Update turn clock / round intro BEFORE broadcasting so clients get fresh timestamps!
    if (action.type === "ADVANCE_ROUND") {
      this.beginRoundIntroWindow(5800);
    } else if (this.gameState.phase === "IN_PROGRESS") {
      this.resetTurnClock();
    }

    this.broadcastStateAndEvents(res.events);
    this.handlePostStateChange();
  }

  private handlePostStateChange() {
    if (this.gameState.phase === "COMPLETED") {
      if (this.emptyHumansTimer) {
        clearTimeout(this.emptyHumansTimer);
        this.emptyHumansTimer = null;
      }
      for (const t of this.botTakeoverTimers.values()) clearTimeout(t);
      this.botTakeoverTimers.clear();
      unregisterGameRoom(this.roomId);
      void this.persistCompletedResults();
      notifyCafeTableFinished(this.cafeRoomId, this.tableId);
      this.clock.setTimeout(() => {
        if (this.clients.length === 0) this.disconnect();
      }, 120_000);
      return;
    }

    if (this.gameState.phase === "ROUND_END") {
      // Auto-advance to next round after 10 seconds if nobody clicks Continue sooner
      this.roundAdvanceTimer = setTimeout(() => {
        if (this.gameState.phase === "ROUND_END") {
          const firstUser = this.gameState.players[0]!.userId;
          this.executeValidatedAction(firstUser, { type: "ADVANCE_ROUND" });
        }
      }, 10_000);
      return;
    }

    this.scheduleBotIfNeeded();
  }

  private resetTurnClock() {
    const active = this.gameState.players[this.gameState.activePlayerIndex];
    const seconds = active?.autoPass ? 5 : this.gameState.config.turnSeconds;
    this.turnEndsAt = Date.now() + seconds * 1000;
  }

  private broadcastStateAndEvents(events: unknown[]) {
    const publicState = TreasureTrailsModule.getPublicState(this.gameState);
    this.broadcast("game.publicState", {
      sessionId: this.sessionId,
      state: publicState,
      turnEndsAt: this.turnEndsAt,
      introEndsAt: this.introEndsAt,
      botControlledUserIds: Array.from(this.botControlledHumans),
      events,
    });

    // Strict private state isolation: push each player's secret hand & role ONLY to their own socket
    for (const [userId, client] of this.userIdToClient.entries()) {
      client.send(
        "game.privateState",
        TreasureTrailsModule.getPrivateState(this.gameState, userId)
      );
    }
  }

  /**
   * Smart, fair Practice & Substitute Bot AI — uses ONLY public state + its own private state
   * and goes through the exact same validateAction/applyAction pipeline as human players.
   */
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

    const waitIntroMs = Math.max(0, this.introEndsAt - Date.now());
    const delayMs = waitIntroMs > 0 ? waitIntroMs + 950 : 1450;

    this.botTimer = setTimeout(() => {
      if (this.aborted || this.userIdToClient.size === 0) return;
      if (this.gameState.phase !== "IN_PROGRESS") return;
      const current = this.gameState.players[this.gameState.activePlayerIndex];
      if (!current || current.userId !== active.userId) return;
      // Guard against human reclaiming control right before the timer fired
      if (
        !this.botUserIds.has(active.userId) &&
        !this.botControlledHumans.has(active.userId)
      ) {
        return;
      }

      const chosen = this.pickBotAction(active.userId);
      if (chosen) {
        const check = TreasureTrailsModule.validateAction(
          this.gameState,
          active.userId,
          chosen
        );
        if (check.valid) {
          this.executeValidatedAction(active.userId, chosen);
          return;
        }
      }

      // Safe fallback: discard first card
      const priv = TreasureTrailsModule.getPrivateState(this.gameState, active.userId);
      if (priv.hand.length > 0) {
        this.executeValidatedAction(active.userId, {
          type: "DISCARD",
          cardId: priv.hand[0]!.id,
        });
      }
    }, delayMs);
  }

  private pickBotAction(botId: string): TreasureTrailsAction | null {
    const pub = TreasureTrailsModule.getPublicState(this.gameState);
    const priv = TreasureTrailsModule.getPrivateState(this.gameState, botId);
    const me = pub.players.find((p) => p.userId === botId);
    if (!me || priv.hand.length === 0) return null;

    const brokenGears = (["lantern", "compass", "grapple"] as GearType[]).filter(
      (g) => !me.gear[g]
    );
    const isTrickster = priv.role === "TRICKSTER";

    // 1. If broken, try Repair card first, else Field-Patch if Trailblazer
    if (brokenGears.length > 0) {
      for (const card of priv.hand) {
        if (card.kind === "REPAIR") {
          const fixable = card.gears.find((g) => !me.gear[g]);
          if (fixable) {
            return {
              type: "PLAY_REPAIR",
              cardId: card.id,
              targetUserId: botId,
              gear: fixable,
            };
          }
        }
      }
      if (!isTrickster && priv.hand.length >= 3) {
        return {
          type: "FIELD_PATCH",
          cardIds: [priv.hand[0]!.id, priv.hand[1]!.id],
          gear: brokenGears[0]!,
        };
      }
    }

    // 2. Use Spyglass if available on an unscouted, unrevealed vault
    const spyCard = priv.hand.find((c) => c.kind === "SPYGLASS");
    if (spyCard) {
      const targetVault = VAULT_COORDS.find((v) => {
        const key = coordKey(v.x, v.y);
        const cell = pub.board[key];
        return cell && !cell.vaultRevealed && !priv.scoutedVaults[key];
      });
      if (targetVault) {
        return {
          type: "PLAY_SPYGLASS",
          cardId: spyCard.id,
          x: targetVault.x,
          y: targetVault.y,
        };
      }
    }

    // 3. Trickster tactics: sabotage an intact explorer or drop a dead-end blocker near the front
    if (isTrickster) {
      const hazCard = priv.hand.find((c) => c.kind === "HAZARD");
      if (hazCard && hazCard.kind === "HAZARD") {
        const target = pub.players.find(
          (p) => p.userId !== botId && p.gear[hazCard.gear]
        );
        if (target) {
          return {
            type: "PLAY_HAZARD",
            cardId: hazCard.id,
            targetUserId: target.userId,
          };
        }
      }

      if (brokenGears.length === 0) {
        const deadCard = priv.hand.find((c) => c.kind === "PATH" && !c.connectedCenter);
        if (deadCard && deadCard.kind === "PATH") {
          for (const rot of [0, 180] as const) {
            const spots = getValidPlacementsForCard(pub.board, deadCard, rot);
            if (spots.length > 0) {
              spots.sort((a, b) => b.x - a.x); // Block furthest eastern progress!
              return {
                type: "PLACE_PATH",
                cardId: deadCard.id,
                x: spots[0]!.x,
                y: spots[0]!.y,
                rotation: rot,
              };
            }
          }
        }
      }
    }

    // 4. Trailblazer tactics: advance East with an open path toward known True Relic (or center)
    if (brokenGears.length === 0) {
      const knownTrueKey = Object.entries(priv.scoutedVaults).find(
        ([, kind]) => kind === "TRUE_RELIC"
      )?.[0];
      const goalY = knownTrueKey ? Number(knownTrueKey.split(",")[1]) : 2;

      let bestMove: { action: TreasureTrailsAction; score: number } | null = null;
      for (const card of priv.hand) {
        if (card.kind !== "PATH" || !card.connectedCenter) continue;
        for (const rot of [0, 180] as const) {
          const spots = getValidPlacementsForCard(pub.board, card, rot);
          for (const spot of spots) {
            const progressScore = isTrickster
              ? -spot.x * 2 + Math.abs(spot.y - 2) // Trickster stalls westward
              : spot.x * 3 - Math.abs(spot.y - goalY);
            if (!bestMove || progressScore > bestMove.score) {
              bestMove = {
                score: progressScore,
                action: {
                  type: "PLACE_PATH",
                  cardId: card.id,
                  x: spot.x,
                  y: spot.y,
                  rotation: rot,
                },
              };
            }
          }
        }
      }
      if (bestMove) return bestMove.action;
    }

    // 5. Repair an ally if holding a repair card (Trailblazer)
    if (!isTrickster) {
      for (const card of priv.hand) {
        if (card.kind !== "REPAIR") continue;
        for (const p of pub.players) {
          const fixable = card.gears.find((g) => !p.gear[g]);
          if (fixable) {
            return {
              type: "PLAY_REPAIR",
              cardId: card.id,
              targetUserId: p.userId,
              gear: fixable,
            };
          }
        }
      }
    }

    // 6. Discard least useful card
    return { type: "DISCARD", cardId: priv.hand[0]!.id };
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
      console.error("[GameRoom] Failed to persist initial session:", err);
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
      console.error("[GameRoom] Failed to persist snapshot:", err);
    }
  }

  private async persistCompletedResults() {
    if (this.persistedFinish) return;
    this.persistedFinish = true;
    try {
      const db = await getDb();
      const results = TreasureTrailsModule.getResults(this.gameState);
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
      console.error("[GameRoom] Failed to persist completed results:", err);
    }
  }
}
