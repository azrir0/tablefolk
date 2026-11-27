import {
  MAX_HAND_TOKENS,
  MAX_RESERVED_CARDS,
  SunstoneGuildModule,
  calculateCardPayment,
  countTokens,
  meetsPatronRequirements,
} from "./engine.js";
import {
  BASE_GEM_COLORS,
  type BaseGemColor,
  type RelicCard,
  type RelicTier,
  type SunstoneAction,
  type SunstonePlayerState,
  type SunstoneState,
  type TokenColor,
} from "./types.js";

function patronSynergyForColor(
  state: SunstoneState,
  player: SunstonePlayerState,
  color: BaseGemColor
): number {
  let score = 0;
  for (const pat of state.patrons) {
    const req = pat.requirements[color] ?? 0;
    if (req > player.bonuses[color]) {
      // Closer patrons count more!
      let remaining = 0;
      for (const c of BASE_GEM_COLORS) {
        remaining += Math.max(0, (pat.requirements[c] ?? 0) - player.bonuses[c]);
      }
      score += remaining <= 2 ? 2.5 : remaining <= 4 ? 1.4 : 0.7;
    }
  }
  return score;
}

function wouldTriggerPatron(
  state: SunstoneState,
  player: SunstonePlayerState,
  card: RelicCard
): boolean {
  const nextBonuses = {
    ...player.bonuses,
    [card.gem]: player.bonuses[card.gem] + card.bonusCount,
  };
  return state.patrons.some((pat) => meetsPatronRequirements(nextBonuses, pat));
}

function getAllMarketCards(state: SunstoneState): RelicCard[] {
  const list: RelicCard[] = [];
  for (const tier of [3, 2, 1] as RelicTier[]) {
    for (const c of state.market[tier]) {
      if (c) list.push(c);
    }
  }
  return list;
}

function scoreTargetCard(
  state: SunstoneState,
  player: SunstonePlayerState,
  card: RelicCard,
  isReserved: boolean
): { score: number; deficit: Record<BaseGemColor, number>; missing: number } {
  const pay = calculateCardPayment(player.tokens, player.bonuses, card);
  const deficit: Record<BaseGemColor, number> = {
    ruby: 0,
    sapphire: 0,
    emerald: 0,
    amethyst: 0,
    pearl: 0,
  };
  for (const c of BASE_GEM_COLORS) {
    deficit[c] = Math.max(0, pay.netCost[c] - player.tokens[c]);
  }

  const syn = patronSynergyForColor(state, player, card.gem);
  const patronBonus = wouldTriggerPatron(state, player, card) ? 14 : 0;
  const earlyGame = player.craftedCount < 5;
  const value =
    card.prestige * (earlyGame ? 4.5 : 7.5) +
    (card.bonusCount === 2 ? 4.5 : earlyGame ? 3.4 : 1.6) +
    syn * 2.2 +
    (card.catalyst ? 2.0 : 0) +
    patronBonus +
    (isReserved ? 3.5 : 0);

  const score = value / (pay.missingCount + 1.4);
  return { score, deficit, missing: pay.missingCount };
}

