import { describe, expect, it } from "vitest";
import {
  BASE_CAMP_COORD,
  TreasureTrailsModule,
  VAULT_COORDS,
  canPlacePathTile,
  coordKey,
  createExpeditionDeck,
  createRolePool,
  rotateEdges180,
  type PathCard,
  type TreasureTrailsCard,
  type TreasureTrailsState,
} from "../index.js";

const FOUR_PLAYERS = [
  { userId: "p1", displayName: "Milo", seatIndex: 0 },
  { userId: "p2", displayName: "Luna", seatIndex: 1 },
  { userId: "p3", displayName: "Kai", seatIndex: 2 },
  { userId: "p4", displayName: "Bryn", seatIndex: 3 },
];

describe("Treasure Trails — Deck, Roles & Privacy", () => {
  it("builds the exact 66-card balanced expedition deck", () => {
    const deck = createExpeditionDeck();
    expect(deck).toHaveLength(66);
    const paths = deck.filter((c) => c.kind === "PATH");
    const openPaths = paths.filter((c) => c.connectedCenter);
    const deadEnds = paths.filter((c) => !c.connectedCenter);
    expect(paths).toHaveLength(40);
    expect(openPaths).toHaveLength(31);
    expect(deadEnds).toHaveLength(9);
    expect(deck.filter((c) => c.kind === "HAZARD")).toHaveLength(9);
    expect(deck.filter((c) => c.kind === "REPAIR")).toHaveLength(9);
    expect(deck.filter((c) => c.kind === "SPYGLASS")).toHaveLength(5);
    expect(deck.filter((c) => c.kind === "BOULDER_CLEAR")).toHaveLength(3);
  });

  it("scales roles cleanly across 3 to 8 players", () => {
    for (let count = 3; count <= 8; count++) {
      const fixed = createRolePool(count, false);
      expect(fixed).toHaveLength(count);
      expect(fixed.filter((r) => r === "TRICKSTER").length).toBeGreaterThanOrEqual(1);
    }
    const mystery5 = createRolePool(5, true);
    expect(mystery5).toHaveLength(6); // 1 extra card stays hidden in the envelope
  });

  it("never leaks private roles, hands, or unrevealed vault contents in public or display state", () => {
    const state = TreasureTrailsModule.createInitialState(FOUR_PLAYERS, { totalRounds: 1 }, 42);
    const pub = TreasureTrailsModule.getPublicState(state);
    const display = TreasureTrailsModule.getDisplayState(state);

    for (const p of pub.players) {
      expect(p.revealedRole).toBeUndefined();
      expect((p as unknown as { hand?: unknown }).hand).toBeUndefined();
    }

    for (const v of VAULT_COORDS) {
      const cell = pub.board[coordKey(v.x, v.y)]!;
      expect(cell.vaultRevealed).toBe(false);
      expect(cell.vaultKind).toBeUndefined();
      expect(cell.edges).toBeNull();
    }

    expect(display.displayMode).toBe(true);
    expect(display.board[coordKey(8, 0)]?.vaultKind).toBeUndefined();

    const priv1 = TreasureTrailsModule.getPrivateState(state, "p1");
    const priv2 = TreasureTrailsModule.getPrivateState(state, "p2");
    expect(priv1.hand).toHaveLength(6);
    expect(priv2.hand).toHaveLength(6);
    expect(priv1.hand.map((c) => c.id)).not.toEqual(priv2.hand.map((c) => c.id));
  });

  it("produces deterministic identical games for the same RNG seed", () => {
    const a = TreasureTrailsModule.createInitialState(FOUR_PLAYERS, { totalRounds: 3 }, 98765);
    const b = TreasureTrailsModule.createInitialState(FOUR_PLAYERS, { totalRounds: 3 }, 98765);
    expect(a).toEqual(b);
  });
});

