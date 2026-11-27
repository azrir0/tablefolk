import {
  shuffleDeterministic,
  type ActionApplyResult,
  type ActionValidationResult,
  type GameModule,
  type GamePlayerSeed,
  type GameResultSummary,
} from "@tablefolk/game-engine";
import {
  BASE_GEM_COLORS,
  GEM_META,
  TOKEN_COLORS,
  type BaseGemColor,
  type GemBonuses,
  type GemCost,
  type GuildPatron,
  type PublicReservedSlot,
  type RelicCard,
  type RelicTier,
  type SunstoneAction,
  type SunstoneConfig,
  type SunstoneDisplayState,
  type SunstoneEvent,
  type SunstoneLogEntry,
  type SunstonePlayerState,
  type SunstonePrivateState,
  type SunstonePublicPlayer,
  type SunstonePublicState,
  type SunstoneState,
  type TokenColor,
  type TokenPool,
} from "./types.js";

export const MAX_HAND_TOKENS = 10;
export const MAX_RESERVED_CARDS = 3;
export const MARKET_SLOTS_PER_TIER = 4;

const DEFAULT_CONFIG: SunstoneConfig = {
  targetPrestige: 15,
  turnSeconds: 45,
};

const TIER1_NAMES: Record<BaseGemColor, string[]> = {
  ruby: [
    "Ember Kiln",
    "Garnet Press",
    "Cinnabar Mill",
    "Hearth Forge",
    "Scarlet Loom",
    "Rose Brazier",
    "Ruby Mortar",
    "Crimson Seal",
  ],
  sapphire: [
    "Cobalt Cistern",
    "Tideglass Jar",
    "Indigo Loom",
    "Azure Grinder",
    "Rainwater Basin",
    "Lapis Inkwell",
    "Cerulean Vial",
    "Starlight Lens",
  ],
  emerald: [
    "Jade Tea Press",
    "Moss Terrarium",
    "Fern Distillery",
    "Clover Mortar",
    "Sage Crucible",
    "Verdant Lantern",
    "Beryl Polisher",
    "Meadow Brooch",
  ],
  amethyst: [
    "Plum Alembic",
    "Lilac Incense",
    "Violet Spindle",
    "Dusk Hourglass",
    "Orchid Glaze",
    "Iris Wax Seal",
    "Amethyst Prism",
    "Twilight Charm",
  ],
  pearl: [
    "Oyster Dredge",
    "Moonstone Tray",
    "Nacre Polisher",
    "Ivory Caliper",
    "Mist Carafe",
    "Silver Filigree",
    "Dewdrop Clasp",
    "Lustre Pendant",
  ],
};

const TIER2_NAMES: Record<BaseGemColor, string[]> = {
  ruby: [
    "Saffron Glassworks",
    "Sunfire Furnace",
    "Carmine Foundry",
    "Phoenix Signet",
    "Vermilion Chandelier",
    "Grand Ruby Hearth",
  ],
  sapphire: [
    "Celestial Astrolabe",
    "Harbor Lighthouse",
    "Sapphire Observatory",
    "Deepwater Vault",
    "Starweaver Dome",
    "Grand Cobalt Spire",
  ],
  emerald: [
    "Botanical Conservatory",
    "Jade Pavilion",
    "Emerald Greenhouse",
    "Canopy Clockwork",
    "Sylvan Reliquary",
    "Grand Verdant Hall",
  ],
  amethyst: [
    "Velvet Observatory",
    "Amethyst Scriptorium",
    "Nebula Lantern",
    "Royal Tapestry Hall",
    "Moonlit Apothecary",
    "Grand Violet Atelier",
  ],
  pearl: [
    "Silver Tide Gallery",
    "Moonstone Fountain",
    "Nacre Salon",
    "Porcelain Rotunda",
    "Gossamer Mirror",
    "Grand Pearl Cloister",
  ],
};

const TIER3_NAMES: Record<BaseGemColor, string[]> = {
  ruby: [
    "Sunstone Crown Prism",
    "Imperial Ruby Diadem",
    "Heart of the Kiln",
    "Sovereign Flame Scepter",
  ],
  sapphire: [
    "Sapphire Firmament",
    "Tidecaller Crown",
    "Starlight Orrery",
    "Sovereign Azure Chalice",
  ],
  emerald: [
    "Emerald World-Tree",
    "Verdant Sovereign Seal",
    "Evergreen Citadel",
    "Crown of the Conservatory",
  ],
  amethyst: [
    "Twilight Crown Mirror",
    "Astral Amethyst Throne",
    "Midnight Prism Spire",
    "Sovereign Velvet Tiara",
  ],
  pearl: [
    "Lunar Pearl Tiara",
    "Celestial Nacre Ark",
    "Solstice Moon Globe",
    "Sovereign Silver Halo",
  ],
};

export function createEmptyTokens(): TokenPool {
  return {
    ruby: 0,
    sapphire: 0,
    emerald: 0,
    amethyst: 0,
    pearl: 0,
    gold: 0,
  };
}

export function createEmptyBonuses(): GemBonuses {
  return {
    ruby: 0,
    sapphire: 0,
    emerald: 0,
    amethyst: 0,
    pearl: 0,
  };
}

export function countTokens(pool: TokenPool): number {
  let sum = 0;
  for (const c of TOKEN_COLORS) {
    sum += pool[c];
  }
  return sum;
}

export interface CardPaymentBreakdown {
  canAfford: boolean;
  /** Base gems deducted from player's hand. */
  basePaid: Record<BaseGemColor, number>;
  /** Sunstone Gold wilds required to bridge any shortfall. */
  goldUsed: number;
  /** Remaining net cost after permanent engine discounts (before paying hand gems). */
  netCost: Record<BaseGemColor, number>;
  /** Total tokens still missing if unaffordable (0 when affordable). */
  missingCount: number;
}

