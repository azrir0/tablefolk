import {
  nextRandom,
  shuffleDeterministic,
  type ActionApplyResult,
  type ActionValidationResult,
  type GameModule,
  type GamePlayerSeed,
  type GameResultSummary,
} from "@tablefolk/game-engine";
import {
  BASE_CAMP_COORD,
  VAULT_COORDS,
  canPlacePathTile,
  computeRevealedDecoyEdges,
  coordKey,
  findTouchedUnrevealedVaults,
} from "./board.js";
import {
  createExpeditionDeck,
  createRolePool,
  getOrientedEdges,
  getStartingHandSize,
} from "./cards.js";
import type {
  BoardCell,
  PlayerGearState,
  PlayerInternalState,
  PublicBoardCell,
  RoleType,
  RoundSummary,
  TreasureTrailsAction,
  TreasureTrailsConfig,
  TreasureTrailsDisplayState,
  TreasureTrailsEvent,
  TreasureTrailsPrivateState,
  TreasureTrailsPublicState,
  TreasureTrailsState,
  VaultKind,
} from "./types.js";

export const DEFAULT_TREASURE_TRAILS_CONFIG: TreasureTrailsConfig = {
  totalRounds: 1,
  turnSeconds: 45,
  mysteryRoles: false,
};

function hasAnyBrokenGear(gear: PlayerGearState): boolean {
  return !gear.lantern || !gear.compass || !gear.grapple;
}

function buildRoundState(
  prevPlayers: Array<{
    userId: string;
    displayName: string;
    seatIndex: number;
    score: number;
  }>,
  config: TreasureTrailsConfig,
  currentRound: number,
  roundStarterIndex: number,
  seed: number,
  roundHistory: RoundSummary[]
): TreasureTrailsState {
  let s = seed | 0;

  // 1. Shuffle roles
  const rolePool = createRolePool(prevPlayers.length, config.mysteryRoles);
  const shuffledRoles = shuffleDeterministic(rolePool, s);
  s = shuffledRoles.nextSeed;

  // 2. Shuffle 3 Vaults (1 TRUE_RELIC, 2 DECOY)
  const vaultKinds: VaultKind[] = ["TRUE_RELIC", "DECOY", "DECOY"];
  const shuffledVaults = shuffleDeterministic(vaultKinds, s);
  s = shuffledVaults.nextSeed;

  // 3. Shuffle 66-card Expedition Deck
  const rawDeck = createExpeditionDeck();
  const shuffledDeck = shuffleDeterministic(rawDeck, s);
  s = shuffledDeck.nextSeed;

  const deck = [...shuffledDeck.shuffled];
  const handSize = getStartingHandSize(prevPlayers.length);

  // 4. Deal hands & fresh gear
  const players: PlayerInternalState[] = prevPlayers.map((p, idx) => ({
    userId: p.userId,
    displayName: p.displayName,
    seatIndex: p.seatIndex,
    role: shuffledRoles.shuffled[idx]!,
    hand: deck.splice(0, handSize),
    gear: { lantern: true, compass: true, grapple: true },
    score: p.score,
    scoutedVaults: {},
    afkStrikes: 0,
    autoPass: false,
  }));

  // 5. Setup board with Base Camp & 3 Sealed Vaults
  const board: Record<string, BoardCell> = {};
  board[coordKey(BASE_CAMP_COORD.x, BASE_CAMP_COORD.y)] = {
    x: BASE_CAMP_COORD.x,
    y: BASE_CAMP_COORD.y,
    kind: "BASE_CAMP",
    edges: { N: true, E: true, S: true, W: true },
    connectedCenter: true,
    cardVariant: "base_camp",
  };

  VAULT_COORDS.forEach((coord, idx) => {
    board[coordKey(coord.x, coord.y)] = {
      x: coord.x,
      y: coord.y,
      kind: "VAULT",
      edges: { N: true, E: true, S: true, W: true },
      connectedCenter: true,
      vaultRevealed: false,
      vaultKind: shuffledVaults.shuffled[idx]!,
    };
  });

  const starter = players[roundStarterIndex % players.length]!;
  const startEvent: TreasureTrailsEvent = {
    type: "ROUND_STARTED",
    roundNumber: currentRound,
    startingPlayerId: starter.userId,
  };

  return {
    phase: "IN_PROGRESS",
    config,
    currentRound,
    rngSeed: s,
    turnNumber: 1,
    activePlayerIndex: roundStarterIndex % players.length,
    roundStarterIndex: roundStarterIndex % players.length,
    players,
    board,
    deck,
    discardCount: 0,
    recentEvents: [startEvent],
    lastRoundSummary: null,
    roundHistory,
  };
}

