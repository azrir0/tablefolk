import { OPENING_SWAP_ONLY_TURNS } from "./engine.js";
import type {
  MasqueId,
  MasqueSlotRef,
  VelvetMasqueAction,
  VelvetMasqueState,
} from "./types.js";

function hashRand(seed: number): number {
  let x = (seed ^ 0x9e3779b9) >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 0xffffffff;
}

function getAllOtherSlots(state: VelvetMasqueState, excludeUserId: string): MasqueSlotRef[] {
  const slots: MasqueSlotRef[] = [];
  for (const p of state.players) {
    if (p.userId !== excludeUserId) {
      slots.push({ kind: "PLAYER", userId: p.userId });
    }
  }
  for (let i = 0; i < state.stageMasks.length; i++) {
    slots.push({ kind: "STAGE", stageIndex: i });
  }
  return slots;
}

/**
 * Estimates whether a bot remembers its own current mask (simulates fair human memory
 * rather than omniscient cheating: if another player juggled them since their last peek,
 * confidence drops!).
 */
function botRemembersSelf(state: VelvetMasqueState, botId: string): boolean {
  const bot = state.players.find((p) => p.userId === botId);
  if (!bot) return false;
  if (bot.juggledTurn === 0) return true; // untouched since Curtain Call
  const lastPeek = state.privatePeeks[botId];
  if (
    lastPeek &&
    lastPeek.slot.kind === "PLAYER" &&
    lastPeek.slot.userId === botId &&
    lastPeek.turnNumber >= bot.juggledTurn
  ) {
    return true;
  }
  const lastSwap = state.privateSwaps[botId];
  if (lastSwap && lastSwap.turnNumber >= bot.juggledTurn) {
    return true;
  }
  return false;
}

/**
 * Picks a smart, fun, human-like action for a Practice Bot or disconnected player sub.
 */
