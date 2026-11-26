import {
  shuffleDeterministic,
  type ActionApplyResult,
  type ActionValidationResult,
  type GameModule,
  type GamePlayerSeed,
  type GameResultSummary,
} from "@tablefolk/game-engine";
import {
  canPlaceTileAt,
  computeFeaturePoints,
  evaluateFeature,
  getClaimableSegmentsAt,
  getValidPlacementsForTemplate,
  parseTileKey,
  tileKey,
  type EvaluatedFeature,
} from "./geometry.js";
import { START_TILE_TEMPLATE, buildHearthvaleDeck, getTileTemplate } from "./tiles.js";
import {
  PLAYER_COLORS,
  type FolkKind,
  type HearthvaleAction,
  type HearthvaleConfig,
  type HearthvaleEvent,
  type HearthvalePlayerState,
  type HearthvalePrivateState,
  type HearthvalePublicState,
  type HearthvaleState,
  type HearthvaleTile,
  type PlacedTile,
  type ScoreLogEntry,
} from "./types.js";

const DEFAULT_CONFIG: HearthvaleConfig = {
  deckSize: 36,
  turnSeconds: 45,
};

const INITIAL_VILLAGERS = 5;
const INITIAL_MAYORS = 1;
const HAND_SIZE = 2;

function cloneState(state: HearthvaleState): HearthvaleState {
  return JSON.parse(JSON.stringify(state)) as HearthvaleState;
}

function appendEvents(state: HearthvaleState, events: HearthvaleEvent[]): void {
  state.recentEvents = [...state.recentEvents, ...events].slice(-24);
}

function folkStrength(kind: FolkKind): number {
  return kind === "MAYOR" ? 2 : 1;
}

function awardAndReturnFeature(
  state: HearthvaleState,
  feature: EvaluatedFeature,
  isEndGame: boolean,
  events: HearthvaleEvent[]
): ScoreLogEntry | null {
  if (feature.folkEntries.length === 0) return null;

  const strengthByUser = new Map<string, number>();
  for (const entry of feature.folkEntries) {
    const prev = strengthByUser.get(entry.folk.userId) ?? 0;
    strengthByUser.set(entry.folk.userId, prev + folkStrength(entry.folk.kind));
  }

  let maxStrength = 0;
  for (const s of strengthByUser.values()) {
    if (s > maxStrength) maxStrength = s;
  }

  const winners: string[] = [];
  for (const [uid, s] of strengthByUser.entries()) {
    if (s === maxStrength && maxStrength > 0) {
      winners.push(uid);
    }
  }

  const points = computeFeaturePoints(feature, isEndGame);
  for (const uid of winners) {
    const player = state.players.find((p) => p.userId === uid);
    if (player) {
      player.score += points;
      if (!isEndGame) {
        player.completedFeatures += 1;
      }
    }
  }

  // Return all Folk tokens placed on this feature back to their owners' supplies
  const returnedFolk: Array<{ userId: string; kind: FolkKind; x: number; y: number }> = [];
  for (const entry of feature.folkEntries) {
    const tile = state.board[tileKey(entry.x, entry.y)];
    if (tile && tile.folk && tile.folk.segmentId === entry.folk.segmentId) {
      delete tile.folk;
    }
    const owner = state.players.find((p) => p.userId === entry.folk.userId);
    if (owner) {
      if (entry.folk.kind === "MAYOR") owner.mayorsLeft += 1;
      else owner.villagersLeft += 1;
    }
    returnedFolk.push({
      userId: entry.folk.userId,
      kind: entry.folk.kind,
      x: entry.x,
      y: entry.y,
    });
  }

  events.push({
    type: "FEATURE_SCORED",
    kind: feature.kind,
    coords: feature.tileCoords,
    points,
    winners,
    returnedFolk,
    isEndGame,
  });

  return {
    kind: feature.kind,
    points,
    winners,
    coords: feature.tileCoords,
    isEndGame,
  };
}

/**
 * Checks all completed features touched by placing a tile at (tx, ty), scores them,
 * and returns their Folk tokens immediately.
 */
