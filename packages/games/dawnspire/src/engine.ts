import {
  nextRandom,
  type ActionApplyResult,
  type ActionValidationResult,
  type GameModule,
  type GamePlayerSeed,
  type GameResultSummary,
} from "@tablefolk/game-engine";

function makeSeededRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    const r = nextRandom(s);
    s = r.nextSeed;
    return r.value;
  };
}
import { buildEraDeck, DAWN_WONDERS, shuffleArray } from "./catalog";
import {
  computeFullScoreBreakdown,
  countCategoriesInScope,
  evaluateCardPlayability,
  evaluateWonderStagePlayability,
  getNeighbors,
  getPlayerShields,
  hasWonderFreeBuildAvailable,
} from "./solver";
import {
  DawnspireActionSchema,
  type DawnHandCardEvaluation,
  type DawnPlayerState,
  type DawnPrivateState,
  type DawnPublicPlayerView,
  type DawnPublicState,
  type DawnspireAction,
  type DawnspireState,
  type EraMilitaryClash,
  type EraNumber,
  type TurnRevealEntry,
  type WonderSide,
} from "./types";

export interface DawnspireConfig {
  wonderSide?: WonderSide;
}

export interface DawnspireEvent {
  type: "PLAYER_LOCKED" | "TURN_RESOLVED" | "ERA_STARTED" | "MILITARY_CLASH" | "GAME_FINISHED";
  summary: string;
  actorId?: string;
}

const ERA_VICTORY_VP: Record<EraNumber, number> = {
  1: 1,
  2: 3,
  3: 5,
};

function dealEraHands(
  state: DawnspireState,
  era: EraNumber,
  rng: () => number = Math.random
): void {
  const deck = buildEraDeck(era, state.players.length, rng);
  const numPlayers = state.players.length;
  for (let i = 0; i < numPlayers; i++) {
    state.players[i]!.hand = deck.slice(i * 7, (i + 1) * 7);
    state.players[i]!.pendingAction = null;
    state.players[i]!.freeBuildUsedThisEra = false;
  }
  if (numPlayers === 2) {
    state.caravanHand = deck.slice(14, 21);
  } else {
    state.caravanHand = [];
  }
  state.era = era;
  state.turnInEra = 1;
  state.passDirection = era === 2 ? "right" : "left";
}

function getMinCoins(state: DawnspireState): number {
  return Math.min(...state.players.map((p) => p.coins));
}