/**
 * Single source of truth for Sunstone Guild card affordability & auto-Gold fill.
 * Shared across server engine, bot AI, and React UI!
 */
export function calculateCardPayment(
  tokens: TokenPool,
  bonuses: GemBonuses,
  card: RelicCard
): CardPaymentBreakdown {
  const basePaid: Record<BaseGemColor, number> = {
    ruby: 0,
    sapphire: 0,
    emerald: 0,
    amethyst: 0,
    pearl: 0,
  };
  const netCost: Record<BaseGemColor, number> = {
    ruby: 0,
    sapphire: 0,
    emerald: 0,
    amethyst: 0,
    pearl: 0,
  };

  let shortfall = 0;
  for (const c of BASE_GEM_COLORS) {
    const raw = card.cost[c] ?? 0;
    const afterDiscount = Math.max(0, raw - bonuses[c]);
    netCost[c] = afterDiscount;
    const paid = Math.min(tokens[c], afterDiscount);
    basePaid[c] = paid;
    shortfall += afterDiscount - paid;
  }

  const canAfford = shortfall <= tokens.gold;
  return {
    canAfford,
    basePaid,
    goldUsed: canAfford ? shortfall : tokens.gold,
    netCost,
    missingCount: canAfford ? 0 : shortfall - tokens.gold,
  };
}

export function meetsPatronRequirements(bonuses: GemBonuses, patron: GuildPatron): boolean {
  for (const c of BASE_GEM_COLORS) {
    const req = patron.requirements[c] ?? 0;
    if (bonuses[c] < req) return false;
  }
  return true;
}

/**
 * Builds the completely symmetric 90-card Artisan Relic deck (40 Tier I, 30 Tier II, 20 Tier III).
 * Every gem color follows the exact same cyclic offset pattern so there is zero color bias.
 */
export function buildAllRelicCards(): Record<RelicTier, RelicCard[]> {
  const tier1: RelicCard[] = [];
  const tier2: RelicCard[] = [];
  const tier3: RelicCard[] = [];

  for (let i = 0; i < BASE_GEM_COLORS.length; i++) {
    const c0 = BASE_GEM_COLORS[i]!;
    const c1 = BASE_GEM_COLORS[(i + 1) % 5]!;
    const c2 = BASE_GEM_COLORS[(i + 2) % 5]!;
    const c3 = BASE_GEM_COLORS[(i + 3) % 5]!;
    const c4 = BASE_GEM_COLORS[(i + 4) % 5]!;

    const t1Specs: Array<{ cost: GemCost; prestige: number; catalyst?: boolean }> = [
      { cost: { [c1]: 3 }, prestige: 0, catalyst: true },
      { cost: { [c1]: 1, [c2]: 1, [c3]: 1, [c4]: 1 }, prestige: 0 },
      { cost: { [c1]: 2, [c2]: 1, [c3]: 1, [c4]: 1 }, prestige: 0 },
      { cost: { [c1]: 2, [c2]: 1 }, prestige: 0 },
      { cost: { [c1]: 2, [c3]: 2 }, prestige: 0 },
      { cost: { [c1]: 2, [c2]: 2, [c3]: 1 }, prestige: 0 },
      { cost: { [c1]: 3, [c2]: 1, [c4]: 1 }, prestige: 0 },
      { cost: { [c2]: 4 }, prestige: 1 },
    ];
    t1Specs.forEach((spec, idx) => {
      tier1.push({
        id: `t1_${c0}_${idx + 1}`,
        tier: 1,
        name: TIER1_NAMES[c0][idx]!,
        gem: c0,
        bonusCount: 1,
        prestige: spec.prestige,
        cost: spec.cost,
        catalyst: spec.catalyst,
      });
    });

    const t2Specs: Array<{ cost: GemCost; prestige: number }> = [
      { cost: { [c1]: 3, [c2]: 2, [c3]: 2 }, prestige: 1 },
      { cost: { [c2]: 3, [c3]: 3, [c4]: 2 }, prestige: 1 },
      { cost: { [c1]: 5 }, prestige: 2 },
      { cost: { [c2]: 5, [c3]: 3 }, prestige: 2 },
      { cost: { [c1]: 4, [c2]: 2, [c4]: 1 }, prestige: 2 },
      { cost: { [c0]: 6 }, prestige: 3 },
    ];
    t2Specs.forEach((spec, idx) => {
      tier2.push({
        id: `t2_${c0}_${idx + 1}`,
        tier: 2,
        name: TIER2_NAMES[c0][idx]!,
        gem: c0,
        bonusCount: 1,
        prestige: spec.prestige,
        cost: spec.cost,
      });
    });

    const t3Specs: Array<{ cost: GemCost; prestige: number; bonusCount: 1 | 2 }> = [
      { cost: { [c1]: 5, [c2]: 3, [c3]: 3, [c4]: 3 }, prestige: 3, bonusCount: 2 },
      { cost: { [c1]: 7 }, prestige: 4, bonusCount: 1 },
      { cost: { [c1]: 6, [c0]: 3, [c2]: 3 }, prestige: 4, bonusCount: 1 },
      { cost: { [c1]: 7, [c0]: 3 }, prestige: 5, bonusCount: 1 },
    ];
    t3Specs.forEach((spec, idx) => {
      tier3.push({
        id: `t3_${c0}_${idx + 1}`,
        tier: 3,
        name: TIER3_NAMES[c0][idx]!,
        gem: c0,
        bonusCount: spec.bonusCount,
        prestige: spec.prestige,
        cost: spec.cost,
      });
    });
  }

  return { 1: tier1, 2: tier2, 3: tier3 };
}