export function pickVelvetMasqueBotAction(
  state: VelvetMasqueState,
  botId: string,
  salt = 0
): VelvetMasqueAction | null {
  if (state.phase !== "IN_PROGRESS") return null;

  const bot = state.players.find((p) => p.userId === botId);
  if (!bot) return null;

  const r1 = hashRand(state.rngSeed + state.turnNumber * 31 + bot.seatIndex * 17 + salt);
  const r2 = hashRand(state.rngSeed + state.turnNumber * 73 + bot.seatIndex * 29 + salt + 7);

  if (state.step === "CURTAIN_CALL") {
    return { type: "CURTAIN_READY" };
  }

  if (state.step === "CHALLENGE_WINDOW" && state.pendingClaim) {
    if (state.pendingClaim.announcerId === botId) return null;
    if (state.pendingClaim.responses[botId] !== "PENDING") return null;
    if (bot.coins <= 0) return { type: "RESPOND_CHALLENGE", decision: "PASS" };

    const announced = state.pendingClaim.maskId;
    const remembers = botRemembersSelf(state, botId);
    const announcer = state.players.find(
      (p) => p.userId === state.pendingClaim!.announcerId
    );
    const announcerCloseToWin =
      announcer && announcer.coins >= state.config.targetCoins - 3;

    // If bot actually holds the announced mask and remembers it -> usually challenge!
    if (bot.mask === announced && remembers) {
      return {
        type: "RESPOND_CHALLENGE",
        decision: r1 < 0.85 ? "CHALLENGE" : "PASS",
      };
    }

    // If bot holds it but was juggled recently -> sometimes still challenges on a hunch
    if (bot.mask === announced && !remembers) {
      return {
        type: "RESPOND_CHALLENGE",
        decision: r1 < 0.42 ? "CHALLENGE" : "PASS",
      };
    }

    // Desperation / spicy counter-challenge if announcer is about to win!
    if (announcerCloseToWin && r1 < 0.28) {
      return { type: "RESPOND_CHALLENGE", decision: "CHALLENGE" };
    }

    // Occasional chaotic bluff-challenge when unsure
    if (!remembers && r1 < 0.1) {
      return { type: "RESPOND_CHALLENGE", decision: "CHALLENGE" };
    }

    return { type: "RESPOND_CHALLENGE", decision: "PASS" };
  }

  if (state.step === "RESOLVE_SWAP" && state.pendingSwap?.actorId === botId) {
    // 62% real swap, 38% deceptive fake swap!
    return { type: "COMMIT_SWAP", actuallySwap: r1 < 0.62 };
  }

  if (state.step === "RESOLVE_POWER" && state.pendingPower?.executorId === botId) {
    const power = state.pendingPower;
    if (power.maskId === "patron") {
      const others = getAllOtherSlots(state, botId);
      const target = others[Math.floor(r1 * others.length)]!;
      return { type: "RESOLVE_PATRON_PEEK", target };
    }
    if (power.maskId === "illusionist") {
      const rivals = [...state.players]
        .filter((p) => p.userId !== botId)
        .sort((a, b) => b.coins - a.coins);
      return {
        type: "RESOLVE_ILLUSIONIST_SWAP",
        targetUserId: rivals[0]!.userId,
      };
    }
    if (power.maskId === "jester") {
      const others = getAllOtherSlots(state, botId);
      const idxA = Math.floor(r1 * others.length);
      let idxB = Math.floor(r2 * (others.length - 1));
      if (idxB >= idxA) idxB += 1;
      return {
        type: "RESOLVE_JESTER_SELECT",
        slotA: others[idxA]!,
        slotB: others[idxB]!,
      };
    }
    if (power.maskId === "taxmaster") {
      const eligible = power.eligibleTargetUserIds ?? [];
      const pickId =
        eligible[Math.floor(r1 * eligible.length)] ??
        state.players.find((p) => p.userId !== botId)!.userId;
      return { type: "RESOLVE_TAXMASTER_TARGET", targetUserId: pickId };
    }
  }

  if (state.step !== "CHOOSE_ACTION") return null;
  const active = state.players[state.activePlayerIndex];
  if (active?.userId !== botId) return null;

  const otherSlots = getAllOtherSlots(state, botId);

  // Opening 2 turns: must swap or fake-swap
  if (state.turnNumber <= OPENING_SWAP_ONLY_TURNS) {
    const target = otherSlots[Math.floor(r1 * otherSlots.length)]!;
    return { type: "INITIATE_SWAP", target };
  }

  const remembers = botRemembersSelf(state, botId);
  const maxRivalCoins = Math.max(
    ...state.players.filter((p) => p.userId !== botId).map((p) => p.coins)
  );
  const smugglerThreshold = state.config.targetCoins === 10 ? 8 : 10;

  // If bot remembers its mask, evaluate whether announcing it is strong!
  if (remembers) {
    const mask = bot.mask;
    const isStrongNow =
      mask === "monarch" ||
      mask === "patron" ||
      mask === "trickster" ||
      mask === "taxmaster" ||
      (mask === "magistrate" && state.fineBox >= 2) ||
      (mask === "illusionist" && maxRivalCoins - bot.coins >= 2) ||
      (mask === "smuggler" && bot.coins >= smugglerThreshold) ||
      mask === "jester";

    if (isStrongNow && r1 < 0.78) {
      return { type: "ANNOUNCE_MASK", maskId: mask };
    }

    // Sometimes bluff Monarch/Magistrate or juggle a rival's mask to throw them off!
    if (r1 < 0.9) {
      const target = otherSlots[Math.floor(r2 * otherSlots.length)]!;
      return { type: "INITIATE_SWAP", target };
    }
    const bluffMask: MasqueId =
      state.fineBox >= 3 && state.roster.includes("magistrate")
        ? "magistrate"
        : "monarch";
    return { type: "ANNOUNCE_MASK", maskId: bluffMask };
  }

  // Bot was juggled and isn't sure who it is -> mix of Peek, Swap, and cheeky Bluffs!
  if (r1 < 0.36) {
    return { type: "PEEK_SELF" };
  }
  if (r1 < 0.68) {
    const target = otherSlots[Math.floor(r2 * otherSlots.length)]!;
    return { type: "INITIATE_SWAP", target };
  }

  // Cheeky bluff! Prefer high-value masks based on board state
  const candidateBluffs: MasqueId[] = ["monarch", "patron", "trickster"];
  if (state.fineBox >= 3 && state.roster.includes("magistrate")) {
    candidateBluffs.push("magistrate", "magistrate");
  }
  if (maxRivalCoins - bot.coins >= 3 && state.roster.includes("illusionist")) {
    candidateBluffs.push("illusionist");
  }
  const validBluffs = candidateBluffs.filter((m) => state.roster.includes(m));
  const chosen = validBluffs[Math.floor(r2 * validBluffs.length)] ?? state.roster[0]!;
  return { type: "ANNOUNCE_MASK", maskId: chosen };
}