function resolveSimultaneousTurn(
  state: DawnspireState,
  events: DawnspireEvent[]
): void {
  const n = state.players.length;
  const minCoinsBefore = getMinCoins(state);

  const planned = state.players.map((p, idx) => {
    const choice = p.pendingAction!;
    const cardIdx = p.hand.findIndex((c) => c.id === choice.cardId);
    const card = cardIdx >= 0 ? p.hand[cardIdx]! : p.hand[0]!;
    const { leftIdx, rightIdx } = getNeighbors(idx, n);

    if (choice.type === "BUILD_CARD") {
      const useFree =
        Boolean(choice.useFreeBuild) &&
        hasWonderFreeBuildAvailable(p) &&
        !p.builtCards.some((c) => c.baseId === card.baseId);
      const plan = useFree
        ? {
            affordable: true,
            isDuplicate: false,
            isFreeChain: false,
            ownCoinsCost: 0,
            leftTradeCoins: 0,
            rightTradeCoins: 0,
            totalCoins: 0,
            missingResources: [],
          }
        : evaluateCardPlayability(state, idx, card);
      return { p, idx, choice, card, plan, useFree, leftIdx, rightIdx };
    }

    if (choice.type === "BUILD_WONDER") {
      const plan = evaluateWonderStagePlayability(state, idx);
      return { p, idx, choice, card, plan, useFree: false, leftIdx, rightIdx };
    }

    return { p, idx, choice, card, plan: null, useFree: false, leftIdx, rightIdx };
  });

  const coinDeltas = new Array<number>(n).fill(0);
  const reveals: TurnRevealEntry[] = [];

  for (const item of planned) {
    const { p, idx, choice, card, plan, useFree, leftIdx, rightIdx } = item;

    p.hand = p.hand.filter((c) => c.id !== card.id);
    p.pendingAction = null;

    if (choice.type === "BUILD_CARD" && plan && plan.affordable && !plan.isDuplicate) {
      coinDeltas[idx] = coinDeltas[idx]! - plan.totalCoins;
      if (plan.leftTradeCoins > 0) {
        coinDeltas[leftIdx] = coinDeltas[leftIdx]! + plan.leftTradeCoins;
      }
      if (plan.rightTradeCoins > 0 && rightIdx !== null) {
        coinDeltas[rightIdx] = coinDeltas[rightIdx]! + plan.rightTradeCoins;
      }
      if (useFree) {
        p.freeBuildUsedThisEra = true;
      }
      p.builtCards.push(card);
      coinDeltas[idx] = coinDeltas[idx]! + (card.effect.coins ?? 0);

      reveals.push({
        playerId: p.userId,
        playerName: p.displayName,
        actionType: "build",
        cardName: card.name,
        cardCategory: card.category,
        tradePaidLeft: plan.leftTradeCoins,
        tradePaidRight: plan.rightTradeCoins,
        freeChain: plan.isFreeChain,
        usedWonderFreeBuild: useFree,
      });
    } else if (choice.type === "BUILD_WONDER" && plan && plan.affordable) {
      const stage = p.wonder.stages[p.wonderStagesBuilt]!;
      coinDeltas[idx] = coinDeltas[idx]! - plan.totalCoins;
      if (plan.leftTradeCoins > 0) {
        coinDeltas[leftIdx] = coinDeltas[leftIdx]! + plan.leftTradeCoins;
      }
      if (plan.rightTradeCoins > 0 && rightIdx !== null) {
        coinDeltas[rightIdx] = coinDeltas[rightIdx]! + plan.rightTradeCoins;
      }
      p.wonderStagesBuilt += 1;
      if (stage.effect.coins) {
        coinDeltas[idx] = coinDeltas[idx]! + stage.effect.coins;
      }

      reveals.push({
        playerId: p.userId,
        playerName: p.displayName,
        actionType: "wonder",
        wonderStageIndex: p.wonderStagesBuilt,
        tradePaidLeft: plan.leftTradeCoins,
        tradePaidRight: plan.rightTradeCoins,
      });
    } else {
      const caravanBonus = p.coins <= minCoinsBefore;
      const earned = caravanBonus ? 4 : 3;
      coinDeltas[idx] = coinDeltas[idx]! + earned;
      state.discardPile.push(card);

      reveals.push({
        playerId: p.userId,
        playerName: p.displayName,
        actionType: "sell",
        coinsEarned: earned,
        caravanBonus,
      });
    }
  }

  for (const item of planned) {
    const { p, idx, choice, card, plan } = item;
    if (choice.type !== "BUILD_CARD" || !plan || !plan.affordable || plan.isDuplicate) {
      continue;
    }
    if (card.effect.coinsPerCategory) {
      const cnt = countCategoriesInScope(
        state,
        idx,
        card.effect.coinsPerCategory.categories,
        card.effect.coinsPerCategory.scope
      );
      coinDeltas[idx] = coinDeltas[idx]! + cnt * card.effect.coinsPerCategory.amount;
    }
    if (card.effect.coinsPerWonderStage) {
      coinDeltas[idx] =
        coinDeltas[idx]! + p.wonderStagesBuilt * card.effect.coinsPerWonderStage;
    }
  }

  for (let i = 0; i < n; i++) {
    state.players[i]!.coins = Math.max(0, state.players[i]!.coins + coinDeltas[i]!);
  }

  const summaryParts = reveals.map((r) => {
    if (r.actionType === "build") {
      const tag = r.freeChain
        ? " (Chain!)"
        : r.usedWonderFreeBuild
          ? " (Free Build!)"
          : "";
      return `${r.playerName} built ${r.cardName}${tag}`;
    }
    if (r.actionType === "wonder") {
      return `${r.playerName} raised Stage ${r.wonderStageIndex}!`;
    }
    return `${r.playerName} sold a card (+${r.coinsEarned}g${r.caravanBonus ? " Caravan!" : ""})`;
  });
  const turnLine = `Era ${state.era}·T${state.turnInEra}: ${summaryParts.join(" · ")}`;
  state.log.unshift(turnLine);
  if (state.log.length > 24) state.log.length = 24;
  state.lastReveals = reveals;
  events.push({ type: "TURN_RESOLVED", summary: turnLine });

  if (state.turnInEra >= 6) {
    for (const p of state.players) {
      for (const rem of p.hand) state.discardPile.push(rem);
      p.hand = [];
    }
    for (const rem of state.caravanHand) state.discardPile.push(rem);
    state.caravanHand = [];

    const clashLine = resolveEraMilitaryClashes(state);
    events.push({ type: "MILITARY_CLASH", summary: clashLine });

    if (state.era < 3) {
      const nextEra = (state.era + 1) as EraNumber;
      const rng = makeSeededRng(state.totalTurn * 7919 + nextEra * 1013 + state.discardPile.length * 37);
      dealEraHands(state, nextEra, rng);
      state.totalTurn += 1;
      const eraMsg = `✨ Era ${nextEra} begins! Passing hands ${state.passDirection === "left" ? "LEFT ⬅" : "RIGHT ➡"}.`;
      state.log.unshift(eraMsg);
      events.push({ type: "ERA_STARTED", summary: eraMsg });
    } else {
      const winMsg = finalizeMatch(state);
      events.push({ type: "GAME_FINISHED", summary: winMsg });
    }
    return;
  }

  passHands(state);
  state.turnInEra += 1;
  state.totalTurn += 1;
}

