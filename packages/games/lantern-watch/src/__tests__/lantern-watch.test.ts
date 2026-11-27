import { describe, expect, it } from "vitest";
import type { GamePlayerSeed } from "@tablefolk/game-engine";
import {
  LanternWatchModule,
  MISSION_CONFIG_BY_PLAYERS,
  pickLanternBotAction,
  type LanternMode,
  type LanternState,
} from "../index.js";

function makePlayers(count: number): GamePlayerSeed[] {
  return Array.from({ length: count }, (_, idx) => ({
    userId: `p${idx + 1}`,
    displayName: `Courier ${idx + 1}`,
    seatIndex: idx,
  }));
}

function approveCurrentProposal(state: LanternState): LanternState {
  let cur = state;
  for (const p of cur.players) {
    cur = LanternWatchModule.applyAction(cur, p.userId, {
      type: "CAST_VOTE",
      vote: "approve",
    }).state;
  }
  return cur;
}

function rejectCurrentProposal(state: LanternState): LanternState {
  let cur = state;
  for (const p of cur.players) {
    cur = LanternWatchModule.applyAction(cur, p.userId, {
      type: "CAST_VOTE",
      vote: "reject",
    }).state;
  }
  return cur;
}

describe("LanternWatchModule", () => {
  it("enforces canonical 4p–8p mission tables and role distributions", () => {
    for (const count of [4, 5, 6, 7, 8]) {
      const cfg = MISSION_CONFIG_BY_PLAYERS[count]!;
      const state = LanternWatchModule.createInitialState(
        makePlayers(count),
        { mode: "oracle" },
        100 + count
      );
      const loyal = state.players.filter((p) => p.faction === "loyal");
      const shadow = state.players.filter((p) => p.faction === "shadow");
      expect(loyal.length).toBe(cfg.loyalCount);
      expect(shadow.length).toBe(cfg.shadowCount);
      expect(state.missions.map((m) => m.teamSize)).toEqual(
        cfg.missions.map((m) => m.teamSize)
      );
      expect(state.missions[3]!.failsRequired).toBe(count >= 7 ? 2 : 1);

      const pub = LanternWatchModule.getPublicState(state);
      expect(pub.spyglassEnabled).toBe(count >= 5);
      // Roles stay hidden while in play
      expect(pub.players.every((p) => p.revealedRole === null)).toBe(true);
    }
  });

  it("isolates private role intel cleanly (Oracle, Warden, Veiled Mole, Classic)", () => {
    // 7p Oracle & Shade has Oracle, Warden, Nightblade, Mirage, Veiled Mole!
    const state7 = LanternWatchModule.createInitialState(
      makePlayers(7),
      { mode: "oracle" },
      4242
    );

    const oracle = state7.players.find((p) => p.role === "oracle")!;
    const warden = state7.players.find((p) => p.role === "warden")!;
    const nightblade = state7.players.find((p) => p.role === "nightblade")!;
    const mirage = state7.players.find((p) => p.role === "mirage")!;
    const veiled = state7.players.find((p) => p.role === "veiled_mole")!;
    const courier = state7.players.find((p) => p.role === "loyal_courier")!;

    // Oracle sees Nightblade + Mirage, NEVER Veiled Mole, and gets warning flag
    const oraclePriv = LanternWatchModule.getPrivateState(state7, oracle.userId);
    const oracleSightIds = oraclePriv.sightings.map((s) => s.userId);
    expect(oracleSightIds).toContain(nightblade.userId);
    expect(oracleSightIds).toContain(mirage.userId);
    expect(oracleSightIds).not.toContain(veiled.userId);
    expect(oraclePriv.veiledMoleWarning).toBe(true);
    expect(oraclePriv.allowedMissionCards).toEqual(["light"]);

    // Warden sees both Oracle and Mirage ambiguously (in seat order)
    const wardenPriv = LanternWatchModule.getPrivateState(state7, warden.userId);
    expect(wardenPriv.sightings.map((s) => s.userId).sort()).toEqual(
      [oracle.userId, mirage.userId].sort()
    );
    expect(wardenPriv.sightings.every((s) => s.kind === "oracle_candidate")).toBe(true);

    // Shadow Moles (including Veiled Mole) all know each other
    const nbPriv = LanternWatchModule.getPrivateState(state7, nightblade.userId);
    expect(nbPriv.sightings.map((s) => s.userId).sort()).toEqual(
      [mirage.userId, veiled.userId].sort()
    );
    expect(nbPriv.allowedMissionCards).toEqual(["light", "sabotage"]);

    const veiledPriv = LanternWatchModule.getPrivateState(state7, veiled.userId);
    expect(veiledPriv.sightings.map((s) => s.userId).sort()).toEqual(
      [nightblade.userId, mirage.userId].sort()
    );

    // Plain Loyal Courier sees nobody
    const courierPriv = LanternWatchModule.getPrivateState(state7, courier.userId);
    expect(courierPriv.sightings).toEqual([]);

    // Classic mode disables special roles & Brass Spyglass
    const stateClassic = LanternWatchModule.createInitialState(
      makePlayers(6),
      { mode: "classic" },
      99
    );
    expect(stateClassic.spyglassHolderId).toBeNull();
    expect(
      stateClassic.players.every(
        (p) => p.role === "loyal_courier" || p.role === "shadow_mole"
      )
    ).toBe(true);
  });

  it("rejects invalid actions including Loyal sabotage and non-commander proposals", () => {
    let state = LanternWatchModule.createInitialState(
      makePlayers(5),
      { mode: "classic" },
      777
    );
    const commander = state.players[state.commanderIndex]!;
    const other = state.players[(state.commanderIndex + 1) % 5]!;

    expect(
      LanternWatchModule.validateAction(state, other.userId, {
        type: "PROPOSE_TEAM",
        teamIds: [commander.userId, other.userId],
      }).valid
    ).toBe(false);

    expect(
      LanternWatchModule.validateAction(state, commander.userId, {
        type: "PROPOSE_TEAM",
        teamIds: [commander.userId],
      }).valid
    ).toBe(false);

    // Propose a team with at least one Loyal member
    const loyalPlayer = state.players.find((p) => p.faction === "loyal")!;
    const secondPlayer = state.players.find((p) => p.userId !== loyalPlayer.userId)!;
    state = LanternWatchModule.applyAction(state, commander.userId, {
      type: "PROPOSE_TEAM",
      teamIds: [loyalPlayer.userId, secondPlayer.userId],
    }).state;
    state = approveCurrentProposal(state);
    expect(state.phase).toBe("EXECUTE_MISSION");

    // Loyal player cannot sabotage!
    const sabCheck = LanternWatchModule.validateAction(state, loyalPlayer.userId, {
      type: "PLAY_MISSION_CARD",
      card: "sabotage",
    });
    expect(sabCheck.valid).toBe(false);
  });

  it("triggers Shadow Council Collapse win on 5 consecutive rejected votes (including ties)", () => {
    let state = LanternWatchModule.createInitialState(
      makePlayers(4),
      { mode: "classic" },
      555
    );

    for (let attempt = 1; attempt <= 5; attempt++) {
      const commander = state.players[state.commanderIndex]!;
      state = LanternWatchModule.applyAction(state, commander.userId, {
        type: "PROPOSE_TEAM",
        teamIds: [state.players[0]!.userId, state.players[1]!.userId],
      }).state;

      if (attempt === 1) {
        // Test 2-2 tie counts as REJECT!
        state = LanternWatchModule.applyAction(state, "p1", {
          type: "CAST_VOTE",
          vote: "approve",
        }).state;
        state = LanternWatchModule.applyAction(state, "p2", {
          type: "CAST_VOTE",
          vote: "approve",
        }).state;
        state = LanternWatchModule.applyAction(state, "p3", {
          type: "CAST_VOTE",
          vote: "reject",
        }).state;
        state = LanternWatchModule.applyAction(state, "p4", {
          type: "CAST_VOTE",
          vote: "reject",
        }).state;
      } else {
        state = rejectCurrentProposal(state);
      }

      expect(state.rejectTrack).toBe(attempt);
    }

    expect(state.phase).toBe("FINISHED");
    expect(state.winner).toBe("shadow");
    expect(state.winReason).toBe("COUNCIL_COLLAPSE");
    expect(LanternWatchModule.isGameCompleted(state)).toBe(true);
  });

  it("enforces Brass Spyglass after Mission 2, 2-fail Mission 4 at 7p, and Final Oracle Unmasking", () => {
    let state = LanternWatchModule.createInitialState(
      makePlayers(7),
      { mode: "oracle" },
      2026
    );
    const oracle = state.players.find((p) => p.role === "oracle")!;
    const nightblade = state.players.find((p) => p.role === "nightblade")!;
    const shadows = state.players.filter((p) => p.faction === "shadow");
    const loyals = state.players.filter((p) => p.faction === "loyal");

    // Mission 1 (size 2): 1 Shadow sabotages -> Shadow 1-0
    let cmd = state.players[state.commanderIndex]!;
    state = LanternWatchModule.applyAction(state, cmd.userId, {
      type: "PROPOSE_TEAM",
      teamIds: [loyals[0]!.userId, shadows[0]!.userId],
    }).state;
    state = approveCurrentProposal(state);
    state = LanternWatchModule.applyAction(state, loyals[0]!.userId, {
      type: "PLAY_MISSION_CARD",
      card: "light",
    }).state;
    state = LanternWatchModule.applyAction(state, shadows[0]!.userId, {
      type: "PLAY_MISSION_CARD",
      card: "sabotage",
    }).state;
    expect(state.shadowWins).toBe(1);
    expect(state.phase).toBe("PROPOSE_TEAM"); // No Spyglass after Mission 1

    // Mission 2 (size 3): All Loyal -> Loyal 1-1 -> triggers SPYGLASS_CHECK!
    cmd = state.players[state.commanderIndex]!;
    const m2Team = loyals.slice(0, 3).map((p) => p.userId);
    state = LanternWatchModule.applyAction(state, cmd.userId, {
      type: "PROPOSE_TEAM",
      teamIds: m2Team,
    }).state;
    state = approveCurrentProposal(state);
    for (const id of m2Team) {
      state = LanternWatchModule.applyAction(state, id, {
        type: "PLAY_MISSION_CARD",
        card: "light",
      }).state;
    }
    expect(state.loyalWins).toBe(1);
    expect(state.phase).toBe("SPYGLASS_CHECK");

    // Execute Brass Spyglass check and verify private report & lens handoff
    const holderId = state.spyglassHolderId!;
    const targetId = LanternWatchModule.getPublicState(state).spyglassEligibleTargetIds[0]!;
    const targetPlayer = state.players.find((p) => p.userId === targetId)!;
    state = LanternWatchModule.applyAction(state, holderId, {
      type: "USE_SPYGLASS",
      targetId,
    }).state;

    expect(state.phase).toBe("PROPOSE_TEAM");
    expect(state.spyglassHolderId).toBe(targetId);
    expect(state.spyglassUsedByIds).toContain(targetId);
    const holderPriv = LanternWatchModule.getPrivateState(state, holderId);
    expect(holderPriv.spyglassReports).toHaveLength(1);
    expect(holderPriv.spyglassReports[0]!.faction).toBe(targetPlayer.faction);
    // Another player does NOT see holder's private report
    const otherPriv = LanternWatchModule.getPrivateState(state, targetId);
    expect(otherPriv.spyglassReports).toHaveLength(0);

    // Mission 3 (size 3): All Loyal -> Loyal 2-1 -> triggers SPYGLASS_CHECK again
    cmd = state.players[state.commanderIndex]!;
    state = LanternWatchModule.applyAction(state, cmd.userId, {
      type: "PROPOSE_TEAM",
      teamIds: m2Team,
    }).state;
    state = approveCurrentProposal(state);
    for (const id of m2Team) {
      state = LanternWatchModule.applyAction(state, id, {
        type: "PLAY_MISSION_CARD",
        card: "light",
      }).state;
    }
    expect(state.loyalWins).toBe(2);
    expect(state.phase).toBe("SPYGLASS_CHECK");
    // Cannot inspect previous holder!
    expect(
      LanternWatchModule.validateAction(state, state.spyglassHolderId!, {
        type: "USE_SPYGLASS",
        targetId: holderId,
      }).valid
    ).toBe(false);
    const nextTarget = LanternWatchModule.getPublicState(state).spyglassEligibleTargetIds[0]!;
    state = LanternWatchModule.applyAction(state, state.spyglassHolderId!, {
      type: "USE_SPYGLASS",
      targetId: nextTarget,
    }).state;

    // Mission 4 (size 4, REQUIRES 2 FAILS!): 1 Sabotage still LIGHTS the beacon -> Loyal 3-1 -> ASSASSINATE_ORACLE!
    cmd = state.players[state.commanderIndex]!;
    const m4Team = [loyals[0]!.userId, loyals[1]!.userId, loyals[2]!.userId, shadows[0]!.userId];
    state = LanternWatchModule.applyAction(state, cmd.userId, {
      type: "PROPOSE_TEAM",
      teamIds: m4Team,
    }).state;
    state = approveCurrentProposal(state);
    for (const id of m4Team) {
      state = LanternWatchModule.applyAction(state, id, {
        type: "PLAY_MISSION_CARD",
        card: id === shadows[0]!.userId ? "sabotage" : "light",
      }).state;
    }
    expect(state.loyalWins).toBe(3);
    expect(state.lastMissionReveal?.sabotageCount).toBe(1);
    expect(state.lastMissionReveal?.outcome).toBe("loyal");
    expect(state.phase).toBe("ASSASSINATE_ORACLE");

    // Branch A: Nightblade misses Oracle -> Loyal wins (ORACLE_SURVIVED)
    const nonOracleLoyal = loyals.find((p) => p.userId !== oracle.userId)!;
    const missState = LanternWatchModule.applyAction(state, nightblade.userId, {
      type: "ASSASSINATE",
      targetId: nonOracleLoyal.userId,
    }).state;
    expect(missState.winner).toBe("loyal");
    expect(missState.winReason).toBe("ORACLE_SURVIVED");

    // Branch B: Nightblade hits Oracle -> Shadow steals win (ORACLE_ASSASSINATED)
    const hitState = LanternWatchModule.applyAction(state, nightblade.userId, {
      type: "ASSASSINATE",
      targetId: oracle.userId,
    }).state;
    expect(hitState.winner).toBe("shadow");
    expect(hitState.winReason).toBe("ORACLE_ASSASSINATED");
    expect(LanternWatchModule.getPublicState(hitState).players.every((p) => p.revealedRole !== null)).toBe(true);
  });

  it("advances every phase cleanly via onTurnTimeout", () => {
    let state = LanternWatchModule.createInitialState(
      makePlayers(5),
      { mode: "oracle" },
      314
    );
    expect(state.phase).toBe("PROPOSE_TEAM");
    state = LanternWatchModule.onTurnTimeout(state).state;
    expect(state.phase).toBe("VOTE_TEAM");
    state = LanternWatchModule.onTurnTimeout(state).state;
    expect(state.phase).toBe("EXECUTE_MISSION");
    state = LanternWatchModule.onTurnTimeout(state).state;
    expect(state.loyalWins).toBe(1);
    expect(state.phase).toBe("PROPOSE_TEAM");
  });

  it("completes full automated Practice Bot matches cleanly across 4p–8p in Classic & Oracle modes", () => {
    const scenarios: Array<{ count: number; mode: LanternMode; seed: number }> = [
      { count: 4, mode: "classic", seed: 101 },
      { count: 5, mode: "oracle", seed: 202 },
      { count: 6, mode: "oracle", seed: 303 },
      { count: 7, mode: "oracle", seed: 404 },
      { count: 8, mode: "classic", seed: 505 },
    ];

    for (const sc of scenarios) {
      let state = LanternWatchModule.createInitialState(
        makePlayers(sc.count),
        { mode: sc.mode },
        sc.seed
      );
      let steps = 0;

      while (!LanternWatchModule.isGameCompleted(state) && steps < 400) {
        const pub = LanternWatchModule.getPublicState(state);
        let acted = false;
        for (const p of state.players) {
          const priv = LanternWatchModule.getPrivateState(state, p.userId);
          const action = pickLanternBotAction(pub, priv, p.userId, sc.seed + steps * 31 + p.seatIndex);
          if (action) {
            const check = LanternWatchModule.validateAction(state, p.userId, action);
            expect(check.valid).toBe(true);
            state = LanternWatchModule.applyAction(state, p.userId, action).state;
            acted = true;
            steps++;
            break;
          }
        }
        expect(acted).toBe(true);
      }

      expect(LanternWatchModule.isGameCompleted(state)).toBe(true);
      const results = LanternWatchModule.getResults(state);
      expect(results).not.toBeNull();
      expect(results!.players).toHaveLength(sc.count);
      expect(results!.players.some((p) => p.isWinner)).toBe(true);
    }
  });
});