function finalizeRound(
  state: TreasureTrailsState,
  winningTeam: RoleType,
  reason: string,
  clutchPlayerId: string | null,
  events: TreasureTrailsEvent[]
): TreasureTrailsState {
  const tricksterCount = state.players.filter((p) => p.role === "TRICKSTER").length;
  const tricksterReward = tricksterCount <= 1 ? 4 : tricksterCount === 2 ? 3 : 2;

  const starsAwarded: Record<string, number> = {};
  const revealedRoles: Record<string, RoleType> = {};

  const updatedPlayers = state.players.map((p) => {
    revealedRoles[p.userId] = p.role;
    let earned = 0;
    if (winningTeam === "TRAILBLAZER" && p.role === "TRAILBLAZER") {
      earned = 2 + (p.userId === clutchPlayerId ? 1 : 0);
    } else if (winningTeam === "TRICKSTER" && p.role === "TRICKSTER") {
      earned = tricksterReward;
    }
    starsAwarded[p.userId] = earned;
    return {
      ...p,
      score: p.score + earned,
    };
  });

  // Reveal all remaining vaults for end-of-round display
  const revealedBoard: Record<string, BoardCell> = {};
  for (const [k, cell] of Object.entries(state.board)) {
    revealedBoard[k] =
      cell.kind === "VAULT" ? { ...cell, vaultRevealed: true } : { ...cell };
  }

  const summary: RoundSummary = {
    roundNumber: state.currentRound,
    winningTeam,
    reason,
    clutchPlayerId,
    starsAwarded,
    revealedRoles,
  };

  events.push({ type: "ROUND_ENDED", summary });

  const isFinalRound = state.currentRound >= state.config.totalRounds;
  if (isFinalRound) {
    const maxScore = Math.max(...updatedPlayers.map((p) => p.score));
    const topScorerIds = updatedPlayers
      .filter((p) => p.score === maxScore)
      .map((p) => p.userId);
    events.push({
      type: "MATCH_ENDED",
      winningTeam:
        state.config.totalRounds === 1
          ? winningTeam === "TRAILBLAZER"
            ? "Trailblazers"
            : "Tricksters"
          : "Expedition Champion",
      topScorerIds,
    });
  }

  return {
    ...state,
    phase: isFinalRound ? "COMPLETED" : "ROUND_END",
    players: updatedPlayers,
    board: revealedBoard,
    lastRoundSummary: summary,
    roundHistory: [...state.roundHistory, summary],
    recentEvents: [...state.recentEvents, ...events].slice(-20),
  };
}

function advanceTurnOrEndByExhaustion(
  state: TreasureTrailsState,
  events: TreasureTrailsEvent[]
): TreasureTrailsState {
  const count = state.players.length;
  for (let offset = 1; offset <= count; offset++) {
    const idx = (state.activePlayerIndex + offset) % count;
    if (state.players[idx]!.hand.length > 0) {
      return {
        ...state,
        activePlayerIndex: idx,
        turnNumber: state.turnNumber + 1,
        recentEvents: [...state.recentEvents, ...events].slice(-20),
      };
    }
  }

  // Every player is out of cards and deck is empty -> Tricksters win!
  return finalizeRound(
    state,
    "TRICKSTER",
    "The expedition deck and all hands ran dry before reaching the Golden Compass!",
    null,
    events
  );
}

export function clearPlayerAfk(
  state: TreasureTrailsState,
  userId: string
): TreasureTrailsState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.userId === userId ? { ...p, afkStrikes: 0, autoPass: false } : p
    ),
  };
}

export const TreasureTrailsModule: GameModule<
  TreasureTrailsState,
  TreasureTrailsAction,
  TreasureTrailsPublicState,
  TreasureTrailsPrivateState,
  TreasureTrailsDisplayState,
  TreasureTrailsEvent,
  Partial<TreasureTrailsConfig>
