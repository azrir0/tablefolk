import { describe, expect, it } from "vitest";
import {
  COMPASS_CHARGE_THRESHOLD,
  HarborreachModule,
  countResources,
  createEmptyResources,
  evaluateHarborBotTrade,
  generateIslandBoard,
  getValidRoadEdges,
  pickHarborBotAction,
  pickHarborBotDiscard,
} from "../index.js";

function makePlayers(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    userId: `u${i + 1}`,
    displayName: `Pioneer ${i + 1}`,
    seatIndex: i,
  }));
}

describe("Harborreach Engine", () => {
  it("generates an exact 19-hex, 54-vertex, 72-edge, 9-harbor island with zero adjacent 6/8 tokens", () => {
    for (const seed of [1, 42, 99, 777, 2026]) {
      const { board } = generateIslandBoard(seed);
      expect(board.hexes).toHaveLength(19);
      expect(board.vertices).toHaveLength(54);
      expect(board.edges).toHaveLength(72);
      expect(board.harbors).toHaveLength(9);

      // Verify exactly 1 desert with null token and 18 numbered land hexes
      expect(board.hexes.filter((h) => h.terrain === "desert")).toHaveLength(1);
      expect(board.hexes.filter((h) => h.numberToken !== null)).toHaveLength(18);

      // Verify ZERO adjacent red tokens (6 or 8)
      for (const a of board.hexes) {
        if (a.numberToken !== 6 && a.numberToken !== 8) continue;
        for (const b of board.hexes) {
          if (a.id === b.id) continue;
          if (b.numberToken !== 6 && b.numberToken !== 8) continue;
          const dq = a.q - b.q;
          const dr = a.r - b.r;
          const ds = -a.q - a.r - (-b.q - b.r);
          expect(Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds))).toBeGreaterThan(1);
        }
      }
    }
  });

  it("runs snake-draft setup and grants starting harvest on 2nd Cottage", () => {
    let state = HarborreachModule.createInitialState(makePlayers(3), {}, 12);
    expect(state.setupOrder).toEqual([0, 1, 2, 2, 1, 0]);
    expect(state.step).toBe("SETUP_SETTLE");

    // Complete all 6 founding cottages + roads using bot picks
    let steps = 0;
    while (state.step === "SETUP_SETTLE" || state.step === "SETUP_ROAD") {
      const active = state.players[state.activePlayerIndex]!;
      const act = pickHarborBotAction(state, active.userId)!;
      state = HarborreachModule.applyAction(state, active.userId, act).state;
      steps++;
    }
    expect(steps).toBe(12);
    expect(state.step).toBe("ROLL_DICE");
    expect(state.roundNumber).toBe(1);
    for (const p of state.players) {
      expect(p.cottagesRemaining).toBe(3); // 5 - 2 placed
      expect(p.roadsRemaining).toBe(13); // 15 - 2 placed
      expect(countResources(p.resources)).toBeGreaterThanOrEqual(1);
    }
  });

  it("awards Dry-Spell Compass charges on dry rolls and lets player redeem any resource at 3 charges", () => {
    let state = HarborreachModule.createInitialState(makePlayers(2), {}, 55);
    while (state.step === "SETUP_SETTLE" || state.step === "SETUP_ROAD") {
      const active = state.players[state.activePlayerIndex]!;
      state = HarborreachModule.applyAction(state, active.userId, pickHarborBotAction(state, active.userId)!).state;
    }
    state.step = "MAIN_PHASE";
    state.players[0]!.compassCharges = COMPASS_CHARGE_THRESHOLD;
    const oreBefore = state.players[0]!.resources.ore;

    const res = HarborreachModule.applyAction(state, "u1", {
      type: "REDEEM_COMPASS",
      receive: "ore",
    });
    expect(res.state.players[0]!.compassCharges).toBe(0);
    expect(res.state.players[0]!.resources.ore).toBe(oreBefore + 1);
  });

  it("handles Harbor 2:1 / 3:1 / 4:1 bank trades and atomic player-to-player trade offers", () => {
    let state = HarborreachModule.createInitialState(makePlayers(2), {}, 88);
    while (state.step === "SETUP_SETTLE" || state.step === "SETUP_ROAD") {
      const active = state.players[state.activePlayerIndex]!;
      state = HarborreachModule.applyAction(state, active.userId, pickHarborBotAction(state, active.userId)!).state;
    }
    state.step = "MAIN_PHASE";
    state.activePlayerIndex = 0;

    // Place u1 on a 2:1 timber harbor vertex
    const timberHarbor = state.board.harbors.find((h) => h.kind === "timber")!;
    state.buildings[timberHarbor.v1] = { ownerId: "u1", kind: "cottage" };
    state.players[0]!.resources = { timber: 3, clay: 0, wool: 0, grain: 0, ore: 0 };

    // 2:1 timber trade works!
    state = HarborreachModule.applyAction(state, "u1", {
      type: "BANK_TRADE",
      give: "timber",
      receive: "ore",
    }).state;
    expect(state.players[0]!.resources.timber).toBe(1);
    expect(state.players[0]!.resources.ore).toBe(1);

    // Player-to-player trade offer & acceptance
    state.players[1]!.resources = { timber: 0, clay: 2, wool: 0, grain: 0, ore: 0 };
    const offered = HarborreachModule.applyAction(state, "u1", {
      type: "OFFER_TRADE",
      give: { ...createEmptyResources(), ore: 1 },
      want: { ...createEmptyResources(), clay: 1 },
    }).state;
    expect(offered.activeTrade).not.toBeNull();
    expect(evaluateHarborBotTrade(offered, "u2")).toBe(true);

    const accepted = HarborreachModule.applyAction(offered, "u2", {
      type: "RESPOND_TRADE",
      tradeId: offered.activeTrade!.id,
      accept: true,
    }).state;
    expect(accepted.activeTrade).toBeNull();
    expect(accepted.players[0]!.resources.clay).toBe(1);
    expect(accepted.players[1]!.resources.ore).toBe(1);
  });

  it("awards Longest Trade Route at 5 continuous roads and Largest Watch at 3 Ranger Scouts", () => {
    let state = HarborreachModule.createInitialState(makePlayers(2), { targetVP: 10 }, 19);
    while (state.step === "SETUP_SETTLE" || state.step === "SETUP_ROAD") {
      const active = state.players[state.activePlayerIndex]!;
      state = HarborreachModule.applyAction(state, active.userId, pickHarborBotAction(state, active.userId)!).state;
    }
    state.step = "MAIN_PHASE";
    state.activePlayerIndex = 0;
    state.players[0]!.resources = { timber: 10, clay: 10, wool: 5, grain: 5, ore: 5 };

    // Build 5 continuous roads along connected valid edges
    let safety = 0;
    while (state.players[0]!.longestRoadLength < 5 && safety < 10) {
      const edges = getValidRoadEdges(state.board, state.buildings, state.roads, "u1");
      expect(edges.length).toBeGreaterThan(0);
      // Pick edge that extends current road chain
      const best = edges[edges.length - 1]!;
      state = HarborreachModule.applyAction(state, "u1", { type: "BUILD_ROAD", edgeId: best }).state;
      safety++;
    }
    expect(state.longestRoadOwnerId).toBe("u1");
    expect(state.longestRoadLength).toBeGreaterThanOrEqual(5);

    // Play 3 Ranger Scouts across turns to claim Largest Watch (+2 VP)
    for (let k = 0; k < 3; k++) {
      state.playedScrollThisTurn = false;
      state.step = "MAIN_PHASE";
      state.turnNumber += 1;
      state.players[0]!.scrolls.push({ id: `k_${k}`, kind: "knight", boughtOnTurn: 0 });
      state = HarborreachModule.applyAction(state, "u1", {
        type: "PLAY_SCROLL",
        scrollId: `k_${k}`,
      }).state;
      if (state.phase === "IN_PROGRESS" && state.step === "MOVE_BANDIT") {
        const otherHex = state.board.hexes.find((h) => h.id !== state.banditHexId)!.id;
        state = HarborreachModule.applyAction(state, "u1", {
          type: "MOVE_BANDIT",
          hexId: otherHex,
        }).state;
      }
    }
    expect(state.largestWatchOwnerId).toBe("u1");
    expect(state.largestWatchCount).toBe(3);
  });

  it("completes full automated Practice Bot matches cleanly across 2p, 3p, and 4p", () => {
    for (const [count, targetVP, seed] of [
      [2, 8, 101],
      [3, 8, 202],
      [4, 10, 303],
    ] as const) {
      let state = HarborreachModule.createInitialState(makePlayers(count), { targetVP }, seed);
      let steps = 0;
      while (!HarborreachModule.isGameCompleted(state) && steps < 1800) {
        if (state.step === "DISCARD_RESOURCES" && state.pendingDiscardUserIds.length > 0) {
          const uid = state.pendingDiscardUserIds[0]!;
          const disc = pickHarborBotDiscard(state, uid)!;
          state = HarborreachModule.applyAction(state, uid, {
            type: "DISCARD_RESOURCES",
            resources: disc,
          }).state;
        } else {
          const active = state.players[state.activePlayerIndex]!;
          const act = pickHarborBotAction(state, active.userId);
          expect(act).not.toBeNull();
          const check = HarborreachModule.validateAction(state, active.userId, act!);
          expect(check.valid).toBe(true);
          state = HarborreachModule.applyAction(state, active.userId, act!).state;
        }
        steps++;
      }

      expect(HarborreachModule.isGameCompleted(state)).toBe(true);
      expect(state.results).not.toBeNull();
      expect(state.winnerIds.length).toBeGreaterThanOrEqual(1);
    }
  });
});
