import { CARD_NAME_BY_BASE_ID } from "./catalog";
import {
  ALL_RESOURCES,
  RESOURCE_META,
  type CardCategory,
  type CardCost,
  type CardEffect,
  type DawnCardDef,
  type DawnPlayerState,
  type DawnResource,
  type DawnspireState,
  type ScoreBreakdown,
  type TradePlan,
} from "./types";

export interface NeighborPair {
  leftIdx: number;
  rightIdx: number | null; // null in 2-player Caravan Duel so we never double-count the single rival
}

export function getNeighbors(playerIdx: number, playerCount: number): NeighborPair {
  if (playerCount <= 2) {
    return {
      leftIdx: (playerIdx + 1) % playerCount,
      rightIdx: null,
    };
  }
  return {
    leftIdx: (playerIdx - 1 + playerCount) % playerCount,
    rightIdx: (playerIdx + 1) % playerCount,
  };
}

export function getActiveWonderEffects(player: DawnPlayerState): CardEffect[] {
  const out: CardEffect[] = [];
  for (let i = 0; i < player.wonderStagesBuilt; i++) {
    const st = player.wonder.stages[i];
    if (st) out.push(st.effect);
  }
  return out;
}

export function getPlayerShields(player: DawnPlayerState): number {
  let shields = 0;
  for (const c of player.builtCards) {
    shields += c.effect.shields ?? 0;
  }
  for (const eff of getActiveWonderEffects(player)) {
    shields += eff.shields ?? 0;
  }
  return shields;
}

export function hasWonderFreeBuildAvailable(player: DawnPlayerState): boolean {
  if (player.freeBuildUsedThisEra) return false;
  return getActiveWonderEffects(player).some((e) => Boolean(e.freeBuildPerEra));
}

export interface PlayerTradeRates {
  leftRaw: number;
  rightRaw: number;
  leftCraft: number;
  rightCraft: number;
}

export function getTradeRates(player: DawnPlayerState): PlayerTradeRates {
  const effects: CardEffect[] = [
    ...player.builtCards.map((c) => c.effect),
    ...getActiveWonderEffects(player),
  ];
  let leftRaw = 2;
  let rightRaw = 2;
  let leftCraft = 2;
  let rightCraft = 2;
  for (const e of effects) {
    if (e.rawTradeLeft) leftRaw = 1;
    if (e.rawTradeRight) rightRaw = 1;
    if (e.craftTradeBoth) {
      leftCraft = 1;
      rightCraft = 1;
    }
  }
  return { leftRaw, rightRaw, leftCraft, rightCraft };
}

interface ResourceSource {
  options: DawnResource[];
  source: "self" | "left" | "right";
}

function collectOwnFixedAndChoice(player: DawnPlayerState): {
  fixed: Record<DawnResource, number>;
  choices: DawnResource[][];
} {
  const fixed: Record<DawnResource, number> = {
    timber: 0,
    stone: 0,
    clay: 0,
    ore: 0,
    glass: 0,
    silk: 0,
  };
  const choices: DawnResource[][] = [];

  // Starting wonder resource is always fixed
  fixed[player.wonder.startingResource] += 1;

  for (const c of player.builtCards) {
    if (c.effect.producesFixed) {
      for (const r of c.effect.producesFixed) fixed[r] += 1;
    }
    if (c.effect.producesChoice && c.effect.producesChoice.length > 0) {
      choices.push(c.effect.producesChoice);
    }
  }

  for (const eff of getActiveWonderEffects(player)) {
    if (eff.producesFixed) {
      for (const r of eff.producesFixed) fixed[r] += 1;
    }
    if (eff.producesChoice && eff.producesChoice.length > 0) {
      choices.push(eff.producesChoice);
    }
  }

  return { fixed, choices };
}

/**
 * Only a neighbor's Wonder starting resource, Brown Raw cards, and Silver Craft cards
 * are tradable (Yellow wild commerce & Wonder wild stages cannot be bought by neighbors!).
 */
function collectTradableNeighborSlots(neighbor: DawnPlayerState): DawnResource[][] {
  const slots: DawnResource[][] = [[neighbor.wonder.startingResource]];
  for (const c of neighbor.builtCards) {
    if (c.category !== "raw" && c.category !== "craft") continue;
    if (c.effect.producesFixed) {
      for (const r of c.effect.producesFixed) slots.push([r]);
    }
    if (c.effect.producesChoice && c.effect.producesChoice.length > 0) {
      slots.push(c.effect.producesChoice);
    }
  }
  return slots;
}