export function pickSunstoneBotAction(
  state: SunstoneState,
  userId: string
): SunstoneAction | null {
  const actor = state.players[state.activePlayerIndex];
  if (!actor || actor.userId !== userId || state.phase !== "IN_PROGRESS") {
    return null;
  }

  // 1. Multiple eligible Patrons -> claim first
  if (state.step === "CLAIM_PATRON" && state.pendingPatronIds.length > 0) {
    return { type: "CLAIM_PATRON", patronId: state.pendingPatronIds[0]! };
  }

  // 2. Excess gems (> 10) -> return least-needed non-gold gems first
  if (state.step === "DISCARD_GEMS") {
    const excess = countTokens(actor.tokens) - MAX_HAND_TOKENS;
    if (excess <= 0) return null;

    // Identify preferred colors from best targets
    const keepWeight: Record<TokenColor, number> = {
      ruby: 0,
      sapphire: 0,
      emerald: 0,
      amethyst: 0,
      pearl: 0,
      gold: 999,
    };
    const candidates: Array<{ card: RelicCard; reserved: boolean }> = [
      ...actor.reserved.map((r) => ({ card: r.card, reserved: true })),
      ...getAllMarketCards(state).map((card) => ({ card, reserved: false })),
    ];
    const ranked = candidates
      .map((c) => ({ ...c, eval: scoreTargetCard(state, actor, c.card, c.reserved) }))
      .sort((a, b) => b.eval.score - a.eval.score)
      .slice(0, 3);
    for (const r of ranked) {
      for (const col of BASE_GEM_COLORS) {
        const net = Math.max(0, (r.card.cost[col] ?? 0) - actor.bonuses[col]);
        if (net > 0) keepWeight[col] += r.eval.score * (net / 4);
      }
    }

    const temp = { ...actor.tokens };
    const discard: TokenColor[] = [];
    while (discard.length < excess) {
      const held = (Object.keys(temp) as TokenColor[]).filter((c) => temp[c] > 0);
      held.sort((a, b) => keepWeight[a] - keepWeight[b] || temp[b] - temp[a]);
      const pick = held[0];
      if (!pick) break;
      temp[pick] -= 1;
      discard.push(pick);
    }
    return { type: "DISCARD_GEMS", gems: discard };
  }

  // 3. MAIN_ACTION: Evaluate all affordable cards first!
  const affordable: Array<{
    action: SunstoneAction;
    score: number;
    card: RelicCard;
  }> = [];

  for (const slot of actor.reserved) {
    const pay = calculateCardPayment(actor.tokens, actor.bonuses, slot.card);
    if (pay.canAfford) {
      const triggersPatron = wouldTriggerPatron(state, actor, slot.card);
      const totalGain = slot.card.prestige + (triggersPatron ? 3 : 0);
      const hitsTarget = actor.prestige + totalGain >= state.config.targetPrestige;
      const syn = patronSynergyForColor(state, actor, slot.card.gem);
      const score =
        (hitsTarget ? 100 : 0) +
        totalGain * 7 +
        (slot.card.bonusCount === 2 ? 4.5 : 2.2) +
        syn * 2.4 +
        (slot.card.catalyst ? 1.8 : 0) +
        1.8 -
        pay.goldUsed * 0.7;
      affordable.push({
        action: { type: "BUY_CARD", cardId: slot.card.id, source: "reserved" },
        score,
        card: slot.card,
      });
    }
  }

  for (const card of getAllMarketCards(state)) {
    const pay = calculateCardPayment(actor.tokens, actor.bonuses, card);
    if (pay.canAfford) {
      const triggersPatron = wouldTriggerPatron(state, actor, card);
      const totalGain = card.prestige + (triggersPatron ? 3 : 0);
      const hitsTarget = actor.prestige + totalGain >= state.config.targetPrestige;
      const syn = patronSynergyForColor(state, actor, card.gem);
      const score =
        (hitsTarget ? 100 : 0) +
        totalGain * 7 +
        (card.bonusCount === 2 ? 4.5 : 2.2) +
        syn * 2.4 +
        (card.catalyst ? 1.8 : 0) -
        pay.goldUsed * 0.8;
      affordable.push({
        action: { type: "BUY_CARD", cardId: card.id, source: "market" },
        score,
        card,
      });
    }
  }

  if (affordable.length > 0) {
    affordable.sort((a, b) => b.score - a.score);
    const best = affordable[0]!;
    if (SunstoneGuildModule.validateAction(state, userId, best.action).valid) {
      return best.action;
    }
  }

  // 4. Compute top target cards to guide gem drafting & tactical reserving
  const allTargets = [
    ...actor.reserved.map((r) => ({ card: r.card, reserved: true })),
    ...getAllMarketCards(state).map((card) => ({ card, reserved: false })),
  ]
    .map((entry) => ({ ...entry, eval: scoreTargetCard(state, actor, entry.card, entry.reserved) }))
    .sort((a, b) => b.eval.score - a.eval.score);

  const primaryTarget = allTargets[0];
  const colorNeed: Record<BaseGemColor, number> = {
    ruby: 0,
    sapphire: 0,
    emerald: 0,
    amethyst: 0,
    pearl: 0,
  };

  for (let i = 0; i < Math.min(3, allTargets.length); i++) {
    const t = allTargets[i]!;
    const weight = i === 0 ? 3 : i === 1 ? 1.5 : 0.8;
    for (const c of BASE_GEM_COLORS) {
      if (t.eval.deficit[c] > 0) {
        colorNeed[c] += t.eval.deficit[c] * weight;
      }
    }
  }

  // 5. Tactical Reserve: lock a juicy Tier II/III card (prestige >= 2) if nearly ready & Gold available!
  const handCount = countTokens(actor.tokens);
  if (
    actor.reserved.length < MAX_RESERVED_CARDS &&
    primaryTarget &&
    !primaryTarget.reserved &&
    primaryTarget.card.prestige >= 2 &&
    primaryTarget.eval.missing <= 2 &&
    (state.bank.gold > 0 || handCount >= 8)
  ) {
    const reserveAct: SunstoneAction = {
      type: "RESERVE_MARKET",
      cardId: primaryTarget.card.id,
    };
    if (SunstoneGuildModule.validateAction(state, userId, reserveAct).valid) {
      return reserveAct;
    }
  }

  // 6. Take 2 of a single heavily-needed color if stack >= 4 and deficit >= 2
  const sortedNeedColors = [...BASE_GEM_COLORS].sort(
    (a, b) => colorNeed[b] - colorNeed[a] || state.bank[b] - state.bank[a]
  );
  if (primaryTarget) {
    const topCol = sortedNeedColors[0]!;
    if (
      primaryTarget.eval.deficit[topCol] >= 2 &&
      state.bank[topCol] >= 4 &&
      handCount <= 8
    ) {
      const takeTwo: SunstoneAction = { type: "TAKE_GEMS", gems: [topCol, topCol] };
      if (SunstoneGuildModule.validateAction(state, userId, takeTwo).valid) {
        return takeTwo;
      }
    }
  }

  // 7. Take up to 3 distinct base gems prioritized by need (staying crisp near 10-gem cap)
  const availOrdered = sortedNeedColors.filter((c) => state.bank[c] > 0);
  if (availOrdered.length > 0) {
    const maxNice = Math.max(1, Math.min(3, MAX_HAND_TOKENS - handCount + 1));
    const picked = availOrdered.slice(0, Math.min(3, maxNice));
    const takeThree: SunstoneAction = { type: "TAKE_GEMS", gems: picked };
    if (SunstoneGuildModule.validateAction(state, userId, takeThree).valid) {
      return takeThree;
    }
  }

  // 8. Fallback: reserve any market card or deck top if room left
  if (actor.reserved.length < MAX_RESERVED_CARDS) {
    const fallbackCard = getAllMarketCards(state)[0];
    if (fallbackCard) {
      const act: SunstoneAction = { type: "RESERVE_MARKET", cardId: fallbackCard.id };
      if (SunstoneGuildModule.validateAction(state, userId, act).valid) return act;
    }
    for (const tier of [1, 2, 3] as RelicTier[]) {
      if (state.decks[tier].length > 0) {
        return { type: "RESERVE_DECK", tier };
      }
    }
  }

  return null;
}
