import {
  shuffleDeterministic,
  type ActionApplyResult,
  type ActionValidationResult,
  type GameModule,
  type GamePlayerSeed,
  type GameResultSummary,
} from "@tablefolk/game-engine";
import {
  MASQUE_DEFINITIONS,
  MASQUE_PLAYER_COLORS,
  getRosterForPlayerCount,
  slotsEqual,
  type ChallengeDecision,
  type MasqueId,
  type MasqueSlotRef,
  type PendingClaimState,
  type PendingPowerState,
  type PendingSwapState,
  type PrivatePeekRecord,
  type ShowdownResult,
  type VelvetMasqueAction,
  type VelvetMasqueConfig,
  type VelvetMasqueDisplayState,
  type VelvetMasqueEvent,
  type VelvetMasquePlayerInternal,
  type VelvetMasquePrivateState,
  type VelvetMasquePublicState,
  type VelvetMasqueState,
} from "./types.js";

export const DEFAULT_VELVET_MASQUE_CONFIG: VelvetMasqueConfig = {
  targetCoins: 13,
  turnSeconds: 45,
};

export const STARTING_GOLD = 6;
export const OPENING_SWAP_ONLY_TURNS = 2;
export const MAX_VELVET_MASQUE_TURNS = 36;
export const MAGISTRATE_MAX_TAKE = 4;
export const ILLUSIONIST_MAX_TRANSFER = 4;

function cloneState(state: VelvetMasqueState): VelvetMasqueState {
  return {
    ...state,
    config: { ...state.config },
    roster: [...state.roster],
    players: state.players.map((p) => ({ ...p })),
    stageMasks: [...state.stageMasks],
    curtainReadyIds: [...state.curtainReadyIds],
    pendingSwap: state.pendingSwap
      ? {
          ...state.pendingSwap,
          slotA: { ...state.pendingSwap.slotA },
          slotB: { ...state.pendingSwap.slotB },
        }
      : null,
    pendingClaim: state.pendingClaim
      ? {
          ...state.pendingClaim,
          responses: { ...state.pendingClaim.responses },
        }
      : null,
    pendingPower: state.pendingPower
      ? {
          ...state.pendingPower,
          eligibleTargetUserIds: state.pendingPower.eligibleTargetUserIds
            ? [...state.pendingPower.eligibleTargetUserIds]
            : undefined,
        }
      : null,
    lastShowdown: state.lastShowdown
      ? {
          ...state.lastShowdown,
          revealed: state.lastShowdown.revealed.map((r) => ({ ...r })),
        }
      : null,
    privatePeeks: { ...state.privatePeeks },
    privateSwaps: { ...state.privateSwaps },
    recentEvents: [...state.recentEvents],
    winnerIds: [...state.winnerIds],
  };
}

function isValidSlot(state: VelvetMasqueState, slot: MasqueSlotRef): boolean {
  if (slot.kind === "PLAYER") {
    return state.players.some((p) => p.userId === slot.userId);
  }
  return slot.stageIndex >= 0 && slot.stageIndex < state.stageMasks.length;
}

function getMaskAtSlot(state: VelvetMasqueState, slot: MasqueSlotRef): MasqueId {
  if (slot.kind === "PLAYER") {
    const p = state.players.find((pl) => pl.userId === slot.userId);
    if (!p) throw new Error(`Unknown player slot: ${slot.userId}`);
    return p.mask;
  }
  const m = state.stageMasks[slot.stageIndex];
  if (!m) throw new Error(`Unknown stage slot: ${slot.stageIndex}`);
  return m;
}

function setMaskAtSlot(state: VelvetMasqueState, slot: MasqueSlotRef, mask: MasqueId) {
  if (slot.kind === "PLAYER") {
    const p = state.players.find((pl) => pl.userId === slot.userId);
    if (p) p.mask = mask;
  } else if (slot.stageIndex >= 0 && slot.stageIndex < state.stageMasks.length) {
    state.stageMasks[slot.stageIndex] = mask;
  }
}

function markSlotJuggled(state: VelvetMasqueState, slot: MasqueSlotRef) {
  if (slot.kind === "PLAYER") {
    const p = state.players.find((pl) => pl.userId === slot.userId);
    if (p) p.juggledTurn = state.turnNumber;
  }
}

function appendEvents(state: VelvetMasqueState, events: VelvetMasqueEvent[]) {
  state.recentEvents = [...state.recentEvents, ...events].slice(-24);
}

function checkGoldVictory(state: VelvetMasqueState, events: VelvetMasqueEvent[]): boolean {
  const winners = state.players.filter((p) => p.coins >= state.config.targetCoins);
  if (winners.length === 0) return false;
  const maxCoins = Math.max(...winners.map((p) => p.coins));
  const top = winners.filter((p) => p.coins === maxCoins);
  state.phase = "COMPLETED";
  state.pendingSwap = null;
  state.pendingClaim = null;
  state.pendingPower = null;
  state.winnerIds = top.map((p) => p.userId);
  const names = top.map((p) => p.displayName).join(" & ");
  state.endReason = `${names} reached ${maxCoins} Gold and claimed the Velvet Crown!`;
  events.push({
    type: "MATCH_ENDED",
    winnerIds: state.winnerIds,
    reason: state.endReason,
  });
  return true;
}