> = {
  slug: "treasure-trails",
  title: "Treasure Trails",
  minPlayers: 3,
  maxPlayers: 8,

  createInitialState(
    players: GamePlayerSeed[],
    partialConfig: Partial<TreasureTrailsConfig> = {},
    rngSeed = Date.now()
  ): TreasureTrailsState {
    if (players.length < 3 || players.length > 8) {
      throw new Error(`Treasure Trails requires 3-8 players (got ${players.length}).`);
    }

    const config: TreasureTrailsConfig = {
      ...DEFAULT_TREASURE_TRAILS_CONFIG,
      ...partialConfig,
    };

    const sortedPlayers = [...players]
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map((p) => ({ ...p, score: 0 }));

    return buildRoundState(sortedPlayers, config, 1, 0, rngSeed, []);
  },

  validateAction(
    state: TreasureTrailsState,
    playerId: string,
    action: TreasureTrailsAction
  ): ActionValidationResult {
    if (action.type === "ADVANCE_ROUND") {
      if (state.phase !== "ROUND_END") {
        return { valid: false, code: "NOT_ROUND_END", message: "Round is still active." };
      }
      return { valid: true };
    }

    if (state.phase !== "IN_PROGRESS") {
      return { valid: false, code: "GAME_NOT_ACTIVE", message: "This round has already ended." };
    }

    const activePlayer = state.players[state.activePlayerIndex];
    if (!activePlayer || activePlayer.userId !== playerId) {
      return { valid: false, code: "NOT_YOUR_TURN", message: "It is not your turn." };
    }

    switch (action.type) {
      case "PLACE_PATH": {
        if (hasAnyBrokenGear(activePlayer.gear)) {
          return {
            valid: false,
            code: "GEAR_BROKEN",
            message: "Repair your broken gear (or use Field-Patch) before placing paths.",
          };
        }
        const card = activePlayer.hand.find((c) => c.id === action.cardId);
        if (!card || card.kind !== "PATH") {
          return { valid: false, code: "INVALID_CARD", message: "Selected card is not a path tile in your hand." };
        }
        const placement = canPlacePathTile(state.board, card, action.x, action.y, action.rotation);
        if (!placement.ok) {
          return { valid: false, code: "INVALID_PLACEMENT", message: placement.reason };
        }
        return { valid: true };
      }

      case "PLAY_HAZARD": {
        const card = activePlayer.hand.find((c) => c.id === action.cardId);
        if (!card || card.kind !== "HAZARD") {
          return { valid: false, code: "INVALID_CARD", message: "Selected card is not a hazard card." };
        }
        const target = state.players.find((p) => p.userId === action.targetUserId);
        if (!target) {
          return { valid: false, code: "INVALID_TARGET", message: "Target player not found." };
        }
        if (!target.gear[card.gear]) {
          return {
            valid: false,
            code: "ALREADY_BROKEN",
            message: `${target.displayName}'s ${card.gear} is already broken.`,
          };
        }
        return { valid: true };
      }

      case "PLAY_REPAIR": {
        const card = activePlayer.hand.find((c) => c.id === action.cardId);
        if (!card || card.kind !== "REPAIR") {
          return { valid: false, code: "INVALID_CARD", message: "Selected card is not a repair card." };
        }
        if (!card.gears.includes(action.gear)) {
          return {
            valid: false,
            code: "GEAR_MISMATCH",
            message: `That repair card cannot fix a ${action.gear}.`,
          };
        }
        const target = state.players.find((p) => p.userId === action.targetUserId);
        if (!target) {
          return { valid: false, code: "INVALID_TARGET", message: "Target player not found." };
        }
        if (target.gear[action.gear]) {
          return {
            valid: false,
            code: "NOT_BROKEN",
            message: `${target.displayName}'s ${action.gear} is already intact.`,
          };
        }
        return { valid: true };
      }

      case "PLAY_SPYGLASS": {
        const card = activePlayer.hand.find((c) => c.id === action.cardId);
        if (!card || card.kind !== "SPYGLASS") {
          return { valid: false, code: "INVALID_CARD", message: "Selected card is not a Spyglass." };
        }
        const cell = state.board[coordKey(action.x, action.y)];
        if (!cell || cell.kind !== "VAULT" || cell.vaultRevealed) {
          return {
            valid: false,
            code: "INVALID_VAULT",
            message: "Select an unrevealed Sealed Vault to scout.",
          };
        }
        return { valid: true };
      }

      case "PLAY_BOULDER_CLEAR": {
        const card = activePlayer.hand.find((c) => c.id === action.cardId);
        if (!card || card.kind !== "BOULDER_CLEAR") {
          return { valid: false, code: "INVALID_CARD", message: "Selected card is not Boulder Clear." };
        }
        const cell = state.board[coordKey(action.x, action.y)];
        if (!cell || cell.kind !== "PATH") {
          return {
            valid: false,
            code: "INVALID_TARGET",
            message: "Boulder Clear can only remove placed path tiles (not Base Camp or Vaults).",
          };
        }
        return { valid: true };
      }

      case "DISCARD": {
        const exists = activePlayer.hand.some((c) => c.id === action.cardId);
        if (!exists) {
          return { valid: false, code: "INVALID_CARD", message: "Card not found in your hand." };
        }
        return { valid: true };
      }

      case "FIELD_PATCH": {
        const [id1, id2] = action.cardIds;
        if (id1 === id2) {
          return { valid: false, code: "DUPLICATE_CARD", message: "Pick two distinct cards to Field-Patch." };
        }
        if (activePlayer.gear[action.gear]) {
          return {
            valid: false,
            code: "NOT_BROKEN",
            message: `Your ${action.gear} is not broken.`,
          };
        }
        const has1 = activePlayer.hand.some((c) => c.id === id1);
        const has2 = activePlayer.hand.some((c) => c.id === id2);
        if (!has1 || !has2) {
          return { valid: false, code: "INVALID_CARD", message: "Both cards must be in your hand." };
        }
        return { valid: true };
      }
    }
  },

  applyAction(
    state: TreasureTrailsState,
    playerId: string,
    action: TreasureTrailsAction
  ): ActionApplyResult<TreasureTrailsState, TreasureTrailsEvent> {
    const check = this.validateAction(state, playerId, action);
    if (!check.valid) {
      throw new Error(`${check.code}: ${check.message}`);
    }

    if (action.type === "ADVANCE_ROUND") {
      const nextRoundState = buildRoundState(
        state.players.map((p) => ({
          userId: p.userId,
          displayName: p.displayName,
          seatIndex: p.seatIndex,
          score: p.score,
        })),
        state.config,
        state.currentRound + 1,
        (state.roundStarterIndex + 1) % state.players.length,
        state.rngSeed,
        state.roundHistory
      );
      return {
        state: nextRoundState,
        events: nextRoundState.recentEvents,
      };
    }

    const events: TreasureTrailsEvent[] = [];
    const deck = [...state.deck];
    const board: Record<string, BoardCell> = { ...state.board };
    let discardCount = state.discardCount;

    let players = state.players.map((p) => ({
      ...p,
      hand: [...p.hand],
      gear: { ...p.gear },
      scoutedVaults: { ...p.scoutedVaults },
    }));

    const actor = players[state.activePlayerIndex]!;
    // Acting voluntarily clears AFK strikes
    actor.afkStrikes = 0;
    actor.autoPass = false;

    const removeCardFromActor = (cardId: string) => {
      const idx = actor.hand.findIndex((c) => c.id === cardId);
      const [removed] = actor.hand.splice(idx, 1);
      return removed!;
    };

    let trueRelicReached = false;

    switch (action.type) {
      case "PLACE_PATH": {
        const card = removeCardFromActor(action.cardId);
        if (card.kind !== "PATH") throw new Error("Expected path card");

        const oriented = getOrientedEdges(card.edges, action.rotation);
        const key = coordKey(action.x, action.y);
        board[key] = {
          x: action.x,
          y: action.y,
          kind: "PATH",
          edges: oriented,
          connectedCenter: card.connectedCenter,
          cardVariant: card.variant,
          rotation: action.rotation,
          placedBy: actor.userId,
        };

        events.push({
          type: "TILE_PLACED",
          actorId: actor.userId,
          x: action.x,
          y: action.y,
          cardVariant: card.variant,
          rotation: action.rotation,
        });

        // Check for adjacent unrevealed Vault reveals
        const touchedVaults = findTouchedUnrevealedVaults(
          board,
          action.x,
          action.y,
          oriented,
          card.connectedCenter
        );
        for (const vault of touchedVaults) {
          const vKey = coordKey(vault.x, vault.y);
          const vKind = vault.vaultKind ?? "DECOY";
          if (vKind === "TRUE_RELIC") {
            board[vKey] = {
              ...vault,
              vaultRevealed: true,
              edges: { N: true, E: true, S: true, W: true },
              connectedCenter: true,
            };
            trueRelicReached = true;
          } else {
            board[vKey] = {
              ...vault,
              vaultRevealed: true,
              edges: computeRevealedDecoyEdges(board, vault.x, vault.y),
              connectedCenter: true,
            };
          }
          events.push({
            type: "VAULT_REVEALED",
            actorId: actor.userId,
            x: vault.x,
            y: vault.y,
            vaultKind: vKind,
          });
        }
        break;
      }

      case "PLAY_HAZARD": {
        const card = removeCardFromActor(action.cardId);
        if (card.kind !== "HAZARD") throw new Error("Expected hazard card");
        discardCount += 1;
        const target = players.find((p) => p.userId === action.targetUserId)!;
        target.gear[card.gear] = false;
        events.push({
          type: "GEAR_BROKEN",
          actorId: actor.userId,
          targetId: target.userId,
          gear: card.gear,
        });
        break;
      }

      case "PLAY_REPAIR": {
        removeCardFromActor(action.cardId);
        discardCount += 1;
        const target = players.find((p) => p.userId === action.targetUserId)!;
        target.gear[action.gear] = true;
        events.push({
          type: "GEAR_REPAIRED",
          actorId: actor.userId,
          targetId: target.userId,
          gear: action.gear,
        });
        break;
      }

      case "PLAY_SPYGLASS": {
        removeCardFromActor(action.cardId);
        discardCount += 1;
        const vKey = coordKey(action.x, action.y);
        const vault = board[vKey]!;
        actor.scoutedVaults[vKey] = vault.vaultKind ?? "DECOY";
        events.push({
          type: "VAULT_SCOUTED",
          actorId: actor.userId,
          x: action.x,
          y: action.y,
        });
        break;
      }

      case "PLAY_BOULDER_CLEAR": {
        removeCardFromActor(action.cardId);
        discardCount += 1;
        delete board[coordKey(action.x, action.y)];
        events.push({
          type: "TILE_CLEARED",
          actorId: actor.userId,
          x: action.x,
          y: action.y,
        });
        break;
      }

      case "DISCARD": {
        removeCardFromActor(action.cardId);
        discardCount += 1;
        events.push({
          type: "CARD_DISCARDED",
          actorId: actor.userId,
        });
        break;
      }

      case "FIELD_PATCH": {
        removeCardFromActor(action.cardIds[0]);
        removeCardFromActor(action.cardIds[1]);
        discardCount += 2;
        actor.gear[action.gear] = true;
        events.push({
          type: "FIELD_PATCHED",
          actorId: actor.userId,
          gear: action.gear,
        });
        break;
      }
    }

    // Draw 1 replacement card if deck has cards remaining
    if (deck.length > 0 && !trueRelicReached) {
      const drawn = deck.shift()!;
      actor.hand.push(drawn);
    }

    const intermediateState: TreasureTrailsState = {
      ...state,
      players,
      board,
      deck,
      discardCount,
    };

    if (trueRelicReached) {
      const ended = finalizeRound(
        intermediateState,
        "TRAILBLAZER",
        `${actor.displayName} connected Base Camp to the Golden Compass!`,
        actor.userId,
        events
      );
      return { state: ended, events };
    }

    const nextState = advanceTurnOrEndByExhaustion(intermediateState, events);
    return { state: nextState, events };
  },

  onTurnTimeout(
    state: TreasureTrailsState
  ): ActionApplyResult<TreasureTrailsState, TreasureTrailsEvent> {
    if (state.phase !== "IN_PROGRESS") {
      return { state, events: [] };
    }

    const events: TreasureTrailsEvent[] = [];
    const deck = [...state.deck];
    let discardCount = state.discardCount;
    const players = state.players.map((p) => ({
      ...p,
      hand: [...p.hand],
      gear: { ...p.gear },
      scoutedVaults: { ...p.scoutedVaults },
    }));

    const actor = players[state.activePlayerIndex]!;
    let nextSeed = state.rngSeed;

    if (actor.hand.length > 0) {
      const r = nextRandom(nextSeed);
      nextSeed = r.nextSeed;
      const dropIdx = Math.floor(r.value * actor.hand.length);
      actor.hand.splice(dropIdx, 1);
      discardCount += 1;
      events.push({
        type: "CARD_DISCARDED",
        actorId: actor.userId,
        timedOut: true,
      });
    }

    actor.afkStrikes += 1;
    if (actor.afkStrikes >= 2) {
      actor.autoPass = true;
    }

    if (deck.length > 0) {
      actor.hand.push(deck.shift()!);
    }

    const nextState = advanceTurnOrEndByExhaustion(
      {
        ...state,
        rngSeed: nextSeed,
        players,
        deck,
        discardCount,
      },
      events
    );
    return { state: nextState, events };
  },

  getPublicState(state: TreasureTrailsState): TreasureTrailsPublicState {
    const revealRoles = state.phase === "ROUND_END" || state.phase === "COMPLETED";

    const publicBoard: Record<string, PublicBoardCell> = {};
    for (const [k, cell] of Object.entries(state.board)) {
      if (cell.kind === "VAULT" && !cell.vaultRevealed) {
        publicBoard[k] = {
          x: cell.x,
          y: cell.y,
          kind: "VAULT",
          edges: null,
          connectedCenter: false,
          vaultRevealed: false,
        };
      } else {
        publicBoard[k] = {
          x: cell.x,
          y: cell.y,
          kind: cell.kind,
          edges: { ...cell.edges },
          connectedCenter: cell.connectedCenter,
          cardVariant: cell.cardVariant,
          rotation: cell.rotation,
          placedBy: cell.placedBy,
          vaultRevealed: cell.vaultRevealed,
          vaultKind: cell.kind === "VAULT" ? cell.vaultKind : undefined,
        };
      }
    }

    return {
      phase: state.phase,
      config: { ...state.config },
      currentRound: state.currentRound,
      turnNumber: state.turnNumber,
      activePlayerId: state.players[state.activePlayerIndex]?.userId ?? "",
      players: state.players.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        seatIndex: p.seatIndex,
        handCount: p.hand.length,
        gear: { ...p.gear },
        score: p.score,
        afkStrikes: p.afkStrikes,
        autoPass: p.autoPass,
        revealedRole: revealRoles ? p.role : undefined,
      })),
      board: publicBoard,
      deckCount: state.deck.length,
      discardCount: state.discardCount,
      recentEvents: [...state.recentEvents],
      lastRoundSummary: state.lastRoundSummary,
    };
  },

  getPrivateState(
    state: TreasureTrailsState,
    playerId: string
  ): TreasureTrailsPrivateState {
    const player = state.players.find((p) => p.userId === playerId);
    if (!player) {
      return {
        userId: playerId,
        role: "TRAILBLAZER",
        hand: [],
        scoutedVaults: {},
      };
    }
    return {
      userId: player.userId,
      role: player.role,
      hand: player.hand.map((c) => ({ ...c })),
      scoutedVaults: { ...player.scoutedVaults },
    };
  },

  getDisplayState(state: TreasureTrailsState): TreasureTrailsDisplayState {
    return {
      ...this.getPublicState(state),
      displayMode: true,
    };
  },

  isGameCompleted(state: TreasureTrailsState): boolean {
    return state.phase === "COMPLETED";
  },

  getResults(state: TreasureTrailsState): GameResultSummary | null {
    if (state.phase !== "COMPLETED") return null;
    const maxScore = Math.max(...state.players.map((p) => p.score));
    const lastWinner = state.lastRoundSummary?.winningTeam;

    return {
      winningTeam:
        state.config.totalRounds === 1
          ? lastWinner === "TRAILBLAZER"
            ? "Trailblazers"
            : "Tricksters"
          : "Expedition Champions",
      headline:
        state.config.totalRounds === 1
          ? state.lastRoundSummary?.reason ?? "Expedition complete!"
          : `Final Standings after ${state.config.totalRounds} Rounds`,
      players: state.players.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        score: p.score,
        isWinner:
          state.config.totalRounds === 1
            ? p.role === lastWinner
            : p.score === maxScore,
        roleLabel: p.role === "TRAILBLAZER" ? "Trailblazer" : "Trickster",
      })),
    };
  },
};