export function buildAllPatrons(): GuildPatron[] {
  return [
    {
      id: "patron_alchemist",
      name: "Master Alchemist",
      title: "Hearth & Dew",
      prestige: 3,
      requirements: { ruby: 4, emerald: 4 },
      icon: "sg-patron",
    },
    {
      id: "patron_clockmaker",
      name: "Royal Clockmaker",
      title: "Tide & Brass",
      prestige: 3,
      requirements: { sapphire: 4, pearl: 4 },
      icon: "sg-patron",
    },
    {
      id: "patron_tailor",
      name: "Velvet Tailor",
      title: "Crimson & Plum",
      prestige: 3,
      requirements: { ruby: 4, amethyst: 4 },
      icon: "sg-patron",
    },
    {
      id: "patron_glassblower",
      name: "Starlight Glassblower",
      title: "Sky & Forest",
      prestige: 3,
      requirements: { sapphire: 4, emerald: 4 },
      icon: "sg-patron",
    },
    {
      id: "patron_archivist",
      name: "Botanical Archivist",
      title: "Moon & Dusk",
      prestige: 3,
      requirements: { amethyst: 4, pearl: 4 },
      icon: "sg-patron",
    },
    {
      id: "patron_lapidary",
      name: "Grand Lapidary",
      title: "Prism Triad",
      prestige: 3,
      requirements: { ruby: 3, sapphire: 3, emerald: 3 },
      icon: "sg-crown",
    },
    {
      id: "patron_curator",
      name: "Sunstone Curator",
      title: "Evening Jewels",
      prestige: 3,
      requirements: { sapphire: 3, amethyst: 3, pearl: 3 },
      icon: "sg-crown",
    },
    {
      id: "patron_chancellor",
      name: "Guild Chancellor",
      title: "Royal Regalia",
      prestige: 3,
      requirements: { ruby: 3, amethyst: 3, pearl: 3 },
      icon: "sg-crown",
    },
    {
      id: "patron_architect",
      name: "Lantern Architect",
      title: "Garden Pavilions",
      prestige: 3,
      requirements: { emerald: 3, amethyst: 3, pearl: 3 },
      icon: "sg-crown",
    },
    {
      id: "patron_jeweler",
      name: "Crown Jeweler",
      title: "Hearth & Canopy",
      prestige: 3,
      requirements: { ruby: 3, emerald: 3, sapphire: 3 },
      icon: "sg-crown",
    },
  ];
}

function cloneState(state: SunstoneState): SunstoneState {
  return structuredClone(state);
}

function appendLog(
  state: SunstoneState,
  actorId: string | null,
  actorName: string,
  text: string,
  kind: SunstoneLogEntry["kind"]
) {
  state.log.unshift({
    id: state.nextLogId++,
    turn: state.turnNumber,
    actorId,
    actorName,
    text,
    kind,
  });
  if (state.log.length > 40) {
    state.log.length = 40;
  }
}

function baseSupplyForPlayers(playerCount: number): number {
  if (playerCount <= 2) return 4;
  if (playerCount === 3) return 5;
  return 7;
}

function refillMarketSlot(state: SunstoneState, tier: RelicTier, slotIndex: number) {
  const deck = state.decks[tier];
  state.market[tier][slotIndex] = deck.length > 0 ? deck.pop()! : null;
}

function computeWinners(players: SunstonePlayerState[]): SunstonePlayerState[] {
  const sorted = [...players].sort((a, b) => {
    if (b.prestige !== a.prestige) return b.prestige - a.prestige;
    if (a.craftedCount !== b.craftedCount) return a.craftedCount - b.craftedCount;
    return countTokens(b.tokens) - countTokens(a.tokens);
  });
  const top = sorted[0]!;
  const topTokens = countTokens(top.tokens);
  return sorted.filter(
    (p) =>
      p.prestige === top.prestige &&
      p.craftedCount === top.craftedCount &&
      countTokens(p.tokens) === topTokens
  );
}

function buildResults(state: SunstoneState): GameResultSummary {
  const winners = computeWinners(state.players);
  const winnerSet = new Set(winners.map((w) => w.userId));
  const sorted = [...state.players].sort((a, b) => {
    if (b.prestige !== a.prestige) return b.prestige - a.prestige;
    if (a.craftedCount !== b.craftedCount) return a.craftedCount - b.craftedCount;
    return countTokens(b.tokens) - countTokens(a.tokens);
  });

  const headline =
    winners.length === 1
      ? `${winners[0]!.displayName} claims the Sunstone Crown with ${winners[0]!.prestige} Prestige!`
      : `Shared Crown! ${winners.map((w) => w.displayName).join(" & ")} tie at ${winners[0]!.prestige} Prestige!`;

  return {
    winningTeam: winners.map((w) => w.displayName).join(" & "),
    headline,
    players: sorted.map((p) => ({
      userId: p.userId,
      displayName: p.displayName,
      score: p.prestige,
      isWinner: winnerSet.has(p.userId),
      roleLabel: `${p.craftedCount} relics · ${p.patronIds.length} patron${p.patronIds.length === 1 ? "" : "s"}`,
    })),
  };
}

function hasAnyLegalMainAction(state: SunstoneState, player: SunstonePlayerState): boolean {
  // 1. Can take at least 1 base gem?
  for (const c of BASE_GEM_COLORS) {
    if (state.bank[c] > 0) return true;
  }
  // 2. Can reserve a market or deck card?
  if (player.reserved.length < MAX_RESERVED_CARDS) {
    for (const tier of [1, 2, 3] as RelicTier[]) {
      if (state.decks[tier].length > 0) return true;
      if (state.market[tier].some((c) => c !== null)) return true;
    }
  }
  // 3. Can buy any market or reserved card?
  for (const tier of [1, 2, 3] as RelicTier[]) {
    for (const card of state.market[tier]) {
      if (card && calculateCardPayment(player.tokens, player.bonuses, card).canAfford) {
        return true;
      }
    }
  }
  for (const slot of player.reserved) {
    if (calculateCardPayment(player.tokens, player.bonuses, slot.card).canAfford) {
      return true;
    }
  }
  return false;
}

