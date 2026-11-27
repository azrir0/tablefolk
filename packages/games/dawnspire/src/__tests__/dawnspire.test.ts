import { describe, expect, it } from "vitest";
import {
  buildEraDeck,
  computeScienceScore,
  DawnspireModule,
  evaluateCardPlayability,
  pickDawnspireBotAction,
  type DawnCardDef,
  type DawnspireState,
} from "../index";

function makePlayers(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    userId: `u_${i + 1}`,
    displayName: `Kingdom ${i + 1}`,
    seatIndex: i,
  }));
}

describe("Dawnspire Engine & Systems", () => {
  it("builds exact 7 * max(3, playerCount) decks across all Eras and player counts 2..7", () => {
    for (const playerCount of [2, 3, 4, 5, 6, 7]) {
      const expected = Math.max(3, playerCount) * 7;
      for (const era of [1, 2, 3] as const) {
        const deck = buildEraDeck(era, playerCount);
        expect(deck.length, `era=${era}, players=${playerCount}`).toBe(expected);
        const ids = new Set(deck.map((c) => c.id));
        expect(ids.size).toBe(expected);
      }
    }
  });

  it("solves resource costs, neighbor trades, 1g discounts, free chains, and duplicates accurately", () => {
    const state = DawnspireModule.createInitialState(
      makePlayers(3),
      { wonderSide: "sunlit" },
      42
    );
    const me = state.players[0]!;
    const left = state.players[2]!;
    const right = state.players[1]!;

    me.wonder = { ...me.wonder, startingResource: "timber" };
    left.wonder = { ...left.wonder, startingResource: "stone" };
    right.wonder = { ...right.wonder, startingResource: "clay" };
    me.coins = 5;

    me.builtCards.push({
      id: "c_west",
      baseId: "west_post",
      name: "West Trading Post",
      era: 1,
      category: "commerce",
      cost: {},
      effect: { rawTradeLeft: true },
      shortEffect: "Left Raw = 1g",
    });

    const testCard: DawnCardDef = {
      id: "c_test",
      baseId: "test_monument",
      name: "Test Monument",
      era: 2,
      category: "civic",
      cost: { resources: { timber: 1, stone: 1, clay: 1 } },
      effect: { vp: 5 },
      shortEffect: "+5 ★",
    };

    const plan = evaluateCardPlayability(state, 0, testCard);
    expect(plan.affordable).toBe(true);
    expect(plan.leftTradeCoins).toBe(1);
    expect(plan.rightTradeCoins).toBe(2);
    expect(plan.totalCoins).toBe(3);

    const dupPlan = evaluateCardPlayability(state, 0, me.builtCards[0]!);
    expect(dupPlan.isDuplicate).toBe(true);
    expect(dupPlan.affordable).toBe(false);

    const forumCard: DawnCardDef = {
      id: "c_forum",
      baseId: "forum",
      name: "Grand Forum",
      era: 2,
      category: "commerce",
      cost: { resources: { clay: 2 } },
      freeFrom: ["west_post", "east_post"],
      effect: { producesChoice: ["glass", "silk"] },
      shortEffect: "Wild Craft",
    };
    const chainPlan = evaluateCardPlayability(state, 0, forumCard);
    expect(chainPlan.isFreeChain).toBe(true);
    expect(chainPlan.affordable).toBe(true);
    expect(chainPlan.totalCoins).toBe(0);
  });

  it("optimizes nonlinear Science scoring with Wild Science symbols", () => {
    expect(computeScienceScore(1, 1, 0, 1)).toBe(10);
    expect(computeScienceScore(2, 1, 1, 1)).toBe(18);
    expect(computeScienceScore(2, 2, 2, 0)).toBe(26);
  });

  it("applies Sunlit Caravan Bonus (+4g) only to lowest-gold players on Sell", () => {
    let state = DawnspireModule.createInitialState(makePlayers(3), {}, 99);
    state.players[0]!.coins = 2;
    state.players[1]!.coins = 5;
    state.players[2]!.coins = 5;

    for (const p of state.players) {
      const res = DawnspireModule.applyAction(state, p.userId, {
        type: "SELL_CARD",
        cardId: p.hand[0]!.id,
      });
      state = res.state;
    }

    expect(state.players[0]!.coins).toBe(6);
    expect(state.players[1]!.coins).toBe(8);
    expect(state.players[2]!.coins).toBe(8);
    expect(state.turnInEra).toBe(2);
  });

  it("plays complete automated Practice Bot matches to victory across 2p, 3p, 5p (Starlit), and 7p", () => {
    const configs: Array<{ players: number; side: "sunlit" | "starlit"; seed: number }> = [
      { players: 2, side: "sunlit", seed: 101 },
      { players: 3, side: "sunlit", seed: 202 },
      { players: 5, side: "starlit", seed: 303 },
      { players: 7, side: "sunlit", seed: 404 },
    ];

    for (const cfg of configs) {
      let state: DawnspireState = DawnspireModule.createInitialState(
        makePlayers(cfg.players),
        { wonderSide: cfg.side },
        cfg.seed
      );
      let safety = 0;
      while (!DawnspireModule.isGameCompleted(state) && safety < 200) {
        safety += 1;
        for (const p of state.players) {
          if (DawnspireModule.isGameCompleted(state)) break;
          if (p.pendingAction !== null) continue;
          const act = pickDawnspireBotAction(state, p.userId);
          expect(act).not.toBeNull();
          state = DawnspireModule.applyAction(state, p.userId, act!).state;
        }
      }

      expect(DawnspireModule.isGameCompleted(state)).toBe(true);
      expect(state.winnerIds.length).toBeGreaterThanOrEqual(1);
      expect(state.era).toBe(3);

      for (const p of state.players) {
        expect(p.finalScore).not.toBeNull();
        const s = p.finalScore!;
        expect(
          s.military + s.treasury + s.wonder + s.civic + s.commerce + s.guild + s.science
        ).toBe(s.total);
        expect(s.total).toBeGreaterThanOrEqual(5);
      }
    }
  });
});