function scoreCompletedAroundTile(
  state: HearthvaleState,
  tx: number,
  ty: number,
  events: HearthvaleEvent[]
): void {
  const placed = state.board[tileKey(tx, ty)];
  if (!placed) return;

  const seenKeys = new Set<string>();
  const tpl = getTileTemplate(placed.templateId);

  // 1. Check every segment on the placed tile (TOWN, ROAD, or self-SHRINE)
  for (const seg of tpl.segments) {
    const feat = evaluateFeature(state.board, tx, ty, seg.id);
    if (!feat || !feat.isComplete || seenKeys.has(feat.canonicalKey)) continue;
    seenKeys.add(feat.canonicalKey);
    awardAndReturnFeature(state, feat, false, events);
  }

  // 2. Check all 8 surrounding tiles for any Windmill (SHRINE) completed by this placement
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = tx + dx;
      const ny = ty + dy;
      const neighbor = state.board[tileKey(nx, ny)];
      if (!neighbor) continue;
      const nTpl = getTileTemplate(neighbor.templateId);
      if (!nTpl.hasShrine) continue;
      const shrineSeg = nTpl.segments.find((s) => s.kind === "SHRINE");
      if (!shrineSeg) continue;
      const feat = evaluateFeature(state.board, nx, ny, shrineSeg.id);
      if (!feat || !feat.isComplete || seenKeys.has(feat.canonicalKey)) continue;
      seenKeys.add(feat.canonicalKey);
      awardAndReturnFeature(state, feat, false, events);
    }
  }
}

/**
 * Ensures any unplaceable tiles in a player's hand are cleanly replaced from the deck
 * so no player is ever deadlocked by an impossible draw.
 */
function ensurePlayableHand(
  state: HearthvaleState,
  player: HearthvalePlayerState,
  events: HearthvaleEvent[]
): boolean {
  let replacedAny = false;
  for (let i = 0; i < player.hand.length; i++) {
    const tile = player.hand[i]!;
    if (getValidPlacementsForTemplate(state.board, tile.templateId).length > 0) {
      continue;
    }

    // Current tile has 0 valid spots anywhere on the board — try replacing from deck!
    let replacement: HearthvaleTile | null = null;
    while (state.deck.length > 0) {
      const candidate = state.deck.shift()!;
      if (getValidPlacementsForTemplate(state.board, candidate.templateId).length > 0) {
        replacement = candidate;
        break;
      }
      // Candidate is also unplaceable right now; discard it cleanly
    }

    if (replacement) {
      player.hand[i] = replacement;
      replacedAny = true;
    } else {
      player.hand.splice(i, 1);
      i -= 1;
      replacedAny = true;
    }
  }

  if (replacedAny) {
    events.push({ type: "TILE_REDRAWN", actorId: player.userId });
  }

  return player.hand.some(
    (t) => getValidPlacementsForTemplate(state.board, t.templateId).length > 0
  );
}

function finalizeMatch(state: HearthvaleState, events: HearthvaleEvent[]): void {
  const seenKeys = new Set<string>();
  const endGameAwards: ScoreLogEntry[] = [];

  for (const tile of Object.values(state.board)) {
    if (!tile.folk) continue;
    const feat = evaluateFeature(state.board, tile.x, tile.y, tile.folk.segmentId);
    if (!feat || seenKeys.has(feat.canonicalKey)) continue;
    seenKeys.add(feat.canonicalKey);
    const entry = awardAndReturnFeature(state, feat, true, events);
    if (entry) endGameAwards.push(entry);
  }

  // Determine winner(s): highest score, tie-breaker most completedFeatures
  let bestScore = -1;
  let bestCompleted = -1;
  for (const p of state.players) {
    if (
      p.score > bestScore ||
      (p.score === bestScore && p.completedFeatures > bestCompleted)
    ) {
      bestScore = p.score;
      bestCompleted = p.completedFeatures;
    }
  }

  const winners = state.players
    .filter((p) => p.score === bestScore && p.completedFeatures === bestCompleted)
    .map((p) => p.userId);

  const scores: Record<string, number> = {};
  for (const p of state.players) {
    scores[p.userId] = p.score;
  }

  state.phase = "COMPLETED";
  state.turnStep = "PLACE_TILE";
  state.pendingTileCoord = null;
  state.endGameSummary = {
    winners,
    scores,
    endGameAwards,
  };

  events.push({
    type: "MATCH_ENDED",
    winners,
    scores,
  });
}

