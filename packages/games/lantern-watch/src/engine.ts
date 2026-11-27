import {
  nextRandom,
  shuffleDeterministic,
  type ActionApplyResult,
  type ActionValidationResult,
  type GameModule,
  type GamePlayerSeed,
  type GameResultSummary,
} from "@tablefolk/game-engine";
import {
  LANTERN_ROLE_META,
  MISSION_CONFIG_BY_PLAYERS,
  type LanternAction,
  type LanternConfig,
  type LanternDisplayState,
  type LanternEvent,
  type LanternFaction,
  type LanternLogEntry,
  type LanternMode,
  type LanternPlayer,
  type LanternPrivateState,
  type LanternPublicPlayer,
  type LanternPublicState,
  type LanternRoleId,
  type LanternState,
  type MissionCardChoice,
  type MissionRecord,
  type PrivateSighting,
  type ProposalRecord,
} from "./types.js";

const ROLE_ORDER: LanternRoleId[] = [
  "oracle",
  "warden",
  "loyal_courier",
  "nightblade",
  "mirage",
  "veiled_mole",
  "shadow_mole",
];

export function buildRoleDeck(playerCount: number, mode: LanternMode): LanternRoleId[] {
  const cfg = MISSION_CONFIG_BY_PLAYERS[playerCount];
  if (!cfg) {
    throw new Error(`Lantern Watch requires 4 to 8 players (received ${playerCount}).`);
  }

  if (mode === "classic") {
    return [
      ...Array<LanternRoleId>(cfg.loyalCount).fill("loyal_courier"),
      ...Array<LanternRoleId>(cfg.shadowCount).fill("shadow_mole"),
    ];
  }

  // Oracle & Shade mode (canonical Avalon-inspired asymmetry across 4–8p)
  const loyalRoles: LanternRoleId[] = ["oracle"];
  if (playerCount >= 6) {
    loyalRoles.push("warden");
  }
  while (loyalRoles.length < cfg.loyalCount) {
    loyalRoles.push("loyal_courier");
  }

  const shadowRoles: LanternRoleId[] = ["nightblade"];
  if (playerCount >= 6) {
    shadowRoles.push("mirage");
  }
  if (playerCount >= 7) {
    shadowRoles.push("veiled_mole");
  }
  while (shadowRoles.length < cfg.shadowCount) {
    shadowRoles.push("shadow_mole");
  }

  return [...loyalRoles, ...shadowRoles];
}

function appendLog(
  state: LanternState,
  text: string,
  tone: LanternLogEntry["tone"] = "neutral"
): LanternLogEntry[] {
  const entry: LanternLogEntry = {
    id: `lw_log_${state.log.length + 1}_${state.missionIndex}`,
    missionNumber: Math.min(state.missionIndex + 1, state.missions.length),
    text,
    tone,
  };
  return [...state.log.slice(-39), entry];
}

function getCommander(state: LanternState): LanternPlayer {
  return state.players[state.commanderIndex]!;
}

function getCurrentMission(state: LanternState) {
  return state.missions[Math.min(state.missionIndex, state.missions.length - 1)]!;
}

function getEligibleSpyglassTargets(state: LanternState): string[] {
  if (!state.spyglassHolderId) return [];
  return state.players
    .filter(
      (p) =>
        p.userId !== state.spyglassHolderId && !state.spyglassUsedByIds.includes(p.userId)
    )
    .map((p) => p.userId);
}

function winHeadline(state: LanternState): string {
  switch (state.winReason) {
    case "BEACONS_LIT":
      return "The Loyal Watch lit 3 coastal beacons — harbor safe!";
    case "ORACLE_SURVIVED":
      return "The Nightblade missed! The Oracle survived and the Loyal Watch triumphs!";
    case "BEACONS_EXTINGUISHED":
      return "Shadow Moles extinguished 3 coastal beacons — darkness claims the harbor!";
    case "COUNCIL_COLLAPSE":
      return "5 proposals rejected in a row — the Council collapsed to Shadow Moles!";
    case "ORACLE_ASSASSINATED":
      return "The Nightblade unmasked the Oracle! Shadow Moles steal victory!";
    default:
      return "Lantern Watch complete.";
  }
}

export const LanternWatchModule: GameModule<
  LanternState,
  LanternAction,
  LanternPublicState,
  LanternPrivateState,
  LanternDisplayState,
  LanternEvent,
  LanternConfig
