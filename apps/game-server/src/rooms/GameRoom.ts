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

    for (const p of options.players) {
      this.allowedUserIds.add(p.userId);
      if (p.isBot) this.botUserIds.add(p.userId);
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

    registerGameRoom(this.roomId, () => {
      this.abortAbandonedGame();
    });

    // Persist session record to PostgreSQL
    void this.persistInitialSession();

    this.beginRoundIntroWindow(5800);

    // If no human ever finishes connecting within 20s, clean up automatically
    this.scheduleEmptyHumansAbort(20_000);

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
    if (!auth.isSpectator) {
      this.userIdToClient.set(auth.userId, client);
      this.gameState = clearPlayerAfk(this.gameState, auth.userId);
      if (this.emptyHumansTimer) {
        clearTimeout(this.emptyHumansTimer);
        this.emptyHumansTimer = null;
      }
    }

    // Send authoritative public state + timer + introEndsAt + private state exclusively to this client
    client.send("game.publicState", {
      sessionId: this.sessionId,
      state: TreasureTrailsModule.getPublicState(this.gameState),
      turnEndsAt: this.turnEndsAt,
      introEndsAt: this.introEndsAt,
      isSpectator: auth.isSpectator,
    });

    if (!auth.isSpectator) {
      client.send(
        "game.privateState",
        TreasureTrailsModule.getPrivateState(this.gameState, auth.userId)
      );
      this.scheduleBotIfNeeded();
    }
  }

  async onLeave(client: Client, consented: boolean) {
    const auth = client.auth as GameAuthedClient | undefined;
    if (!consented) {
      try {
        await this.allowReconnection(client, 45);
        return;
      } catch {
        // Proceed to mark disconnected
      }
    }

    if (auth && this.userIdToClient.get(auth.userId)?.sessionId === client.sessionId) {
      this.userIdToClient.delete(auth.userId);
    }

    // Never keep running a bot-only match when 0 humans remain!
    if (this.userIdToClient.size === 0) {
      if (this.botTimer) {
        clearTimeout(this.botTimer);
        this.botTimer = null;
      }
      if (this.gameState.phase === "COMPLETED") {
        void this.disconnect();
      } else {
        // Give brief 15s resume window in case solo player clicked Back to Café temporarily;
        // standing up at the table triggers immediate abortAbandonedGame() via CafeRoom!
        this.scheduleEmptyHumansAbort(15_000);
      }
    }
  }

  onDispose() {
    if (this.botTimer) clearTimeout(this.botTimer);
    if (this.roundAdvanceTimer) clearTimeout(this.roundAdvanceTimer);
    if (this.emptyHumansTimer) clearTimeout(this.emptyHumansTimer);
    unregisterGameRoom(this.roomId);
    notifyCafeTableFinished(this.cafeRoomId, this.tableId);
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

    notifyCafeTableFinished(this.cafeRoomId, this.tableId);
    void this.disconnect();
  }

  private registerMessageHandlers() {
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
   * Smart, fair Practice Bot AI — uses ONLY public state + its own private state
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
    if (!active || !this.botUserIds.has(active.userId)) return;

    const waitIntroMs = Math.max(0, this.introEndsAt - Date.now());
    const delayMs = waitIntroMs > 0 ? waitIntroMs + 950 : 1450;

    this.botTimer = setTimeout(() => {
      if (this.aborted || this.userIdToClient.size === 0) return;
      if (this.gameState.phase !== "IN_PROGRESS") return;
      const current = this.gameState.players[this.gameState.activePlayerIndex];
      if (!current || current.userId !== active.userId) return;

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