/**
 * Exact backtracking resource + trade solver:
 * Guarantees the globally minimum Gold cost and exact Left/Right neighbor trade split!
 */
export function evaluateCost(
  player: DawnPlayerState,
  leftNeighbor: DawnPlayerState | null,
  rightNeighbor: DawnPlayerState | null,
  cost: CardCost
): TradePlan {
  const ownCoinsCost = cost.coins ?? 0;
  const { fixed, choices } = collectOwnFixedAndChoice(player);
  const rates = getTradeRates(player);

  // Build list of unmet required resources after consuming own fixed production
  const needed: DawnResource[] = [];
  if (cost.resources) {
    for (const r of ALL_RESOURCES) {
      const req = cost.resources[r] ?? 0;
      const deficit = Math.max(0, req - fixed[r]);
      for (let i = 0; i < deficit; i++) {
        needed.push(r);
      }
    }
  }

  // Fast path: everything already covered by own fixed resources!
  if (needed.length === 0) {
    const affordable = player.coins >= ownCoinsCost;
    return {
      affordable,
      isDuplicate: false,
      isFreeChain: false,
      ownCoinsCost,
      leftTradeCoins: 0,
      rightTradeCoins: 0,
      totalCoins: ownCoinsCost,
      missingResources: [],
    };
  }

  // Build candidate source slots (own choices first = 0g, then left & right neighbor tradable slots)
  const sources: ResourceSource[] = [];
  for (const ch of choices) {
    sources.push({ options: ch, source: "self" });
  }
  if (leftNeighbor) {
    for (const sl of collectTradableNeighborSlots(leftNeighbor)) {
      sources.push({ options: sl, source: "left" });
    }
  }
  if (rightNeighbor) {
    for (const sl of collectTradableNeighborSlots(rightNeighbor)) {
      sources.push({ options: sl, source: "right" });
    }
  }

  const used = new Array<boolean>(sources.length).fill(false);

  const slotCost = (src: "self" | "left" | "right", res: DawnResource): number => {
    if (src === "self") return 0;
    const isRaw = RESOURCE_META[res].kind === "raw";
    if (src === "left") return isRaw ? rates.leftRaw : rates.leftCraft;
    return isRaw ? rates.rightRaw : rates.rightCraft;
  };

  let bestTotal = Number.POSITIVE_INFINITY;
  let bestLeft = 0;
  let bestRight = 0;

  // Also track max coverable count so we can tell player exact missing resources if impossible
  let maxCovered = 0;
  let bestMissing: DawnResource[] = [...needed];
  const currentMissing: DawnResource[] = [];

  const dfs = (
    idx: number,
    curLeft: number,
    curRight: number,
    coveredCount: number
  ) => {
    const curTotal = ownCoinsCost + curLeft + curRight;
    if (curTotal >= bestTotal && currentMissing.length === 0) return;

    if (idx === needed.length) {
      if (currentMissing.length === 0) {
        if (curTotal < bestTotal) {
          bestTotal = curTotal;
          bestLeft = curLeft;
          bestRight = curRight;
        }
      } else if (coveredCount > maxCovered) {
        maxCovered = coveredCount;
        bestMissing = [...currentMissing];
      }
      return;
    }

    const req = needed[idx]!;
    let matchedAny = false;

    // Deduplicate identical (source, options-key) unused slots at this depth for speed!
    const triedKeys = new Set<string>();

    for (let s = 0; s < sources.length; s++) {
      if (used[s]) continue;
      const slot = sources[s]!;
      if (!slot.options.includes(req)) continue;

      const dedupeKey = `${slot.source}:${slot.options.join(",")}`;
      if (triedKeys.has(dedupeKey)) continue;
      triedKeys.add(dedupeKey);

      const addCost = slotCost(slot.source, req);
      const nextLeft = slot.source === "left" ? curLeft + addCost : curLeft;
      const nextRight = slot.source === "right" ? curRight + addCost : curRight;
      if (currentMissing.length === 0 && ownCoinsCost + nextLeft + nextRight >= bestTotal) {
        continue;
      }

      matchedAny = true;
      used[s] = true;
      dfs(idx + 1, nextLeft, nextRight, coveredCount + 1);
      used[s] = false;
    }

    // Only record missing branch if we haven't already found a complete solution
    if (!matchedAny && bestTotal === Number.POSITIVE_INFINITY) {
      currentMissing.push(req);
      dfs(idx + 1, curLeft, curRight, coveredCount);
      currentMissing.pop();
    }
  };

  dfs(0, 0, 0, 0);

  if (bestTotal < Number.POSITIVE_INFINITY) {
    return {
      affordable: player.coins >= bestTotal,
      isDuplicate: false,
      isFreeChain: false,
      ownCoinsCost,
      leftTradeCoins: bestLeft,
      rightTradeCoins: bestRight,
      totalCoins: bestTotal,
      missingResources: [],
    };
  }

  return {
    affordable: false,
    isDuplicate: false,
    isFreeChain: false,
    ownCoinsCost,
    leftTradeCoins: 0,
    rightTradeCoins: 0,
    totalCoins: ownCoinsCost,
    missingResources: bestMissing,
  };
}