function advanceTurnOrFinish(state: SunstoneState, events: SunstoneEvent[]) {
  const actor = state.players[state.activePlayerIndex]!;

  // Check if target Prestige triggers Final Round!
  if (!state.finalRoundTriggered && actor.prestige >= state.config.targetPrestige) {
    state.finalRoundTriggered = true;
    state.finalRoundTriggerPlayerId = actor.userId;
    const summary = `${actor.displayName} reached ${actor.prestige} Prestige — Final Round!`;
    appendLog(state, actor.userId, actor.displayName, summary, "system");
    events.push({
      type: "FINAL_ROUND_TRIGGERED",
      actorId: actor.userId,
      actorName: actor.displayName,
      summary,
      payload: { prestige: actor.prestige },
    });
  }

  const isLastSeat = state.activePlayerIndex === state.players.length - 1;
  if (state.finalRoundTriggered && isLastSeat) {
    finishGame(state, events);
    return;
  }

  // Advance to next player
  state.activePlayerIndex = (state.activePlayerIndex + 1) % state.players.length;
  if (state.activePlayerIndex === 0) {
    state.roundNumber += 1;
  }
  state.turnNumber += 1;
  state.step = "MAIN_ACTION";
  state.pendingPatronIds = [];

  // Stalemate safety: if NOBODY at the table has any legal move (or 160 turns safety cap), finish cleanly
  if (
    state.turnNumber > 160 ||
    state.players.every((p) => !hasAnyLegalMainAction(state, p))
  ) {
    finishGame(state, events);
    return;
  }

  // If the current player alone has no legal move (rare edge case), skip to next player who does
  let hops = 0;
  while (
    hops < state.players.length &&
    !hasAnyLegalMainAction(state, state.players[state.activePlayerIndex]!)
  ) {
    const skipped = state.players[state.activePlayerIndex]!;
    appendLog(
      state,
      skipped.userId,
      skipped.displayName,
      `${skipped.displayName} had no legal moves and passed.`,
      "system"
    );
    const wasLast = state.activePlayerIndex === state.players.length - 1;
    if (state.finalRoundTriggered && wasLast) {
      finishGame(state, events);
      return;
    }
    state.activePlayerIndex = (state.activePlayerIndex + 1) % state.players.length;
    if (state.activePlayerIndex === 0) state.roundNumber += 1;
    hops++;
  }
}

function finishGame(state: SunstoneState, events: SunstoneEvent[]) {
  state.phase = "GAME_END";
  state.step = "MAIN_ACTION";
  state.pendingPatronIds = [];
  const winners = computeWinners(state.players);
  state.winnerIds = winners.map((w) => w.userId);
  state.results = buildResults(state);
  appendLog(state, null, "Guild Herald", state.results.headline, "system");
  events.push({
    type: "GAME_FINISHED",
    summary: state.results.headline,
    payload: { winnerIds: state.winnerIds },
  });
}

function resolveEndOfAction(state: SunstoneState, events: SunstoneEvent[]) {
  const actor = state.players[state.activePlayerIndex]!;

  // 1. Check 10-gem hand cap first!
  if (countTokens(actor.tokens) > MAX_HAND_TOKENS) {
    state.step = "DISCARD_GEMS";
    return;
  }

  // 2. Check eligible Guild Patrons (max 1 per turn)
  const eligible = state.patrons.filter((pat) => meetsPatronRequirements(actor.bonuses, pat));
  if (eligible.length === 1) {
    const patron = eligible[0]!;
    claimPatronInternal(state, actor, patron, events);
    advanceTurnOrFinish(state, events);
    return;
  }
  if (eligible.length >= 2) {
    state.step = "CLAIM_PATRON";
    state.pendingPatronIds = eligible.map((p) => p.id);
    return;
  }

  // 3. Advance turn cleanly
  advanceTurnOrFinish(state, events);
}

function claimPatronInternal(
  state: SunstoneState,
  actor: SunstonePlayerState,
  patron: GuildPatron,
  events: SunstoneEvent[]
) {
  state.patrons = state.patrons.filter((p) => p.id !== patron.id);
  actor.patronIds.push(patron.id);
  actor.prestige += patron.prestige;
  state.pendingPatronIds = [];
  const summary = `${actor.displayName} welcomed ${patron.name} (+${patron.prestige} Prestige)!`;
  appendLog(state, actor.userId, actor.displayName, summary, "patron");
  events.push({
    type: "PATRON_CLAIMED",
    actorId: actor.userId,
    actorName: actor.displayName,
    summary,
    payload: { patronId: patron.id, prestige: patron.prestige },
  });
}

export function clearSunstoneAfk(state: SunstoneState, userId: string): SunstoneState {
  const idx = state.players.findIndex((p) => p.userId === userId);
  if (idx < 0 || state.players[idx]!.consecutiveTimeouts === 0) return state;
  const next = cloneState(state);
  next.players[idx]!.consecutiveTimeouts = 0;
  return next;
}

export const SunstoneGuildModule: GameModule<
  SunstoneState,
  SunstoneAction,
  SunstonePublicState,
  SunstonePrivateState,
  SunstoneDisplayState,
  SunstoneEvent,
  Partial<SunstoneConfig>