function passHands(state: DawnspireState): void {
  const n = state.players.length;
  if (n === 2) {
    if (state.caravanHand.length > 0) {
      const dropped = state.caravanHand.pop()!;
      state.discardPile.push(dropped);
    }
    const h0 = state.players[0]!.hand;
    const h1 = state.players[1]!.hand;
    const hc = state.caravanHand;
    if (state.passDirection === "left") {
      state.players[0]!.hand = h1;
      state.players[1]!.hand = hc;
      state.caravanHand = h0;
    } else {
      state.players[0]!.hand = hc;
      state.players[1]!.hand = h0;
      state.caravanHand = h1;
    }
    return;
  }

  const prevHands = state.players.map((p) => p.hand);
  for (let i = 0; i < n; i++) {
    const fromIdx =
      state.passDirection === "left" ? (i + 1) % n : (i - 1 + n) % n;
    state.players[i]!.hand = prevHands[fromIdx]!;
  }
}

function resolveEraMilitaryClashes(state: DawnspireState): string {
  const n = state.players.length;
  const winVP = ERA_VICTORY_VP[state.era];
  const shields = state.players.map((p) => getPlayerShields(p));
  const eraClashes: EraMilitaryClash[] = [];

  for (let i = 0; i < n; i++) {
    const me = state.players[i]!;
    const { leftIdx, rightIdx } = getNeighbors(i, n);

    const targets: Array<{ oppIdx: number; side: "left" | "right" }> = [
      { oppIdx: leftIdx, side: "left" },
    ];
    if (rightIdx !== null && rightIdx !== leftIdx) {
      targets.push({ oppIdx: rightIdx, side: "right" });
    }

    for (const t of targets) {
      const opp = state.players[t.oppIdx]!;
      const myS = shields[i]!;
      const oppS = shields[t.oppIdx]!;
      let outcome: "win" | "loss" | "tie" = "tie";
      let vpDelta = 0;

      if (myS > oppS) {
        outcome = "win";
        vpDelta = winVP;
        me.militaryWinsVP += winVP;
      } else if (myS < oppS) {
        outcome = "loss";
        vpDelta = -1;
        me.militaryDefeats += 1;
      }

      eraClashes.push({
        era: state.era,
        playerId: me.userId,
        opponentId: opp.userId,
        opponentName: opp.displayName,
        side: t.side,
        myShields: myS,
        oppShields: oppS,
        outcome,
        vpDelta,
      });
    }
  }

  state.militaryHistory.push(...eraClashes);
  const winners = eraClashes
    .filter((c) => c.outcome === "win")
    .map((c) => {
      const p = state.players.find((pl) => pl.userId === c.playerId);
      return `${p?.displayName ?? "?"} +${c.vpDelta}★`;
    });
  const line =
    winners.length > 0
      ? `⚔ Era ${state.era} Military Clashes: ${winners.join(", ")}`
      : `⚔ Era ${state.era} Military Clashes: All borders held in peace!`;
  state.log.unshift(line);
  return line;
}

