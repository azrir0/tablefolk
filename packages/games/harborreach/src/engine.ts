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
  computeLongestRoadForPlayer,
  generateIslandBoard,
  getBanditStealCandidates,
  getPlayerTradeRates,
  getValidCottageVertices,
  getValidRoadEdges,
  getValidSetupRoadEdges,
  getValidSetupVertices,
  getValidTownVertices,
} from "./board.js";
import {
  BUILD_COSTS,
  RESOURCES,
  RESOURCE_META,
  SCROLL_META,
  type HarborAction,
  type HarborConfig,
  type HarborDisplayState,
  type HarborEvent,
  type HarborLogEntry,
  type HarborPlayerState,
  type HarborPrivateState,
  type HarborPublicPlayer,
  type HarborPublicState,
  type HarborState,
  type ResourcePool,
  type ResourceType,
  type ScrollCard,
  type ScrollKind,
} from "./types.js";

export const MAX_ROADS = 15;
export const MAX_COTTAGES = 5;
export const MAX_TOWNS = 4;
export const COMPASS_CHARGE_THRESHOLD = 3;

const DEFAULT_CONFIG: HarborConfig = {
  targetVP: 10,
  turnSeconds: 45,
};

export function createEmptyResources(): ResourcePool {
  return { timber: 0, clay: 0, wool: 0, grain: 0, ore: 0 };
}

export function countResources(pool: ResourcePool): number {
  return pool.timber + pool.clay + pool.wool + pool.grain + pool.ore;
}

export function hasResources(
  pool: ResourcePool,
  cost: Partial<Record<ResourceType, number>>
): boolean {
  for (const r of RESOURCES) {
    if (pool[r] < (cost[r] ?? 0)) return false;
  }
  return true;
}

function spendResources(
  pool: ResourcePool,
  cost: Partial<Record<ResourceType, number>>
) {
  for (const r of RESOURCES) {
    pool[r] -= cost[r] ?? 0;
  }
}

function buildScrollDeck(seed: number): { deck: ScrollCard[]; nextSeed: number } {
  const kinds: ScrollKind[] = [
    ...Array<ScrollKind>(14).fill("knight"),
    ...Array<ScrollKind>(5).fill("victory_point"),
    ...Array<ScrollKind>(2).fill("road_builder"),
    ...Array<ScrollKind>(2).fill("year_of_plenty"),
    ...Array<ScrollKind>(2).fill("monopoly"),
  ];
  const { shuffled, nextSeed } = shuffleDeterministic(kinds, seed);
  return {
    deck: shuffled.map((kind, i) => ({
      id: `scr_${i + 1}_${kind}`,
      kind,
      boughtOnTurn: 0,
    })),
    nextSeed,
  };
}

function cloneState(state: HarborState): HarborState {
  return structuredClone(state);
}

function appendLog(
  state: HarborState,
  actorId: string | null,
  actorName: string,
  text: string,
  kind: HarborLogEntry["kind"]
) {
  state.log.unshift({
    id: state.nextLogId++,
    turn: state.turnNumber,
    actorId,
    actorName,
    text,
    kind,
  });
  if (state.log.length > 48) state.log.length = 48;
}

export function computePlayerPublicVP(state: HarborState, player: HarborPlayerState): number {
  let vp = 0;
  for (const b of Object.values(state.buildings)) {
    if (b.ownerId === player.userId) {
      vp += b.kind === "town" ? 2 : 1;
    }
  }
  if (state.longestRoadOwnerId === player.userId) vp += 2;
  if (state.largestWatchOwnerId === player.userId) vp += 2;
  return vp;
}

export function computePlayerTotalVP(state: HarborState, player: HarborPlayerState): number {
  return computePlayerPublicVP(state, player) + player.vpScrollsCount;
}

function recomputeLongestRoadAward(state: HarborState, events: HarborEvent[]) {
  for (const p of state.players) {
    p.longestRoadLength = computeLongestRoadForPlayer(
      state.board,
      state.buildings,
      state.roads,
      p.userId
    );
  }

  const prevOwner = state.longestRoadOwnerId;
  const maxLen = Math.max(...state.players.map((p) => p.longestRoadLength));

  if (maxLen < 5) {
    state.longestRoadOwnerId = null;
    state.longestRoadLength = maxLen;
    return;
  }

  // If previous owner still holds >= 5 and is tied for max (nobody strictly beat them), keep it!
  if (prevOwner) {
    const prevPlayer = state.players.find((p) => p.userId === prevOwner);
    if (prevPlayer && prevPlayer.longestRoadLength >= 5 && prevPlayer.longestRoadLength === maxLen) {
      state.longestRoadLength = maxLen;
      return;
    }
  }

  // Otherwise check if there is a unique strict leader >= 5
  const leaders = state.players.filter((p) => p.longestRoadLength === maxLen);
  if (leaders.length === 1) {
    const newOwner = leaders[0]!;
    state.longestRoadOwnerId = newOwner.userId;
    state.longestRoadLength = maxLen;
    if (newOwner.userId !== prevOwner) {
      const summary = `${newOwner.displayName} claimed Longest Trade Route (${maxLen} roads, +2 VP)!`;
      appendLog(state, newOwner.userId, newOwner.displayName, summary, "system");
      events.push({
        type: "AWARD_CLAIMED",
        actorId: newOwner.userId,
        actorName: newOwner.displayName,
        summary,
        payload: { award: "longest_road", length: maxLen },
      });
    }
  } else {
    // Tied after previous owner's road was split -> award temporarily unclaimed until someone leads
    state.longestRoadOwnerId = null;
    state.longestRoadLength = maxLen;
  }
}

function recomputeLargestWatchAward(state: HarborState, actor: HarborPlayerState, events: HarborEvent[]) {
  if (actor.knightsPlayed < 3) return;
  if (actor.knightsPlayed > state.largestWatchCount) {
    const prev = state.largestWatchOwnerId;
    state.largestWatchOwnerId = actor.userId;
    state.largestWatchCount = actor.knightsPlayed;
    if (prev !== actor.userId) {
      const summary = `${actor.displayName} claimed Largest Harbor Watch (${actor.knightsPlayed} Scouts, +2 VP)!`;
      appendLog(state, actor.userId, actor.displayName, summary, "system");
      events.push({
        type: "AWARD_CLAIMED",
        actorId: actor.userId,
        actorName: actor.displayName,
        summary,
        payload: { award: "largest_watch", count: actor.knightsPlayed },
      });
    }
  }
}