function advanceTurn(state: VelvetMasqueState, events: VelvetMasqueEvent[]) {
  state.pendingSwap = null;
  state.pendingClaim = null;
  state.pendingPower = null;

  if (checkGoldVictory(state, events)) {
    appendEvents(state, events);
    return;
  }

  if (state.turnNumber >= state.maxTurns) {
    // Safety cap: richest player wins (tie-break: fewest fines paid)
    const sorted = [...state.players].sort(
      (a, b) => b.coins - a.coins || a.finesPaid - b.finesPaid
    );
    const best = sorted[0]!;
    const winners = sorted.filter(
      (p) => p.coins === best.coins && p.finesPaid === best.finesPaid
    );
    state.phase = "COMPLETED";
    state.winnerIds = winners.map((p) => p.userId);
    const names = winners.map((p) => p.displayName).join(" & ");
    state.endReason = `Final Curtain! ${names} won with ${best.coins} Gold.`;
    events.push({
      type: "MATCH_ENDED",
      winnerIds: state.winnerIds,
      reason: state.endReason,
    });
    appendEvents(state, events);
    return;
  }

  state.turnNumber += 1;
  state.activePlayerIndex = (state.activePlayerIndex + 1) % state.players.length;
  state.step = "CHOOSE_ACTION";
  appendEvents(state, events);
}

function triggerMaskPower(
  state: VelvetMasqueState,
  executorId: string,
  maskId: MasqueId,
  events: VelvetMasqueEvent[]
) {
  const executor = state.players.find((p) => p.userId === executorId);
  if (!executor) {
    advanceTurn(state, events);
    return;
  }

  state.pendingClaim = null;
  state.pendingSwap = null;
  state.pendingPower = null;

  switch (maskId) {
    case "monarch": {
      executor.coins += 3;
      events.push({
        type: "COINS_CHANGED",
        deltas: [{ userId: executor.userId, delta: 3 }],
        fineBoxDelta: 0,
        reason: `${executor.displayName} collected 3 Gold as Monarch!`,
      });
      advanceTurn(state, events);
      return;
    }

    case "patron": {
      executor.coins += 2;
      events.push({
        type: "COINS_CHANGED",
        deltas: [{ userId: executor.userId, delta: 2 }],
        fineBoxDelta: 0,
        reason: `${executor.displayName} collected 2 Gold as Patron!`,
      });
      if (checkGoldVictory(state, events)) {
        appendEvents(state, events);
        return;
      }
      state.step = "RESOLVE_POWER";
      state.pendingPower = { executorId: executor.userId, maskId: "patron" };
      appendEvents(state, events);
      return;
    }

    case "magistrate": {
      if (state.fineBox > 0) {
        const take = Math.min(MAGISTRATE_MAX_TAKE, state.fineBox);
        state.fineBox -= take;
        executor.coins += take;
        events.push({
          type: "COINS_CHANGED",
          deltas: [{ userId: executor.userId, delta: take }],
          fineBoxDelta: -take,
          reason: `${executor.displayName} seized ${take} Gold from the Fine Box!`,
        });
      } else {
        executor.coins += 1;
        events.push({
          type: "COINS_CHANGED",
          deltas: [{ userId: executor.userId, delta: 1 }],
          fineBoxDelta: 0,
          reason: `Fine Box was empty — ${executor.displayName} received 1 Gold stipend!`,
        });
      }
      advanceTurn(state, events);
      return;
    }

    case "trickster": {
      const idx = state.players.findIndex((p) => p.userId === executor.userId);
      const count = state.players.length;
      const left = state.players[(idx - 1 + count) % count]!;
      const right = state.players[(idx + 1) % count]!;
      const deltas: Array<{ userId: string; delta: number }> = [];
      let stolen = 0;

      if (left.userId !== executor.userId && left.coins > 0) {
        left.coins -= 1;
        stolen += 1;
        deltas.push({ userId: left.userId, delta: -1 });
      }
      if (
        right.userId !== executor.userId &&
        right.userId !== left.userId &&
        right.coins > 0
      ) {
        right.coins -= 1;
        stolen += 1;
        deltas.push({ userId: right.userId, delta: -1 });
      }
      if (stolen > 0) {
        executor.coins += stolen;
        deltas.push({ userId: executor.userId, delta: stolen });
      }
      events.push({
        type: "COINS_CHANGED",
        deltas,
        fineBoxDelta: 0,
        reason:
          stolen > 0
            ? `${executor.displayName} pickpocketed ${stolen} Gold from neighbors!`
            : `${executor.displayName}'s neighbors had empty pockets!`,
      });
      advanceTurn(state, events);
      return;
    }

    case "illusionist": {
      state.step = "RESOLVE_POWER";
      state.pendingPower = { executorId: executor.userId, maskId: "illusionist" };
      appendEvents(state, events);
      return;
    }

    case "jester": {
      executor.coins += 1;
      events.push({
        type: "COINS_CHANGED",
        deltas: [{ userId: executor.userId, delta: 1 }],
        fineBoxDelta: 0,
        reason: `${executor.displayName} earned 1 Gold as Jester — now juggling two masks!`,
      });
      if (checkGoldVictory(state, events)) {
        appendEvents(state, events);
        return;
      }
      state.step = "RESOLVE_POWER";
      state.pendingPower = { executorId: executor.userId, maskId: "jester" };
      appendEvents(state, events);
      return;
    }

    case "taxmaster": {
      const rivals = state.players.filter((p) => p.userId !== executor.userId && p.coins > 0);
      if (rivals.length === 0) {
        events.push({
          type: "COINS_CHANGED",
          deltas: [],
          fineBoxDelta: 0,
          reason: `No rivals had Gold for ${executor.displayName} to tax!`,
        });
        advanceTurn(state, events);
        return;
      }
      const maxCoins = Math.max(...rivals.map((r) => r.coins));
      const richest = rivals.filter((r) => r.coins === maxCoins);
      if (richest.length === 1) {
        const target = richest[0]!;
        const take = Math.min(2, target.coins);
        target.coins -= take;
        executor.coins += take;
        events.push({
          type: "COINS_CHANGED",
          deltas: [
            { userId: target.userId, delta: -take },
            { userId: executor.userId, delta: take },
          ],
          fineBoxDelta: 0,
          reason: `${executor.displayName} taxed ${take} Gold from richest rival ${target.displayName}!`,
        });
        advanceTurn(state, events);
        return;
      }
      state.step = "RESOLVE_POWER";
      state.pendingPower = {
        executorId: executor.userId,
        maskId: "taxmaster",
        eligibleTargetUserIds: richest.map((r) => r.userId),
      };
      appendEvents(state, events);
      return;
    }

    case "smuggler": {
      const smugglerThreshold = state.config.targetCoins === 10 ? 8 : 10;
      if (executor.coins >= smugglerThreshold) {
        state.phase = "COMPLETED";
        state.winnerIds = [executor.userId];
        state.endReason = `${executor.displayName} pulled off the Smuggler's Heist with ${executor.coins} Gold!`;
        events.push({
          type: "MATCH_ENDED",
          winnerIds: state.winnerIds,
          reason: state.endReason,
        });
        appendEvents(state, events);
        return;
      }
      executor.coins += 1;
      const peekRec: PrivatePeekRecord = {
        id: `pk_${state.turnNumber}_${executor.userId}`,
        turnNumber: state.turnNumber,
        slot: { kind: "PLAYER", userId: executor.userId },
        maskId: executor.mask,
        reason: "SMUGGLER_PEEK",
      };
      state.privatePeeks[executor.userId] = peekRec;
      events.push({
        type: "COINS_CHANGED",
        deltas: [{ userId: executor.userId, delta: 1 }],
        fineBoxDelta: 0,
        reason: `${executor.displayName} stashed 1 Gold and checked their mask (needs ${smugglerThreshold} Gold to heist)!`,
      });
      advanceTurn(state, events);
      return;
    }
  }
}