export function evaluateCardPlayability(
  state: DawnspireState,
  playerIdx: number,
  card: DawnCardDef
): TradePlan {
  const player = state.players[playerIdx]!;

  // Rule 1: Duplicate structure baseId is forbidden!
  if (player.builtCards.some((c) => c.baseId === card.baseId)) {
    return {
      affordable: false,
      isDuplicate: true,
      isFreeChain: false,
      ownCoinsCost: 0,
      leftTradeCoins: 0,
      rightTradeCoins: 0,
      totalCoins: 0,
      missingResources: [],
    };
  }

  // Rule 2: Free chain prerequisite!
  if (card.freeFrom && card.freeFrom.length > 0) {
    const matchedBase = card.freeFrom.find((reqId) =>
      player.builtCards.some((c) => c.baseId === reqId)
    );
    if (matchedBase) {
      return {
        affordable: true,
        isDuplicate: false,
        isFreeChain: true,
        chainSourceName: CARD_NAME_BY_BASE_ID[matchedBase] ?? matchedBase,
        ownCoinsCost: 0,
        leftTradeCoins: 0,
        rightTradeCoins: 0,
        totalCoins: 0,
        missingResources: [],
      };
    }
  }

  const { leftIdx, rightIdx } = getNeighbors(playerIdx, state.players.length);
  const leftNbr = state.players[leftIdx] ?? null;
  const rightNbr = rightIdx !== null ? state.players[rightIdx] ?? null : null;

  return evaluateCost(player, leftNbr, rightNbr, card.cost);
}

export function evaluateWonderStagePlayability(
  state: DawnspireState,
  playerIdx: number
): TradePlan | null {
  const player = state.players[playerIdx]!;
  const nextStage = player.wonder.stages[player.wonderStagesBuilt];
  if (!nextStage) return null;

  const { leftIdx, rightIdx } = getNeighbors(playerIdx, state.players.length);
  const leftNbr = state.players[leftIdx] ?? null;
  const rightNbr = rightIdx !== null ? state.players[rightIdx] ?? null : null;

  return evaluateCost(player, leftNbr, rightNbr, nextStage.cost);
}

/**
 * Exact Science scoring: T^2 + C^2 + G^2 + 7 * min(T, C, G),
 * automatically searching all assignments for Wild Science symbols!
 */
export function computeScienceScore(
  tablet: number,
  compass: number,
  gear: number,
  wildCount: number
): number {
  if (wildCount <= 0) {
    return (
      tablet * tablet +
      compass * compass +
      gear * gear +
      7 * Math.min(tablet, compass, gear)
    );
  }
  const a = computeScienceScore(tablet + 1, compass, gear, wildCount - 1);
  const b = computeScienceScore(tablet, compass + 1, gear, wildCount - 1);
  const c = computeScienceScore(tablet, compass, gear + 1, wildCount - 1);
  return Math.max(a, b, c);
}

function getScopedPlayers(
  state: DawnspireState,
  playerIdx: number,
  scope: "self" | "neighbors" | "all"
): DawnPlayerState[] {
  const me = state.players[playerIdx]!;
  if (scope === "self") return [me];
  const { leftIdx, rightIdx } = getNeighbors(playerIdx, state.players.length);
  const nbrs: DawnPlayerState[] = [state.players[leftIdx]!];
  if (rightIdx !== null && rightIdx !== leftIdx) {
    nbrs.push(state.players[rightIdx]!);
  }
  return scope === "neighbors" ? nbrs : [me, ...nbrs];
}

export function countCategoriesInScope(
  state: DawnspireState,
  playerIdx: number,
  categories: CardCategory[],
  scope: "self" | "neighbors" | "all"
): number {
  const targets = getScopedPlayers(state, playerIdx, scope);
  let total = 0;
  for (const p of targets) {
    for (const c of p.builtCards) {
      if (categories.includes(c.category)) total += 1;
    }
  }
  return total;
}