function finalizeMatch(state: DawnspireState): string {
  state.phase = "FINISHED";
  const ranked = state.players.map((p, idx) => {
    const score = computeFullScoreBreakdown(state, idx);
    p.finalScore = score;
    return {
      userId: p.userId,
      total: score.total,
      coins: p.coins,
      cards: p.builtCards.length,
    };
  });

  ranked.sort(
    (a, b) => b.total - a.total || b.coins - a.coins || b.cards - a.cards
  );
  const top = ranked[0]!;
  state.winnerIds = ranked
    .filter((r) => r.total === top.total && r.coins === top.coins)
    .map((r) => r.userId);

  const winnerNames = state.players
    .filter((p) => state.winnerIds.includes(p.userId))
    .map((p) => p.displayName)
    .join(" & ");
  const line = `👑 Dawnspire Complete! ${winnerNames} wins with ${top.total} Victory Points!`;
  state.log.unshift(line);
  return line;
}

export const DawnspireModule: GameModule<
  DawnspireState,
  DawnspireAction,
  DawnPublicState,
  DawnPrivateState,
  DawnPublicState,
  DawnspireEvent,
  DawnspireConfig
> = {
  slug: "dawnspire",
  title: "Dawnspire",
  minPlayers: 2,
  maxPlayers: 7,

  createInitialState(
    players: GamePlayerSeed[],
    config: DawnspireConfig = {},
    rngSeed: number = Date.now()
  ): DawnspireState {
    const rng = makeSeededRng(rngSeed);
    const wonderSide: WonderSide = config.wonderSide === "starlit" ? "starlit" : "sunlit";
    const pool = shuffleArray(DAWN_WONDERS[wonderSide], rng);

    const dawnPlayers: DawnPlayerState[] = players.map((p, idx) => ({
      userId: p.userId,
      displayName: p.displayName,
      seatIndex: p.seatIndex ?? idx,
      wonder: pool[idx % pool.length]!,
      wonderStagesBuilt: 0,
      coins: 3,
      builtCards: [],
      militaryWinsVP: 0,
      militaryDefeats: 0,
      freeBuildUsedThisEra: false,
      hand: [],
      pendingAction: null,
      finalScore: null,
    }));

    const state: DawnspireState = {
      phase: "IN_PROGRESS",
      wonderSide,
      era: 1,
      turnInEra: 1,
      totalTurn: 1,
      passDirection: "left",
      players: dawnPlayers,
      caravanHand: [],
      discardPile: [],
      lastReveals: [],
      militaryHistory: [],
      log: [
        `Welcome to Dawnspire (${wonderSide === "starlit" ? "Starlit" : "Sunlit"} Wonders)! Era 1 begins — passing LEFT ⬅.`,
      ],
      winnerIds: [],
    };

    dealEraHands(state, 1, rng);
    return state;
  },

  validateAction(
    state: DawnspireState,
    playerId: string,
    action: DawnspireAction
  ): ActionValidationResult {
    if (state.phase !== "IN_PROGRESS") {
      return { valid: false, code: "GAME_FINISHED", message: "Match is already finished." };
    }
    const parsed = DawnspireActionSchema.safeParse(action);
    if (!parsed.success) {
      return { valid: false, code: "INVALID_PAYLOAD", message: "Invalid Dawnspire action payload." };
    }

    const pIdx = state.players.findIndex((p) => p.userId === playerId);
    if (pIdx < 0) {
      return { valid: false, code: "UNKNOWN_PLAYER", message: "Player not in this match." };
    }
    const player = state.players[pIdx]!;

    const card = player.hand.find((c) => c.id === parsed.data.cardId);
    if (!card) {
      return { valid: false, code: "CARD_NOT_IN_HAND", message: "That card is not in your current hand." };
    }

    if (parsed.data.type === "BUILD_CARD") {
      if (player.builtCards.some((c) => c.baseId === card.baseId)) {
        return {
          valid: false,
          code: "DUPLICATE_STRUCTURE",
          message: `You already built ${card.name} in your kingdom.`,
        };
      }
      if (parsed.data.useFreeBuild) {
        if (!hasWonderFreeBuildAvailable(player)) {
          return {
            valid: false,
            code: "FREE_BUILD_UNAVAILABLE",
            message: "Your Wonder Free Build power is not available this Era.",
          };
        }
        return { valid: true };
      }
      const plan = evaluateCardPlayability(state, pIdx, card);
      if (!plan.affordable) {
        return {
          valid: false,
          code: "CANNOT_AFFORD",
          message:
            plan.missingResources.length > 0
              ? `Missing resources to build ${card.name}.`
              : `Need ${plan.totalCoins} Gold to build ${card.name} (you have ${player.coins}g).`,
        };
      }
      return { valid: true };
    }

    if (parsed.data.type === "BUILD_WONDER") {
      const plan = evaluateWonderStagePlayability(state, pIdx);
      if (!plan) {
        return {
          valid: false,
          code: "WONDER_COMPLETE",
          message: "Your Wonder is already fully completed!",
        };
      }
      if (!plan.affordable) {
        return {
          valid: false,
          code: "CANNOT_AFFORD_WONDER",
          message:
            plan.missingResources.length > 0
              ? "Missing resources for the next Wonder stage."
              : `Need ${plan.totalCoins} Gold for this Wonder stage (you have ${player.coins}g).`,
        };
      }
      return { valid: true };
    }

    return { valid: true };
  },

  applyAction(
    state: DawnspireState,
    playerId: string,
    action: DawnspireAction
  ): ActionApplyResult<DawnspireState, DawnspireEvent> {
    const check = this.validateAction(state, playerId, action);
    if (!check.valid) {
      throw new Error(check.message);
    }
    const next: DawnspireState = structuredClone(state);
    const pIdx = next.players.findIndex((p) => p.userId === playerId);
    const player = next.players[pIdx]!;
    player.pendingAction = action;

    const events: DawnspireEvent[] = [
      {
        type: "PLAYER_LOCKED",
        actorId: player.userId,
        summary: `${player.displayName} locked in their choice.`,
      },
    ];

    if (next.players.every((p) => p.pendingAction !== null)) {
      resolveSimultaneousTurn(next, events);
    }

    return { state: next, events };
  },

  onTurnTimeout(
    state: DawnspireState
  ): ActionApplyResult<DawnspireState, DawnspireEvent> {
    if (state.phase !== "IN_PROGRESS") return { state, events: [] };
    const next: DawnspireState = structuredClone(state);
    const events: DawnspireEvent[] = [];

    for (let i = 0; i < next.players.length; i++) {
      const p = next.players[i]!;
      if (p.pendingAction !== null || p.hand.length === 0) continue;
      let chosen: DawnspireAction | null = null;
      for (const c of p.hand) {
        const plan = evaluateCardPlayability(next, i, c);
        if (plan.affordable && !plan.isDuplicate) {
          chosen = { type: "BUILD_CARD", cardId: c.id };
          break;
        }
      }
      if (!chosen) {
        const wPlan = evaluateWonderStagePlayability(next, i);
        if (wPlan && wPlan.affordable) {
          chosen = { type: "BUILD_WONDER", cardId: p.hand[0]!.id };
        } else {
          chosen = { type: "SELL_CARD", cardId: p.hand[0]!.id };
        }
      }
      p.pendingAction = chosen;
    }

    if (next.players.every((p) => p.pendingAction !== null)) {
      resolveSimultaneousTurn(next, events);
    }
    return { state: next, events };
  },

  getPublicState(state: DawnspireState): DawnPublicState {
    const players: DawnPublicPlayerView[] = state.players.map((p, idx) => ({
      userId: p.userId,
      displayName: p.displayName,
      seatIndex: p.seatIndex,
      wonder: p.wonder,
      wonderStagesBuilt: p.wonderStagesBuilt,
      coins: p.coins,
      builtCards: p.builtCards,
      militaryWinsVP: p.militaryWinsVP,
      militaryDefeats: p.militaryDefeats,
      shields: getPlayerShields(p),
      hasLockedIn: p.pendingAction !== null,
      freeBuildAvailable: hasWonderFreeBuildAvailable(p),
      liveScoreEstimate: p.finalScore ?? computeFullScoreBreakdown(state, idx),
      finalScore: p.finalScore,
    }));

    return {
      phase: state.phase,
      wonderSide: state.wonderSide,
      era: state.era,
      turnInEra: state.turnInEra,
      totalTurn: state.totalTurn,
      passDirection: state.passDirection,
      players,
      discardCount: state.discardPile.length,
      lastReveals: state.lastReveals,
      militaryHistory: state.militaryHistory,
      log: state.log,
      winnerIds: state.winnerIds,
      isTwoPlayerCaravan: state.players.length === 2,
    };
  },

  getPrivateState(state: DawnspireState, playerId: string): DawnPrivateState {
    const pIdx = state.players.findIndex((p) => p.userId === playerId);
    if (pIdx < 0) {
      return {
        userId: playerId,
        hand: [],
        nextWonderStagePlan: null,
        pendingAction: null,
        sellGoldAmount: 3,
        hasCaravanBonus: false,
        leftNeighborId: "",
        rightNeighborId: "",
      };
    }

    const player = state.players[pIdx]!;
    const canFree = hasWonderFreeBuildAvailable(player);
    const minCoins = getMinCoins(state);
    const hasCaravanBonus = player.coins <= minCoins;
    const { leftIdx, rightIdx } = getNeighbors(pIdx, state.players.length);

    const hand: DawnHandCardEvaluation[] = player.hand.map((card) => {
      const buildPlan = evaluateCardPlayability(state, pIdx, card);
      const canUseWonderFreeBuild =
        canFree &&
        !buildPlan.isDuplicate &&
        !buildPlan.isFreeChain &&
        (!buildPlan.affordable || buildPlan.totalCoins > 0);
      return {
        card,
        buildPlan,
        canUseWonderFreeBuild,
      };
    });

    return {
      userId: playerId,
      hand,
      nextWonderStagePlan: evaluateWonderStagePlayability(state, pIdx),
      pendingAction: player.pendingAction,
      sellGoldAmount: hasCaravanBonus ? 4 : 3,
      hasCaravanBonus,
      leftNeighborId: state.players[leftIdx]?.userId ?? "",
      rightNeighborId:
        rightIdx !== null
          ? state.players[rightIdx]?.userId ?? ""
          : state.players[leftIdx]?.userId ?? "",
    };
  },

  getDisplayState(state: DawnspireState): DawnPublicState {
    return this.getPublicState(state);
  },

  isGameCompleted(state: DawnspireState): boolean {
    return state.phase === "FINISHED";
  },

  getResults(state: DawnspireState): GameResultSummary | null {
    if (state.phase !== "FINISHED") return null;
    const winners = state.players.filter((p) => state.winnerIds.includes(p.userId));
    const topScore = winners[0]?.finalScore?.total ?? 0;
    return {
      winningTeam: winners.map((w) => w.displayName).join(" & "),
      headline: `${winners.map((w) => w.displayName).join(" & ")} raised the grandest realm (${topScore}★)!`,
      players: state.players.map((p, idx) => ({
        userId: p.userId,
        displayName: p.displayName,
        score: p.finalScore?.total ?? computeFullScoreBreakdown(state, idx).total,
        isWinner: state.winnerIds.includes(p.userId),
        roleLabel: p.wonder.name,
      })),
    };
  },
};