function resolveChallengeShowdown(state: VelvetMasqueState, events: VelvetMasqueEvent[]) {
  const claim = state.pendingClaim;
  if (!claim) return;

  const challengerIds = Object.entries(claim.responses)
    .filter(([, decision]) => decision === "CHALLENGE")
    .map(([uid]) => uid);

  const announcer = state.players.find((p) => p.userId === claim.announcerId)!;

  if (challengerIds.length === 0) {
    // Unchallenged! Card stays face-down and power activates!
    if (announcer.mask !== claim.maskId) {
      announcer.bluffsWon += 1;
    }
    state.lastShowdown = {
      id: `sd_${state.turnNumber}_${claim.announcerId}`,
      turnNumber: state.turnNumber,
      announcedMaskId: claim.maskId,
      announcerId: claim.announcerId,
      wasChallenged: false,
      winnerId: claim.announcerId,
      revealed: [],
    };
    events.push({
      type: "CLAIM_UNCHALLENGED",
      announcerId: claim.announcerId,
      maskId: claim.maskId,
    });
    triggerMaskPower(state, claim.announcerId, claim.maskId, events);
    return;
  }

  // Challenged! Announcer + all Challengers flip face-up simultaneously!
  const claimantIds = [claim.announcerId, ...challengerIds];
  const revealed: ShowdownResult["revealed"] = [];
  const fineDeltas: Array<{ userId: string; delta: number }> = [];
  let fineBoxGain = 0;
  let winnerId: string | null = null;

  for (const uid of claimantIds) {
    const p = state.players.find((pl) => pl.userId === uid)!;
    const wonClaim = p.mask === claim.maskId;
    if (wonClaim) {
      winnerId = p.userId;
      revealed.push({
        userId: p.userId,
        actualMaskId: p.mask,
        wonClaim: true,
        paidFine: false,
      });
    } else {
      let paidFine = false;
      if (p.coins > 0) {
        p.coins -= 1;
        state.fineBox += 1;
        p.finesPaid += 1;
        fineBoxGain += 1;
        paidFine = true;
        fineDeltas.push({ userId: p.userId, delta: -1 });
      }
      revealed.push({
        userId: p.userId,
        actualMaskId: p.mask,
        wonClaim: false,
        paidFine,
      });
    }
  }

  const showdown: ShowdownResult = {
    id: `sd_${state.turnNumber}_${claim.announcerId}`,
    turnNumber: state.turnNumber,
    announcedMaskId: claim.maskId,
    announcerId: claim.announcerId,
    wasChallenged: true,
    winnerId,
    revealed,
  };
  state.lastShowdown = showdown;
  events.push({ type: "SHOWDOWN_RESOLVED", showdown });

  if (fineBoxGain > 0) {
    events.push({
      type: "COINS_CHANGED",
      deltas: fineDeltas,
      fineBoxDelta: fineBoxGain,
      reason: `${fineBoxGain} Gold in fines dropped into the Fine Box!`,
    });
  }

  if (winnerId) {
    triggerMaskPower(state, winnerId, claim.maskId, events);
  } else {
    advanceTurn(state, events);
  }
}