function finishTurnAndAdvance(
  state: HearthvaleState,
  placedX: number,
  placedY: number,
  events: HearthvaleEvent[]
): void {
  // 1. Score completed features around the newly placed tile
  scoreCompletedAroundTile(state, placedX, placedY, events);

  // 2. Refill active player's hand up to HAND_SIZE
  const active = state.players[state.activePlayerIndex]!;
  while (active.hand.length < HAND_SIZE && state.deck.length > 0) {
    active.hand.push(state.deck.shift()!);
  }

  state.pendingTileCoord = null;
  state.turnStep = "PLACE_TILE";
  state.turnNumber += 1;

  // 3. Advance clockwise to next player who has a playable tile
  const total = state.players.length;
  for (let step = 1; step <= total; step++) {
    const nextIdx = (state.activePlayerIndex + step) % total;
    const candidate = state.players[nextIdx]!;
    while (candidate.hand.length < HAND_SIZE && state.deck.length > 0) {
      candidate.hand.push(state.deck.shift()!);
    }
    if (ensurePlayableHand(state, candidate, events)) {
      state.activePlayerIndex = nextIdx;
      return;
    }
  }

  // 4. Nobody has any playable tiles left -> run End-of-Game scoring!
  finalizeMatch(state, events);
}

export function clearHearthvaleAfk(
  state: HearthvaleState,
  userId: string
): HearthvaleState {
  const next = cloneState(state);
  const p = next.players.find((pl) => pl.userId === userId);
  if (p) {
    p.consecutiveTimeouts = 0;
    p.autoPass = false;
  }
  return next;
}

export const HearthvaleModule: GameModule<
  HearthvaleState,
  HearthvaleAction,
  HearthvalePublicState,
  HearthvalePrivateState,
  HearthvalePublicState,
  HearthvaleEvent,
  Partial<HearthvaleConfig>
