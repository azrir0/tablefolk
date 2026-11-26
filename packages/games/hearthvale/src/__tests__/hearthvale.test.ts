import { describe, expect, it } from "vitest";
import {
  HearthvaleModule,
  buildHearthvaleDeck,
  canPlaceTileAt,
  evaluateFeature,
  getRotatedEdges,
  pickHearthvaleBotAction,
  tileKey,
  type HearthvaleState,
} from "../index.js";

const TWO_PLAYERS = [
  { userId: "p1", displayName: "Alice", seatIndex: 0 },
  { userId: "p2", displayName: "Bob", seatIndex: 1 },
];

describe("Hearthvale Tile Deck & Geometry", () => {
  it("builds exact 36-tile Cozy and 54-tile Grand decks", () => {
    expect(buildHearthvaleDeck(36)).toHaveLength(36);
    expect(buildHearthvaleDeck(54)).toHaveLength(54);
  });

  it("rotates tile edges clockwise accurately", () => {
    // start_town_road: N=TOWN, E=ROAD, S=FIELD, W=ROAD
    expect(getRotatedEdges("start_town_road", 0)).toEqual({
      N: "TOWN",
      E: "ROAD",
      S: "FIELD",
      W: "ROAD",
    });
    expect(getRotatedEdges("start_town_road", 90)).toEqual({
      N: "ROAD",
      E: "TOWN",
      S: "ROAD",
      W: "FIELD",
    });
    expect(getRotatedEdges("start_town_road", 180)).toEqual({
      N: "FIELD",
      E: "ROAD",
      S: "TOWN",
      W: "ROAD",
    });
    expect(getRotatedEdges("start_town_road", 270)).toEqual({
      N: "ROAD",
      E: "FIELD",
      S: "ROAD",
      W: "TOWN",
    });
  });

  it("enforces edge-matching placement rules around Start Tile", () => {
    const state = HearthvaleModule.createInitialState(TWO_PLAYERS, { deckSize: 36 }, 42);
    // Start tile at (0,0) has TOWN on N -> placing town_cap at (0,-1) requires TOWN on S (rotation 180)
    expect(canPlaceTileAt(state.board, "town_cap", 0, -1, 180)).toBe(true);
    expect(canPlaceTileAt(state.board, "town_cap", 0, -1, 0)).toBe(false);
    // Placing disconnected tile far away is invalid
    expect(canPlaceTileAt(state.board, "town_cap", 5, 5, 0)).toBe(false);
  });
});