function buildResults(state: HarborState): GameResultSummary {
  const sorted = [...state.players].sort((a, b) => {
    const vpDiff = computePlayerTotalVP(state, b) - computePlayerTotalVP(state, a);
    if (vpDiff !== 0) return vpDiff;
    return countResources(b.resources) - countResources(a.resources);
  });
  const topVP = computePlayerTotalVP(state, sorted[0]!);
  const winners = sorted.filter((p) => computePlayerTotalVP(state, p) === topVP);
  const winnerSet = new Set(winners.map((w) => w.userId));

  const headline =
    winners.length === 1
      ? `${winners[0]!.displayName} rules Harborreach with ${topVP} Victory Points!`
      : `Shared Crown! ${winners.map((w) => w.displayName).join(" & ")} tie at ${topVP} VP!`;

  return {
    winningTeam: winners.map((w) => w.displayName).join(" & "),
    headline,
    players: sorted.map((p) => {
      const awards: string[] = [];
      if (state.longestRoadOwnerId === p.userId) awards.push("Longest Route");
      if (state.largestWatchOwnerId === p.userId) awards.push("Largest Watch");
      if (p.vpScrollsCount > 0) awards.push(`${p.vpScrollsCount} Landmark`);
      return {
        userId: p.userId,
        displayName: p.displayName,
        score: computePlayerTotalVP(state, p),
        isWinner: winnerSet.has(p.userId),
        roleLabel: awards.length > 0 ? awards.join(" · ") : `${p.longestRoadLength} road chain`,
      };
    }),
  };
}

function checkVictory(state: HarborState, events: HarborEvent[]): boolean {
  const actor = state.players[state.activePlayerIndex]!;
  if (computePlayerTotalVP(state, actor) >= state.config.targetVP) {
    finishGame(state, events);
    return true;
  }
  return false;
}

function finishGame(state: HarborState, events: HarborEvent[]) {
  state.phase = "GAME_END";
  state.activeTrade = null;
  state.pendingDiscardUserIds = [];
  state.freeRoadsLeft = 0;
  const results = buildResults(state);
  state.results = results;
  state.winnerIds = results.players.filter((p) => p.isWinner).map((p) => p.userId);
  appendLog(state, null, "Harbor Herald", results.headline, "system");
  events.push({
    type: "GAME_FINISHED",
    summary: results.headline,
    payload: { winnerIds: state.winnerIds },
  });
}

function drawDie(state: HarborState): number {
  const r = nextRandom(state.rngState);
  state.rngState = r.nextSeed;
  return Math.floor(r.value * 6) + 1;
}

function pickRandomResourceFromHand(
  state: HarborState,
  victim: HarborPlayerState
): ResourceType | null {
  const bag: ResourceType[] = [];
  for (const r of RESOURCES) {
    for (let i = 0; i < victim.resources[r]; i++) bag.push(r);
  }
  if (bag.length === 0) return null;
  const rnd = nextRandom(state.rngState);
  state.rngState = rnd.nextSeed;
  return bag[Math.floor(rnd.value * bag.length)]!;
}

export function clearHarborAfk(state: HarborState, userId: string): HarborState {
  const idx = state.players.findIndex((p) => p.userId === userId);
  if (idx < 0 || state.players[idx]!.consecutiveTimeouts === 0) return state;
  const next = cloneState(state);
  next.players[idx]!.consecutiveTimeouts = 0;
  return next;
}

export const HarborreachModule: GameModule<
  HarborState,
  HarborAction,
  HarborPublicState,
  HarborPrivateState,
  HarborDisplayState,
  HarborEvent,
  Partial<HarborConfig>