export function clearVelvetMasqueAfk(
  state: VelvetMasqueState,
  userId: string
): VelvetMasqueState {
  const next = cloneState(state);
  const p = next.players.find((pl) => pl.userId === userId);
  if (p) {
    p.afkStrikes = 0;
    p.autoPass = false;
  }
  return next;
}

/**
 * Forces the Curtain Call memorize phase to end and flips all masks face-down for Turn 1.
 */
export function closeCurtainCall(
  state: VelvetMasqueState
): ActionApplyResult<VelvetMasqueState, VelvetMasqueEvent> {
  if (state.phase !== "IN_PROGRESS" || state.step !== "CURTAIN_CALL") {
    return { state, events: [] };
  }
  const next = cloneState(state);
  next.step = "CHOOSE_ACTION";
  const events: VelvetMasqueEvent[] = [{ type: "CURTAIN_CLOSED" }];
  appendEvents(next, events);
  return { state: next, events };
}

export const VelvetMasqueModule: GameModule<
  VelvetMasqueState,
  VelvetMasqueAction,
  VelvetMasquePublicState,
  VelvetMasquePrivateState,
  VelvetMasqueDisplayState,
  VelvetMasqueEvent,
  Partial<VelvetMasqueConfig>
> = {
  slug: "velvet-masque",
  title: "Velvet Masque",
  minPlayers: 3,
  maxPlayers: 8,

  createInitialState(
    players: GamePlayerSeed[],
    partialConfig: Partial<VelvetMasqueConfig> = {},
    rngSeed = Date.now()
  ): VelvetMasqueState {
    if (players.length < 3 || players.length > 8) {
      throw new Error(`Velvet Masque requires 3–8 players (got ${players.length}).`);
    }

    const config: VelvetMasqueConfig = {
      ...DEFAULT_VELVET_MASQUE_CONFIG,
      ...partialConfig,
    };

    const sortedSeeds = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
    const roster = getRosterForPlayerCount(sortedSeeds.length);
    const shuffled = shuffleDeterministic(roster, rngSeed);

    const internalPlayers: VelvetMasquePlayerInternal[] = sortedSeeds.map((seed, idx) => ({
      userId: seed.userId,
      displayName: seed.displayName,
      seatIndex: seed.seatIndex,
      color: MASQUE_PLAYER_COLORS[idx % MASQUE_PLAYER_COLORS.length]!,
      coins: STARTING_GOLD,
      mask: shuffled.shuffled[idx]!,
      finesPaid: 0,
      bluffsWon: 0,
      juggledTurn: 0,
      afkStrikes: 0,
      autoPass: false,
    }));

    const stageMasks = shuffled.shuffled.slice(sortedSeeds.length);

    return {
      phase: "IN_PROGRESS",
      step: "CURTAIN_CALL",
      config,
      rngSeed: shuffled.nextSeed,
      turnNumber: 1,
      maxTurns: MAX_VELVET_MASQUE_TURNS,
      activePlayerIndex: 0,
      roster,
      players: internalPlayers,
      stageMasks,
      fineBox: 0,
      curtainReadyIds: [],
      pendingSwap: null,
      pendingClaim: null,
      pendingPower: null,
      lastShowdown: null,
      privatePeeks: {},
      privateSwaps: {},
      recentEvents: [],
      winnerIds: [],
      endReason: null,
    };
  },

  validateAction(
    state: VelvetMasqueState,
    playerId: string,
    action: VelvetMasqueAction
  ): ActionValidationResult {
    if (state.phase !== "IN_PROGRESS") {
      return { valid: false, code: "GAME_OVER", message: "This gala has already finished." };
    }

    const player = state.players.find((p) => p.userId === playerId);
    if (!player) {
      return { valid: false, code: "NOT_PLAYER", message: "Only seated players can act." };
    }

    const activePlayer = state.players[state.activePlayerIndex];

    switch (action.type) {
      case "CURTAIN_READY": {
        if (state.step !== "CURTAIN_CALL") {
          return { valid: false, code: "WRONG_STEP", message: "Curtain Call is already over." };
        }
        return { valid: true };
      }

      case "PEEK_SELF": {
        if (state.step !== "CHOOSE_ACTION") {
          return { valid: false, code: "WRONG_STEP", message: "You cannot peek right now." };
        }
        if (activePlayer?.userId !== playerId) {
          return { valid: false, code: "NOT_YOUR_TURN", message: "Wait for your turn!" };
        }
        if (state.turnNumber <= OPENING_SWAP_ONLY_TURNS) {
          return {
            valid: false,
            code: "OPENING_SWAP_ONLY",
            message: "Turns 1–2 are Opening Shuffle turns — swap or fake-swap a mask first!",
          };
        }
        return { valid: true };
      }

      case "INITIATE_SWAP": {
        if (state.step !== "CHOOSE_ACTION") {
          return { valid: false, code: "WRONG_STEP", message: "Not in action selection." };
        }
        if (activePlayer?.userId !== playerId) {
          return { valid: false, code: "NOT_YOUR_TURN", message: "Wait for your turn!" };
        }
        if (!isValidSlot(state, action.target)) {
          return { valid: false, code: "INVALID_TARGET", message: "Invalid mask target." };
        }
        if (action.target.kind === "PLAYER" && action.target.userId === playerId) {
          return {
            valid: false,
            code: "SELF_SWAP",
            message: "Pick another player or a Velvet Stage mask to juggle with!",
          };
        }
        return { valid: true };
      }

      case "COMMIT_SWAP": {
        if (state.step !== "RESOLVE_SWAP" || !state.pendingSwap) {
          return { valid: false, code: "WRONG_STEP", message: "No swap is under the cloak." };
        }
        if (state.pendingSwap.actorId !== playerId) {
          return { valid: false, code: "NOT_ACTOR", message: "Another player is under the cloak." };
        }
        return { valid: true };
      }

      case "ANNOUNCE_MASK": {
        if (state.step !== "CHOOSE_ACTION") {
          return { valid: false, code: "WRONG_STEP", message: "Cannot announce a mask right now." };
        }
        if (activePlayer?.userId !== playerId) {
          return { valid: false, code: "NOT_YOUR_TURN", message: "Wait for your turn!" };
        }
        if (state.turnNumber <= OPENING_SWAP_ONLY_TURNS) {
          return {
            valid: false,
            code: "OPENING_SWAP_ONLY",
            message: "Turns 1–2 are Opening Shuffle turns — swap or fake-swap a mask first!",
          };
        }
        if (!state.roster.includes(action.maskId)) {
          return {
            valid: false,
            code: "MASK_NOT_IN_ROSTER",
            message: `${MASQUE_DEFINITIONS[action.maskId].name} is not in play for this player count.`,
          };
        }
        return { valid: true };
      }

      case "RESPOND_CHALLENGE": {
        if (state.step !== "CHALLENGE_WINDOW" || !state.pendingClaim) {
          return { valid: false, code: "WRONG_STEP", message: "No claim is open to challenge." };
        }
        if (state.pendingClaim.announcerId === playerId) {
          return { valid: false, code: "SELF_CHALLENGE", message: "You announced this mask!" };
        }
        const current = state.pendingClaim.responses[playerId];
        if (current !== "PENDING") {
          return { valid: false, code: "ALREADY_RESPONDED", message: "You already responded." };
        }
        if (action.decision === "CHALLENGE" && player.coins <= 0) {
          return {
            valid: false,
            code: "NO_COINS",
            message: "You need at least 1 Gold to challenge a claim.",
          };
        }
        return { valid: true };
      }

      case "RESOLVE_PATRON_PEEK": {
        if (
          state.step !== "RESOLVE_POWER" ||
          state.pendingPower?.maskId !== "patron" ||
          state.pendingPower.executorId !== playerId
        ) {
          return { valid: false, code: "WRONG_STEP", message: "No Patron peek active for you." };
        }
        if (!isValidSlot(state, action.target)) {
          return { valid: false, code: "INVALID_TARGET", message: "Invalid mask target." };
        }
        if (action.target.kind === "PLAYER" && action.target.userId === playerId) {
          return {
            valid: false,
            code: "INVALID_TARGET",
            message: "Pick another player's mask or a Velvet Stage mask to peek at!",
          };
        }
        return { valid: true };
      }

      case "RESOLVE_ILLUSIONIST_SWAP": {
        if (
          state.step !== "RESOLVE_POWER" ||
          state.pendingPower?.maskId !== "illusionist" ||
          state.pendingPower.executorId !== playerId
        ) {
          return { valid: false, code: "WRONG_STEP", message: "No Illusionist power active." };
        }
        if (action.targetUserId === playerId) {
          return { valid: false, code: "SELF_TARGET", message: "Pick another player's fortune." };
        }
        if (!state.players.some((p) => p.userId === action.targetUserId)) {
          return { valid: false, code: "INVALID_TARGET", message: "Player not found." };
        }
        return { valid: true };
      }

      case "RESOLVE_JESTER_SELECT": {
        if (
          state.step !== "RESOLVE_POWER" ||
          state.pendingPower?.maskId !== "jester" ||
          state.pendingPower.executorId !== playerId
        ) {
          return { valid: false, code: "WRONG_STEP", message: "No Jester power active." };
        }
        if (!isValidSlot(state, action.slotA) || !isValidSlot(state, action.slotB)) {
          return { valid: false, code: "INVALID_TARGET", message: "Invalid mask target." };
        }
        if (slotsEqual(action.slotA, action.slotB)) {
          return { valid: false, code: "SAME_SLOT", message: "Pick two DIFFERENT masks!" };
        }
        if (
          (action.slotA.kind === "PLAYER" && action.slotA.userId === playerId) ||
          (action.slotB.kind === "PLAYER" && action.slotB.userId === playerId)
        ) {
          return {
            valid: false,
            code: "SELF_TARGET",
            message: "The Jester must juggle two OTHER masks (not their own)!",
          };
        }
        return { valid: true };
      }

      case "RESOLVE_TAXMASTER_TARGET": {
        if (
          state.step !== "RESOLVE_POWER" ||
          state.pendingPower?.maskId !== "taxmaster" ||
          state.pendingPower.executorId !== playerId
        ) {
          return { valid: false, code: "WRONG_STEP", message: "No Taxmaster tie-break active." };
        }
        const eligible = state.pendingPower.eligibleTargetUserIds ?? [];
        if (!eligible.includes(action.targetUserId)) {
          return {
            valid: false,
            code: "INVALID_TARGET",
            message: "Choose one of the tied richest rivals.",
          };
        }
        return { valid: true };
      }
    }
  },

  applyAction(
    state: VelvetMasqueState,
    playerId: string,
    action: VelvetMasqueAction
  ): ActionApplyResult<VelvetMasqueState, VelvetMasqueEvent> {
    const check = this.validateAction(state, playerId, action);
    if (!check.valid) {
      throw new Error(`${check.code}: ${check.message}`);
    }

    const next = cloneState(state);
    const events: VelvetMasqueEvent[] = [];
    const actor = next.players.find((p) => p.userId === playerId)!;
    actor.afkStrikes = 0;
    actor.autoPass = false;

    switch (action.type) {
      case "CURTAIN_READY": {
        if (!next.curtainReadyIds.includes(playerId)) {
          next.curtainReadyIds.push(playerId);
        }
        if (next.curtainReadyIds.length >= next.players.length) {
          next.step = "CHOOSE_ACTION";
          events.push({ type: "CURTAIN_CLOSED" });
          appendEvents(next, events);
        }
        return { state: next, events };
      }

      case "PEEK_SELF": {
        next.lastShowdown = null;
        next.privatePeeks[playerId] = {
          id: `pk_${next.turnNumber}_${playerId}`,
          turnNumber: next.turnNumber,
          slot: { kind: "PLAYER", userId: playerId },
          maskId: actor.mask,
          reason: "SELF_PEEK",
        };
        events.push({ type: "PLAYER_PEEKED", actorId: playerId });
        advanceTurn(next, events);
        return { state: next, events };
      }

      case "INITIATE_SWAP": {
        next.lastShowdown = null;
        const swap: PendingSwapState = {
          actorId: playerId,
          slotA: { kind: "PLAYER", userId: playerId },
          slotB: { ...action.target },
          isJesterBonus: false,
        };
        next.pendingSwap = swap;
        next.step = "RESOLVE_SWAP";
        events.push({
          type: "CLOAK_SWAP_STARTED",
          actorId: playerId,
          slotA: swap.slotA,
          slotB: swap.slotB,
        });
        appendEvents(next, events);
        return { state: next, events };
      }

      case "COMMIT_SWAP": {
        const swap = next.pendingSwap!;
        if (action.actuallySwap) {
          const mA = getMaskAtSlot(next, swap.slotA);
          const mB = getMaskAtSlot(next, swap.slotB);
          setMaskAtSlot(next, swap.slotA, mB);
          setMaskAtSlot(next, swap.slotB, mA);
        }
        markSlotJuggled(next, swap.slotA);
        markSlotJuggled(next, swap.slotB);
        next.privateSwaps[playerId] = {
          turnNumber: next.turnNumber,
          slotA: swap.slotA,
          slotB: swap.slotB,
          actuallySwap: action.actuallySwap,
        };
        events.push({
          type: "CLOAK_SWAP_RESOLVED",
          actorId: playerId,
          slotA: swap.slotA,
          slotB: swap.slotB,
        });
        advanceTurn(next, events);
        return { state: next, events };
      }

      case "ANNOUNCE_MASK": {
        next.lastShowdown = null;
        const responses: Record<string, ChallengeDecision> = {};
        for (const p of next.players) {
          if (p.userId === playerId) continue;
          // Players with 0 Gold cannot risk a fine to challenge
          responses[p.userId] = p.coins > 0 ? "PENDING" : "PASS";
        }
        const claim: PendingClaimState = {
          announcerId: playerId,
          maskId: action.maskId,
          responses,
        };
        next.pendingClaim = claim;
        events.push({
          type: "MASK_ANNOUNCED",
          announcerId: playerId,
          maskId: action.maskId,
        });

        const anyPending = Object.values(responses).some((r) => r === "PENDING");
        if (!anyPending) {
          resolveChallengeShowdown(next, events);
        } else {
          next.step = "CHALLENGE_WINDOW";
          appendEvents(next, events);
        }
        return { state: next, events };
      }

      case "RESPOND_CHALLENGE": {
        const claim = next.pendingClaim!;
        claim.responses[playerId] = action.decision;
        if (action.decision === "CHALLENGE") {
          events.push({
            type: "CHALLENGE_DECLARED",
            challengerId: playerId,
            maskId: claim.maskId,
          });
        }
        const stillPending = Object.values(claim.responses).some((r) => r === "PENDING");
        if (!stillPending) {
          resolveChallengeShowdown(next, events);
        } else {
          appendEvents(next, events);
        }
        return { state: next, events };
      }

      case "RESOLVE_PATRON_PEEK": {
        const revealedMask = getMaskAtSlot(next, action.target);
        next.privatePeeks[playerId] = {
          id: `pk_${next.turnNumber}_${playerId}_patron`,
          turnNumber: next.turnNumber,
          slot: { ...action.target },
          maskId: revealedMask,
          reason: "PATRON_PEEK",
        };
        events.push({
          type: "PATRON_PEEKED",
          executorId: playerId,
          target: { ...action.target },
        });
        advanceTurn(next, events);
        return { state: next, events };
      }

      case "RESOLVE_ILLUSIONIST_SWAP": {
        const target = next.players.find((p) => p.userId === action.targetUserId)!;
        const rawDiff = target.coins - actor.coins;
        const transfer = Math.max(
          -ILLUSIONIST_MAX_TRANSFER,
          Math.min(ILLUSIONIST_MAX_TRANSFER, rawDiff)
        );
        actor.coins += transfer;
        target.coins -= transfer;
        events.push({
          type: "COINS_CHANGED",
          deltas:
            transfer === 0
              ? []
              : [
                  { userId: actor.userId, delta: transfer },
                  { userId: target.userId, delta: -transfer },
                ],
          fineBoxDelta: 0,
          reason:
            transfer > 0
              ? `${actor.displayName} siphoned ${transfer} Gold via Fortune Swap with ${target.displayName}!`
              : transfer < 0
                ? `${actor.displayName} swapped fortunes with ${target.displayName} (transferred ${Math.abs(transfer)} Gold)!`
                : `${actor.displayName} and ${target.displayName} already held equal Gold!`,
        });
        advanceTurn(next, events);
        return { state: next, events };
      }

      case "RESOLVE_JESTER_SELECT": {
        const swap: PendingSwapState = {
          actorId: playerId,
          slotA: { ...action.slotA },
          slotB: { ...action.slotB },
          isJesterBonus: true,
        };
        next.pendingPower = null;
        next.pendingSwap = swap;
        next.step = "RESOLVE_SWAP";
        events.push({
          type: "CLOAK_SWAP_STARTED",
          actorId: playerId,
          slotA: swap.slotA,
          slotB: swap.slotB,
        });
        appendEvents(next, events);
        return { state: next, events };
      }

      case "RESOLVE_TAXMASTER_TARGET": {
        const target = next.players.find((p) => p.userId === action.targetUserId)!;
        const take = Math.min(2, target.coins);
        target.coins -= take;
        actor.coins += take;
        events.push({
          type: "COINS_CHANGED",
          deltas: [
            { userId: target.userId, delta: -take },
            { userId: actor.userId, delta: take },
          ],
          fineBoxDelta: 0,
          reason: `${actor.displayName} taxed ${take} Gold from ${target.displayName}!`,
        });
        advanceTurn(next, events);
        return { state: next, events };
      }
    }
  },

  onTurnTimeout(
    state: VelvetMasqueState
  ): ActionApplyResult<VelvetMasqueState, VelvetMasqueEvent> {
    if (state.phase !== "IN_PROGRESS") {
      return { state, events: [] };
    }

    if (state.step === "CURTAIN_CALL") {
      return closeCurtainCall(state);
    }

    if (state.step === "CHALLENGE_WINDOW" && state.pendingClaim) {
      const next = cloneState(state);
      const events: VelvetMasqueEvent[] = [];
      for (const uid of Object.keys(next.pendingClaim!.responses)) {
        if (next.pendingClaim!.responses[uid] === "PENDING") {
          next.pendingClaim!.responses[uid] = "PASS";
        }
      }
      resolveChallengeShowdown(next, events);
      return { state: next, events };
    }

    if (state.step === "RESOLVE_SWAP" && state.pendingSwap) {
      return this.applyAction(state, state.pendingSwap.actorId, {
        type: "COMMIT_SWAP",
        actuallySwap: false,
      });
    }

    if (state.step === "RESOLVE_POWER" && state.pendingPower) {
      const power: PendingPowerState = state.pendingPower;
      if (power.maskId === "patron") {
        const target: MasqueSlotRef =
          state.stageMasks.length > 0
            ? { kind: "STAGE", stageIndex: 0 }
            : {
                kind: "PLAYER",
                userId: state.players.find((p) => p.userId !== power.executorId)!.userId,
              };
        return this.applyAction(state, power.executorId, {
          type: "RESOLVE_PATRON_PEEK",
          target,
        });
      }
      if (power.maskId === "illusionist") {
        const richest = [...state.players]
          .filter((p) => p.userId !== power.executorId)
          .sort((a, b) => b.coins - a.coins)[0]!;
        return this.applyAction(state, power.executorId, {
          type: "RESOLVE_ILLUSIONIST_SWAP",
          targetUserId: richest.userId,
        });
      }
      if (power.maskId === "taxmaster") {
        const first =
          power.eligibleTargetUserIds?.[0] ??
          state.players.find((p) => p.userId !== power.executorId)!.userId;
        return this.applyAction(state, power.executorId, {
          type: "RESOLVE_TAXMASTER_TARGET",
          targetUserId: first,
        });
      }
      // Jester timeout: advance cleanly (already earned +1 Gold)
      const next = cloneState(state);
      const events: VelvetMasqueEvent[] = [];
      advanceTurn(next, events);
      return { state: next, events };
    }

    // CHOOSE_ACTION timeout
    const active = state.players[state.activePlayerIndex]!;
    const next = cloneState(state);
    const activeCopy = next.players[next.activePlayerIndex]!;
    activeCopy.afkStrikes += 1;
    if (activeCopy.afkStrikes >= 2) {
      activeCopy.autoPass = true;
    }

    if (next.turnNumber <= OPENING_SWAP_ONLY_TURNS) {
      const target: MasqueSlotRef =
        next.stageMasks.length > 0
          ? { kind: "STAGE", stageIndex: 0 }
          : {
              kind: "PLAYER",
              userId: next.players[(next.activePlayerIndex + 1) % next.players.length]!.userId,
            };
      const started = this.applyAction(next, active.userId, {
        type: "INITIATE_SWAP",
        target,
      });
      const finished = this.applyAction(started.state, active.userId, {
        type: "COMMIT_SWAP",
        actuallySwap: false,
      });
      return {
        state: finished.state,
        events: [...started.events, ...finished.events],
      };
    }

    // Turn 3+: safe default is Peek Own Mask
    return this.applyAction(next, active.userId, { type: "PEEK_SELF" });
  },

  getPublicState(state: VelvetMasqueState): VelvetMasquePublicState {
    const revealAll = state.step === "CURTAIN_CALL" || state.phase === "COMPLETED";
    const showdownRevealMap = new Map<string, MasqueId>();
    if (state.lastShowdown?.wasChallenged) {
      for (const r of state.lastShowdown.revealed) {
        showdownRevealMap.set(r.userId, r.actualMaskId);
      }
    }

    return {
      phase: state.phase,
      step: state.step,
      config: { ...state.config },
      turnNumber: state.turnNumber,
      maxTurns: state.maxTurns,
      activePlayerId: state.players[state.activePlayerIndex]?.userId ?? "",
      roster: [...state.roster],
      players: state.players.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        seatIndex: p.seatIndex,
        color: p.color,
        coins: p.coins,
        finesPaid: p.finesPaid,
        bluffsWon: p.bluffsWon,
        juggledTurn: p.juggledTurn,
        afkStrikes: p.afkStrikes,
        autoPass: p.autoPass,
        revealedMask: revealAll
          ? p.mask
          : showdownRevealMap.get(p.userId),
      })),
      stageCount: state.stageMasks.length,
      revealedStageMasks: revealAll ? [...state.stageMasks] : undefined,
      fineBox: state.fineBox,
      curtainReadyIds: [...state.curtainReadyIds],
      pendingSwap: state.pendingSwap
        ? {
            ...state.pendingSwap,
            slotA: { ...state.pendingSwap.slotA },
            slotB: { ...state.pendingSwap.slotB },
          }
        : null,
      pendingClaim: state.pendingClaim
        ? {
            ...state.pendingClaim,
            responses: { ...state.pendingClaim.responses },
          }
        : null,
      pendingPower: state.pendingPower
        ? {
            ...state.pendingPower,
            eligibleTargetUserIds: state.pendingPower.eligibleTargetUserIds
              ? [...state.pendingPower.eligibleTargetUserIds]
              : undefined,
          }
        : null,
      lastShowdown: state.lastShowdown
        ? {
            ...state.lastShowdown,
            revealed: state.lastShowdown.revealed.map((r) => ({ ...r })),
          }
        : null,
      recentEvents: [...state.recentEvents],
      winnerIds: [...state.winnerIds],
      endReason: state.endReason,
    };
  },

  getPrivateState(
    state: VelvetMasqueState,
    playerId: string
  ): VelvetMasquePrivateState {
    return {
      userId: playerId,
      latestPeek: state.privatePeeks[playerId] ?? null,
      latestSwap: state.privateSwaps[playerId] ?? null,
    };
  },

  getDisplayState(state: VelvetMasqueState): VelvetMasqueDisplayState {
    return {
      ...this.getPublicState(state),
      displayMode: true,
    };
  },

  isGameCompleted(state: VelvetMasqueState): boolean {
    return state.phase === "COMPLETED";
  },

  getResults(state: VelvetMasqueState): GameResultSummary | null {
    if (state.phase !== "COMPLETED") return null;
    const winnerSet = new Set(state.winnerIds);
    return {
      winningTeam: state.players
        .filter((p) => winnerSet.has(p.userId))
        .map((p) => p.displayName)
        .join(" & "),
      headline: state.endReason ?? "The Velvet Gala has concluded!",
      players: state.players.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        score: p.coins,
        isWinner: winnerSet.has(p.userId),
        roleLabel: `${MASQUE_DEFINITIONS[p.mask].emoji} ${MASQUE_DEFINITIONS[p.mask].name}`,
      })),
    };
  },
};