> = {
  slug: "sunstone-guild",
  title: "Sunstone Guild",
  minPlayers: 2,
  maxPlayers: 4,

  createInitialState(
    players: GamePlayerSeed[],
    rawConfig: Partial<SunstoneConfig> = {},
    rngSeed: number
  ): SunstoneState {
    if (players.length < 2 || players.length > 4) {
      throw new Error(`Sunstone Guild supports 2–4 players (got ${players.length}).`);
    }

    const config: SunstoneConfig = {
      targetPrestige: rawConfig.targetPrestige === 12 ? 12 : DEFAULT_CONFIG.targetPrestige,
      turnSeconds: rawConfig.turnSeconds ?? DEFAULT_CONFIG.turnSeconds,
    };

    const allDecks = buildAllRelicCards();
    const cardCatalogById: Record<string, RelicCard> = {};
    for (const tier of [1, 2, 3] as RelicTier[]) {
      for (const card of allDecks[tier]) {
        cardCatalogById[card.id] = card;
      }
    }

    let seed = rngSeed | 0;
    const t1 = shuffleDeterministic(allDecks[1], seed);
    seed = t1.nextSeed;
    const t2 = shuffleDeterministic(allDecks[2], seed);
    seed = t2.nextSeed;
    const t3 = shuffleDeterministic(allDecks[3], seed);
    seed = t3.nextSeed;

    const allPatrons = buildAllPatrons();
    const patronCatalogById: Record<string, GuildPatron> = {};
    for (const p of allPatrons) patronCatalogById[p.id] = p;
    const shuffledPatrons = shuffleDeterministic(allPatrons, seed);
    seed = shuffledPatrons.nextSeed;

    const decks: Record<RelicTier, RelicCard[]> = {
      1: t1.shuffled,
      2: t2.shuffled,
      3: t3.shuffled,
    };
    const market: Record<RelicTier, Array<RelicCard | null>> = {
      1: [],
      2: [],
      3: [],
    };
    for (const tier of [1, 2, 3] as RelicTier[]) {
      for (let slot = 0; slot < MARKET_SLOTS_PER_TIER; slot++) {
        market[tier].push(decks[tier].pop() ?? null);
      }
    }

    const baseSupply = baseSupplyForPlayers(players.length);
    const bank: TokenPool = {
      ruby: baseSupply,
      sapphire: baseSupply,
      emerald: baseSupply,
      amethyst: baseSupply,
      pearl: baseSupply,
      gold: 5,
    };

    const orderedPlayers = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
    const playerStates: SunstonePlayerState[] = orderedPlayers.map((p, idx) => ({
      userId: p.userId,
      displayName: p.displayName,
      seatIndex: p.seatIndex,
      colorIndex: idx,
      tokens: createEmptyTokens(),
      bonuses: createEmptyBonuses(),
      craftedCardIds: [],
      craftedCount: 0,
      reserved: [],
      patronIds: [],
      prestige: 0,
      consecutiveTimeouts: 0,
    }));

    const state: SunstoneState = {
      config,
      phase: "IN_PROGRESS",
      step: "MAIN_ACTION",
      roundNumber: 1,
      turnNumber: 1,
      activePlayerIndex: 0,
      finalRoundTriggered: false,
      finalRoundTriggerPlayerId: null,
      bank,
      decks,
      market,
      patrons: shuffledPatrons.shuffled.slice(0, players.length + 1),
      pendingPatronIds: [],
      players: playerStates,
      cardCatalogById,
      patronCatalogById,
      winnerIds: [],
      results: null,
      log: [],
      nextLogId: 1,
      rngState: seed,
    };

    appendLog(
      state,
      null,
      "Guild Herald",
      `Welcome to Sunstone Guild! First to ${config.targetPrestige} Prestige triggers the Final Round.`,
      "system"
    );

    return state;
  },

  validateAction(
    state: SunstoneState,
    playerId: string,
    action: SunstoneAction
  ): ActionValidationResult {
    if (state.phase !== "IN_PROGRESS") {
      return { valid: false, code: "GAME_ENDED", message: "This match has already finished." };
    }
    const actor = state.players[state.activePlayerIndex];
    if (!actor || actor.userId !== playerId) {
      return { valid: false, code: "NOT_YOUR_TURN", message: "Wait for your turn!" };
    }

    if (state.step === "DISCARD_GEMS") {
      if (action.type !== "DISCARD_GEMS") {
        return {
          valid: false,
          code: "MUST_DISCARD",
          message: `You hold more than ${MAX_HAND_TOKENS} gems — return excess gems first.`,
        };
      }
      const excess = countTokens(actor.tokens) - MAX_HAND_TOKENS;
      if (action.gems.length !== excess) {
        return {
          valid: false,
          code: "WRONG_DISCARD_COUNT",
          message: `Return exactly ${excess} gem${excess === 1 ? "" : "s"}.`,
        };
      }
      const counts: Partial<Record<TokenColor, number>> = {};
      for (const g of action.gems) {
        counts[g] = (counts[g] ?? 0) + 1;
        if (counts[g]! > actor.tokens[g]) {
          return {
            valid: false,
            code: "INSUFFICIENT_GEM_DISCARD",
            message: `You don't hold that many ${GEM_META[g].label} gems.`,
          };
        }
      }
      return { valid: true };
    }

    if (state.step === "CLAIM_PATRON") {
      if (action.type !== "CLAIM_PATRON") {
        return {
          valid: false,
          code: "MUST_CLAIM_PATRON",
          message: "Choose which Guild Patron visits your workshop.",
        };
      }
      if (!state.pendingPatronIds.includes(action.patronId)) {
        return {
          valid: false,
          code: "INVALID_PATRON",
          message: "That Guild Patron is not available to claim.",
        };
      }
      return { valid: true };
    }

    // step === "MAIN_ACTION"
    if (action.type === "DISCARD_GEMS" || action.type === "CLAIM_PATRON") {
      return {
        valid: false,
        code: "WRONG_STEP",
        message: "Choose a main action: Take Gems, Reserve a Relic, or Craft a Relic.",
      };
    }

    if (action.type === "TAKE_GEMS") {
      const { gems } = action;
      if (gems.length === 2 && gems[0] === gems[1]) {
        const col = gems[0]!;
        if (state.bank[col] < 4) {
          return {
            valid: false,
            code: "STACK_TOO_LOW_FOR_TWO",
            message: `Taking 2 ${GEM_META[col].label} requires at least 4 in the bank.`,
          };
        }
        return { valid: true };
      }

      const unique = new Set(gems);
      if (unique.size !== gems.length) {
        return {
          valid: false,
          code: "DUPLICATE_GEMS",
          message: "Pick up to 3 different gem colors, or 2 of the same color (when 4+ remain).",
        };
      }
      for (const col of gems) {
        if (state.bank[col] < 1) {
          return {
            valid: false,
            code: "GEM_OUT_OF_STOCK",
            message: `No ${GEM_META[col].label} gems left in the bank.`,
          };
        }
      }
      return { valid: true };
    }

    if (action.type === "RESERVE_MARKET") {
      if (actor.reserved.length >= MAX_RESERVED_CARDS) {
        return {
          valid: false,
          code: "RESERVE_LIMIT",
          message: `You can hold at most ${MAX_RESERVED_CARDS} reserved Relics.`,
        };
      }
      const found = findMarketCard(state, action.cardId);
      if (!found) {
        return {
          valid: false,
          code: "CARD_NOT_IN_MARKET",
          message: "That Relic is no longer in the market.",
        };
      }
      return { valid: true };
    }

    if (action.type === "RESERVE_DECK") {
      if (actor.reserved.length >= MAX_RESERVED_CARDS) {
        return {
          valid: false,
          code: "RESERVE_LIMIT",
          message: `You can hold at most ${MAX_RESERVED_CARDS} reserved Relics.`,
        };
      }
      if (state.decks[action.tier].length === 0) {
        return {
          valid: false,
          code: "DECK_EMPTY",
          message: `Tier ${action.tier} deck has no cards left.`,
        };
      }
      return { valid: true };
    }

    if (action.type === "BUY_CARD") {
      let card: RelicCard | null = null;
      if (action.source === "market") {
        card = findMarketCard(state, action.cardId)?.card ?? null;
      } else {
        card = actor.reserved.find((r) => r.card.id === action.cardId)?.card ?? null;
      }
      if (!card) {
        return {
          valid: false,
          code: "CARD_NOT_FOUND",
          message: "That Relic is not available to craft.",
        };
      }
      const payment = calculateCardPayment(actor.tokens, actor.bonuses, card);
      if (!payment.canAfford) {
        return {
          valid: false,
          code: "CANNOT_AFFORD",
          message: `You need ${payment.missingCount} more gem${payment.missingCount === 1 ? "" : "s"} to craft ${card.name}.`,
        };
      }
      return { valid: true };
    }

    return { valid: false, code: "UNKNOWN_ACTION", message: "Unsupported action." };
  },

  applyAction(
    state: SunstoneState,
    playerId: string,
    action: SunstoneAction
  ): ActionApplyResult<SunstoneState, SunstoneEvent> {
    const check = this.validateAction(state, playerId, action);
    if (!check.valid) {
      throw new Error(check.message);
    }

    const next = cloneState(state);
    const actor = next.players[next.activePlayerIndex]!;
    actor.consecutiveTimeouts = 0;
    const events: SunstoneEvent[] = [];

    if (action.type === "TAKE_GEMS") {
      for (const col of action.gems) {
        next.bank[col] -= 1;
        actor.tokens[col] += 1;
      }
      const isPair = action.gems.length === 2 && action.gems[0] === action.gems[1];
      const summary = isPair
        ? `${actor.displayName} took 2× ${GEM_META[action.gems[0]!].label}.`
        : `${actor.displayName} took ${action.gems.map((g) => GEM_META[g].label).join(", ")}.`;
      appendLog(next, actor.userId, actor.displayName, summary, "gem");
      events.push({
        type: "GEMS_TAKEN",
        actorId: actor.userId,
        actorName: actor.displayName,
        summary,
        payload: { gems: action.gems },
      });
      resolveEndOfAction(next, events);
      return { state: next, events };
    }

    if (action.type === "RESERVE_MARKET") {
      const found = findMarketCard(next, action.cardId)!;
      actor.reserved.push({ card: found.card, isBlind: false });
      refillMarketSlot(next, found.tier, found.slotIndex);

      let gotGold = false;
      if (next.bank.gold > 0) {
        next.bank.gold -= 1;
        actor.tokens.gold += 1;
        gotGold = true;
      }
      const summary = `${actor.displayName} reserved ${found.card.name}${gotGold ? " (+1 Sunstone Gold)" : ""}.`;
      appendLog(next, actor.userId, actor.displayName, summary, "reserve");
      events.push({
        type: "CARD_RESERVED",
        actorId: actor.userId,
        actorName: actor.displayName,
        summary,
        payload: { cardId: found.card.id, isBlind: false, gotGold },
      });
      resolveEndOfAction(next, events);
      return { state: next, events };
    }

    if (action.type === "RESERVE_DECK") {
      const drawn = next.decks[action.tier].pop()!;
      actor.reserved.push({ card: drawn, isBlind: true });

      let gotGold = false;
      if (next.bank.gold > 0) {
        next.bank.gold -= 1;
        actor.tokens.gold += 1;
        gotGold = true;
      }
      const summary = `${actor.displayName} reserved a hidden Tier ${action.tier} Relic${gotGold ? " (+1 Sunstone Gold)" : ""}.`;
      appendLog(next, actor.userId, actor.displayName, summary, "reserve");
      events.push({
        type: "CARD_RESERVED",
        actorId: actor.userId,
        actorName: actor.displayName,
        summary,
        payload: { tier: action.tier, isBlind: true, gotGold },
      });
      resolveEndOfAction(next, events);
      return { state: next, events };
    }

    if (action.type === "BUY_CARD") {
      let card: RelicCard;
      if (action.source === "market") {
        const found = findMarketCard(next, action.cardId)!;
        card = found.card;
        refillMarketSlot(next, found.tier, found.slotIndex);
      } else {
        const idx = actor.reserved.findIndex((r) => r.card.id === action.cardId);
        card = actor.reserved[idx]!.card;
        actor.reserved.splice(idx, 1);
      }

      const payment = calculateCardPayment(actor.tokens, actor.bonuses, card);
      for (const c of BASE_GEM_COLORS) {
        actor.tokens[c] -= payment.basePaid[c];
        next.bank[c] += payment.basePaid[c];
      }
      if (payment.goldUsed > 0) {
        actor.tokens.gold -= payment.goldUsed;
        next.bank.gold += payment.goldUsed;
      }

      actor.bonuses[card.gem] += card.bonusCount;
      actor.prestige += card.prestige;
      actor.craftedCardIds.push(card.id);
      actor.craftedCount += 1;

      const prestigeLabel = card.prestige > 0 ? ` (+${card.prestige}★)` : "";
      const bonusLabel = card.bonusCount === 2 ? ` [2× ${GEM_META[card.gem].label}]` : "";
      const summary = `${actor.displayName} crafted ${card.name}${prestigeLabel}${bonusLabel}!`;
      appendLog(next, actor.userId, actor.displayName, summary, "craft");
      events.push({
        type: "CARD_CRAFTED",
        actorId: actor.userId,
        actorName: actor.displayName,
        summary,
        payload: {
          cardId: card.id,
          prestige: card.prestige,
          gem: card.gem,
          bonusCount: card.bonusCount,
          goldUsed: payment.goldUsed,
        },
      });

      // Tier I Catalyst Spark: immediately refund 1 matching gem from bank if available!
      if (card.catalyst && next.bank[card.gem] > 0) {
        next.bank[card.gem] -= 1;
        actor.tokens[card.gem] += 1;
        const catSummary = `⚡ Catalyst Spark! ${actor.displayName} gained +1 free ${GEM_META[card.gem].label}.`;
        appendLog(next, actor.userId, actor.displayName, catSummary, "gem");
        events.push({
          type: "CATALYST_TRIGGERED",
          actorId: actor.userId,
          actorName: actor.displayName,
          summary: catSummary,
          payload: { gem: card.gem },
        });
      }

      resolveEndOfAction(next, events);
      return { state: next, events };
    }

    if (action.type === "DISCARD_GEMS") {
      for (const g of action.gems) {
        actor.tokens[g] -= 1;
        next.bank[g] += 1;
      }
      const summary = `${actor.displayName} returned ${action.gems.map((g) => GEM_META[g].label).join(", ")} to the bank.`;
      appendLog(next, actor.userId, actor.displayName, summary, "discard");
      events.push({
        type: "GEMS_DISCARDED",
        actorId: actor.userId,
        actorName: actor.displayName,
        summary,
        payload: { gems: action.gems },
      });
      resolveEndOfAction(next, events);
      return { state: next, events };
    }

    if (action.type === "CLAIM_PATRON") {
      const patron = next.patrons.find((p) => p.id === action.patronId)!;
      claimPatronInternal(next, actor, patron, events);
      advanceTurnOrFinish(next, events);
      return { state: next, events };
    }

    return { state: next, events };
  },

  onTurnTimeout(state: SunstoneState): ActionApplyResult<SunstoneState, SunstoneEvent> {
    if (state.phase !== "IN_PROGRESS") {
      return { state, events: [] };
    }

    const next = cloneState(state);
    const actor = next.players[next.activePlayerIndex]!;
    actor.consecutiveTimeouts += 1;
    const events: SunstoneEvent[] = [];

    if (next.step === "DISCARD_GEMS") {
      const excess = countTokens(actor.tokens) - MAX_HAND_TOKENS;
      const toReturn: TokenColor[] = [];
      const order: TokenColor[] = [...BASE_GEM_COLORS, "gold"];
      const temp = { ...actor.tokens };
      while (toReturn.length < excess) {
        // Return highest-count non-gold token first
        let best: TokenColor | null = null;
        let bestAmt = 0;
        for (const c of order) {
          if (temp[c] > bestAmt && (c !== "gold" || BASE_GEM_COLORS.every((b) => temp[b] === 0))) {
            bestAmt = temp[c];
            best = c;
          }
        }
        if (!best) break;
        temp[best] -= 1;
        toReturn.push(best);
      }
      if (toReturn.length > 0) {
        const res = this.applyAction(next, actor.userId, {
          type: "DISCARD_GEMS",
          gems: toReturn,
        });
        res.state.players[state.activePlayerIndex]!.consecutiveTimeouts =
          actor.consecutiveTimeouts;
        return {
          state: res.state,
          events: [
            {
              type: "TURN_TIMEOUT",
              actorId: actor.userId,
              actorName: actor.displayName,
              summary: `${actor.displayName} timed out — excess gems returned automatically.`,
            },
            ...res.events,
          ],
        };
      }
    }

    if (next.step === "CLAIM_PATRON" && next.pendingPatronIds.length > 0) {
      const res = this.applyAction(next, actor.userId, {
        type: "CLAIM_PATRON",
        patronId: next.pendingPatronIds[0]!,
      });
      res.state.players[state.activePlayerIndex]!.consecutiveTimeouts = actor.consecutiveTimeouts;
      return {
        state: res.state,
        events: [
          {
            type: "TURN_TIMEOUT",
            actorId: actor.userId,
            actorName: actor.displayName,
            summary: `${actor.displayName} timed out — Guild Patron welcomed automatically.`,
          },
          ...res.events,
        ],
      };
    }

    // MAIN_ACTION timeout: take up to 3 available base gems if under cap, else pass cleanly
    const avail = BASE_GEM_COLORS.filter((c) => next.bank[c] > 0);
    const space = Math.max(0, MAX_HAND_TOKENS - countTokens(actor.tokens));
    if (avail.length > 0 && space > 0) {
      const picked = avail.slice(0, Math.min(3, space));
      const res = this.applyAction(next, actor.userId, { type: "TAKE_GEMS", gems: picked });
      res.state.players[state.activePlayerIndex]!.consecutiveTimeouts = actor.consecutiveTimeouts;
      return {
        state: res.state,
        events: [
          {
            type: "TURN_TIMEOUT",
            actorId: actor.userId,
            actorName: actor.displayName,
            summary: `${actor.displayName} timed out and gathered ${picked.map((g) => GEM_META[g].label).join(", ")}.`,
          },
          ...res.events,
        ],
      };
    }

    const summary = `${actor.displayName} timed out and passed the turn.`;
    appendLog(next, actor.userId, actor.displayName, summary, "system");
    events.push({
      type: "TURN_TIMEOUT",
      actorId: actor.userId,
      actorName: actor.displayName,
      summary,
    });
    advanceTurnOrFinish(next, events);
    return { state: next, events };
  },

  getPublicState(state: SunstoneState): SunstonePublicState {
    const players: SunstonePublicPlayer[] = state.players.map((p) => {
      const publicReserved: PublicReservedSlot[] = p.reserved.map((slot) => ({
        cardId: slot.isBlind ? `blind_${slot.card.tier}_${p.userId}` : slot.card.id,
        tier: slot.card.tier,
        isBlind: slot.isBlind,
        card: slot.isBlind ? null : slot.card,
      }));
      const recentCrafted = p.craftedCardIds
        .slice(-4)
        .map((id) => state.cardCatalogById[id]!)
        .filter(Boolean);
      const patrons = p.patronIds
        .map((id) => state.patronCatalogById[id]!)
        .filter(Boolean);

      return {
        userId: p.userId,
        displayName: p.displayName,
        seatIndex: p.seatIndex,
        colorIndex: p.colorIndex,
        tokens: { ...p.tokens },
        tokenCount: countTokens(p.tokens),
        bonuses: { ...p.bonuses },
        craftedCount: p.craftedCount,
        recentCrafted,
        reserved: publicReserved,
        patrons,
        prestige: p.prestige,
        consecutiveTimeouts: p.consecutiveTimeouts,
      };
    });

    return {
      phase: state.phase,
      step: state.step,
      roundNumber: state.roundNumber,
      turnNumber: state.turnNumber,
      targetPrestige: state.config.targetPrestige,
      turnSeconds: state.config.turnSeconds,
      activePlayerId: state.players[state.activePlayerIndex]!.userId,
      activePlayerIndex: state.activePlayerIndex,
      finalRoundTriggered: state.finalRoundTriggered,
      bank: { ...state.bank },
      deckCounts: {
        1: state.decks[1].length,
        2: state.decks[2].length,
        3: state.decks[3].length,
      },
      market: {
        1: [...state.market[1]],
        2: [...state.market[2]],
        3: [...state.market[3]],
      },
      patrons: [...state.patrons],
      pendingPatronIds: [...state.pendingPatronIds],
      players,
      winnerIds: [...state.winnerIds],
      results: state.results,
      log: state.log.slice(0, 24),
    };
  },

  getPrivateState(state: SunstoneState, playerId: string): SunstonePrivateState {
    const player = state.players.find((p) => p.userId === playerId);
    const active = state.players[state.activePlayerIndex];
    const isYourTurn = state.phase === "IN_PROGRESS" && active?.userId === playerId;
    const excessGemsToDiscard =
      isYourTurn && state.step === "DISCARD_GEMS" && player
        ? Math.max(0, countTokens(player.tokens) - MAX_HAND_TOKENS)
        : 0;

    return {
      userId: playerId,
      reserved: player ? player.reserved.map((r) => ({ ...r })) : [],
      isYourTurn,
      step: state.step,
      excessGemsToDiscard,
      pendingPatronIds: isYourTurn && state.step === "CLAIM_PATRON" ? [...state.pendingPatronIds] : [],
    };
  },

  getDisplayState(state: SunstoneState): SunstoneDisplayState {
    return {
      phase: state.phase,
      roundNumber: state.roundNumber,
      targetPrestige: state.config.targetPrestige,
      activePlayerName: state.players[state.activePlayerIndex]?.displayName ?? "",
      finalRoundTriggered: state.finalRoundTriggered,
      leaderboard: [...state.players]
        .sort((a, b) => b.prestige - a.prestige || a.craftedCount - b.craftedCount)
        .map((p) => ({
          userId: p.userId,
          displayName: p.displayName,
          prestige: p.prestige,
          craftedCount: p.craftedCount,
          patrons: p.patronIds.length,
        })),
      bank: { ...state.bank },
      market: {
        1: [...state.market[1]],
        2: [...state.market[2]],
        3: [...state.market[3]],
      },
      patrons: [...state.patrons],
      results: state.results,
    };
  },

  isGameCompleted(state: SunstoneState): boolean {
    return state.phase === "GAME_END";
  },

  getResults(state: SunstoneState): GameResultSummary | null {
    return state.results;
  },
};

function findMarketCard(
  state: SunstoneState,
  cardId: string
): { tier: RelicTier; slotIndex: number; card: RelicCard } | null {
  for (const tier of [1, 2, 3] as RelicTier[]) {
    const row = state.market[tier];
    for (let slotIndex = 0; slotIndex < row.length; slotIndex++) {
      const card = row[slotIndex];
      if (card && card.id === cardId) {
        return { tier, slotIndex, card };
      }
    }
  }
  return null;
}