> = {
  slug: "lantern-watch",
  title: "Lantern Watch",
  minPlayers: 4,
  maxPlayers: 8,

  createInitialState(
    players: GamePlayerSeed[],
    config: LanternConfig = {},
    rngSeed: number
  ): LanternState {
    if (players.length < 4 || players.length > 8) {
      throw new Error(`Lantern Watch supports 4 to 8 players (got ${players.length}).`);
    }

    const mode: LanternMode = config.mode === "classic" ? "classic" : "oracle";
    const turnSeconds = Math.max(20, Math.min(180, Number(config.turnSeconds ?? 60)));
    const countConfig = MISSION_CONFIG_BY_PLAYERS[players.length]!;
    const orderedSeeds = [...players].sort((a, b) => a.seatIndex - b.seatIndex);

    const roleDeck = buildRoleDeck(orderedSeeds.length, mode);
    const shuffledRoles = shuffleDeterministic(roleDeck, rngSeed);
    let seed = shuffledRoles.nextSeed;

    const assignedPlayers: LanternPlayer[] = orderedSeeds.map((seedPlayer, idx) => {
      const role = shuffledRoles.shuffled[idx]!;
      return {
        userId: seedPlayer.userId,
        displayName: seedPlayer.displayName,
        seatIndex: seedPlayer.seatIndex,
        role,
        faction: LANTERN_ROLE_META[role].faction,
        spyglassReports: [],
      };
    });

    const rCmd = nextRandom(seed);
    seed = rCmd.nextSeed;
    const commanderIndex = Math.floor(rCmd.value * assignedPlayers.length);

    const spyglassEnabled = mode === "oracle" && assignedPlayers.length >= 5;
    const spyglassStartIdx =
      (commanderIndex - 1 + assignedPlayers.length) % assignedPlayers.length;
    const spyglassHolderId = spyglassEnabled
      ? assignedPlayers[spyglassStartIdx]!.userId
      : null;

    const commander = assignedPlayers[commanderIndex]!;
    const initialLog: LanternLogEntry[] = [
      {
        id: "lw_log_1",
        missionNumber: 1,
        text: `Lantern Watch convened (${mode === "oracle" ? "Oracle & Shade" : "Classic Watch"} · ${countConfig.loyalCount} Loyal vs ${countConfig.shadowCount} Shadow).`,
        tone: "gold",
      },
      {
        id: "lw_log_2",
        missionNumber: 1,
        text: `${commander.displayName} takes the Lantern Seal as first Commander for Beacon 1 (${countConfig.missions[0]!.beaconName}).`,
        tone: "neutral",
      },
    ];

    if (spyglassHolderId) {
      const holder = assignedPlayers[spyglassStartIdx]!;
      initialLog.push({
        id: "lw_log_3",
        missionNumber: 1,
        text: `${holder.displayName} holds the Brass Spyglass (activates after Missions 2, 3, and 4).`,
        tone: "gold",
      });
    }

    return {
      mode,
      turnSeconds,
      rngSeed: seed,
      phase: "PROPOSE_TEAM",
      players: assignedPlayers,
      missions: countConfig.missions.map((m) => ({ ...m })),
      missionIndex: 0,
      commanderIndex,
      rejectTrack: 0,
      loyalWins: 0,
      shadowWins: 0,
      proposedTeamIds: [],
      pendingVotes: {},
      pendingMissionCards: {},
      proposalHistory: [],
      missionHistory: [],
      spyglassHolderId,
      spyglassUsedByIds: spyglassHolderId ? [spyglassHolderId] : [],
      lastVoteReveal: null,
      lastMissionReveal: null,
      assassinationTargetId: null,
      assassinationSuccess: null,
      winner: null,
      winReason: null,
      log: initialLog,
    };
  },

  validateAction(
    state: LanternState,
    playerId: string,
    action: LanternAction
  ): ActionValidationResult {
    if (state.phase === "FINISHED") {
      return { valid: false, code: "GAME_FINISHED", message: "This watch has already concluded." };
    }

    const player = state.players.find((p) => p.userId === playerId);
    if (!player) {
      return { valid: false, code: "UNKNOWN_PLAYER", message: "You are not seated at this council." };
    }

    if (action.type === "PROPOSE_TEAM") {
      if (state.phase !== "PROPOSE_TEAM") {
        return { valid: false, code: "WRONG_PHASE", message: "Not currently proposing a courier team." };
      }
      const commander = getCommander(state);
      if (commander.userId !== playerId) {
        return { valid: false, code: "NOT_COMMANDER", message: `Only ${commander.displayName} can propose the team.` };
      }
      const mission = getCurrentMission(state);
      const uniqueIds = new Set(action.teamIds);
      if (uniqueIds.size !== action.teamIds.length) {
        return { valid: false, code: "DUPLICATE_MEMBER", message: "Each courier can only be selected once." };
      }
      if (uniqueIds.size !== mission.teamSize) {
        return {
          valid: false,
          code: "INVALID_TEAM_SIZE",
          message: `Select exactly ${mission.teamSize} couriers for ${mission.beaconName}.`,
        };
      }
      for (const id of uniqueIds) {
        if (!state.players.some((p) => p.userId === id)) {
          return { valid: false, code: "INVALID_MEMBER", message: "Proposed courier is not at this table." };
        }
      }
      return { valid: true };
    }

    if (action.type === "CAST_VOTE") {
      if (state.phase !== "VOTE_TEAM") {
        return { valid: false, code: "WRONG_PHASE", message: "Not currently voting on a proposed team." };
      }
      if (state.pendingVotes[playerId]) {
        return { valid: false, code: "ALREADY_VOTED", message: "You already cast your council vote." };
      }
      return { valid: true };
    }

    if (action.type === "PLAY_MISSION_CARD") {
      if (state.phase !== "EXECUTE_MISSION") {
        return { valid: false, code: "WRONG_PHASE", message: "No beacon mission is currently underway." };
      }
      if (!state.proposedTeamIds.includes(playerId)) {
        return { valid: false, code: "NOT_ON_TEAM", message: "Only selected couriers may act on this beacon." };
      }
      if (state.pendingMissionCards[playerId]) {
        return { valid: false, code: "ALREADY_ACTED", message: "You already submitted your secret mission card." };
      }
      if (player.faction === "loyal" && action.card === "sabotage") {
        return {
          valid: false,
          code: "LOYAL_CANNOT_SABOTAGE",
          message: "Loyal Watch couriers may only play Light Beacon.",
        };
      }
      return { valid: true };
    }

    if (action.type === "USE_SPYGLASS") {
      if (state.phase !== "SPYGLASS_CHECK") {
        return { valid: false, code: "WRONG_PHASE", message: "The Brass Spyglass is not active right now." };
      }
      if (state.spyglassHolderId !== playerId) {
        return { valid: false, code: "NOT_SPYGLASS_HOLDER", message: "Only the Spyglass holder may inspect a courier." };
      }
      if (action.targetId === playerId) {
        return { valid: false, code: "CANNOT_SELF_INSPECT", message: "You cannot inspect yourself." };
      }
      if (!state.players.some((p) => p.userId === action.targetId)) {
        return { valid: false, code: "INVALID_TARGET", message: "Invalid Spyglass target." };
      }
      if (state.spyglassUsedByIds.includes(action.targetId)) {
        return {
          valid: false,
          code: "ALREADY_HELD_SPYGLASS",
          message: "You cannot inspect someone who has already held the Brass Spyglass.",
        };
      }
      return { valid: true };
    }

    if (action.type === "ASSASSINATE") {
      if (state.phase !== "ASSASSINATE_ORACLE") {
        return { valid: false, code: "WRONG_PHASE", message: "Not in the Final Unmasking phase." };
      }
      if (player.role !== "nightblade") {
        return { valid: false, code: "NOT_NIGHTBLADE", message: "Only the Nightblade may name the Oracle." };
      }
      const target = state.players.find((p) => p.userId === action.targetId);
      if (!target) {
        return { valid: false, code: "INVALID_TARGET", message: "Target is not seated at this table." };
      }
      if (target.faction !== "loyal") {
        return {
          valid: false,
          code: "MUST_TARGET_LOYAL",
          message: "You must target a Loyal Watch member to unmask the Oracle.",
        };
      }
      return { valid: true };
    }

    return { valid: false, code: "UNKNOWN_ACTION", message: "Unknown Lantern Watch action." };
  },

  applyAction(
    state: LanternState,
    playerId: string,
    action: LanternAction
  ): ActionApplyResult<LanternState, LanternEvent> {
    const check = this.validateAction(state, playerId, action);
    if (!check.valid) {
      throw new Error(check.message);
    }

    const events: LanternEvent[] = [];

    if (action.type === "PROPOSE_TEAM") {
      const commander = getCommander(state);
      const mission = getCurrentMission(state);
      // Normalize teamIds in seat order for crisp display
      const seatOrderedTeam = state.players
        .filter((p) => action.teamIds.includes(p.userId))
        .map((p) => p.userId);
      const teamNames = seatOrderedTeam
        .map((id) => state.players.find((p) => p.userId === id)?.displayName ?? id)
        .join(", ");

      const nextState: LanternState = {
        ...state,
        phase: "VOTE_TEAM",
        proposedTeamIds: seatOrderedTeam,
        pendingVotes: {},
        log: appendLog(
          state,
          `Commander ${commander.displayName} proposed [${teamNames}] for ${mission.beaconName} (Attempt ${state.rejectTrack + 1}/5).`,
          "neutral"
        ),
      };
      events.push({
        type: "TEAM_PROPOSED",
        commanderId: commander.userId,
        teamIds: seatOrderedTeam,
        missionNumber: mission.missionNumber,
      });
      return { state: nextState, events };
    }

    if (action.type === "CAST_VOTE") {
      const nextVotes = { ...state.pendingVotes, [playerId]: action.vote };
      events.push({ type: "VOTE_CAST", playerId });

      if (Object.keys(nextVotes).length < state.players.length) {
        return {
          state: {
            ...state,
            pendingVotes: nextVotes,
          },
          events,
        };
      }

      // All votes are in — flip publicly!
      const mission = getCurrentMission(state);
      const commander = getCommander(state);
      let approveCount = 0;
      let rejectCount = 0;
      for (const v of Object.values(nextVotes)) {
        if (v === "approve") approveCount++;
        else rejectCount++;
      }
      const approved = approveCount > rejectCount;
      const proposalRecord: ProposalRecord = {
        id: `prop_m${mission.missionNumber}_${state.proposalHistory.length + 1}`,
        missionNumber: mission.missionNumber,
        proposalAttempt: state.rejectTrack + 1,
        commanderId: commander.userId,
        commanderName: commander.displayName,
        teamIds: [...state.proposedTeamIds],
        votes: nextVotes,
        approveCount,
        rejectCount,
        approved,
      };

      const nextCommanderIndex = (state.commanderIndex + 1) % state.players.length;
      const nextProposalHistory = [...state.proposalHistory, proposalRecord];

      if (approved) {
        const nextState: LanternState = {
          ...state,
          phase: "EXECUTE_MISSION",
          commanderIndex: nextCommanderIndex,
          rejectTrack: 0,
          pendingVotes: {},
          pendingMissionCards: {},
          proposalHistory: nextProposalHistory,
          lastVoteReveal: proposalRecord,
          log: appendLog(
            state,
            `Council APPROVED (${approveCount}–${rejectCount})! The team departs for ${mission.beaconName}.`,
            "loyal"
          ),
        };
        events.push({
          type: "VOTE_RESOLVED",
          approved: true,
          approveCount,
          rejectCount,
          rejectTrack: 0,
        });
        return { state: nextState, events };
      }

      // Rejected (majority reject or tie)
      const nextRejectTrack = state.rejectTrack + 1;
      events.push({
        type: "VOTE_RESOLVED",
        approved: false,
        approveCount,
        rejectCount,
        rejectTrack: nextRejectTrack,
      });

      if (nextRejectTrack >= 5) {
        const finishedState: LanternState = {
          ...state,
          phase: "FINISHED",
          commanderIndex: nextCommanderIndex,
          rejectTrack: nextRejectTrack,
          proposedTeamIds: [],
          pendingVotes: {},
          proposalHistory: nextProposalHistory,
          lastVoteReveal: proposalRecord,
          winner: "shadow",
          winReason: "COUNCIL_COLLAPSE",
          log: appendLog(
            state,
            `Council REJECTED (${approveCount}–${rejectCount}) for a 5th consecutive time! The Council collapses — Shadow Moles win!`,
            "shadow"
          ),
        };
        events.push({
          type: "GAME_FINISHED",
          winner: "shadow",
          winReason: "COUNCIL_COLLAPSE",
        });
        return { state: finishedState, events };
      }

      const nextCommander = state.players[nextCommanderIndex]!;
      const nextState: LanternState = {
        ...state,
        phase: "PROPOSE_TEAM",
        commanderIndex: nextCommanderIndex,
        rejectTrack: nextRejectTrack,
        proposedTeamIds: [],
        pendingVotes: {},
        proposalHistory: nextProposalHistory,
        lastVoteReveal: proposalRecord,
        log: appendLog(
          state,
          `Council REJECTED (${approveCount}–${rejectCount}) · Chaos ${nextRejectTrack}/5. ${nextCommander.displayName} becomes Commander.`,
          "shadow"
        ),
      };
      return { state: nextState, events };
    }

    if (action.type === "PLAY_MISSION_CARD") {
      const nextCards = { ...state.pendingMissionCards, [playerId]: action.card };
      events.push({ type: "MISSION_CARD_PLAYED", playerId });

      if (Object.keys(nextCards).length < state.proposedTeamIds.length) {
        return {
          state: {
            ...state,
            pendingMissionCards: nextCards,
          },
          events,
        };
      }

      // All selected couriers have acted — shuffle cards anonymously!
      const mission = getCurrentMission(state);
      const rawCards = Object.values(nextCards);
      const shuffled = shuffleDeterministic(rawCards, state.rngSeed);
      const lightCount = rawCards.filter((c) => c === "light").length;
      const sabotageCount = rawCards.filter((c) => c === "sabotage").length;
      const succeeded = sabotageCount < mission.failsRequired;
      const outcome: LanternFaction = succeeded ? "loyal" : "shadow";
      const lastProposal = state.proposalHistory[state.proposalHistory.length - 1];

      const missionRecord: MissionRecord = {
        missionNumber: mission.missionNumber,
        beaconName: mission.beaconName,
        teamSize: mission.teamSize,
        failsRequired: mission.failsRequired,
        commanderId: lastProposal?.commanderId ?? getCommander(state).userId,
        teamIds: [...state.proposedTeamIds],
        lightCount,
        sabotageCount,
        shuffledCards: shuffled.shuffled as MissionCardChoice[],
        outcome,
      };

      const nextLoyalWins = state.loyalWins + (succeeded ? 1 : 0);
      const nextShadowWins = state.shadowWins + (succeeded ? 0 : 1);
      const nextMissionHistory = [...state.missionHistory, missionRecord];

      const outcomeText = succeeded
        ? `${mission.beaconName} LIT! (${lightCount} Light${sabotageCount > 0 ? `, ${sabotageCount} Extinguish — needed ${mission.failsRequired} fails!` : ""}) · Watch ${nextLoyalWins}–${nextShadowWins} Shadow.`
        : `${mission.beaconName} EXTINGUISHED! (${sabotageCount} Extinguish, ${lightCount} Light) · Watch ${nextLoyalWins}–${nextShadowWins} Shadow.`;

      events.push({
        type: "MISSION_RESOLVED",
        missionNumber: mission.missionNumber,
        outcome,
        lightCount,
        sabotageCount,
      });

      const baseAfterMission: LanternState = {
        ...state,
        rngSeed: shuffled.nextSeed,
        loyalWins: nextLoyalWins,
        shadowWins: nextShadowWins,
        proposedTeamIds: [],
        pendingMissionCards: {},
        missionHistory: nextMissionHistory,
        lastMissionReveal: missionRecord,
        log: appendLog(state, outcomeText, succeeded ? "loyal" : "shadow"),
      };

      // Check Shadow 3-beacon victory
      if (nextShadowWins >= 3) {
        const finishedState: LanternState = {
          ...baseAfterMission,
          phase: "FINISHED",
          winner: "shadow",
          winReason: "BEACONS_EXTINGUISHED",
          log: appendLog(
            baseAfterMission,
            "Three coastal beacons have gone dark — the Shadow Moles claim the harbor!",
            "shadow"
          ),
        };
        events.push({
          type: "GAME_FINISHED",
          winner: "shadow",
          winReason: "BEACONS_EXTINGUISHED",
        });
        return { state: finishedState, events };
      }

      // Check Loyal 3-beacon threshold (triggers Oracle Unmasking in Oracle & Shade mode!)
      if (nextLoyalWins >= 3) {
        const nightblade = state.players.find((p) => p.role === "nightblade");
        const oracle = state.players.find((p) => p.role === "oracle");
        if (state.mode === "oracle" && nightblade && oracle) {
          const assassinationState: LanternState = {
            ...baseAfterMission,
            phase: "ASSASSINATE_ORACLE",
            log: appendLog(
              baseAfterMission,
              "Three beacons blaze! Shadows stir — the Nightblade steps forward for ONE final attempt to unmask the Oracle!",
              "gold"
            ),
          };
          return { state: assassinationState, events };
        }

        const finishedState: LanternState = {
          ...baseAfterMission,
          phase: "FINISHED",
          winner: "loyal",
          winReason: "BEACONS_LIT",
          log: appendLog(
            baseAfterMission,
            "Three coastal beacons shine across the bay — the Loyal Watch wins!",
            "loyal"
          ),
        };
        events.push({
          type: "GAME_FINISHED",
          winner: "loyal",
          winReason: "BEACONS_LIT",
        });
        return { state: finishedState, events };
      }

      // Match continues to next mission! Check Brass Spyglass trigger (after Missions 2, 3, and 4)
      const nextMissionIndex = Math.min(state.missionIndex + 1, state.missions.length - 1);
      const spyglassDue =
        state.mode === "oracle" &&
        state.spyglassHolderId !== null &&
        mission.missionNumber >= 2 &&
        mission.missionNumber <= 4 &&
        getEligibleSpyglassTargets(baseAfterMission).length > 0;

      if (spyglassDue) {
        const holder = state.players.find((p) => p.userId === state.spyglassHolderId)!;
        const spyglassState: LanternState = {
          ...baseAfterMission,
          missionIndex: nextMissionIndex,
          phase: "SPYGLASS_CHECK",
          log: appendLog(
            baseAfterMission,
            `Brass Spyglass opens! ${holder.displayName} may privately inspect one unchecked courier.`,
            "gold"
          ),
        };
        return { state: spyglassState, events };
      }

      const nextCommander = getCommander(baseAfterMission);
      const nextMission = state.missions[nextMissionIndex]!;
      return {
        state: {
          ...baseAfterMission,
          missionIndex: nextMissionIndex,
          phase: "PROPOSE_TEAM",
          log: appendLog(
            baseAfterMission,
            `${nextCommander.displayName} leads the council for Beacon ${nextMission.missionNumber} (${nextMission.beaconName}).`,
            "neutral"
          ),
        },
        events,
      };
    }

    if (action.type === "USE_SPYGLASS") {
      const actor = state.players.find((p) => p.userId === playerId)!;
      const target = state.players.find((p) => p.userId === action.targetId)!;
      const completedMissionNumber = state.missionHistory.length;

      const nextPlayers = state.players.map((p) =>
        p.userId === actor.userId
          ? {
              ...p,
              spyglassReports: [
                ...p.spyglassReports,
                {
                  missionNumber: completedMissionNumber,
                  targetId: target.userId,
                  targetName: target.displayName,
                  faction: target.faction,
                },
              ],
            }
          : p
      );

      const nextCommander = getCommander(state);
      const nextMission = getCurrentMission(state);
      const nextState: LanternState = {
        ...state,
        phase: "PROPOSE_TEAM",
        players: nextPlayers,
        spyglassHolderId: target.userId,
        spyglassUsedByIds: [...state.spyglassUsedByIds, target.userId],
        log: appendLog(
          state,
          `${actor.displayName} peered through the Brass Spyglass at ${target.displayName} and handed them the lens. ${nextCommander.displayName} now proposes for ${nextMission.beaconName}.`,
          "gold"
        ),
      };

      events.push({
        type: "SPYGLASS_USED",
        actorId: actor.userId,
        targetId: target.userId,
        missionNumber: completedMissionNumber,
      });
      return { state: nextState, events };
    }

    if (action.type === "ASSASSINATE") {
      const actor = state.players.find((p) => p.userId === playerId)!;
      const target = state.players.find((p) => p.userId === action.targetId)!;
      const success = target.role === "oracle";
      const winner: LanternFaction = success ? "shadow" : "loyal";
      const winReason = success ? "ORACLE_ASSASSINATED" : "ORACLE_SURVIVED";

      const oraclePlayer = state.players.find((p) => p.role === "oracle");
      const msg = success
        ? `Nightblade ${actor.displayName} unmasked ${target.displayName} as THE ORACLE! Shadow Moles steal victory!`
        : `Nightblade ${actor.displayName} struck ${target.displayName} (${LANTERN_ROLE_META[target.role].name}) — and missed! ${oraclePlayer?.displayName ?? "The Oracle"} survives! Loyal Watch wins!`;

      const finishedState: LanternState = {
        ...state,
        phase: "FINISHED",
        assassinationTargetId: target.userId,
        assassinationSuccess: success,
        winner,
        winReason,
        log: appendLog(state, msg, success ? "shadow" : "loyal"),
      };

      events.push({
        type: "ASSASSINATION_RESOLVED",
        actorId: actor.userId,
        targetId: target.userId,
        success,
      });
      events.push({
        type: "GAME_FINISHED",
        winner,
        winReason,
      });
      return { state: finishedState, events };
    }

    throw new Error("Unhandled Lantern Watch action.");
  },

  onTurnTimeout(state: LanternState): ActionApplyResult<LanternState, LanternEvent> {
    if (state.phase === "FINISHED") {
      return { state, events: [] };
    }

    if (state.phase === "PROPOSE_TEAM") {
      const commander = getCommander(state);
      const mission = getCurrentMission(state);
      const teamIds: string[] = [];
      for (let i = 0; i < mission.teamSize; i++) {
        const seat = (state.commanderIndex + i) % state.players.length;
        teamIds.push(state.players[seat]!.userId);
      }
      return this.applyAction(state, commander.userId, {
        type: "PROPOSE_TEAM",
        teamIds,
      });
    }

    if (state.phase === "VOTE_TEAM") {
      let cur = state;
      const allEvents: LanternEvent[] = [];
      for (const p of state.players) {
        if (cur.phase !== "VOTE_TEAM") break;
        if (!cur.pendingVotes[p.userId]) {
          const res = this.applyAction(cur, p.userId, {
            type: "CAST_VOTE",
            vote: "approve",
          });
          cur = res.state;
          allEvents.push(...res.events);
        }
      }
      return { state: cur, events: allEvents };
    }

    if (state.phase === "EXECUTE_MISSION") {
      let cur = state;
      const allEvents: LanternEvent[] = [];
      for (const id of state.proposedTeamIds) {
        if (cur.phase !== "EXECUTE_MISSION") break;
        if (!cur.pendingMissionCards[id]) {
          const res = this.applyAction(cur, id, {
            type: "PLAY_MISSION_CARD",
            card: "light",
          });
          cur = res.state;
          allEvents.push(...res.events);
        }
      }
      return { state: cur, events: allEvents };
    }

    if (state.phase === "SPYGLASS_CHECK" && state.spyglassHolderId) {
      const targets = getEligibleSpyglassTargets(state);
      if (targets.length > 0) {
        return this.applyAction(state, state.spyglassHolderId, {
          type: "USE_SPYGLASS",
          targetId: targets[0]!,
        });
      }
      // Fallback: advance cleanly to PROPOSE_TEAM if no eligible targets exist
      return {
        state: { ...state, phase: "PROPOSE_TEAM" },
        events: [],
      };
    }

    if (state.phase === "ASSASSINATE_ORACLE") {
      const nightblade = state.players.find((p) => p.role === "nightblade");
      const firstLoyal = state.players.find((p) => p.faction === "loyal");
      if (nightblade && firstLoyal) {
        return this.applyAction(state, nightblade.userId, {
          type: "ASSASSINATE",
          targetId: firstLoyal.userId,
        });
      }
    }

    return { state, events: [] };
  },

  getPublicState(state: LanternState): LanternPublicState {
    const commander = getCommander(state);
    const currentMission = getCurrentMission(state);
    const countConfig = MISSION_CONFIG_BY_PLAYERS[state.players.length]!;
    const revealed = state.phase === "FINISHED";

    const rolesInPlay = [...state.players.map((p) => p.role)].sort(
      (a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b)
    );

    const publicPlayers: LanternPublicPlayer[] = state.players.map((p) => ({
      userId: p.userId,
      displayName: p.displayName,
      seatIndex: p.seatIndex,
      isCommander: p.userId === commander.userId,
      isOnProposedTeam: state.proposedTeamIds.includes(p.userId),
      hasVoted: Boolean(state.pendingVotes[p.userId]),
      hasSubmittedMissionCard: Boolean(state.pendingMissionCards[p.userId]),
      holdsSpyglass: state.spyglassHolderId === p.userId,
      hasUsedSpyglass: state.spyglassUsedByIds.includes(p.userId),
      lastVote: state.lastVoteReveal?.votes[p.userId] ?? null,
      revealedRole: revealed ? p.role : null,
      revealedFaction: revealed ? p.faction : null,
    }));

    return {
      mode: state.mode,
      phase: state.phase,
      turnSeconds: state.turnSeconds,
      playerCount: state.players.length,
      loyalCount: countConfig.loyalCount,
      shadowCount: countConfig.shadowCount,
      rolesInPlay,
      missions: state.missions,
      missionIndex: state.missionIndex,
      currentMission,
      commanderId: commander.userId,
      rejectTrack: state.rejectTrack,
      loyalWins: state.loyalWins,
      shadowWins: state.shadowWins,
      proposedTeamIds: state.proposedTeamIds,
      votedPlayerIds: Object.keys(state.pendingVotes),
      missionSubmittedIds: Object.keys(state.pendingMissionCards),
      players: publicPlayers,
      proposalHistory: state.proposalHistory,
      missionHistory: state.missionHistory,
      spyglassEnabled: state.mode === "oracle" && state.players.length >= 5,
      spyglassHolderId: state.spyglassHolderId,
      spyglassUsedByIds: state.spyglassUsedByIds,
      spyglassEligibleTargetIds:
        state.phase === "SPYGLASS_CHECK" ? getEligibleSpyglassTargets(state) : [],
      lastVoteReveal: state.lastVoteReveal,
      lastMissionReveal: state.lastMissionReveal,
      assassinationTargetId: state.assassinationTargetId,
      assassinationSuccess: state.assassinationSuccess,
      winner: state.winner,
      winReason: state.winReason,
      log: state.log,
    };
  },

  getPrivateState(state: LanternState, playerId: string): LanternPrivateState {
    const player = state.players.find((p) => p.userId === playerId);
    if (!player) {
      return {
        playerId,
        role: "loyal_courier",
        roleName: "Spectator",
        roleSummary: "Observing the Harbor Council.",
        faction: "loyal",
        sightings: [],
        veiledMoleWarning: false,
        spyglassReports: [],
        allowedMissionCards: [],
        myPendingVote: null,
        myPendingMissionCard: null,
        canPropose: false,
        canVote: false,
        canPlayMissionCard: false,
        canUseSpyglass: false,
        canAssassinate: false,
      };
    }

    const meta = LANTERN_ROLE_META[player.role];
    const sightings: PrivateSighting[] = [];

    if (player.faction === "shadow") {
      for (const other of state.players) {
        if (other.userId !== player.userId && other.faction === "shadow") {
          sightings.push({
            userId: other.userId,
            displayName: other.displayName,
            kind: "shadow_ally",
            label: "Shadow Ally",
          });
        }
      }
    } else if (player.role === "oracle") {
      for (const other of state.players) {
        if (other.faction === "shadow" && other.role !== "veiled_mole") {
          sightings.push({
            userId: other.userId,
            displayName: other.displayName,
            kind: "shadow_suspect",
            label: "Shadow Mole",
          });
        }
      }
    } else if (player.role === "warden") {
      // Seat-ordered so order never leaks which silhouette is Oracle vs Mirage
      for (const other of state.players) {
        if (other.role === "oracle" || other.role === "mirage") {
          sightings.push({
            userId: other.userId,
            displayName: other.displayName,
            kind: "oracle_candidate",
            label: "Oracle or Mirage",
          });
        }
      }
    }

    const commander = getCommander(state);

    return {
      playerId: player.userId,
      role: player.role,
      roleName: meta.name,
      roleSummary: meta.summary,
      faction: player.faction,
      sightings,
      veiledMoleWarning:
        player.role === "oracle" && state.players.some((p) => p.role === "veiled_mole"),
      spyglassReports: [...player.spyglassReports],
      allowedMissionCards: player.faction === "shadow" ? ["light", "sabotage"] : ["light"],
      myPendingVote: state.pendingVotes[player.userId] ?? null,
      myPendingMissionCard: state.pendingMissionCards[player.userId] ?? null,
      canPropose: state.phase === "PROPOSE_TEAM" && commander.userId === player.userId,
      canVote: state.phase === "VOTE_TEAM" && !state.pendingVotes[player.userId],
      canPlayMissionCard:
        state.phase === "EXECUTE_MISSION" &&
        state.proposedTeamIds.includes(player.userId) &&
        !state.pendingMissionCards[player.userId],
      canUseSpyglass:
        state.phase === "SPYGLASS_CHECK" && state.spyglassHolderId === player.userId,
      canAssassinate:
        state.phase === "ASSASSINATE_ORACLE" && player.role === "nightblade",
    };
  },

  getDisplayState(state: LanternState): LanternDisplayState {
    return {
      phase: state.phase,
      mode: state.mode,
      missionNumber: Math.min(state.missionIndex + 1, state.missions.length),
      loyalWins: state.loyalWins,
      shadowWins: state.shadowWins,
      rejectTrack: state.rejectTrack,
      winner: state.winner,
    };
  },

  isGameCompleted(state: LanternState): boolean {
    return state.phase === "FINISHED";
  },

  getResults(state: LanternState): GameResultSummary | null {
    if (state.phase !== "FINISHED" || !state.winner) {
      return null;
    }

    return {
      winningTeam: state.winner === "loyal" ? "Loyal Watch" : "Shadow Moles",
      headline: winHeadline(state),
      players: state.players.map((p) => {
        const isWinner = p.faction === state.winner;
        const teamScore = p.faction === "loyal" ? state.loyalWins : state.shadowWins;
        return {
          userId: p.userId,
          displayName: p.displayName,
          score: isWinner ? Math.max(3, teamScore) : teamScore,
          isWinner,
          roleLabel: LANTERN_ROLE_META[p.role].name,
        };
      }),
    };
  },
};