> = {
  slug: "harborreach",
  title: "Harborreach",
  minPlayers: 2,
  maxPlayers: 4,

  createInitialState(
    players: GamePlayerSeed[],
    rawConfig: Partial<HarborConfig> = {},
    rngSeed: number
  ): HarborState {
    if (players.length < 2 || players.length > 4) {
      throw new Error(`Harborreach supports 2–4 players (got ${players.length}).`);
    }

    const config: HarborConfig = {
      targetVP: rawConfig.targetVP === 8 ? 8 : DEFAULT_CONFIG.targetVP,
      turnSeconds: rawConfig.turnSeconds ?? DEFAULT_CONFIG.turnSeconds,
    };

    const { board, nextSeed: seed1 } = generateIslandBoard(rngSeed);
    const { deck: scrollDeck, nextSeed: seed2 } = buildScrollDeck(seed1);
    const desertHex = board.hexes.find((h) => h.terrain === "desert") ?? board.hexes[9]!;

    const ordered = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
    const playerStates: HarborPlayerState[] = ordered.map((p, idx) => ({
      userId: p.userId,
      displayName: p.displayName,
      seatIndex: p.seatIndex,
      colorIndex: idx,
      resources: createEmptyResources(),
      scrolls: [],
      knightsPlayed: 0,
      vpScrollsCount: 0,
      compassCharges: 0,
      roadsRemaining: MAX_ROADS,
      cottagesRemaining: MAX_COTTAGES,
      townsRemaining: MAX_TOWNS,
      longestRoadLength: 0,
      consecutiveTimeouts: 0,
    }));

    // Snake draft founding order: [0, 1, ..., n-1, n-1, ..., 1, 0]
    const forward = playerStates.map((_, i) => i);
    const setupOrder = [...forward, ...[...forward].reverse()];

    const state: HarborState = {
      config,
      phase: "IN_PROGRESS",
      step: "SETUP_SETTLE",
      roundNumber: 0,
      turnNumber: 1,
      setupOrder,
      setupCursor: 0,
      setupLastVertexId: null,
      activePlayerIndex: setupOrder[0]!,
      board,
      buildings: {},
      roads: {},
      banditHexId: desertHex.id,
      scrollDeck,
      lastDice: null,
      playedScrollThisTurn: false,
      freeRoadsLeft: 0,
      pendingDiscardUserIds: [],
      longestRoadOwnerId: null,
      longestRoadLength: 0,
      largestWatchOwnerId: null,
      largestWatchCount: 0,
      activeTrade: null,
      players: playerStates,
      winnerIds: [],
      results: null,
      log: [],
      nextLogId: 1,
      nextTradeId: 1,
      rngState: seed2,
    };

    appendLog(
      state,
      null,
      "Harbor Herald",
      `Welcome to Harborreach! Found 2 starting Cottages — first to ${config.targetVP} VP claims the Island!`,
      "system"
    );

    return state;
  },

  validateAction(
    state: HarborState,
    playerId: string,
    action: HarborAction
  ): ActionValidationResult {
    if (state.phase !== "IN_PROGRESS") {
      return { valid: false, code: "GAME_ENDED", message: "This match has already finished." };
    }

    const player = state.players.find((p) => p.userId === playerId);
    if (!player) {
      return { valid: false, code: "NOT_PLAYER", message: "You are not seated in this match." };
    }

    // 1. Out-of-turn allowed actions: DISCARD_RESOURCES & RESPOND_TRADE!
    if (action.type === "DISCARD_RESOURCES") {
      if (state.step !== "DISCARD_RESOURCES") {
        return { valid: false, code: "WRONG_STEP", message: "No resource discard is active." };
      }
      if (!state.pendingDiscardUserIds.includes(playerId)) {
        return { valid: false, code: "ALREADY_DISCARDED", message: "You do not need to discard." };
      }
      const needed = Math.floor(countResources(player.resources) / 2);
      const given = countResources(action.resources);
      if (given !== needed) {
        return {
          valid: false,
          code: "WRONG_DISCARD_COUNT",
          message: `Discard exactly ${needed} resource${needed === 1 ? "" : "s"}.`,
        };
      }
      if (!hasResources(player.resources, action.resources)) {
        return {
          valid: false,
          code: "INSUFFICIENT_RESOURCES",
          message: "You cannot discard resources you don't hold.",
        };
      }
      return { valid: true };
    }

    if (action.type === "RESPOND_TRADE") {
      if (state.step !== "MAIN_PHASE" || !state.activeTrade) {
        return { valid: false, code: "NO_ACTIVE_TRADE", message: "That trade offer is no longer open." };
      }
      if (state.activeTrade.id !== action.tradeId) {
        return { valid: false, code: "STALE_TRADE", message: "That trade offer has changed." };
      }
      if (state.activeTrade.fromUserId === playerId) {
        return { valid: false, code: "OWN_TRADE", message: "You cannot respond to your own trade." };
      }
      if (state.activeTrade.declinedByUserIds.includes(playerId)) {
        return { valid: false, code: "ALREADY_DECLINED", message: "You already declined this offer." };
      }
      if (action.accept && !hasResources(player.resources, state.activeTrade.want)) {
        return {
          valid: false,
          code: "CANNOT_FULFILL_TRADE",
          message: "You don't hold the requested resources for this trade.",
        };
      }
      return { valid: true };
    }

    // All other actions require being the active player
    const active = state.players[state.activePlayerIndex];
    if (!active || active.userId !== playerId) {
      return { valid: false, code: "NOT_YOUR_TURN", message: "Wait for your turn!" };
    }

    if (state.step === "SETUP_SETTLE") {
      if (action.type !== "SETUP_PLACE_COTTAGE") {
        return { valid: false, code: "MUST_SETUP_SETTLE", message: "Place your starting Cottage on a glowing vertex." };
      }
      const valid = getValidSetupVertices(state.board, state.buildings);
      if (!valid.includes(action.vertexId)) {
        return { valid: false, code: "INVALID_VERTEX", message: "Cottages must be at least 2 roads away from other buildings." };
      }
      return { valid: true };
    }

    if (state.step === "SETUP_ROAD") {
      if (action.type !== "SETUP_PLACE_ROAD") {
        return { valid: false, code: "MUST_SETUP_ROAD", message: "Place a starting Road touching your new Cottage." };
      }
      const valid =
        state.setupLastVertexId !== null
          ? getValidSetupRoadEdges(state.board, state.roads, state.setupLastVertexId)
          : [];
      if (!valid.includes(action.edgeId)) {
        return { valid: false, code: "INVALID_EDGE", message: "Pick a glowing road touching the Cottage you just placed." };
      }
      return { valid: true };
    }

    if (state.step === "DISCARD_RESOURCES") {
      return {
        valid: false,
        code: "WAITING_DISCARDS",
        message: "Waiting for pioneers with 8+ cards to discard half.",
      };
    }

    if (state.step === "MOVE_BANDIT") {
      if (action.type !== "MOVE_BANDIT") {
        return { valid: false, code: "MUST_MOVE_BANDIT", message: "Move the Bandit Fox to another land hex!" };
      }
      if (action.hexId < 0 || action.hexId >= state.board.hexes.length) {
        return { valid: false, code: "INVALID_HEX", message: "Choose a valid island hex." };
      }
      if (action.hexId === state.banditHexId) {
        return { valid: false, code: "SAME_HEX", message: "The Bandit Fox must move to a different hex!" };
      }
      const resCounts: Record<string, number> = {};
      for (const p of state.players) resCounts[p.userId] = countResources(p.resources);
      const candidates = getBanditStealCandidates(
        state.board,
        state.buildings,
        action.hexId,
        playerId,
        resCounts
      );
      if (
        action.stealFromUserId &&
        !candidates.includes(action.stealFromUserId)
      ) {
        return { valid: false, code: "INVALID_STEAL_TARGET", message: "That pioneer cannot be robbed on that hex." };
      }
      return { valid: true };
    }

    if (state.step === "FREE_ROADS") {
      if (action.type !== "BUILD_ROAD") {
        return { valid: false, code: "MUST_PLACE_FREE_ROAD", message: `Place your free Road (${state.freeRoadsLeft} left).` };
      }
      const valid = getValidRoadEdges(state.board, state.buildings, state.roads, playerId);
      if (!valid.includes(action.edgeId)) {
        return { valid: false, code: "INVALID_ROAD_EDGE", message: "Choose a glowing edge connected to your network." };
      }
      return { valid: true };
    }

    if (state.step === "ROLL_DICE") {
      if (action.type === "ROLL_DICE") return { valid: true };
      if (action.type === "PLAY_SCROLL") {
        return validatePlayScroll(state, active, action, true);
      }
      return {
        valid: false,
        code: "MUST_ROLL",
        message: "Roll the dice (or play a Ranger Scout Scroll first)!",
      };
    }

    // step === "MAIN_PHASE"
    switch (action.type) {
      case "BUILD_ROAD": {
        if (active.roadsRemaining <= 0) {
          return { valid: false, code: "NO_ROADS_LEFT", message: "All 15 Roads are already on the island." };
        }
        if (!hasResources(active.resources, BUILD_COSTS.road)) {
          return { valid: false, code: "CANNOT_AFFORD", message: "Roads cost 1 Timber + 1 Clay." };
        }
        const valid = getValidRoadEdges(state.board, state.buildings, state.roads, playerId);
        if (!valid.includes(action.edgeId)) {
          return { valid: false, code: "INVALID_ROAD_EDGE", message: "Roads must connect to your existing roads or settlements." };
        }
        return { valid: true };
      }
      case "BUILD_COTTAGE": {
        if (active.cottagesRemaining <= 0) {
          return { valid: false, code: "NO_COTTAGES_LEFT", message: "All 5 Cottages placed — upgrade one into a Town!" };
        }
        if (!hasResources(active.resources, BUILD_COSTS.cottage)) {
          return { valid: false, code: "CANNOT_AFFORD", message: "Cottages cost 1 Timber, 1 Clay, 1 Wool, 1 Grain." };
        }
        const valid = getValidCottageVertices(state.board, state.buildings, state.roads, playerId);
        if (!valid.includes(action.vertexId)) {
          return { valid: false, code: "INVALID_COTTAGE_VERTEX", message: "Cottages must sit on your road network, 2+ roads from any building." };
        }
        return { valid: true };
      }
      case "UPGRADE_TOWN": {
        if (active.townsRemaining <= 0) {
          return { valid: false, code: "NO_TOWNS_LEFT", message: "All 4 Towns are already built!" };
        }
        if (!hasResources(active.resources, BUILD_COSTS.town)) {
          return { valid: false, code: "CANNOT_AFFORD", message: "Towns cost 2 Grain + 3 Ore." };
        }
        const valid = getValidTownVertices(state.buildings, playerId);
        if (!valid.includes(action.vertexId)) {
          return { valid: false, code: "INVALID_TOWN_VERTEX", message: "Choose one of your existing Cottages to upgrade." };
        }
        return { valid: true };
      }
      case "BUY_SCROLL": {
        if (state.scrollDeck.length === 0) {
          return { valid: false, code: "SCROLL_DECK_EMPTY", message: "No Guild Scrolls remain in the deck." };
        }
        if (!hasResources(active.resources, BUILD_COSTS.scroll)) {
          return { valid: false, code: "CANNOT_AFFORD", message: "Guild Scrolls cost 1 Wool, 1 Grain, 1 Ore." };
        }
        return { valid: true };
      }
      case "PLAY_SCROLL":
        return validatePlayScroll(state, active, action, false);
      case "BANK_TRADE": {
        if (action.give === action.receive) {
          return { valid: false, code: "SAME_RESOURCE", message: "Choose two different resources to swap." };
        }
        const rates = getPlayerTradeRates(state.board, state.buildings, playerId);
        const rate = rates[action.give];
        if (active.resources[action.give] < rate) {
          return {
            valid: false,
            code: "INSUFFICIENT_FOR_TRADE",
            message: `Need ${rate} ${RESOURCE_META[action.give].label} for a ${rate}:1 trade.`,
          };
        }
        return { valid: true };
      }
      case "OFFER_TRADE": {
        const giveTotal = countResources(action.give);
        const wantTotal = countResources(action.want);
        if (giveTotal <= 0 || wantTotal <= 0) {
          return { valid: false, code: "EMPTY_TRADE", message: "Offer at least 1 resource and request at least 1 resource." };
        }
        for (const r of RESOURCES) {
          if (action.give[r] > 0 && action.want[r] > 0) {
            return { valid: false, code: "OVERLAP_TRADE", message: "Don't offer and request the same resource." };
          }
        }
        if (!hasResources(active.resources, action.give)) {
          return { valid: false, code: "INSUFFICIENT_RESOURCES", message: "You don't hold all resources in your offer." };
        }
        return { valid: true };
      }
      case "CANCEL_TRADE":
        return state.activeTrade
          ? { valid: true }
          : { valid: false, code: "NO_ACTIVE_TRADE", message: "No active trade offer." };
      case "REDEEM_COMPASS":
        if (active.compassCharges < COMPASS_CHARGE_THRESHOLD) {
          return { valid: false, code: "COMPASS_NOT_READY", message: "Gather 3 Compass Charges on dry rolls first!" };
        }
        return { valid: true };
      case "END_TURN":
        return { valid: true };
      default:
        return { valid: false, code: "WRONG_STEP", message: "Action not valid during Main Phase." };
    }
  },

  applyAction(
    state: HarborState,
    playerId: string,
    action: HarborAction
  ): ActionApplyResult<HarborState, HarborEvent> {
    const check = this.validateAction(state, playerId, action);
    if (!check.valid) throw new Error(check.message);

    const next = cloneState(state);
    const events: HarborEvent[] = [];
    const actor = next.players.find((p) => p.userId === playerId)!;
    actor.consecutiveTimeouts = 0;

    if (action.type === "SETUP_PLACE_COTTAGE") {
      next.buildings[action.vertexId] = { ownerId: playerId, kind: "cottage" };
      actor.cottagesRemaining -= 1;
      next.setupLastVertexId = action.vertexId;
      next.step = "SETUP_ROAD";

      // 2nd Cottage (reverse half of snake draft) immediately harvests 1 resource per adjacent terrain!
      const isSecondPass = next.setupCursor >= next.players.length;
      const gainedLabels: string[] = [];
      if (isSecondPass) {
        const v = next.board.vertices[action.vertexId]!;
        for (const hid of v.hexIds) {
          const hex = next.board.hexes[hid]!;
          if (hex.terrain !== "desert") {
            actor.resources[hex.terrain] += 1;
            gainedLabels.push(RESOURCE_META[hex.terrain].label);
          }
        }
      }
      const summary =
        gainedLabels.length > 0
          ? `${actor.displayName} founded a 2nd Cottage (+${gainedLabels.join(", ")}).`
          : `${actor.displayName} founded a starting Cottage.`;
      appendLog(next, actor.userId, actor.displayName, summary, "build");
      events.push({ type: "SETUP_PLACED", actorId: actor.userId, actorName: actor.displayName, summary });
      return { state: next, events };
    }

    if (action.type === "SETUP_PLACE_ROAD") {
      next.roads[action.edgeId] = playerId;
      actor.roadsRemaining -= 1;
      next.setupLastVertexId = null;
      next.setupCursor += 1;

      if (next.setupCursor < next.setupOrder.length) {
        next.activePlayerIndex = next.setupOrder[next.setupCursor]!;
        next.step = "SETUP_SETTLE";
      } else {
        next.activePlayerIndex = 0;
        next.roundNumber = 1;
        next.step = "ROLL_DICE";
        appendLog(
          next,
          null,
          "Harbor Herald",
          `Founding complete! Round 1 begins — ${next.players[0]!.displayName} rolls the dice!`,
          "system"
        );
      }
      events.push({
        type: "SETUP_PLACED",
        actorId: actor.userId,
        actorName: actor.displayName,
        summary: `${actor.displayName} laid a starting road.`,
      });
      return { state: next, events };
    }

    if (action.type === "ROLL_DICE") {
      const d1 = drawDie(next);
      const d2 = drawDie(next);
      const sum = d1 + d2;
      next.lastDice = [d1, d2];

      if (sum === 7) {
        const summary = `${actor.displayName} rolled 7 (${d1}+${d2}) — Bandit Fox prowls!`;
        appendLog(next, actor.userId, actor.displayName, summary, "bandit");
        events.push({
          type: "DICE_ROLLED",
          actorId: actor.userId,
          actorName: actor.displayName,
          summary,
          payload: { d1, d2, sum },
        });
        const overCap = next.players.filter((p) => countResources(p.resources) > 7);
        if (overCap.length > 0) {
          next.pendingDiscardUserIds = overCap.map((p) => p.userId);
          next.step = "DISCARD_RESOURCES";
        } else {
          next.step = "MOVE_BANDIT";
        }
        return { state: next, events };
      }

      // Produce resources from matching unblocked hexes
      const receivedByUser = new Map<string, number>();
      for (const hex of next.board.hexes) {
        if (hex.numberToken !== sum || hex.id === next.banditHexId || hex.terrain === "desert") {
          continue;
        }
        for (const vid of hex.vertexIds) {
          const b = next.buildings[vid];
          if (!b) continue;
          const owner = next.players.find((p) => p.userId === b.ownerId);
          if (!owner) continue;
          const qty = b.kind === "town" ? 2 : 1;
          owner.resources[hex.terrain] += qty;
          receivedByUser.set(owner.userId, (receivedByUser.get(owner.userId) ?? 0) + qty);
        }
      }

      // Cozy Dry-Spell Compass Twist: +1 charge (max 3) for anyone who harvested 0 on this roll!
      for (const p of next.players) {
        if ((receivedByUser.get(p.userId) ?? 0) === 0 && p.compassCharges < COMPASS_CHARGE_THRESHOLD) {
          p.compassCharges += 1;
        }
      }

      const harvestTotal = Array.from(receivedByUser.values()).reduce((a, b) => a + b, 0);
      const summary =
        harvestTotal > 0
          ? `${actor.displayName} rolled ${sum} (${d1}+${d2}) — ${harvestTotal} resource${harvestTotal === 1 ? "" : "s"} harvested!`
          : `${actor.displayName} rolled ${sum} (${d1}+${d2}) — dry roll (+1 Compass charge).`;
      appendLog(next, actor.userId, actor.displayName, summary, "dice");
      events.push({
        type: "DICE_ROLLED",
        actorId: actor.userId,
        actorName: actor.displayName,
        summary,
        payload: { d1, d2, sum, harvestTotal },
      });
      next.step = "MAIN_PHASE";
      return { state: next, events };
    }

    if (action.type === "DISCARD_RESOURCES") {
      spendResources(actor.resources, action.resources);
      next.pendingDiscardUserIds = next.pendingDiscardUserIds.filter((uid) => uid !== playerId);
      const qty = countResources(action.resources);
      const summary = `${actor.displayName} discarded ${qty} resource${qty === 1 ? "" : "s"} during the Bandit prowl.`;
      appendLog(next, actor.userId, actor.displayName, summary, "bandit");
      events.push({ type: "RESOURCES_DISCARDED", actorId: actor.userId, actorName: actor.displayName, summary });
      if (next.pendingDiscardUserIds.length === 0) {
        next.step = "MOVE_BANDIT";
      }
      return { state: next, events };
    }

    if (action.type === "MOVE_BANDIT") {
      next.banditHexId = action.hexId;
      const resCounts: Record<string, number> = {};
      for (const p of next.players) resCounts[p.userId] = countResources(p.resources);
      const candidates = getBanditStealCandidates(
        next.board,
        next.buildings,
        action.hexId,
        playerId,
        resCounts
      );

      let stolenSummary = "";
      const targetId =
        action.stealFromUserId && candidates.includes(action.stealFromUserId)
          ? action.stealFromUserId
          : candidates.length > 0
            ? candidates[0]!
            : null;
      if (targetId) {
        const victim = next.players.find((p) => p.userId === targetId)!;
        const stolen = pickRandomResourceFromHand(next, victim);
        if (stolen) {
          victim.resources[stolen] -= 1;
          actor.resources[stolen] += 1;
          stolenSummary = ` and swiped 1 card from ${victim.displayName}!`;
        }
      }

      const hex = next.board.hexes[action.hexId]!;
      const hexLabel =
        hex.terrain === "desert"
          ? "the Dune Cove"
          : `${RESOURCE_META[hex.terrain].terrainLabel} (${hex.numberToken ?? "—"})`;
      const summary = `${actor.displayName} moved the Bandit Fox to ${hexLabel}${stolenSummary}`;
      appendLog(next, actor.userId, actor.displayName, summary, "bandit");
      events.push({ type: "BANDIT_MOVED", actorId: actor.userId, actorName: actor.displayName, summary });

      // If Ranger Scout was played BEFORE rolling, return to ROLL_DICE; otherwise enter MAIN_PHASE
      next.step = next.lastDice === null ? "ROLL_DICE" : "MAIN_PHASE";
      checkVictory(next, events);
      return { state: next, events };
    }

    if (action.type === "BUILD_ROAD") {
      const isFree = next.step === "FREE_ROADS";
      if (!isFree) {
        spendResources(actor.resources, BUILD_COSTS.road);
      }
      next.roads[action.edgeId] = playerId;
      actor.roadsRemaining -= 1;
      next.activeTrade = null;

      const summary = isFree
        ? `${actor.displayName} laid a free Road Builder road!`
        : `${actor.displayName} built a Road.`;
      appendLog(next, actor.userId, actor.displayName, summary, "build");
      events.push({ type: "BUILT_ROAD", actorId: actor.userId, actorName: actor.displayName, summary });

      recomputeLongestRoadAward(next, events);

      if (isFree) {
        next.freeRoadsLeft -= 1;
        const moreValid =
          next.freeRoadsLeft > 0 &&
          actor.roadsRemaining > 0 &&
          getValidRoadEdges(next.board, next.buildings, next.roads, playerId).length > 0;
        if (!moreValid) {
          next.freeRoadsLeft = 0;
          next.step = "MAIN_PHASE";
        }
      }

      checkVictory(next, events);
      return { state: next, events };
    }

    if (action.type === "BUILD_COTTAGE") {
      spendResources(actor.resources, BUILD_COSTS.cottage);
      next.buildings[action.vertexId] = { ownerId: playerId, kind: "cottage" };
      actor.cottagesRemaining -= 1;
      next.activeTrade = null;

      const summary = `${actor.displayName} built a cozy Cottage (+1 VP)!`;
      appendLog(next, actor.userId, actor.displayName, summary, "build");
      events.push({ type: "BUILT_COTTAGE", actorId: actor.userId, actorName: actor.displayName, summary });

      // Building a Cottage can split an opponent's Longest Trade Route!
      recomputeLongestRoadAward(next, events);
      checkVictory(next, events);
      return { state: next, events };
    }

    if (action.type === "UPGRADE_TOWN") {
      spendResources(actor.resources, BUILD_COSTS.town);
      next.buildings[action.vertexId] = { ownerId: playerId, kind: "town" };
      actor.townsRemaining -= 1;
      actor.cottagesRemaining += 1;
      next.activeTrade = null;

      const summary = `${actor.displayName} upgraded a Cottage into a bustling Town (+1 VP, 2× harvest)!`;
      appendLog(next, actor.userId, actor.displayName, summary, "build");
      events.push({ type: "UPGRADED_TOWN", actorId: actor.userId, actorName: actor.displayName, summary });

      checkVictory(next, events);
      return { state: next, events };
    }

    if (action.type === "BUY_SCROLL") {
      spendResources(actor.resources, BUILD_COSTS.scroll);
      const card = next.scrollDeck.pop()!;
      card.boughtOnTurn = next.turnNumber;
      next.activeTrade = null;

      if (card.kind === "victory_point") {
        actor.vpScrollsCount += 1;
      }
      actor.scrolls.push(card);

      const summary = `${actor.displayName} purchased a Guild Scroll.`;
      appendLog(next, actor.userId, actor.displayName, summary, "scroll");
      events.push({ type: "BOUGHT_SCROLL", actorId: actor.userId, actorName: actor.displayName, summary });

      // Secret Landmark Charter counts immediately toward victory!
      checkVictory(next, events);
      return { state: next, events };
    }

    if (action.type === "PLAY_SCROLL") {
      const idx = actor.scrolls.findIndex((s) => s.id === action.scrollId);
      const card = actor.scrolls[idx]!;
      actor.scrolls.splice(idx, 1);
      next.playedScrollThisTurn = true;
      next.activeTrade = null;

      if (card.kind === "knight") {
        actor.knightsPlayed += 1;
        const summary = `${actor.displayName} dispatched a Ranger Scout (Watch ${actor.knightsPlayed})!`;
        appendLog(next, actor.userId, actor.displayName, summary, "scroll");
        events.push({ type: "PLAYED_SCROLL", actorId: actor.userId, actorName: actor.displayName, summary });
        recomputeLargestWatchAward(next, actor, events);
        if (!checkVictory(next, events)) {
          next.step = "MOVE_BANDIT";
        }
        return { state: next, events };
      }

      if (card.kind === "road_builder") {
        const validEdges = getValidRoadEdges(next.board, next.buildings, next.roads, playerId);
        const canPlace = Math.min(2, actor.roadsRemaining, validEdges.length);
        const summary = `${actor.displayName} played Road Builder (${canPlace} free road${canPlace === 1 ? "" : "s"})!`;
        appendLog(next, actor.userId, actor.displayName, summary, "scroll");
        events.push({ type: "PLAYED_SCROLL", actorId: actor.userId, actorName: actor.displayName, summary });
        if (canPlace > 0) {
          next.freeRoadsLeft = canPlace;
          next.step = "FREE_ROADS";
        }
        return { state: next, events };
      }

      if (card.kind === "year_of_plenty") {
        const [r1, r2] = action.plentyResources!;
        actor.resources[r1] += 1;
        actor.resources[r2] += 1;
        const summary = `${actor.displayName} played Harvest Plenty (+${RESOURCE_META[r1].label}, +${RESOURCE_META[r2].label})!`;
        appendLog(next, actor.userId, actor.displayName, summary, "scroll");
        events.push({ type: "PLAYED_SCROLL", actorId: actor.userId, actorName: actor.displayName, summary });
        return { state: next, events };
      }

      if (card.kind === "monopoly") {
        const res = action.monopolyResource!;
        let total = 0;
        for (const p of next.players) {
          if (p.userId === playerId) continue;
          const amt = p.resources[res];
          if (amt > 0) {
            p.resources[res] = 0;
            actor.resources[res] += amt;
            total += amt;
          }
        }
        const summary = `${actor.displayName} declared Guild Monopoly on ${RESOURCE_META[res].label} (+${total})!`;
        appendLog(next, actor.userId, actor.displayName, summary, "scroll");
        events.push({ type: "PLAYED_SCROLL", actorId: actor.userId, actorName: actor.displayName, summary });
        return { state: next, events };
      }
    }

    if (action.type === "BANK_TRADE") {
      const rates = getPlayerTradeRates(next.board, next.buildings, playerId);
      const rate = rates[action.give];
      actor.resources[action.give] -= rate;
      actor.resources[action.receive] += 1;
      next.activeTrade = null;

      const summary = `${actor.displayName} traded ${rate} ${RESOURCE_META[action.give].label} → 1 ${RESOURCE_META[action.receive].label} (${rate}:1).`;
      appendLog(next, actor.userId, actor.displayName, summary, "trade");
      events.push({ type: "TRADE_COMPLETED", actorId: actor.userId, actorName: actor.displayName, summary });
      return { state: next, events };
    }

    if (action.type === "OFFER_TRADE") {
      next.activeTrade = {
        id: `tr_${next.nextTradeId++}`,
        fromUserId: actor.userId,
        fromName: actor.displayName,
        give: { ...action.give },
        want: { ...action.want },
        declinedByUserIds: [],
        createdAtTurn: next.turnNumber,
      };
      const giveStr = formatResourceBundle(action.give);
      const wantStr = formatResourceBundle(action.want);
      const summary = `${actor.displayName} offered ${giveStr} for ${wantStr}.`;
      appendLog(next, actor.userId, actor.displayName, summary, "trade");
      events.push({ type: "TRADE_OFFERED", actorId: actor.userId, actorName: actor.displayName, summary });
      return { state: next, events };
    }

    if (action.type === "RESPOND_TRADE") {
      const offer = next.activeTrade!;
      if (!action.accept) {
        offer.declinedByUserIds.push(playerId);
        // Clear offer automatically if every rival declined!
        const allDeclined = next.players
          .filter((p) => p.userId !== offer.fromUserId)
          .every((p) => offer.declinedByUserIds.includes(p.userId));
        if (allDeclined) {
          next.activeTrade = null;
        }
        return { state: next, events };
      }

      // Execute atomic player-to-player swap!
      const proposer = next.players.find((p) => p.userId === offer.fromUserId)!;
      if (
        !hasResources(proposer.resources, offer.give) ||
        !hasResources(actor.resources, offer.want)
      ) {
        next.activeTrade = null;
        return { state: next, events };
      }
      for (const r of RESOURCES) {
        proposer.resources[r] -= offer.give[r];
        actor.resources[r] += offer.give[r];
        actor.resources[r] -= offer.want[r];
        proposer.resources[r] += offer.want[r];
      }
      next.activeTrade = null;
      const summary = `${actor.displayName} accepted ${proposer.displayName}'s trade (${formatResourceBundle(offer.give)} ↔ ${formatResourceBundle(offer.want)})!`;
      appendLog(next, actor.userId, actor.displayName, summary, "trade");
      events.push({ type: "TRADE_COMPLETED", actorId: actor.userId, actorName: actor.displayName, summary });
      return { state: next, events };
    }

    if (action.type === "CANCEL_TRADE") {
      next.activeTrade = null;
      return { state: next, events };
    }

    if (action.type === "REDEEM_COMPASS") {
      actor.compassCharges = 0;
      actor.resources[action.receive] += 1;
      const summary = `🧭 ${actor.displayName} redeemed their Harbor Compass for +1 ${RESOURCE_META[action.receive].label}!`;
      appendLog(next, actor.userId, actor.displayName, summary, "compass");
      events.push({ type: "COMPASS_REDEEMED", actorId: actor.userId, actorName: actor.displayName, summary });
      return { state: next, events };
    }

    if (action.type === "END_TURN") {
      next.activeTrade = null;
      next.playedScrollThisTurn = false;
      next.lastDice = null;
      next.freeRoadsLeft = 0;
      next.activePlayerIndex = (next.activePlayerIndex + 1) % next.players.length;
      if (next.activePlayerIndex === 0) next.roundNumber += 1;
      next.turnNumber += 1;
      next.step = "ROLL_DICE";

      // Stalemate safety cap at 220 turns
      if (next.turnNumber > 220) {
        finishGame(next, events);
      }
      return { state: next, events };
    }

    return { state: next, events };
  },

  onTurnTimeout(state: HarborState): ActionApplyResult<HarborState, HarborEvent> {
    if (state.phase !== "IN_PROGRESS") return { state, events: [] };
    const next = cloneState(state);

    // Handle pending discards on timeout automatically
    if (next.step === "DISCARD_RESOURCES" && next.pendingDiscardUserIds.length > 0) {
      let cur = next;
      const allEvents: HarborEvent[] = [];
      for (const uid of [...next.pendingDiscardUserIds]) {
        const p = cur.players.find((pl) => pl.userId === uid);
        if (!p) continue;
        const need = Math.floor(countResources(p.resources) / 2);
        const disc = createEmptyResources();
        let left = need;
        for (const r of RESOURCES) {
          const take = Math.min(p.resources[r], left);
          disc[r] = take;
          left -= take;
        }
        const res = this.applyAction(cur, uid, { type: "DISCARD_RESOURCES", resources: disc });
        cur = res.state;
        allEvents.push(...res.events);
      }
      return { state: cur, events: allEvents };
    }

    const active = next.players[next.activePlayerIndex]!;
    active.consecutiveTimeouts += 1;

    if (next.step === "SETUP_SETTLE") {
      const valid = getValidSetupVertices(next.board, next.buildings);
      if (valid.length > 0) {
        const res = this.applyAction(next, active.userId, {
          type: "SETUP_PLACE_COTTAGE",
          vertexId: valid[0]!,
        });
        res.state.players[state.activePlayerIndex]!.consecutiveTimeouts = active.consecutiveTimeouts;
        return res;
      }
    }
    if (next.step === "SETUP_ROAD" && next.setupLastVertexId !== null) {
      const valid = getValidSetupRoadEdges(next.board, next.roads, next.setupLastVertexId);
      if (valid.length > 0) {
        const res = this.applyAction(next, active.userId, {
          type: "SETUP_PLACE_ROAD",
          edgeId: valid[0]!,
        });
        res.state.players[state.activePlayerIndex]!.consecutiveTimeouts = active.consecutiveTimeouts;
        return res;
      }
    }
    if (next.step === "ROLL_DICE") {
      const res = this.applyAction(next, active.userId, { type: "ROLL_DICE" });
      res.state.players[state.activePlayerIndex]!.consecutiveTimeouts = active.consecutiveTimeouts;
      return res;
    }
    if (next.step === "MOVE_BANDIT") {
      const targetHex = next.board.hexes.find((h) => h.id !== next.banditHexId)?.id ?? 0;
      const res = this.applyAction(next, active.userId, { type: "MOVE_BANDIT", hexId: targetHex });
      res.state.players[state.activePlayerIndex]!.consecutiveTimeouts = active.consecutiveTimeouts;
      return res;
    }
    if (next.step === "FREE_ROADS") {
      const valid = getValidRoadEdges(next.board, next.buildings, next.roads, active.userId);
      if (valid.length > 0) {
        const res = this.applyAction(next, active.userId, { type: "BUILD_ROAD", edgeId: valid[0]! });
        res.state.players[state.activePlayerIndex]!.consecutiveTimeouts = active.consecutiveTimeouts;
        return res;
      }
      next.freeRoadsLeft = 0;
      next.step = "MAIN_PHASE";
    }

    const res = this.applyAction(next, active.userId, { type: "END_TURN" });
    res.state.players[state.activePlayerIndex]!.consecutiveTimeouts = active.consecutiveTimeouts;
    return {
      state: res.state,
      events: [
        {
          type: "TURN_TIMEOUT",
          actorId: active.userId,
          actorName: active.displayName,
          summary: `${active.displayName} timed out — turn passed.`,
        },
        ...res.events,
      ],
    };
  },

  getPublicState(state: HarborState): HarborPublicState {
    const players: HarborPublicPlayer[] = state.players.map((p) => {
      const publicVP = computePlayerPublicVP(state, p);
      return {
        userId: p.userId,
        displayName: p.displayName,
        seatIndex: p.seatIndex,
        colorIndex: p.colorIndex,
        resourceCount: countResources(p.resources),
        scrollCount: p.scrolls.length,
        knightsPlayed: p.knightsPlayed,
        compassCharges: p.compassCharges,
        roadsRemaining: p.roadsRemaining,
        cottagesRemaining: p.cottagesRemaining,
        townsRemaining: p.townsRemaining,
        longestRoadLength: p.longestRoadLength,
        publicVP,
        finalVP: state.phase === "GAME_END" ? computePlayerTotalVP(state, p) : null,
        hasLongestRoad: state.longestRoadOwnerId === p.userId,
        hasLargestWatch: state.largestWatchOwnerId === p.userId,
        consecutiveTimeouts: p.consecutiveTimeouts,
      };
    });

    return {
      phase: state.phase,
      step: state.step,
      roundNumber: state.roundNumber,
      turnNumber: state.turnNumber,
      targetVP: state.config.targetVP,
      turnSeconds: state.config.turnSeconds,
      activePlayerId: state.players[state.activePlayerIndex]!.userId,
      activePlayerIndex: state.activePlayerIndex,
      setupLastVertexId: state.setupLastVertexId,
      board: state.board,
      buildings: { ...state.buildings },
      roads: { ...state.roads },
      banditHexId: state.banditHexId,
      scrollDeckCount: state.scrollDeck.length,
      lastDice: state.lastDice,
      playedScrollThisTurn: state.playedScrollThisTurn,
      freeRoadsLeft: state.freeRoadsLeft,
      pendingDiscardUserIds: [...state.pendingDiscardUserIds],
      longestRoadOwnerId: state.longestRoadOwnerId,
      longestRoadLength: state.longestRoadLength,
      largestWatchOwnerId: state.largestWatchOwnerId,
      largestWatchCount: state.largestWatchCount,
      activeTrade: state.activeTrade ? { ...state.activeTrade } : null,
      players,
      winnerIds: [...state.winnerIds],
      results: state.results,
      log: state.log.slice(0, 24),
    };
  },

  getPrivateState(state: HarborState, playerId: string): HarborPrivateState {
    const p = state.players.find((pl) => pl.userId === playerId);
    const active = state.players[state.activePlayerIndex];
    const mustDiscard =
      state.step === "DISCARD_RESOURCES" && state.pendingDiscardUserIds.includes(playerId) && p
        ? Math.floor(countResources(p.resources) / 2)
        : 0;
    return {
      userId: playerId,
      resources: p ? { ...p.resources } : createEmptyResources(),
      scrolls: p ? p.scrolls.map((s) => ({ ...s })) : [],
      vpScrollsCount: p?.vpScrollsCount ?? 0,
      totalVP: p ? computePlayerTotalVP(state, p) : 0,
      tradeRates: getPlayerTradeRates(state.board, state.buildings, playerId),
      isYourTurn: state.phase === "IN_PROGRESS" && active?.userId === playerId,
      mustDiscardCount: mustDiscard,
    };
  },

  getDisplayState(state: HarborState): HarborDisplayState {
    return {
      phase: state.phase,
      roundNumber: state.roundNumber,
      targetVP: state.config.targetVP,
      activePlayerName: state.players[state.activePlayerIndex]?.displayName ?? "",
      lastDice: state.lastDice,
      leaderboard: [...state.players]
        .sort((a, b) => computePlayerPublicVP(state, b) - computePlayerPublicVP(state, a))
        .map((p) => ({
          userId: p.userId,
          displayName: p.displayName,
          publicVP: computePlayerPublicVP(state, p),
          hasLongestRoad: state.longestRoadOwnerId === p.userId,
          hasLargestWatch: state.largestWatchOwnerId === p.userId,
        })),
      results: state.results,
    };
  },

  isGameCompleted(state: HarborState): boolean {
    return state.phase === "GAME_END";
  },

  getResults(state: HarborState): GameResultSummary | null {
    return state.results;
  },
};

