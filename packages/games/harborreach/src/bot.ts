import {
  getBanditStealCandidates,
  getPipCount,
  getPlayerTradeRates,
  getValidCottageVertices,
  getValidRoadEdges,
  getValidSetupRoadEdges,
  getValidSetupVertices,
  getValidTownVertices,
  isVertexOpenForSettlement,
} from "./board.js";
import {
  COMPASS_CHARGE_THRESHOLD,
  HarborreachModule,
  computePlayerPublicVP,
  countResources,
  createEmptyResources,
  hasResources,
} from "./engine.js";
import {
  BUILD_COSTS,
  RESOURCES,
  type HarborAction,
  type HarborPlayerState,
  type HarborState,
  type ResourcePool,
  type ResourceType,
} from "./types.js";

function scoreVertexForBot(
  state: HarborState,
  vertexId: number,
  ownedResources: Set<ResourceType>
): number {
  const v = state.board.vertices[vertexId]!;
  let score = 0;
  const seen = new Set<ResourceType>();
  for (const hid of v.hexIds) {
    const h = state.board.hexes[hid]!;
    if (h.terrain === "desert") continue;
    const pips = getPipCount(h.numberToken);
    score += pips * 2.2;
    if (!seen.has(h.terrain)) {
      seen.add(h.terrain);
      score += 1.6;
    }
    if (!ownedResources.has(h.terrain)) {
      score += 2.2;
    }
    // Slight preference for balanced Grain/Ore/Timber/Clay
    if (h.terrain === "grain" || h.terrain === "ore") score += 0.5;
  }
  if (v.harbor === "any") score += 2.2;
  else if (v.harbor) score += 2.6;
  return score;
}

function getOwnedTerrains(state: HarborState, userId: string): Set<ResourceType> {
  const set = new Set<ResourceType>();
  for (const [vidStr, b] of Object.entries(state.buildings)) {
    if (b.ownerId !== userId) continue;
    const v = state.board.vertices[Number(vidStr)]!;
    for (const hid of v.hexIds) {
      const h = state.board.hexes[hid]!;
      if (h.terrain !== "desert") set.add(h.terrain);
    }
  }
  return set;
}

function scoreRoadEdgeForBot(
  state: HarborState,
  player: HarborPlayerState,
  edgeId: number
): number {
  const edge = state.board.edges[edgeId]!;
  const owned = getOwnedTerrains(state, player.userId);
  let score = 0;
  for (const vid of [edge.v1, edge.v2]) {
    if (isVertexOpenForSettlement(state.board, state.buildings, vid)) {
      score += scoreVertexForBot(state, vid, owned) * 1.4;
    }
    // Check 1-hop ahead open vertices!
    const v = state.board.vertices[vid]!;
    for (const nId of v.neighborVertexIds) {
      if (isVertexOpenForSettlement(state.board, state.buildings, nId)) {
        score += scoreVertexForBot(state, nId, owned) * 0.45;
      }
    }
  }
  return score;
}

function pickMostNeededResource(state: HarborState, player: HarborPlayerState): ResourceType {
  const canUpgradeTown =
    player.townsRemaining > 0 && getValidTownVertices(state.buildings, player.userId).length > 0;
  const canBuildCottage =
    player.cottagesRemaining > 0 &&
    getValidCottageVertices(state.board, state.buildings, state.roads, player.userId).length > 0;

  // Priority: missing resource for Town -> Cottage -> Scroll -> Road
  const goals: Array<Partial<Record<ResourceType, number>>> = [];
  if (canUpgradeTown) goals.push(BUILD_COSTS.town);
  if (canBuildCottage) goals.push(BUILD_COSTS.cottage);
  goals.push(BUILD_COSTS.scroll, BUILD_COSTS.road);

  let bestRes: ResourceType = "grain";
  let bestDeficit = Infinity;
  for (const goal of goals) {
    let totalMissing = 0;
    let firstMissing: ResourceType | null = null;
    for (const r of RESOURCES) {
      const need = Math.max(0, (goal[r] ?? 0) - player.resources[r]);
      if (need > 0) {
        totalMissing += need;
        if (!firstMissing) firstMissing = r;
      }
    }
    if (firstMissing && totalMissing < bestDeficit) {
      bestDeficit = totalMissing;
      bestRes = firstMissing;
    }
  }
  return bestRes;
}