function scoreSingleGuildEffect(
  state: DawnspireState,
  playerIdx: number,
  effect: CardEffect
): number {
  let vp = 0;
  if (effect.vpPerCategory) {
    const cnt = countCategoriesInScope(
      state,
      playerIdx,
      effect.vpPerCategory.categories,
      effect.vpPerCategory.scope
    );
    vp += cnt * effect.vpPerCategory.amount;
  }
  if (effect.vpPerWonderStage) {
    const targets = getScopedPlayers(state, playerIdx, effect.vpPerWonderStage.scope);
    const stages = targets.reduce((acc, p) => acc + p.wonderStagesBuilt, 0);
    vp += stages * effect.vpPerWonderStage.amount;
  }
  if (effect.vpPerNeighborDefeat) {
    const nbrs = getScopedPlayers(state, playerIdx, "neighbors");
    const defs = nbrs.reduce((acc, p) => acc + p.militaryDefeats, 0);
    vp += defs * effect.vpPerNeighborDefeat;
  }
  return vp;
}

/**
 * Full 7-category Dawnspire Victory Point breakdown!
 */
export function computeFullScoreBreakdown(
  state: DawnspireState,
  playerIdx: number
): ScoreBreakdown {
  const player = state.players[playerIdx]!;
  const wonderEffects = getActiveWonderEffects(player);

  // 1. Military
  const military = player.militaryWinsVP - player.militaryDefeats;

  // 2. Treasury (3 Gold = +1 VP)
  const treasury = Math.floor(player.coins / 3);

  // 3. Wonder VP
  let wonder = 0;
  for (const eff of wonderEffects) {
    wonder += eff.vp ?? 0;
  }

  // 4. Civic (Blue)
  let civic = 0;
  for (const c of player.builtCards) {
    if (c.category === "civic") civic += c.effect.vp ?? 0;
  }

  // 5. Commerce (Yellow endgame VP)
  let commerce = 0;
  for (const c of player.builtCards) {
    if (c.category !== "commerce") continue;
    commerce += c.effect.vp ?? 0;
    if (c.effect.vpPerCategory) {
      const cnt = countCategoriesInScope(
        state,
        playerIdx,
        c.effect.vpPerCategory.categories,
        c.effect.vpPerCategory.scope
      );
      commerce += cnt * c.effect.vpPerCategory.amount;
    }
    if (c.effect.vpPerWonderStage) {
      const targets = getScopedPlayers(state, playerIdx, c.effect.vpPerWonderStage.scope);
      const stages = targets.reduce((acc, p) => acc + p.wonderStagesBuilt, 0);
      commerce += stages * c.effect.vpPerWonderStage.amount;
    }
  }

  // 6 & 7. Science & Guilds (coordinated when Golden Bazaar Side B copies Scholars Guild!)
  let tablet = 0;
  let compass = 0;
  let gear = 0;
  let wildScience = 0;

  for (const c of player.builtCards) {
    if (c.effect.science === "tablet") tablet += 1;
    if (c.effect.science === "compass") compass += 1;
    if (c.effect.science === "gear") gear += 1;
    if (c.effect.wildScience) wildScience += 1;
  }
  for (const eff of wonderEffects) {
    if (eff.wildScience) wildScience += 1;
  }

  let guild = 0;
  for (const c of player.builtCards) {
    if (c.category !== "guild") continue;
    guild += scoreSingleGuildEffect(state, playerIdx, c.effect);
  }

  const baseScience = computeScienceScore(tablet, compass, gear, wildScience);

  // Golden Bazaar Side B: copy highest-value Guild owned by either neighbor!
  let copiedBonus = 0;
  if (wonderEffects.some((e) => e.copyNeighborGuild)) {
    const nbrs = getScopedPlayers(state, playerIdx, "neighbors");
    for (const nbr of nbrs) {
      for (const c of nbr.builtCards) {
        if (c.category !== "guild") continue;
        if (c.effect.wildScience) {
          const withExtraWild = computeScienceScore(tablet, compass, gear, wildScience + 1);
          copiedBonus = Math.max(copiedBonus, withExtraWild - baseScience);
        } else {
          copiedBonus = Math.max(
            copiedBonus,
            scoreSingleGuildEffect(state, playerIdx, c.effect)
          );
        }
      }
    }
  }
  guild += copiedBonus;

  const science = baseScience;
  const total = military + treasury + wonder + civic + commerce + guild + science;

  return {
    military,
    treasury,
    wonder,
    civic,
    commerce,
    guild,
    science,
    total,
  };
}