function validatePlayScroll(
  state: HarborState,
  active: HarborPlayerState,
  action: Extract<HarborAction, { type: "PLAY_SCROLL" }>,
  beforeDice: boolean
): ActionValidationResult {
  if (state.playedScrollThisTurn) {
    return { valid: false, code: "SCROLL_LIMIT", message: "You can play at most 1 Guild Scroll per turn." };
  }
  const card = active.scrolls.find((s) => s.id === action.scrollId);
  if (!card) {
    return { valid: false, code: "SCROLL_NOT_FOUND", message: "You don't hold that Guild Scroll." };
  }
  if (card.kind === "victory_point") {
    return {
      valid: false,
      code: "VP_AUTO_COUNTS",
      message: `${SCROLL_META.victory_point.title} counts automatically toward victory!`,
    };
  }
  if (beforeDice && card.kind !== "knight") {
    return {
      valid: false,
      code: "ONLY_SCOUT_BEFORE_DICE",
      message: "Only Ranger Scout can be played before rolling the dice.",
    };
  }
  if (card.boughtOnTurn === state.turnNumber) {
    return {
      valid: false,
      code: "BOUGHT_THIS_TURN",
      message: "Guild Scrolls purchased this turn can be played starting next turn.",
    };
  }
  if (card.kind === "year_of_plenty" && !action.plentyResources) {
    return { valid: false, code: "PICK_PLENTY", message: "Choose 2 resources to gain with Harvest Plenty." };
  }
  if (card.kind === "monopoly" && !action.monopolyResource) {
    return { valid: false, code: "PICK_MONOPOLY", message: "Choose 1 resource for Guild Monopoly." };
  }
  return { valid: true };
}

function formatResourceBundle(pool: ResourcePool): string {
  return RESOURCES.filter((r) => pool[r] > 0)
    .map((r) => `${pool[r]} ${RESOURCE_META[r].label}`)
    .join(" + ");
}