describe("Hearthvale Scoring & Special Twists", () => {
  it("scores 3 pts for a 2-tile mini-town and immediately returns Folk", () => {
    const state = HearthvaleModule.createInitialState(TWO_PLAYERS, { deckSize: 36 }, 101);
    // Give Alice a town_cap tile and place it at (0,-1) rot 180 to cap the Start Tile's North town!
    state.players[0]!.hand[0] = { id: "test_cap", templateId: "town_cap" };

    const step1 = HearthvaleModule.applyAction(state, "p1", {
      type: "PLACE_TILE",
      tileId: "test_cap",
      x: 0,
      y: -1,
      rotation: 180,
    });
    expect(step1.state.turnStep).toBe("PLACE_FOLK");

    const step2 = HearthvaleModule.applyAction(step1.state, "p1", {
      type: "CLAIM_FEATURE",
      segmentId: "town_n",
      folkKind: "VILLAGER",
    });

    // Completed 2-tile town = 3 pts, Villager immediately returned back to 5!
    expect(step2.state.players[0]!.score).toBe(3);
    expect(step2.state.players[0]!.villagersLeft).toBe(5);
    expect(step2.state.board[tileKey(0, -1)]?.folk).toBeUndefined();
    expect(step2.events.some((e) => e.type === "FEATURE_SCORED" && e.points === 3)).toBe(true);
  });

  it("doubles completed Road score to 2 pts/tile when a Roadside Lantern is present", () => {
    const state = HearthvaleModule.createInitialState(TWO_PLAYERS, { deckSize: 36 }, 202);
    // Build a 3-tile closed road: T-junction on West (-1,0) -> Start (0,0) -> Lantern Straight (1,0) -> T-junction (2,0)
    state.board[tileKey(-1, 0)] = {
      tileId: "w_cap",
      templateId: "road_t_junction",
      x: -1,
      y: 0,
      rotation: 0, // E=ROAD, S=ROAD, W=ROAD (separate endpoints -> closes East road!)
      placedBy: "p1",
    };
    state.board[tileKey(1, 0)] = {
      tileId: "e_lantern",
      templateId: "road_straight_lantern",
      x: 1,
      y: 0,
      rotation: 90, // E=ROAD, W=ROAD with Lantern!
      placedBy: "p1",
      folk: { userId: "p1", color: "terracotta", kind: "VILLAGER", segmentId: "road_ns" },
    };
    state.players[0]!.villagersLeft = 4;
    state.players[0]!.hand[0] = { id: "close_e", templateId: "road_t_junction" };

    const res = HearthvaleModule.applyAction(state, "p1", {
      type: "PLACE_TILE",
      tileId: "close_e",
      x: 2,
      y: 0,
      rotation: 0, // W=ROAD endpoint closes the 4-tile road (-1,0 -> 0,0 -> 1,0 -> 2,0)!
    });

    // Skip claiming any of the open T-junction arms
    const finalRes =
      res.state.turnStep === "PLACE_FOLK"
        ? HearthvaleModule.applyAction(res.state, "p1", { type: "SKIP_CLAIM" })
        : res;

    // 4 tiles × 2 pts (Lantern!) = 8 pts, Villager returned!
    expect(finalRes.state.players[0]!.score).toBe(8);
    expect(finalRes.state.players[0]!.villagersLeft).toBe(5);
  });

  it("lets a Mayor (strength 2) steal majority from a Villager (strength 1) on a merged Town", () => {
    const state = HearthvaleModule.createInitialState(TWO_PLAYERS, { deckSize: 36 }, 303);
    // Start tile (0,0) has TOWN on N claimed by Alice's Villager (strength 1)
    state.board[tileKey(0, 0)]!.folk = {
      userId: "p1",
      color: "terracotta",
      kind: "VILLAGER",
      segmentId: "town_n",
    };
    state.players[0]!.villagersLeft = 4;

    // Bob has a town_cap at (0,-2) pointing South (rot 180) claimed by Bob's Mayor (strength 2)
    state.board[tileKey(0, -2)] = {
      tileId: "bob_cap",
      templateId: "town_cap",
      x: 0,
      y: -2,
      rotation: 180, // S=TOWN
      placedBy: "p2",
      folk: { userId: "p2", color: "sage", kind: "MAYOR", segmentId: "town_n" },
    };
    state.players[1]!.mayorsLeft = 0;

    // Alice places a Grand Bridge Crest (E-W town rotated 90° -> N-S town!) at (0,-1) merging & completing the 3-tile Crest Town!
    state.players[0]!.hand[0] = { id: "bridge", templateId: "town_band_crest" };
    const res = HearthvaleModule.applyAction(state, "p1", {
      type: "PLACE_TILE",
      tileId: "bridge",
      x: 0,
      y: -1,
      rotation: 90, // N=TOWN, S=TOWN, hasCrest=true
    });

    // Already occupied -> auto-skips PLACE_FOLK & scores immediately!
    // 3 tiles * 2 + 1 crest * 2 = 8 pts -> Bob's Mayor (2) beats Alice's Villager (1)!
    expect(res.state.turnStep).toBe("PLACE_TILE");
    expect(res.state.players[0]!.score).toBe(0);
    expect(res.state.players[1]!.score).toBe(8);
    expect(res.state.players[0]!.villagersLeft).toBe(5);
    expect(res.state.players[1]!.mayorsLeft).toBe(1);
  });

  it("keeps Twin Walls (town_split_opposite) segments strictly separate", () => {
    const state = HearthvaleModule.createInitialState(TWO_PLAYERS, { deckSize: 36 }, 404);
    state.board[tileKey(0, -1)] = {
      tileId: "twin",
      templateId: "town_split_opposite",
      x: 0,
      y: -1,
      rotation: 0, // N=TOWN (separate), S=TOWN (separate, connects to 0,0!)
      placedBy: "p1",
    };

    const southFeat = evaluateFeature(state.board, 0, -1, "town_s");
    const northFeat = evaluateFeature(state.board, 0, -1, "town_n");
    expect(southFeat?.isComplete).toBe(true);
    expect(southFeat?.tileCoords).toHaveLength(2);
    expect(northFeat?.isComplete).toBe(false);
    expect(northFeat?.tileCoords).toHaveLength(1);
  });

  it("awards 9 pts and returns Folk when a Hilltop Windmill is completely surrounded", () => {
    const state = HearthvaleModule.createInitialState(TWO_PLAYERS, { deckSize: 36 }, 505);
    // Place a Windmill at (0, 2) with Alice's Villager, and surround 7 of 8 neighbors
    state.board[tileKey(0, 2)] = {
      tileId: "wm",
      templateId: "windmill_meadow",
      x: 0,
      y: 2,
      rotation: 0,
      placedBy: "p1",
      folk: { userId: "p1", color: "terracotta", kind: "VILLAGER", segmentId: "shrine" },
    };
    state.players[0]!.villagersLeft = 4;

    const coords = [
      [-1, 1],
      [0, 1],
      [1, 1],
      [-1, 2],
      [1, 2],
      [-1, 3],
      [0, 3],
    ] as const;
    for (const [cx, cy] of coords) {
      state.board[tileKey(cx, cy)] = {
        tileId: `f_${cx}_${cy}`,
        templateId: "windmill_meadow",
        x: cx,
        y: cy,
        rotation: 0,
        placedBy: "p2",
      };
    }

    // Place final 8th neighbor at (1, 3) -> completes the Windmill at (0, 2)!
    state.players[0]!.hand[0] = { id: "last_nb", templateId: "windmill_meadow" };
    const s1 = HearthvaleModule.applyAction(state, "p1", {
      type: "PLACE_TILE",
      tileId: "last_nb",
      x: 1,
      y: 3,
      rotation: 0,
    });
    const s2 = HearthvaleModule.applyAction(s1.state, "p1", { type: "SKIP_CLAIM" });

    expect(s2.state.players[0]!.score).toBe(9);
    expect(s2.state.players[0]!.villagersLeft).toBe(5);
    expect(s2.state.board[tileKey(0, 2)]?.folk).toBeUndefined();
  });

  it("plays a complete 3-player Cozy match to completion with Bot AI and conserves all Folk", () => {
    let state: HearthvaleState = HearthvaleModule.createInitialState(
      [
        { userId: "b1", displayName: "Maple", seatIndex: 0 },
        { userId: "b2", displayName: "Latte", seatIndex: 1 },
        { userId: "b3", displayName: "Matcha", seatIndex: 2 },
      ],
      { deckSize: 36, turnSeconds: 45 },
      987654
    );

    let safety = 0;
    while (state.phase === "IN_PROGRESS" && safety < 250) {
      safety += 1;
      const activeId = state.players[state.activePlayerIndex]!.userId;
      const action = pickHearthvaleBotAction(state, activeId);
      expect(action).not.toBeNull();
      const res = HearthvaleModule.applyAction(state, activeId, action!);
      state = res.state;
    }

    expect(state.phase).toBe("COMPLETED");
    expect(state.endGameSummary).not.toBeNull();
    expect(HearthvaleModule.getResults(state)).not.toBeNull();

    // Every Folk must be returned after end-game scoring!
    for (const p of state.players) {
      expect(p.villagersLeft).toBe(5);
      expect(p.mayorsLeft).toBe(1);
    }
    const totalScore = state.players.reduce((sum, p) => sum + p.score, 0);
    expect(totalScore).toBeGreaterThan(20);
  });
});
