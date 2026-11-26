import { describe, expect, it } from "vitest";
import {
  VelvetMasqueModule,
  closeCurtainCall,
  pickVelvetMasqueBotAction,
  type VelvetMasqueState,
} from "../index.js";

function makePlayers(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    userId: `p${i + 1}`,
    displayName: `Guest ${i + 1}`,
    seatIndex: i,
  }));
}

describe("Velvet Masque Engine", () => {
  it("scales roster & Velvet Stage slots cleanly from 3 to 8 players and hides masks after Curtain Call", () => {
    const s3 = VelvetMasqueModule.createInitialState(makePlayers(3), {}, 101);
    expect(s3.step).toBe("CURTAIN_CALL");
    expect(s3.roster).toHaveLength(6);
    expect(s3.stageMasks).toHaveLength(3);

    // During Curtain Call, all masks & stage masks are visible to memorize
    const pubCurtain = VelvetMasqueModule.getPublicState(s3);
    expect(pubCurtain.players.every((p) => Boolean(p.revealedMask))).toBe(true);
    expect(pubCurtain.revealedStageMasks).toHaveLength(3);

    // After Curtain closes, ZERO masks leak in public state
    const closed = closeCurtainCall(s3).state;
    expect(closed.step).toBe("CHOOSE_ACTION");
    const pubHidden = VelvetMasqueModule.getPublicState(closed);
    expect(pubHidden.players.every((p) => p.revealedMask === undefined)).toBe(true);
    expect(pubHidden.revealedStageMasks).toBeUndefined();

    // 7p adds Taxmaster, 8p adds Taxmaster + Smuggler
    const s7 = VelvetMasqueModule.createInitialState(makePlayers(7), {}, 102);
    expect(s7.roster).toContain("taxmaster");
    expect(s7.stageMasks).toHaveLength(0);

    const s8 = VelvetMasqueModule.createInitialState(makePlayers(8), {}, 103);
    expect(s8.roster).toContain("taxmaster");
    expect(s8.roster).toContain("smuggler");
    expect(new Set(s8.players.map((p) => p.color)).size).toBe(8);
  });

  it("enforces 2 opening swap turns and hides real vs fake swap from public state", () => {
    let state = closeCurtainCall(
      VelvetMasqueModule.createInitialState(makePlayers(4), {}, 202)
    ).state;

    // Turn 1: Announce and Peek are blocked
    expect(
      VelvetMasqueModule.validateAction(state, "p1", { type: "PEEK_SELF" }).valid
    ).toBe(false);
    expect(
      VelvetMasqueModule.validateAction(state, "p1", {
        type: "ANNOUNCE_MASK",
        maskId: "monarch",
      }).valid
    ).toBe(false);

    const p1Before = state.players[0]!.mask;
    const p2Before = state.players[1]!.mask;

    // Turn 1: Real swap between p1 and p2
    state = VelvetMasqueModule.applyAction(state, "p1", {
      type: "INITIATE_SWAP",
      target: { kind: "PLAYER", userId: "p2" },
    }).state;
    expect(state.step).toBe("RESOLVE_SWAP");

    const swapRes = VelvetMasqueModule.applyAction(state, "p1", {
      type: "COMMIT_SWAP",
      actuallySwap: true,
    });
    state = swapRes.state;
    expect(state.players[0]!.mask).toBe(p2Before);
    expect(state.players[1]!.mask).toBe(p1Before);
    // Private confirmation exists only for p1
    expect(VelvetMasqueModule.getPrivateState(state, "p1").latestSwap?.actuallySwap).toBe(true);
    expect(VelvetMasqueModule.getPrivateState(state, "p2").latestSwap).toBeNull();

    // Turn 2: Fake swap by p2 with Stage 0
    const p2MaskT2 = state.players[1]!.mask;
    const stage0Before = state.stageMasks[0]!;
    state = VelvetMasqueModule.applyAction(state, "p2", {
      type: "INITIATE_SWAP",
      target: { kind: "STAGE", stageIndex: 0 },
    }).state;
    state = VelvetMasqueModule.applyAction(state, "p2", {
      type: "COMMIT_SWAP",
      actuallySwap: false,
    }).state;
    expect(state.players[1]!.mask).toBe(p2MaskT2);
    expect(state.stageMasks[0]).toBe(stage0Before);

    // Turn 3: Peek & Announce are now unlocked!
    expect(state.turnNumber).toBe(3);
    expect(
      VelvetMasqueModule.validateAction(state, "p3", { type: "PEEK_SELF" }).valid
    ).toBe(true);
    expect(
      VelvetMasqueModule.validateAction(state, "p3", {
        type: "ANNOUNCE_MASK",
        maskId: "monarch",
      }).valid
    ).toBe(true);
  });

  it("resolves unchallenged bluff without flipping and triggers simultaneous Showdown when challenged", () => {
    let state: VelvetMasqueState = closeCurtainCall(
      VelvetMasqueModule.createInitialState(makePlayers(4), {}, 303)
    ).state;
    state.turnNumber = 3;
    // Assign deterministic masks
    state.players[0]!.mask = "jester";
    state.players[1]!.mask = "monarch";
    state.players[2]!.mask = "patron";
    state.players[3]!.mask = "magistrate";

    // p1 bluffs Monarch — everyone passes!
    state = VelvetMasqueModule.applyAction(state, "p1", {
      type: "ANNOUNCE_MASK",
      maskId: "monarch",
    }).state;
    state = VelvetMasqueModule.applyAction(state, "p2", {
      type: "RESPOND_CHALLENGE",
      decision: "PASS",
    }).state;
    state = VelvetMasqueModule.applyAction(state, "p3", {
      type: "RESPOND_CHALLENGE",
      decision: "PASS",
    }).state;
    state = VelvetMasqueModule.applyAction(state, "p4", {
      type: "RESPOND_CHALLENGE",
      decision: "PASS",
    }).state;

    // p1 gets +3 Gold unchallenged, bluff counted, card never revealed!
    expect(state.players[0]!.coins).toBe(9);
    expect(state.players[0]!.bluffsWon).toBe(1);
    expect(VelvetMasqueModule.getPublicState(state).players[0]!.revealedMask).toBeUndefined();

    // Now p2's turn: p2 announces Patron (bluff!), p3 (actual Patron) & p4 (not Patron) BOTH challenge!
    state = VelvetMasqueModule.applyAction(state, "p2", {
      type: "ANNOUNCE_MASK",
      maskId: "patron",
    }).state;
    state = VelvetMasqueModule.applyAction(state, "p1", {
      type: "RESPOND_CHALLENGE",
      decision: "PASS",
    }).state;
    state = VelvetMasqueModule.applyAction(state, "p3", {
      type: "RESPOND_CHALLENGE",
      decision: "CHALLENGE",
    }).state;
    state = VelvetMasqueModule.applyAction(state, "p4", {
      type: "RESPOND_CHALLENGE",
      decision: "CHALLENGE",
    }).state;

    // Showdown: p2 & p4 pay 1 Gold fine each (Fine Box = 2), p3 wins Patron (+2 Gold -> 8) and enters RESOLVE_POWER!
    expect(state.fineBox).toBe(2);
    expect(state.players[1]!.coins).toBe(5);
    expect(state.players[3]!.coins).toBe(5);
    expect(state.players[2]!.coins).toBe(8);
    expect(state.step).toBe("RESOLVE_POWER");
    expect(state.pendingPower).toEqual({ executorId: "p3", maskId: "patron" });

    // Showdown revealed masks are publicly visible for claimants
    const pubSd = VelvetMasqueModule.getPublicState(state);
    expect(pubSd.players[1]!.revealedMask).toBe("monarch");
    expect(pubSd.players[2]!.revealedMask).toBe("patron");
    expect(pubSd.players[3]!.revealedMask).toBe("magistrate");
    expect(pubSd.players[0]!.revealedMask).toBeUndefined(); // p1 passed, stayed hidden!

    // p3 resolves Patron peek on Stage 0 -> private peek only for p3
    state = VelvetMasqueModule.applyAction(state, "p3", {
      type: "RESOLVE_PATRON_PEEK",
      target: { kind: "STAGE", stageIndex: 0 },
    }).state;
    expect(VelvetMasqueModule.getPrivateState(state, "p3").latestPeek?.maskId).toBe(
      state.stageMasks[0]
    );
    expect(state.step).toBe("CHOOSE_ACTION");
  });

  it("caps Magistrate Fine Box payout at 4 (+1 when empty) and caps Illusionist swap at ±4 Gold", () => {
    let state = closeCurtainCall(
      VelvetMasqueModule.createInitialState(makePlayers(4), {}, 404)
    ).state;
    state.turnNumber = 3;
    state.fineBox = 7;
    state.players[0]!.coins = 3;
    state.players[1]!.coins = 11;

    // p1 claims Magistrate unchallenged -> takes capped 4 Gold (7 -> 3 left in Fine Box)
    state = VelvetMasqueModule.applyAction(state, "p1", {
      type: "ANNOUNCE_MASK",
      maskId: "magistrate",
    }).state;
    for (const uid of ["p2", "p3", "p4"]) {
      state = VelvetMasqueModule.applyAction(state, uid, {
        type: "RESPOND_CHALLENGE",
        decision: "PASS",
      }).state;
    }
    expect(state.players[0]!.coins).toBe(7);
    expect(state.fineBox).toBe(3);

    // Test empty Fine Box stipend (+1 from Bank)
    state.fineBox = 0;
    state = VelvetMasqueModule.applyAction(state, "p2", {
      type: "ANNOUNCE_MASK",
      maskId: "magistrate",
    }).state;
    for (const uid of ["p1", "p3", "p4"]) {
      state = VelvetMasqueModule.applyAction(state, uid, {
        type: "RESPOND_CHALLENGE",
        decision: "PASS",
      }).state;
    }
    expect(state.players[1]!.coins).toBe(12);

    // Test Illusionist fortune swap cap: p3 has 2 Gold, p2 has 12 Gold -> transfer capped at 4 (p3->6, p2->8)
    state.players[2]!.coins = 2;
    state = VelvetMasqueModule.applyAction(state, "p3", {
      type: "ANNOUNCE_MASK",
      maskId: "illusionist",
    }).state;
    for (const uid of ["p1", "p2", "p4"]) {
      state = VelvetMasqueModule.applyAction(state, uid, {
        type: "RESPOND_CHALLENGE",
        decision: "PASS",
      }).state;
    }
    expect(state.step).toBe("RESOLVE_POWER");
    state = VelvetMasqueModule.applyAction(state, "p3", {
      type: "RESOLVE_ILLUSIONIST_SWAP",
      targetUserId: "p2",
    }).state;
    expect(state.players[2]!.coins).toBe(6);
    expect(state.players[1]!.coins).toBe(8);
  });

  it("prevents accidental 0-coin bankruptcy end, blocks broke players from challenging, and supports Smuggler heist", () => {
    let state = closeCurtainCall(
      VelvetMasqueModule.createInitialState(makePlayers(8), { targetCoins: 13 }, 505)
    ).state;
    state.turnNumber = 3;
    state.players[1]!.coins = 0; // broke player
    state.players[0]!.coins = 10; // at Smuggler heist threshold!

    // p1 announces Smuggler: p2 (0 coins) is auto-passed!
    state = VelvetMasqueModule.applyAction(state, "p1", {
      type: "ANNOUNCE_MASK",
      maskId: "smuggler",
    }).state;
    expect(state.pendingClaim?.responses["p2"]).toBe("PASS");
    expect(
      VelvetMasqueModule.validateAction(state, "p2", {
        type: "RESPOND_CHALLENGE",
        decision: "CHALLENGE",
      }).valid
    ).toBe(false);

    // Everyone else passes -> p1 wins immediately via Smuggler Heist at 10 Gold!
    for (const uid of ["p3", "p4", "p5", "p6", "p7", "p8"]) {
      state = VelvetMasqueModule.applyAction(state, uid, {
        type: "RESPOND_CHALLENGE",
        decision: "PASS",
      }).state;
    }
    expect(state.phase).toBe("COMPLETED");
    expect(state.winnerIds).toEqual(["p1"]);
    expect(state.endReason).toContain("Smuggler");
  });

  it("runs complete 4-player and 8-player bot matches cleanly to completion without deadlocks", () => {
    for (const count of [4, 8]) {
      let state = VelvetMasqueModule.createInitialState(
        makePlayers(count),
        { targetCoins: 10 },
        900 + count
      );
      let safetySteps = 0;

      while (state.phase === "IN_PROGRESS" && safetySteps < 500) {
        safetySteps += 1;
        if (state.step === "CURTAIN_CALL") {
          state = closeCurtainCall(state).state;
          continue;
        }
        if (state.step === "CHALLENGE_WINDOW" && state.pendingClaim) {
          for (const [uid, decision] of Object.entries(state.pendingClaim.responses)) {
            if (decision !== "PENDING") continue;
            const act = pickVelvetMasqueBotAction(state, uid, safetySteps);
            expect(act).not.toBeNull();
            state = VelvetMasqueModule.applyAction(state, uid, act!).state;
            if (state.step !== "CHALLENGE_WINDOW") break;
          }
          continue;
        }
        const actorId =
          state.step === "RESOLVE_SWAP"
            ? state.pendingSwap!.actorId
            : state.step === "RESOLVE_POWER"
              ? state.pendingPower!.executorId
              : state.players[state.activePlayerIndex]!.userId;
        const act = pickVelvetMasqueBotAction(state, actorId, safetySteps);
        expect(act).not.toBeNull();
        state = VelvetMasqueModule.applyAction(state, actorId, act!).state;
      }

      expect(state.phase).toBe("COMPLETED");
      expect(state.winnerIds.length).toBeGreaterThanOrEqual(1);
      expect(VelvetMasqueModule.getResults(state)).not.toBeNull();
    }
  });
});