export function pickHarborBotDiscard(
  state: HarborState,
  userId: string
): ResourcePool | null {
  const p = state.players.find((pl) => pl.userId === userId);
  if (!p || !state.pendingDiscardUserIds.includes(userId)) return null;
  const needDiscard = Math.floor(countResources(p.resources) / 2);
  if (needDiscard <= 0) return null;

  const discard = createEmptyResources();
  const temp = { ...p.resources };
  // Keep scarce resources (ore/grain first for Towns), shed highest stacks first
  let left = needDiscard;
  while (left > 0) {
    const held = RESOURCES.filter((r) => temp[r] > 0).sort(
      (a, b) => temp[b] - temp[a] || (a === "ore" || a === "grain" ? 1 : -1)
    );
    const pick = held[0];
    if (!pick) break;
    temp[pick] -= 1;
    discard[pick] += 1;
    left -= 1;
  }
  return discard;
}

export function evaluateHarborBotTrade(
  state: HarborState,
  botUserId: string
): boolean {
  const offer = state.activeTrade;
  if (!offer || offer.fromUserId === botUserId) return false;
  if (offer.declinedByUserIds.includes(botUserId)) return false;

  const bot = state.players.find((p) => p.userId === botUserId);
  if (!bot || !hasResources(bot.resources, offer.want)) return false;

  const giveTotal = countResources(offer.give);
  const wantTotal = countResources(offer.want);
  // Decline heavily lopsided offers
  if (wantTotal > giveTotal + 1) return false;

  // Accept if the incoming resource(s) include what the bot currently needs most!
  const needed = pickMostNeededResource(state, bot);
  if (offer.give[needed] > 0 && offer.want[needed] === 0 && giveTotal >= wantTotal) {
    return true;
  }
  // Accept fair 1:1 trade swapping surplus (>=2 held) for a resource we have 0 of!
  if (giveTotal >= wantTotal) {
    const gainsZeroHeld = RESOURCES.some((r) => offer.give[r] > 0 && bot.resources[r] === 0);
    const onlyGivesSurplus = RESOURCES.every(
      (r) => offer.want[r] === 0 || bot.resources[r] >= offer.want[r] + 1
    );
    if (gainsZeroHeld && onlyGivesSurplus) return true;
  }
  // Accept generous 2-for-1 offers
  if (giveTotal >= wantTotal + 1) return true;
  return false;
}

