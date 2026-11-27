import {
  computeFullScoreBreakdown,
  evaluateCardPlayability,
  evaluateWonderStagePlayability,
  getNeighbors,
  getPlayerShields,
  hasWonderFreeBuildAvailable,
} from "./solver";
import type { DawnspireAction, DawnspireState } from "./types";

/**
 * Smart Dawnspire Practice Bot:
 * Evaluates every legal option in hand (Build, Free Build, Wonder Stage, Sell) using
 * exact VP projections, resource synergy in Era I/II, military margin vs neighbors,
 * and free chain unlocks!
 */
export function pickDawnspireBotAction(
  state: DawnspireState,
  botUserId: string
): DawnspireAction | null {
  if (state.phase !== "IN_PROGRESS") return null;
  const pIdx = state.players.findIndex((p) => p.userId === botUserId);
  if (pIdx < 0) return null;
  const bot = state.players[pIdx]!;
  if (bot.pendingAction !== null || bot.hand.length === 0) return null;

  const { leftIdx, rightIdx } = getNeighbors(pIdx, state.players.length);
  const myShields = getPlayerShields(bot);
  const leftShields = getPlayerShields(state.players[leftIdx]!);
  const rightShields =
    rightIdx !== null ? getPlayerShields(state.players[rightIdx]!) : leftShields;
  const maxNbrShields = Math.max(leftShields, rightShields);

  const baseScore = computeFullScoreBreakdown(state, pIdx).total;
  const canFree = hasWonderFreeBuildAvailable(bot);
  const wonderPlan = evaluateWonderStagePlayability(state, pIdx);
  const nextStage = bot.wonder.stages[bot.wonderStagesBuilt] ?? null;

  let bestAction: DawnspireAction = {
    type: "SELL_CARD",
    cardId: bot.hand[0]!.id,
  };
  let bestValue = 1.4; // baseline value of selling a card for 3-4 Gold

  // Evaluate building each card in hand
  for (const card of bot.hand) {
    const plan = evaluateCardPlayability(state, pIdx, card);
    if (plan.isDuplicate) continue;

    const tryBuild = (useFreeBuild: boolean, goldCost: number) => {
      // Simulate immediate score delta
      bot.builtCards.push(card);
      const afterScore = computeFullScoreBreakdown(state, pIdx).total;
      bot.builtCards.pop();

      let val = (afterScore - baseScore) * 2.2;

      // Early-era engine value for resources & trade markets
      if (card.category === "raw" || card.category === "craft") {
        val += state.era === 1 ? 7.5 : state.era === 2 ? 4.8 : 1.0;
        if (card.effect.producesFixed && card.effect.producesFixed.length >= 2) {
          val += 2.2;
        }
      }
      if (card.category === "commerce") {
        val += state.era === 1 ? 5.2 : state.era === 2 ? 4.5 : 3.0;
        if (card.effect.coins) val += card.effect.coins * 0.45;
      }
      if (card.category === "science") {
        val += state.era === 1 ? 5.0 : state.era === 2 ? 5.2 : 3.5;
      }
      if (card.category === "military") {
        const added = card.effect.shields ?? 0;
        const neededToLead = maxNbrShields - myShields;
        if (neededToLead >= 0 && neededToLead < added + 1) {
          val += state.era === 1 ? 4.8 : state.era === 2 ? 6.5 : 8.5;
        } else {
          val += added * 1.3;
        }
      }
      if (card.chainsTo && card.chainsTo.length > 0 && state.era < 3) {
        val += 1.6;
      }
      if (plan.isFreeChain) {
        val += 2.0;
      }
      if (useFreeBuild) {
        // Save free build for valuable Era II/III structures (avoid wasting on cheap Era I cards)
        val += state.era === 1 ? -3.0 : 1.5;
      }

      // Penalize paying trade gold to neighbors
      val -= goldCost * 0.75;

      if (val > bestValue) {
        bestValue = val;
        bestAction = useFreeBuild
          ? { type: "BUILD_CARD", cardId: card.id, useFreeBuild: true }
          : { type: "BUILD_CARD", cardId: card.id };
      }
    };

    if (plan.affordable) {
      tryBuild(false, plan.totalCoins);
    } else if (canFree) {
      tryBuild(true, 0);
    }
  }

  // Evaluate building next Wonder stage (using least useful card in hand as tuck fuel!)
  if (wonderPlan && wonderPlan.affordable && nextStage) {
    let stageVal = (nextStage.effect.vp ?? 0) * 2.1;
    if (nextStage.effect.wildScience) stageVal += 9.5;
    if (nextStage.effect.freeBuildPerEra) stageVal += state.era < 3 ? 8.5 : 4.5;
    if (nextStage.effect.producesChoice) stageVal += state.era < 3 ? 8.0 : 2.5;
    if (nextStage.effect.coins) stageVal += nextStage.effect.coins * 0.5;
    if (nextStage.effect.shields) stageVal += nextStage.effect.shields * 3.0;
    if (nextStage.effect.copyNeighborGuild) stageVal += 7.5;
    if (nextStage.effect.rawTradeLeft || nextStage.effect.rawTradeRight) stageVal += 5.5;
    stageVal -= wonderPlan.totalCoins * 0.7;

    if (stageVal > bestValue) {
      // Tuck a card that is NOT currently affordable or least valuable
      const tuckCard =
        bot.hand.find((c) => !evaluateCardPlayability(state, pIdx, c).affordable) ??
        bot.hand[bot.hand.length - 1]!;
      bestValue = stageVal;
      bestAction = { type: "BUILD_WONDER", cardId: tuckCard.id };
    }
  }

  return bestAction;
}