> = {
  slug: "hearthvale",
  title: "Hearthvale",
  minPlayers: 2,
  maxPlayers: 5,

  createInitialState(
    players: GamePlayerSeed[],
    config: Partial<HearthvaleConfig> = {},
    rngSeed: number
  ): HearthvaleState {
    if (players.length < 2 || players.length > 5) {
      throw new Error("Hearthvale requires between 2 and 5 players.");
    }

    const fullConfig: HearthvaleConfig = {
      deckSize: config.deckSize === 54 ? 54 : DEFAULT_CONFIG.deckSize,
      turnSeconds: config.turnSeconds ?? DEFAULT_CONFIG.turnSeconds,
    };

    const { shuffled: shuffledDeck, nextSeed } = shuffleDeterministic(
      buildHearthvaleDeck(fullConfig.deckSize),
      rngSeed
    );

    const sortedPlayers = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
    const playerStates: HearthvalePlayerState[] = sortedPlayers.map((p, idx) => ({
      userId: p.userId,
      displayName: p.displayName,
      seatIndex: p.seatIndex,
      color: PLAYER_COLORS[idx % PLAYER_COLORS.length]!,
      score: 0,
      completedFeatures: 0,
      villagersLeft: INITIAL_VILLAGERS,
      mayorsLeft: INITIAL_MAYORS,
      hand: shuffledDeck.splice(0, HAND_SIZE),
      consecutiveTimeouts: 0,
      autoPass: false,
    }));

    const startTile: PlacedTile = {
      tileId: "hv_start_0",
      templateId: START_TILE_TEMPLATE.templateId,
      x: 0,
      y: 0,
      rotation: 0,
      placedBy: "system",
    };

    const state: HearthvaleState = {
      config: fullConfig,
      phase: "IN_PROGRESS",
      turnStep: "PLACE_TILE",
      turnNumber: 1,
      activePlayerIndex: 0,
      rngState: nextSeed,
      players: playerStates,
      board: {
        [tileKey(0, 0)]: startTile,
      },
      deck: shuffledDeck,
      pendingTileCoord: null,
      recentEvents: [],
      endGameSummary: null,
    };

    const events: HearthvaleEvent[] = [
      {
        type: "MATCH_STARTED",
        startingPlayerId: playerStates[0]!.userId,
        deckCount: shuffledDeck.length,
      },
    ];
    ensurePlayableHand(state, playerStates[0]!, events);
    appendEvents(state, events);
    return state;
  },

  validateAction(
    state: HearthvaleState,
    playerId: string,
    action: HearthvaleAction
  ): ActionValidationResult {
    if (state.phase !== "IN_PROGRESS") {
      return { valid: false, code: "NOT_IN_PROGRESS", message: "Match has already ended." };
    }

    const active = state.players[state.activePlayerIndex];
    if (!active || active.userId !== playerId) {
      return { valid: false, code: "NOT_YOUR_TURN", message: "It is not your turn." };
    }

    if (action.type === "PLACE_TILE") {
      if (state.turnStep !== "PLACE_TILE") {
        return {
          valid: false,
          code: "WRONG_STEP",
          message: "Finish placing or skipping your Folk token first.",
        };
      }
      const tile = active.hand.find((t) => t.id === action.tileId);
      if (!tile) {
        return { valid: false, code: "TILE_NOT_IN_HAND", message: "That tile is not in your hand." };
      }
      if (!canPlaceTileAt(state.board, tile.templateId, action.x, action.y, action.rotation)) {
        return {
          valid: false,
          code: "INVALID_PLACEMENT",
          message: "Tile edges must match all neighboring roads, towns, and meadows.",
        };
      }
      return { valid: true };
    }

    if (action.type === "SKIP_CLAIM") {
      if (state.turnStep !== "PLACE_FOLK" || !state.pendingTileCoord) {
        return { valid: false, code: "WRONG_STEP", message: "Place a tile first." };
      }
      return { valid: true };
    }

    if (action.type === "CLAIM_FEATURE") {
      if (state.turnStep !== "PLACE_FOLK" || !state.pendingTileCoord) {
        return { valid: false, code: "WRONG_STEP", message: "Place a tile first." };
      }
      if (action.folkKind === "VILLAGER" && active.villagersLeft <= 0) {
        return { valid: false, code: "NO_VILLAGERS", message: "No Villagers left in your supply." };
      }
      if (action.folkKind === "MAYOR" && active.mayorsLeft <= 0) {
        return { valid: false, code: "NO_MAYOR", message: "Your Mayor is already on the map." };
      }

      const { x, y } = parseTileKey(state.pendingTileCoord);
      const claimable = getClaimableSegmentsAt(state.board, x, y);
      if (!claimable.some((seg) => seg.segmentId === action.segmentId)) {
        return {
          valid: false,
          code: "FEATURE_OCCUPIED",
          message: "That feature is already claimed by another Folk.",
        };
      }
      return { valid: true };
    }

    return { valid: false, code: "UNKNOWN_ACTION", message: "Unknown action." };
  },

  applyAction(
    state: HearthvaleState,
    playerId: string,
    action: HearthvaleAction
  ): ActionApplyResult<HearthvaleState, HearthvaleEvent> {
    const check = this.validateAction(state, playerId, action);
    if (!check.valid) {
      throw new Error(`Invalid Hearthvale action (${check.code}): ${check.message}`);
    }

    const next = cloneState(state);
    const active = next.players[next.activePlayerIndex]!;
    active.consecutiveTimeouts = 0;
    active.autoPass = false;

    const events: HearthvaleEvent[] = [];

    if (action.type === "PLACE_TILE") {
      const tileIdx = active.hand.findIndex((t) => t.id === action.tileId);
      const [tile] = active.hand.splice(tileIdx, 1);
      const key = tileKey(action.x, action.y);

      next.board[key] = {
        tileId: tile!.id,
        templateId: tile!.templateId,
        x: action.x,
        y: action.y,
        rotation: action.rotation,
        placedBy: active.userId,
      };

      events.push({
        type: "TILE_PLACED",
        actorId: active.userId,
        x: action.x,
        y: action.y,
        templateId: tile!.templateId,
        rotation: action.rotation,
      });

      const hasAnyFolk = active.villagersLeft > 0 || active.mayorsLeft > 0;
      const claimable = hasAnyFolk ? getClaimableSegmentsAt(next.board, action.x, action.y) : [];

      if (claimable.length > 0) {
        next.turnStep = "PLACE_FOLK";
        next.pendingTileCoord = key;
      } else {
        // Nothing claimable (or 0 Folk left) -> auto-score & advance seamlessly!
        finishTurnAndAdvance(next, action.x, action.y, events);
      }
    } else if (action.type === "SKIP_CLAIM") {
      const { x, y } = parseTileKey(next.pendingTileCoord!);
      finishTurnAndAdvance(next, x, y, events);
    } else if (action.type === "CLAIM_FEATURE") {
      const key = next.pendingTileCoord!;
      const { x, y } = parseTileKey(key);
      const placed = next.board[key]!;

      placed.folk = {
        userId: active.userId,
        color: active.color,
        kind: action.folkKind,
        segmentId: action.segmentId,
      };
      if (action.folkKind === "MAYOR") active.mayorsLeft -= 1;
      else active.villagersLeft -= 1;

      events.push({
        type: "FOLK_PLACED",
        actorId: active.userId,
        x,
        y,
        segmentId: action.segmentId,
        folkKind: action.folkKind,
      });

      finishTurnAndAdvance(next, x, y, events);
    }

    appendEvents(next, events);
    return { state: next, events };
  },

  onTurnTimeout(state: HearthvaleState): ActionApplyResult<HearthvaleState, HearthvaleEvent> {
    if (state.phase !== "IN_PROGRESS") {
      return { state, events: [] };
    }

    const next = cloneState(state);
    const active = next.players[next.activePlayerIndex]!;
    active.consecutiveTimeouts += 1;
    if (active.consecutiveTimeouts >= 2) {
      active.autoPass = true;
    }

    const events: HearthvaleEvent[] = [];

    if (next.turnStep === "PLACE_FOLK" && next.pendingTileCoord) {
      const { x, y } = parseTileKey(next.pendingTileCoord);
      finishTurnAndAdvance(next, x, y, events);
      appendEvents(next, events);
      return { state: next, events };
    }

    // Step 1 timeout: automatically place the first legal tile & skip claiming
    for (const tile of active.hand) {
      const spots = getValidPlacementsForTemplate(next.board, tile.templateId);
      if (spots.length > 0) {
        const spot = spots[0]!;
        const rot = spot.rotations[0]!;
        const tileIdx = active.hand.findIndex((t) => t.id === tile.id);
        active.hand.splice(tileIdx, 1);

        const key = tileKey(spot.x, spot.y);
        next.board[key] = {
          tileId: tile.id,
          templateId: tile.templateId,
          x: spot.x,
          y: spot.y,
          rotation: rot,
          placedBy: active.userId,
        };

        events.push({
          type: "TILE_PLACED",
          actorId: active.userId,
          x: spot.x,
          y: spot.y,
          templateId: tile.templateId,
          rotation: rot,
          timedOut: true,
        });

        finishTurnAndAdvance(next, spot.x, spot.y, events);
        appendEvents(next, events);
        return { state: next, events };
      }
    }

    // No playable tiles at all -> end match cleanly
    finalizeMatch(next, events);
    appendEvents(next, events);
    return { state: next, events };
  },

  getPublicState(state: HearthvaleState): HearthvalePublicState {
    let claimableSegments: HearthvalePublicState["claimableSegments"] = [];
    if (state.turnStep === "PLACE_FOLK" && state.pendingTileCoord) {
      const { x, y } = parseTileKey(state.pendingTileCoord);
      claimableSegments = getClaimableSegmentsAt(state.board, x, y);
    }

    return {
      config: state.config,
      phase: state.phase,
      turnStep: state.turnStep,
      turnNumber: state.turnNumber,
      activePlayerId: state.players[state.activePlayerIndex]?.userId ?? "",
      deckCount: state.deck.length,
      board: state.board,
      pendingTileCoord: state.pendingTileCoord,
      claimableSegments,
      players: state.players.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        seatIndex: p.seatIndex,
        color: p.color,
        score: p.score,
        completedFeatures: p.completedFeatures,
        villagersLeft: p.villagersLeft,
        mayorsLeft: p.mayorsLeft,
        handCount: p.hand.length,
        autoPass: p.autoPass,
      })),
      recentEvents: state.recentEvents,
      endGameSummary: state.endGameSummary,
    };
  },

  getPrivateState(state: HearthvaleState, playerId: string): HearthvalePrivateState {
    const player = state.players.find((p) => p.userId === playerId);
    return {
      userId: playerId,
      hand: player ? [...player.hand] : [],
    };
  },

  getDisplayState(state: HearthvaleState): HearthvalePublicState {
    return this.getPublicState(state);
  },

  isGameCompleted(state: HearthvaleState): boolean {
    return state.phase === "COMPLETED";
  },

  getResults(state: HearthvaleState): GameResultSummary | null {
    if (state.phase !== "COMPLETED" || !state.endGameSummary) return null;
    const winners = new Set(state.endGameSummary.winners);
    const winnerNames = state.players
      .filter((p) => winners.has(p.userId))
      .map((p) => p.displayName)
      .join(" & ");

    return {
      winningTeam: winnerNames || "Winner",
      headline:
        winners.size > 1
          ? `${winnerNames} tie for Master Architect!`
          : `${winnerNames} wins Hearthvale!`,
      players: state.players.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        score: p.score,
        isWinner: winners.has(p.userId),
        roleLabel: `${p.completedFeatures} completed`,
      })),
    };
  },
};