describe("Treasure Trails — Board Rules, Action Cards & Field-Patch", () => {
  it("validates 180-degree flips, border matching, and prevents extending through dead ends", () => {
    const state = TreasureTrailsModule.createInitialState(FOUR_PLAYERS, {}, 101);
    const tNorth: PathCard = {
      id: "test_t",
      kind: "PATH",
      variant: "t_horiz",
      label: "Horizontal Fork",
      edges: { N: true, E: true, S: false, W: true },
      connectedCenter: true,
    };
    const flipped = rotateEdges180(tNorth.edges);
    expect(flipped).toEqual({ N: false, E: true, S: true, W: true });

    // Valid next to Base Camp (0,2) at (1,2)
    expect(canPlacePathTile(state.board, tNorth, 1, 2, 0).ok).toBe(true);

    // Invalid floating tile disconnected from Base Camp
    expect(canPlacePathTile(state.board, tNorth, 4, 2, 0).ok).toBe(false);

    // Place a Dead-End tile at (1,2) with open W & E edges but blocked center
    const deadEnd: PathCard = {
      id: "test_dead",
      kind: "PATH",
      variant: "dead_ew",
      label: "Split Trail",
      edges: { N: false, E: true, S: false, W: true },
      connectedCenter: false,
    };
    state.players[0]!.hand[0] = deadEnd;
    const res1 = TreasureTrailsModule.applyAction(state, "p1", {
      type: "PLACE_PATH",
      cardId: deadEnd.id,
      x: 1,
      y: 2,
      rotation: 0,
    });

    // Attempting to extend past the dead-end at (2,2) MUST fail!
    expect(canPlacePathTile(res1.state.board, tNorth, 2, 2, 0).ok).toBe(false);
  });

  it("blocks path placement while gear is broken and supports Field-Patch self-rescue", () => {
    let state = TreasureTrailsModule.createInitialState(FOUR_PLAYERS, {}, 202);
    const hazCard: TreasureTrailsCard = {
      id: "h1",
      kind: "HAZARD",
      gear: "lantern",
      label: "Dim Lantern",
    };
    const pathCard: PathCard = {
      id: "p_card",
      kind: "PATH",
      variant: "crossroads",
      label: "Crossroads",
      edges: { N: true, E: true, S: true, W: true },
      connectedCenter: true,
    };
    state.players[0]!.hand[0] = hazCard;
    state.players[1]!.hand[0] = pathCard;

    // p1 breaks p2's lantern
    const afterHaz = TreasureTrailsModule.applyAction(state, "p1", {
      type: "PLAY_HAZARD",
      cardId: "h1",
      targetUserId: "p2",
    });
    state = afterHaz.state;
    expect(state.players[1]!.gear.lantern).toBe(false);

    // p2 tries to place a path tile -> REJECTED
    const badPlace = TreasureTrailsModule.validateAction(state, "p2", {
      type: "PLACE_PATH",
      cardId: "p_card",
      x: 1,
      y: 2,
      rotation: 0,
    });
    expect(badPlace.valid).toBe(false);

    // p2 uses Field-Patch (discards 2 cards, draws 1 -> hand shrinks by 1, lantern fixed!)
    const prevHandLen = state.players[1]!.hand.length;
    const c1 = state.players[1]!.hand[1]!.id;
    const c2 = state.players[1]!.hand[2]!.id;
    const afterPatch = TreasureTrailsModule.applyAction(state, "p2", {
      type: "FIELD_PATCH",
      cardIds: [c1, c2],
      gear: "lantern",
    });
    expect(afterPatch.state.players[1]!.gear.lantern).toBe(true);
    expect(afterPatch.state.players[1]!.hand.length).toBe(prevHandLen - 1);
    expect(afterPatch.events.some((e) => e.type === "FIELD_PATCHED")).toBe(true);
  });

  it("keeps Spyglass scouting strictly private and lets Boulder Clear remove placed tiles only", () => {
    let state = TreasureTrailsModule.createInitialState(FOUR_PLAYERS, {}, 303);
    const spy: TreasureTrailsCard = { id: "spy_test", kind: "SPYGLASS", label: "Spyglass" };
    const clear: TreasureTrailsCard = { id: "clr_test", kind: "BOULDER_CLEAR", label: "Boulder Clear" };
    state.players[0]!.hand[0] = spy;
    state.players[1]!.hand[0] = clear;

    const afterSpy = TreasureTrailsModule.applyAction(state, "p1", {
      type: "PLAY_SPYGLASS",
      cardId: "spy_test",
      x: 8,
      y: 0,
    });
    state = afterSpy.state;

    // p1 sees vault (8,0); p2 does NOT; public state does NOT
    expect(TreasureTrailsModule.getPrivateState(state, "p1").scoutedVaults["8,0"]).toBeDefined();
    expect(TreasureTrailsModule.getPrivateState(state, "p2").scoutedVaults["8,0"]).toBeUndefined();
    expect(TreasureTrailsModule.getPublicState(state).board["8,0"]?.vaultKind).toBeUndefined();

    // Boulder Clear refuses Base Camp (0,2) and Vault (8,0)
    expect(
      TreasureTrailsModule.validateAction(state, "p2", {
        type: "PLAY_BOULDER_CLEAR",
        cardId: "clr_test",
        x: BASE_CAMP_COORD.x,
        y: BASE_CAMP_COORD.y,
      }).valid
    ).toBe(false);
    expect(
      TreasureTrailsModule.validateAction(state, "p2", {
        type: "PLAY_BOULDER_CLEAR",
        cardId: "clr_test",
        x: 8,
        y: 0,
      }).valid
    ).toBe(false);
  });

  it("reveals Decoy vaults without ending the round and awards Trailblazers + clutch star on True Relic", () => {
    let state: TreasureTrailsState = TreasureTrailsModule.createInitialState(
      FOUR_PLAYERS,
      { totalRounds: 1 },
      404
    );

    // Force (8,2) to be TRUE_RELIC and (8,0) to be DECOY for deterministic win check
    state.board[coordKey(8, 0)]!.vaultKind = "DECOY";
    state.board[coordKey(8, 2)]!.vaultKind = "TRUE_RELIC";
    state.board[coordKey(8, 4)]!.vaultKind = "DECOY";

    // Build open bridge from (1,2) through (6,2)
    for (let x = 1; x <= 6; x++) {
      state.board[coordKey(x, 2)] = {
        x,
        y: 2,
        kind: "PATH",
        edges: { N: true, E: true, S: true, W: true },
        connectedCenter: true,
        cardVariant: "crossroads",
      };
    }

    const finalTile: PathCard = {
      id: "final_bridge",
      kind: "PATH",
      variant: "straight_h",
      label: "East-West Trail",
      edges: { N: false, E: true, S: false, W: true },
      connectedCenter: true,
    };

    // Ensure active player is a Trailblazer so we can check clutch bonus clearly
    state.players[0]!.role = "TRAILBLAZER";
    state.players[0]!.hand[0] = finalTile;

    const res = TreasureTrailsModule.applyAction(state, "p1", {
      type: "PLACE_PATH",
      cardId: "final_bridge",
      x: 7,
      y: 2,
      rotation: 0,
    });

    expect(res.state.phase).toBe("COMPLETED");
    expect(TreasureTrailsModule.isGameCompleted(res.state)).toBe(true);
    expect(res.state.lastRoundSummary?.winningTeam).toBe("TRAILBLAZER");
    expect(res.state.lastRoundSummary?.starsAwarded["p1"]).toBe(3); // +2 win +1 clutch star
    expect(TreasureTrailsModule.getResults(res.state)?.winningTeam).toBe("Trailblazers");
  });

  it("awards Tricksters when deck and all hands exhaust, and handles AFK timeouts", () => {
    let state = TreasureTrailsModule.createInitialState(FOUR_PLAYERS, { totalRounds: 1 }, 505);
    state.deck = [];
    // Give only p1 a single card left; everyone else empty
    state.players[0]!.hand = [state.players[0]!.hand[0]!];
    state.players[1]!.hand = [];
    state.players[2]!.hand = [];
    state.players[3]!.hand = [];

    const timed = TreasureTrailsModule.onTurnTimeout(state);
    expect(timed.state.phase).toBe("COMPLETED");
    expect(timed.state.lastRoundSummary?.winningTeam).toBe("TRICKSTER");
    const trickster = timed.state.players.find((p) => p.role === "TRICKSTER")!;
    expect(trickster.score).toBe(4); // Solo trickster earns +4 stars
  });

  it("assigns distinct per-player colors matching Hearthvale and preserves them across rounds", () => {
    const eightPlayers = Array.from({ length: 8 }, (_, i) => ({
      userId: `u${i + 1}`,
      displayName: `Explorer ${i + 1}`,
      seatIndex: i,
    }));
    const state = TreasureTrailsModule.createInitialState(
      eightPlayers,
      { totalRounds: 3 },
      606
    );
    const pub = TreasureTrailsModule.getPublicState(state);
    const colors = pub.players.map((p) => p.color);
    expect(new Set(colors).size).toBe(8);
    expect(colors.slice(0, 5)).toEqual(["terracotta", "sage", "ocean", "honey", "plum"]);

    // Advance to Round 2 and confirm each player keeps their exact color
    const endedState: TreasureTrailsState = { ...state, phase: "ROUND_END" };
    const nextRound = TreasureTrailsModule.applyAction(endedState, "u1", {
      type: "ADVANCE_ROUND",
    }).state;
    expect(nextRound.players.map((p) => p.color)).toEqual(colors);
  });
});
