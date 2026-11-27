import { describe, expect, it } from "vitest";
import {
  BASE_GEM_COLORS,
  SunstoneGuildModule,
  buildAllRelicCards,
  calculateCardPayment,
  countTokens,
  pickSunstoneBotAction,
  type RelicCard,
} from "../index.js";

function makePlayers(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    userId: `u${i + 1}`,
    displayName: `Artisan ${i + 1}`,
    seatIndex: i,
  }));
}

describe("Sunstone Guild Engine", () => {
  it("builds a completely symmetric 90-card deck across all 5 colors", () => {
    const decks = buildAllRelicCards();
    expect(decks[1]).toHaveLength(40);
    expect(decks[2]).toHaveLength(30);
    expect(decks[3]).toHaveLength(20);

    for (const c of BASE_GEM_COLORS) {
      expect(decks[1].filter((card) => card.gem === c)).toHaveLength(8);
      expect(decks[1].filter((card) => card.gem === c && card.catalyst)).toHaveLength(1);
      expect(decks[2].filter((card) => card.gem === c)).toHaveLength(6);
      expect(decks[3].filter((card) => card.gem === c)).toHaveLength(4);
      expect(decks[3].filter((card) => card.gem === c && card.bonusCount === 2)).toHaveLength(1);
    }
  });

  it("scales bank supplies and face-up Patrons accurately for 2, 3, and 4 players", () => {
    const s2 = SunstoneGuildModule.createInitialState(makePlayers(2), {}, 42);
    expect(s2.bank.ruby).toBe(4);
    expect(s2.bank.gold).toBe(5);
    expect(s2.patrons).toHaveLength(3);
    expect(s2.market[1]).toHaveLength(4);
    expect(s2.market[2]).toHaveLength(4);
    expect(s2.market[3]).toHaveLength(4);

    const s3 = SunstoneGuildModule.createInitialState(makePlayers(3), {}, 42);
    expect(s3.bank.ruby).toBe(5);
    expect(s3.patrons).toHaveLength(4);

    const s4 = SunstoneGuildModule.createInitialState(makePlayers(4), {}, 42);
    expect(s4.bank.ruby).toBe(7);
    expect(s4.patrons).toHaveLength(5);
  });

  it("enforces Take-2 (>= 4 in bank) and Take-3 distinct rules cleanly", () => {
    let state = SunstoneGuildModule.createInitialState(makePlayers(2), {}, 7);
    // 2p bank starts at 4 ruby -> taking 2 ruby IS legal!
    expect(
      SunstoneGuildModule.validateAction(state, "u1", {
        type: "TAKE_GEMS",
        gems: ["ruby", "ruby"],
      }).valid
    ).toBe(true);

    state = SunstoneGuildModule.applyAction(state, "u1", {
      type: "TAKE_GEMS",
      gems: ["ruby", "ruby"],
    }).state;
    expect(state.bank.ruby).toBe(2);
    expect(state.players[0]!.tokens.ruby).toBe(2);

    // Now ruby bank is 2 (< 4) -> u2 taking 2 ruby must FAIL!
    const badTake2 = SunstoneGuildModule.validateAction(state, "u2", {
      type: "TAKE_GEMS",
      gems: ["ruby", "ruby"],
    });
    expect(badTake2.valid).toBe(false);

    // Taking 3 distinct colors succeeds!
    const res = SunstoneGuildModule.applyAction(state, "u2", {
      type: "TAKE_GEMS",
      gems: ["ruby", "sapphire", "emerald"],
    });
    expect(res.state.players[1]!.tokens.ruby).toBe(1);
    expect(res.state.players[1]!.tokens.sapphire).toBe(1);
    expect(res.state.players[1]!.tokens.emerald).toBe(1);
  });

  it("enforces the 10-gem hand cap with DISCARD_GEMS flow", () => {
    let state = SunstoneGuildModule.createInitialState(makePlayers(4), {}, 11);
    state.players[0]!.tokens = {
      ruby: 3,
      sapphire: 3,
      emerald: 3,
      amethyst: 0,
      pearl: 0,
      gold: 0,
    };
    // 9 gems + 3 taken = 12 -> must discard exactly 2!
    const taken = SunstoneGuildModule.applyAction(state, "u1", {
      type: "TAKE_GEMS",
      gems: ["amethyst", "pearl", "ruby"],
    });
    state = taken.state;
    expect(state.step).toBe("DISCARD_GEMS");
    expect(state.activePlayerIndex).toBe(0);
    expect(SunstoneGuildModule.getPrivateState(state, "u1").excessGemsToDiscard).toBe(2);

    // Wrong discard count fails
    expect(
      SunstoneGuildModule.validateAction(state, "u1", {
        type: "DISCARD_GEMS",
        gems: ["ruby"],
      }).valid
    ).toBe(false);

    // Exact 2-gem discard finishes turn cleanly
    const afterDiscard = SunstoneGuildModule.applyAction(state, "u1", {
      type: "DISCARD_GEMS",
      gems: ["ruby", "sapphire"],
    });
    expect(countTokens(afterDiscard.state.players[0]!.tokens)).toBe(10);
    expect(afterDiscard.state.step).toBe("MAIN_ACTION");
    expect(afterDiscard.state.activePlayerIndex).toBe(1);
  });

  it("applies discounts, auto-Gold wilds, Catalyst ⚡ bonus gem, and 2× Masterworks accurately", () => {
    let state = SunstoneGuildModule.createInitialState(makePlayers(2), {}, 21);
    const catalystCard: RelicCard = {
      id: "test_cat",
      tier: 1,
      name: "Ember Kiln",
      gem: "ruby",
      bonusCount: 1,
      prestige: 0,
      cost: { sapphire: 3 },
      catalyst: true,
    };
    state.market[1][0] = catalystCard;
    state.players[0]!.bonuses.sapphire = 1;
    state.players[0]!.tokens.sapphire = 1;
    state.players[0]!.tokens.gold = 1;

    const pay = calculateCardPayment(
      state.players[0]!.tokens,
      state.players[0]!.bonuses,
      catalystCard
    );
    expect(pay.canAfford).toBe(true);
    expect(pay.basePaid.sapphire).toBe(1);
    expect(pay.goldUsed).toBe(1);

    const bankRubyBefore = state.bank.ruby;
    const res = SunstoneGuildModule.applyAction(state, "u1", {
      type: "BUY_CARD",
      cardId: "test_cat",
      source: "market",
    });
    const p0 = res.state.players[0]!;
    expect(p0.bonuses.ruby).toBe(1);
    expect(p0.tokens.sapphire).toBe(0);
    expect(p0.tokens.gold).toBe(0);
    // Catalyst refunded +1 Ruby from bank!
    expect(p0.tokens.ruby).toBe(1);
    expect(res.state.bank.ruby).toBe(bankRubyBefore - 1);
    expect(res.events.some((e) => e.type === "CATALYST_TRIGGERED")).toBe(true);

    // Test 2x Grand Masterwork bonusCount
    const masterwork: RelicCard = {
      id: "test_mw",
      tier: 3,
      name: "Sunstone Crown Prism",
      gem: "emerald",
      bonusCount: 2,
      prestige: 3,
      cost: { ruby: 1 },
    };
    res.state.market[3][0] = masterwork;
    res.state.activePlayerIndex = 0;
    const mwRes = SunstoneGuildModule.applyAction(res.state, "u1", {
      type: "BUY_CARD",
      cardId: "test_mw",
      source: "market",
    });
    expect(mwRes.state.players[0]!.bonuses.emerald).toBe(2);
    expect(mwRes.state.players[0]!.prestige).toBe(3);
  });

  it("keeps blind deck reserves strictly hidden in public state while visible to the owner", () => {
    let state = SunstoneGuildModule.createInitialState(makePlayers(2), {}, 99);
    const res = SunstoneGuildModule.applyAction(state, "u1", {
      type: "RESERVE_DECK",
      tier: 2,
    });
    state = res.state;

    // u1 gained 1 Gold wild
    expect(state.players[0]!.tokens.gold).toBe(1);

    // Public state hides the blind card details!
    const pub = SunstoneGuildModule.getPublicState(state);
    expect(pub.players[0]!.reserved).toHaveLength(1);
    expect(pub.players[0]!.reserved[0]!.isBlind).toBe(true);
    expect(pub.players[0]!.reserved[0]!.card).toBeNull();

    // Private state for u1 reveals the exact card; u2 does NOT see u1's reserve!
    const priv1 = SunstoneGuildModule.getPrivateState(state, "u1");
    expect(priv1.reserved).toHaveLength(1);
    expect(priv1.reserved[0]!.card.tier).toBe(2);
    expect(priv1.reserved[0]!.card.name.length).toBeGreaterThan(0);

    const priv2 = SunstoneGuildModule.getPrivateState(state, "u2");
    expect(priv2.reserved).toHaveLength(0);
  });

  it("handles single auto-claimed Patron and multi-Patron CLAIM_PATRON choice + equal-turns Final Round + tiebreaker", () => {
    let state = SunstoneGuildModule.createInitialState(makePlayers(2), { targetPrestige: 12 }, 5);
    // Give u1 11 prestige and bonuses right on the edge of TWO patrons!
    state.patrons = [
      {
        id: "p_a",
        name: "Patron A",
        title: "A",
        prestige: 3,
        requirements: { ruby: 3, sapphire: 3 },
        icon: "sg-patron",
      },
      {
        id: "p_b",
        name: "Patron B",
        title: "B",
        prestige: 3,
        requirements: { ruby: 3, emerald: 3 },
        icon: "sg-patron",
      },
    ];
    state.patronCatalogById["p_a"] = state.patrons[0]!;
    state.patronCatalogById["p_b"] = state.patrons[1]!;

    state.players[0]!.prestige = 11;
    state.players[0]!.craftedCount = 5;
    state.players[0]!.bonuses = { ruby: 2, sapphire: 3, emerald: 3, amethyst: 0, pearl: 0 };
    state.market[1][0] = {
      id: "trigger_card",
      tier: 1,
      name: "Free Ruby",
      gem: "ruby",
      bonusCount: 1,
      prestige: 0,
      cost: {},
    };

    // Buying Free Ruby meets BOTH Patrons -> enters CLAIM_PATRON step!
    const res1 = SunstoneGuildModule.applyAction(state, "u1", {
      type: "BUY_CARD",
      cardId: "trigger_card",
      source: "market",
    });
    expect(res1.state.step).toBe("CLAIM_PATRON");
    expect(res1.state.pendingPatronIds).toEqual(["p_a", "p_b"]);

    // u1 claims Patron B -> hits 14 Prestige -> triggers Final Round, passes to u2 for equal turns!
    const res2 = SunstoneGuildModule.applyAction(res1.state, "u1", {
      type: "CLAIM_PATRON",
      patronId: "p_b",
    });
    expect(res2.state.phase).toBe("IN_PROGRESS");
    expect(res2.state.finalRoundTriggered).toBe(true);
    expect(res2.state.activePlayerIndex).toBe(1);
    expect(res2.state.players[0]!.prestige).toBe(14);
    expect(res2.state.players[0]!.craftedCount).toBe(6);

    // Give u2 14 Prestige too, with FEWER crafted cards (4 vs 6) -> u2 must win tiebreaker!
    res2.state.players[1]!.prestige = 14;
    res2.state.players[1]!.craftedCount = 4;
    const res3 = SunstoneGuildModule.applyAction(res2.state, "u2", {
      type: "TAKE_GEMS",
      gems: ["ruby"],
    });
    expect(res3.state.phase).toBe("GAME_END");
    expect(res3.state.winnerIds).toEqual(["u2"]);
    expect(res3.state.results?.players[0]?.userId).toBe("u2");
  });

  it("completes full automated Practice Bot matches cleanly across 2p, 3p, and 4p", () => {
    for (const [count, targetPrestige, seed] of [
      [2, 12, 101],
      [3, 15, 202],
      [4, 15, 303],
    ] as const) {
      let state = SunstoneGuildModule.createInitialState(
        makePlayers(count),
        { targetPrestige },
        seed
      );
      let safety = 0;
      while (!SunstoneGuildModule.isGameCompleted(state) && safety < 350) {
        const active = state.players[state.activePlayerIndex]!;
        const act = pickSunstoneBotAction(state, active.userId);
        expect(act).not.toBeNull();
        const check = SunstoneGuildModule.validateAction(state, active.userId, act!);
        expect(check.valid).toBe(true);
        state = SunstoneGuildModule.applyAction(state, active.userId, act!).state;
        safety++;
      }

      expect(SunstoneGuildModule.isGameCompleted(state)).toBe(true);
      expect(state.results).not.toBeNull();
      expect(state.winnerIds.length).toBeGreaterThanOrEqual(1);
      // Winner reached at least targetPrestige (no premature stalemate!)
      const topScore = Math.max(...state.players.map((p) => p.prestige));
      expect(topScore).toBeGreaterThanOrEqual(targetPrestige);
    }
  });
});