/**
 * Smart, fun Practice & Substitute Bot AI for Hearthvale.
 * Evaluates its 2-tile hand across all legal placements & feature claims!
 */
export function pickHearthvaleBotAction(
  state: HearthvaleState,
  botId: string
): HearthvaleAction | null {
  if (state.phase !== "IN_PROGRESS") return null;
  const bot = state.players[state.activePlayerIndex];
  if (!bot || bot.userId !== botId) return null;

  // Step 2: Decide whether to claim a feature (and whether to deploy the Mayor!)
  if (state.turnStep === "PLACE_FOLK" && state.pendingTileCoord) {
    const { x, y } = parseTileKey(state.pendingTileCoord);
    const claimable = getClaimableSegmentsAt(state.board, x, y);
    if (claimable.length === 0) return { type: "SKIP_CLAIM" };

    const totalFolk = bot.villagersLeft + bot.mayorsLeft;
    if (totalFolk <= 0) return { type: "SKIP_CLAIM" };

    let bestClaim: { segId: string; folkKind: FolkKind; score: number } | null = null;
    for (const seg of claimable) {
      const feat = evaluateFeature(state.board, x, y, seg.segmentId);
      if (!feat) continue;

      let value = 0;
      if (seg.kind === "SHRINE") {
        // Windmills are super valuable if plenty of tiles remain or already well-surrounded!
        value = feat.shrineFillCount * 2 + (state.deck.length >= 10 ? 7 : 2);
      } else if (seg.kind === "TOWN") {
        const pts = computeFeaturePoints(feat, false);
        value = feat.isComplete ? pts * 4 : pts * 2.2 + feat.crestCount * 4 + 3;
      } else {
        // ROAD
        const pts = computeFeaturePoints(feat, false);
        value = feat.isComplete
          ? pts * 3.5
          : pts * 1.4 + (feat.lanternCount > 0 ? 5 : 0);
      }

      // Keep 1 reserve Folk late-game unless the feature completes immediately or scores high
      const threshold = totalFolk === 1 && !feat.isComplete ? 7 : 2;
      if (value < threshold) continue;

      // Save the Mayor for strong Towns or big Lantern Roads (or if out of Villagers)
      let folkKind: FolkKind = "VILLAGER";
      if (bot.villagersLeft === 0) {
        folkKind = "MAYOR";
      } else if (
        bot.mayorsLeft > 0 &&
        seg.kind === "TOWN" &&
        !feat.isComplete &&
        (feat.crestCount > 0 || feat.tileCoords.length >= 2)
      ) {
        folkKind = "MAYOR";
      }

      if (!bestClaim || value > bestClaim.score) {
        bestClaim = { segId: seg.segmentId, folkKind, score: value };
      }
    }

    if (bestClaim) {
      return {
        type: "CLAIM_FEATURE",
        segmentId: bestClaim.segId,
        folkKind: bestClaim.folkKind,
      };
    }
    return { type: "SKIP_CLAIM" };
  }

  // Step 1: Score every legal (tile, x, y, rotation) in the 2-tile hand
  let bestMove: { action: HearthvaleAction; score: number } | null = null;

  for (const tile of bot.hand) {
    const spots = getValidPlacementsForTemplate(state.board, tile.templateId);
    const tpl = getTileTemplate(tile.templateId);

    for (const spot of spots) {
      for (const rot of spot.rotations) {
        // Simulate placing tile onto a shallow board copy
        const simBoard: Record<string, PlacedTile> = {
          ...state.board,
          [tileKey(spot.x, spot.y)]: {
            tileId: tile.id,
            templateId: tile.templateId,
            x: spot.x,
            y: spot.y,
            rotation: rot,
            placedBy: botId,
          },
        };

        let moveScore = 0;

        // Reward surrounding our own Windmills & avoid helping opponent Windmills slightly
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nb = state.board[tileKey(spot.x + dx, spot.y + dy)];
            if (nb?.folk) {
              const nbTpl = getTileTemplate(nb.templateId);
              if (nbTpl.hasShrine && nb.folk.segmentId === "shrine") {
                moveScore += nb.folk.userId === botId ? 7 : -2;
              }
            }
          }
        }

        // Evaluate all segments on this simulated tile
        for (const seg of tpl.segments) {
          const feat = evaluateFeature(simBoard, spot.x, spot.y, seg.id);
          if (!feat) continue;

          if (seg.kind === "SHRINE") {
            if (bot.villagersLeft + bot.mayorsLeft > 0) {
              moveScore += feat.shrineFillCount * 2.5 + 4;
            }
            continue;
          }

          let myStrength = 0;
          let oppMax = 0;
          const oppTotals = new Map<string, number>();
          for (const f of feat.folkEntries) {
            const w = folkStrength(f.folk.kind);
            if (f.folk.userId === botId) myStrength += w;
            else oppTotals.set(f.folk.userId, (oppTotals.get(f.folk.userId) ?? 0) + w);
          }
          for (const s of oppTotals.values()) if (s > oppMax) oppMax = s;

          const pts = computeFeaturePoints(feat, false);

          if (feat.isComplete) {
            if (myStrength > 0 && myStrength >= oppMax) {
              moveScore += pts * 5 + 8; // Instant score + return our Folk!
            } else if (myStrength === 0 && oppMax === 0 && bot.villagersLeft + bot.mayorsLeft > 0) {
              moveScore += pts * 4.5 + 5; // Place & immediately claim completed feature!
            } else if (oppMax > myStrength) {
              moveScore -= pts * 3; // Avoid gifting opponents free completions
            }
          } else {
            if (myStrength > 0 && myStrength >= oppMax) {
              moveScore += seg.kind === "TOWN" ? 5 + feat.crestCount * 2 : 3 + feat.lanternCount * 2;
            } else if (myStrength === 0 && oppMax === 0 && bot.villagersLeft + bot.mayorsLeft > 0) {
              moveScore += seg.kind === "TOWN" ? 4 + feat.crestCount * 2 : 2 + feat.lanternCount * 2;
            }
          }
        }

        // Slight preference for compact cozy valley growth near center
        moveScore -= (Math.abs(spot.x) + Math.abs(spot.y)) * 0.15;

        if (!bestMove || moveScore > bestMove.score) {
          bestMove = {
            score: moveScore,
            action: {
              type: "PLACE_TILE",
              tileId: tile.id,
              x: spot.x,
              y: spot.y,
              rotation: rot,
            },
          };
        }
      }
    }
  }

  return bestMove?.action ?? null;
}