export function pickHarborBotAction(
  state: HarborState,
  userId: string
): HarborAction | null {
  if (state.phase !== "IN_PROGRESS") return null;

  // 1. Pending discard for this bot
  if (state.step === "DISCARD_RESOURCES" && state.pendingDiscardUserIds.includes(userId)) {
    const disc = pickHarborBotDiscard(state, userId);
    if (disc) return { type: "DISCARD_RESOURCES", resources: disc };
  }

  const active = state.players[state.activePlayerIndex];
  if (!active || active.userId !== userId) return null;

  // 2. Setup Cottage
  if (state.step === "SETUP_SETTLE") {
    const valid = getValidSetupVertices(state.board, state.buildings);
    if (valid.length === 0) return null;
    const owned = getOwnedTerrains(state, userId);
    valid.sort((a, b) => scoreVertexForBot(state, b, owned) - scoreVertexForBot(state, a, owned));
    return { type: "SETUP_PLACE_COTTAGE", vertexId: valid[0]! };
  }

  // 3. Setup Road
  if (state.step === "SETUP_ROAD" && state.setupLastVertexId !== null) {
    const valid = getValidSetupRoadEdges(state.board, state.roads, state.setupLastVertexId);
    if (valid.length === 0) return null;
    valid.sort((a, b) => scoreRoadEdgeForBot(state, active, b) - scoreRoadEdgeForBot(state, active, a));
    return { type: "SETUP_PLACE_ROAD", edgeId: valid[0]! };
  }

  // 4. Roll Dice (or play Ranger Scout first if Bandit blocks our good hex!)
  if (state.step === "ROLL_DICE") {
    const banditHex = state.board.hexes[state.banditHexId];
    const blocksMe =
      banditHex &&
      banditHex.vertexIds.some((vid) => state.buildings[vid]?.ownerId === userId);
    const scout = active.scrolls.find(
      (s) => s.kind === "knight" && s.boughtOnTurn < state.turnNumber
    );
    if (blocksMe && scout && !state.playedScrollThisTurn) {
      return { type: "PLAY_SCROLL", scrollId: scout.id };
    }
    return { type: "ROLL_DICE" };
  }

  // 5. Move Bandit Fox: target highest-pip hex belonging to the leading rival (avoid own hexes!)
  if (state.step === "MOVE_BANDIT") {
    const resCounts: Record<string, number> = {};
    for (const p of state.players) resCounts[p.userId] = countResources(p.resources);

    let bestHexId = state.board.hexes.find((h) => h.id !== state.banditHexId)!.id;
    let bestScore = -999;
    let bestVictim: string | null = null;

    for (const hex of state.board.hexes) {
      if (hex.id === state.banditHexId) continue;
      let s = 0;
      let touchesSelf = false;
      const rivals: Array<{ uid: string; vp: number }> = [];
      for (const vid of hex.vertexIds) {
        const b = state.buildings[vid];
        if (!b) continue;
        if (b.ownerId === userId) {
          touchesSelf = true;
          s -= 20;
        } else {
          const rp = state.players.find((p) => p.userId === b.ownerId)!;
          const rvp = computePlayerPublicVP(state, rp);
          s += getPipCount(hex.numberToken) * (b.kind === "town" ? 3.5 : 2) + rvp * 1.8;
          if ((resCounts[rp.userId] ?? 0) > 0) {
            rivals.push({ uid: rp.userId, vp: rvp });
          }
        }
      }
      if (!touchesSelf && hex.terrain !== "desert") s += 1;
      if (s > bestScore) {
        bestScore = s;
        bestHexId = hex.id;
        rivals.sort((a, b) => b.vp - a.vp);
        bestVictim = rivals[0]?.uid ?? null;
      }
    }

    return { type: "MOVE_BANDIT", hexId: bestHexId, stealFromUserId: bestVictim };
  }

  // 6. Free Roads (from Road Builder scroll)
  if (state.step === "FREE_ROADS") {
    const valid = getValidRoadEdges(state.board, state.buildings, state.roads, userId);
    if (valid.length === 0) return null;
    valid.sort((a, b) => scoreRoadEdgeForBot(state, active, b) - scoreRoadEdgeForBot(state, active, a));
    return { type: "BUILD_ROAD", edgeId: valid[0]! };
  }

  // 7. MAIN_PHASE Strategic Loop
  // 7a. Redeem Dry-Spell Compass if charged!
  if (active.compassCharges >= COMPASS_CHARGE_THRESHOLD) {
    return { type: "REDEEM_COMPASS", receive: pickMostNeededResource(state, active) };
  }

  // 7b. Play strong Guild Scrolls (Road Builder / Plenty / Monopoly / Scout)
  if (!state.playedScrollThisTurn) {
    const playable = active.scrolls.filter(
      (s) => s.kind !== "victory_point" && s.boughtOnTurn < state.turnNumber
    );
    const roadBuilder = playable.find((s) => s.kind === "road_builder");
    if (
      roadBuilder &&
      active.roadsRemaining >= 2 &&
      getValidRoadEdges(state.board, state.buildings, state.roads, userId).length > 0
    ) {
      return { type: "PLAY_SCROLL", scrollId: roadBuilder.id };
    }
    const plenty = playable.find((s) => s.kind === "year_of_plenty");
    if (plenty) {
      const need1 = pickMostNeededResource(state, active);
      const fakeHand = { ...active.resources, [need1]: active.resources[need1] + 1 };
      const need2 = pickMostNeededResource(state, { ...active, resources: fakeHand });
      return { type: "PLAY_SCROLL", scrollId: plenty.id, plentyResources: [need1, need2] };
    }
    const monopoly = playable.find((s) => s.kind === "monopoly");
    if (monopoly) {
      // Pick resource rivals hold the most of (or most needed)
      let bestR = pickMostNeededResource(state, active);
      let bestAmt = 0;
      for (const r of RESOURCES) {
        let amt = 0;
        for (const p of state.players) {
          if (p.userId !== userId) amt += p.resources[r];
        }
        if (amt > bestAmt) {
          bestAmt = amt;
          bestR = r;
        }
      }
      if (bestAmt >= 2) {
        return { type: "PLAY_SCROLL", scrollId: monopoly.id, monopolyResource: bestR };
      }
    }
    const scout = playable.find((s) => s.kind === "knight");
    if (scout) {
      return { type: "PLAY_SCROLL", scrollId: scout.id };
    }
  }

  // 7c. Build Priority 1: Upgrade Cottage -> Town (+1 VP & 2x Harvest!)
  const townSpots = getValidTownVertices(state.buildings, userId);
  if (active.townsRemaining > 0 && townSpots.length > 0 && hasResources(active.resources, BUILD_COSTS.town)) {
    const emptySet = new Set<ResourceType>();
    townSpots.sort((a, b) => scoreVertexForBot(state, b, emptySet) - scoreVertexForBot(state, a, emptySet));
    return { type: "UPGRADE_TOWN", vertexId: townSpots[0]! };
  }

  // 7d. Build Priority 2: Build Cottage (+1 VP!)
  const cottageSpots = getValidCottageVertices(state.board, state.buildings, state.roads, userId);
  if (
    active.cottagesRemaining > 0 &&
    cottageSpots.length > 0 &&
    hasResources(active.resources, BUILD_COSTS.cottage)
  ) {
    const owned = getOwnedTerrains(state, userId);
    cottageSpots.sort((a, b) => scoreVertexForBot(state, b, owned) - scoreVertexForBot(state, a, owned));
    return { type: "BUILD_COTTAGE", vertexId: cottageSpots[0]! };
  }

  // 7e. Build Priority 3: Build Road (to open Cottage spots or claim Longest Route!)
  const roadSpots = getValidRoadEdges(state.board, state.buildings, state.roads, userId);
  const wantsRoad =
    cottageSpots.length === 0 ||
    active.longestRoadLength >= 3 ||
    countResources(active.resources) >= 6;
  if (
    active.roadsRemaining > 0 &&
    roadSpots.length > 0 &&
    wantsRoad &&
    hasResources(active.resources, BUILD_COSTS.road)
  ) {
    roadSpots.sort((a, b) => scoreRoadEdgeForBot(state, active, b) - scoreRoadEdgeForBot(state, active, a));
    return { type: "BUILD_ROAD", edgeId: roadSpots[0]! };
  }

  // 7f. Build Priority 4: Buy Guild Scroll
  if (state.scrollDeck.length > 0 && hasResources(active.resources, BUILD_COSTS.scroll)) {
    return { type: "BUY_SCROLL" };
  }

  // 7g. Smart Bank/Harbor Trade if we have surplus >= rate to bridge a build or avoid 7-roll discard!
  const rates = getPlayerTradeRates(state.board, state.buildings, userId);
  const needed = pickMostNeededResource(state, active);
  for (const r of RESOURCES) {
    if (r === needed) continue;
    const rate = rates[r];
    if (active.resources[r] >= rate + (countResources(active.resources) >= 7 ? 0 : 1) || active.resources[r] >= rate + 1) {
      const act: HarborAction = { type: "BANK_TRADE", give: r, receive: needed };
      if (HarborreachModule.validateAction(state, userId, act).valid) {
        return act;
      }
    }
  }
  // Even at exact rate if holding > 7 cards (better to convert into a needed resource than lose half on a 7!)
  if (countResources(active.resources) >= 7) {
    for (const r of RESOURCES) {
      if (r === needed) continue;
      if (active.resources[r] >= rates[r]) {
        return { type: "BANK_TRADE", give: r, receive: needed };
      }
    }
  }

  return { type: "END_TURN" };
}
