import { nextRandom } from "@tablefolk/game-engine";
import type {
  LanternAction,
  LanternPrivateState,
  LanternPublicState,
} from "./types.js";

/**
 * Non-cheating Bayesian-style Practice Bot for Lantern Watch.
 * Strictly reads ONLY `publicState` + the bot's own `privateState`!
 */
export function pickLanternBotAction(
  publicState: LanternPublicState,
  privateState: LanternPrivateState,
  playerId: string,
  rngSeed: number
): LanternAction | null {
  let seed = rngSeed | 0;
  const rand = (): number => {
    const r = nextRandom(seed);
    seed = r.nextSeed;
    return r.value;
  };

  const knownShadowIds = new Set<string>();
  const knownLoyalIds = new Set<string>();
  const oracleCandidateIds = new Set<string>();

  if (privateState.faction === "shadow") {
    knownShadowIds.add(playerId);
  } else {
    knownLoyalIds.add(playerId);
  }

  for (const s of privateState.sightings) {
    if (s.kind === "shadow_ally" || s.kind === "shadow_suspect") {
      knownShadowIds.add(s.userId);
    } else if (s.kind === "oracle_candidate") {
      oracleCandidateIds.add(s.userId);
    }
  }

  for (const rep of privateState.spyglassReports) {
    if (rep.faction === "shadow") {
      knownShadowIds.add(rep.targetId);
    } else {
      knownLoyalIds.add(rep.targetId);
    }
  }

  // Compute public suspicion score for every player from mission & vote history
  const suspicion = new Map<string, number>();
  for (const p of publicState.players) {
    suspicion.set(p.userId, (rand() - 0.5) * 0.25);
  }

  const missionOutcomeByNumber = new Map<number, "loyal" | "shadow">();
  for (const m of publicState.missionHistory) {
    missionOutcomeByNumber.set(m.missionNumber, m.outcome);
    if (m.sabotageCount > 0) {
      // Spread suspicion among other couriers on the failed mission
      const otherMembers = m.teamIds.filter((id) => id !== playerId);
      const denom = Math.max(1, otherMembers.length);
      for (const id of otherMembers) {
        suspicion.set(id, (suspicion.get(id) ?? 0) + (3.2 * m.sabotageCount) / denom);
      }
    } else {
      for (const id of m.teamIds) {
        suspicion.set(id, (suspicion.get(id) ?? 0) - 0.85);
      }
    }
  }

  for (const prop of publicState.proposalHistory) {
    const outcome = missionOutcomeByNumber.get(prop.missionNumber);
    if (prop.approved && outcome === "shadow") {
      for (const [voterId, choice] of Object.entries(prop.votes)) {
        if (choice === "approve") {
          suspicion.set(voterId, (suspicion.get(voterId) ?? 0) + 0.55);
        } else {
          suspicion.set(voterId, (suspicion.get(voterId) ?? 0) - 0.25);
        }
      }
    } else if (prop.approved && outcome === "loyal") {
      for (const [voterId, choice] of Object.entries(prop.votes)) {
        if (choice === "reject" && !prop.teamIds.includes(voterId)) {
          suspicion.set(voterId, (suspicion.get(voterId) ?? 0) + 0.2);
        }
      }
    }
  }

  // Hard override with private knowledge
  for (const id of knownShadowIds) {
    suspicion.set(id, 100);
  }
  for (const id of knownLoyalIds) {
    suspicion.set(id, -100);
  }

  const otherPlayers = publicState.players.filter((p) => p.userId !== playerId);

  // 1. PROPOSE_TEAM
  if (publicState.phase === "PROPOSE_TEAM" && privateState.canPropose) {
    const teamSize = publicState.currentMission.teamSize;
    const failsRequired = publicState.currentMission.failsRequired;

    if (privateState.faction === "loyal") {
      const ranked = [...otherPlayers].sort(
        (a, b) => (suspicion.get(a.userId) ?? 0) - (suspicion.get(b.userId) ?? 0)
      );
      const team = [playerId, ...ranked.slice(0, teamSize - 1).map((p) => p.userId)];
      return { type: "PROPOSE_TEAM", teamIds: team };
    }

    // Shadow Commander: blend in by picking self (or 1 ally) + lowest-suspicion Loyal players
    const loyalOthers = otherPlayers
      .filter((p) => !knownShadowIds.has(p.userId))
      .sort((a, b) => (suspicion.get(a.userId) ?? 0) - (suspicion.get(b.userId) ?? 0));
    const shadowOthers = otherPlayers.filter((p) => knownShadowIds.has(p.userId));

    const team: string[] = [];
    const wantShadowCount = Math.min(
      failsRequired,
      1 + shadowOthers.length,
      teamSize
    );
    // Usually include self, occasionally send an ally instead to look innocent
    if (rand() < 0.72 || shadowOthers.length === 0) {
      team.push(playerId);
    } else {
      team.push(shadowOthers[0]!.userId);
    }

    while (team.length < wantShadowCount) {
      const nextAlly = shadowOthers.find((p) => !team.includes(p.userId));
      if (!nextAlly) break;
      team.push(nextAlly.userId);
    }

    for (const loyal of loyalOthers) {
      if (team.length >= teamSize) break;
      team.push(loyal.userId);
    }
    for (const p of publicState.players) {
      if (team.length >= teamSize) break;
      if (!team.includes(p.userId)) team.push(p.userId);
    }

    return { type: "PROPOSE_TEAM", teamIds: team.slice(0, teamSize) };
  }

  // 2. VOTE_TEAM
  if (publicState.phase === "VOTE_TEAM" && privateState.canVote) {
    const team = publicState.proposedTeamIds;
    const failsRequired = publicState.currentMission.failsRequired;

    // 5th proposal hammer rule: Loyal MUST approve to prevent Shadow Collapse; Shadow rejects!
    if (publicState.rejectTrack >= 4) {
      return {
        type: "CAST_VOTE",
        vote: privateState.faction === "loyal" ? "approve" : "reject",
      };
    }

    if (privateState.faction === "shadow") {
      const shadowOnTeam = team.filter((id) => knownShadowIds.has(id)).length;
      if (shadowOnTeam >= failsRequired) {
        return { type: "CAST_VOTE", vote: "approve" };
      }
      if (shadowOnTeam > 0 && publicState.loyalWins < 2 && rand() < 0.45) {
        return { type: "CAST_VOTE", vote: "approve" };
      }
      // On Mission 1 attempt 1, occasionally approve clean team to earn trust
      if (
        publicState.missionIndex === 0 &&
        publicState.rejectTrack === 0 &&
        rand() < 0.35
      ) {
        return { type: "CAST_VOTE", vote: "approve" };
      }
      return { type: "CAST_VOTE", vote: "reject" };
    }

    // Loyal voting logic
    const knownShadowsOnTeam = team.filter((id) => knownShadowIds.has(id)).length;
    if (knownShadowsOnTeam > 0) {
      // Oracle stays subtly unpredictable on non-critical Mission 1 attempt 1 (~15% bluff approve)
      if (
        privateState.role === "oracle" &&
        publicState.missionIndex === 0 &&
        publicState.rejectTrack === 0 &&
        rand() < 0.15
      ) {
        return { type: "CAST_VOTE", vote: "approve" };
      }
      return { type: "CAST_VOTE", vote: "reject" };
    }

    // Evaluate public suspicion of the proposed team
    const nonSelfTeam = team.filter((id) => id !== playerId);
    const avgSuspicion =
      nonSelfTeam.length === 0
        ? 0
        : nonSelfTeam.reduce((sum, id) => sum + (suspicion.get(id) ?? 0), 0) /
          nonSelfTeam.length;

    if (publicState.missionIndex === 0) {
      const included = team.includes(playerId);
      const approveChance = included ? 0.85 : publicState.rejectTrack >= 2 ? 0.72 : 0.55;
      return { type: "CAST_VOTE", vote: rand() < approveChance ? "approve" : "reject" };
    }

    if (avgSuspicion > 0.95) {
      return { type: "CAST_VOTE", vote: "reject" };
    }
    if (avgSuspicion < 0.35 || team.includes(playerId)) {
      return { type: "CAST_VOTE", vote: "approve" };
    }
    return { type: "CAST_VOTE", vote: rand() < 0.55 ? "approve" : "reject" };
  }

  // 3. EXECUTE_MISSION
  if (publicState.phase === "EXECUTE_MISSION" && privateState.canPlayMissionCard) {
    if (privateState.faction === "loyal") {
      return { type: "PLAY_MISSION_CARD", card: "light" };
    }

    const shadowOnTeam = publicState.proposedTeamIds.filter((id) =>
      knownShadowIds.has(id)
    ).length;
    const failsRequired = publicState.currentMission.failsRequired;

    // On a 2-fail mission, if I am the lone Shadow and Loyal isn't on match point, stay undercover!
    if (failsRequired >= 2 && shadowOnTeam < 2 && publicState.loyalWins < 2) {
      return { type: "PLAY_MISSION_CARD", card: "light" };
    }
    // Occasional clever Mission 1 bluff on a 2-courier mission to gain deep cover
    if (
      publicState.missionIndex === 0 &&
      publicState.proposedTeamIds.length === 2 &&
      shadowOnTeam === 1 &&
      rand() < 0.2
    ) {
      return { type: "PLAY_MISSION_CARD", card: "light" };
    }

    return { type: "PLAY_MISSION_CARD", card: "sabotage" };
  }

  // 4. SPYGLASS_CHECK
  if (publicState.phase === "SPYGLASS_CHECK" && privateState.canUseSpyglass) {
    const eligible = publicState.spyglassEligibleTargetIds;
    if (eligible.length === 0) return null;

    // Prefer checking an unknown player (especially Warden's Oracle/Mirage candidates!)
    const candidateTarget = eligible.find((id) => oracleCandidateIds.has(id));
    if (candidateTarget) {
      return { type: "USE_SPYGLASS", targetId: candidateTarget };
    }

    const unknownEligible = eligible.filter(
      (id) => !knownShadowIds.has(id) && !knownLoyalIds.has(id)
    );
    const pool = unknownEligible.length > 0 ? unknownEligible : eligible;
    // Check whoever has highest suspicion among unknowns
    const best = [...pool].sort(
      (a, b) => (suspicion.get(b) ?? 0) - (suspicion.get(a) ?? 0)
    )[0]!;
    return { type: "USE_SPYGLASS", targetId: best };
  }

  // 5. ASSASSINATE_ORACLE (Nightblade only!)
  if (publicState.phase === "ASSASSINATE_ORACLE" && privateState.canAssassinate) {
    const loyalTargets = publicState.players.filter(
      (p) => !knownShadowIds.has(p.userId)
    );
    if (loyalTargets.length === 0) return null;

    // Score each Loyal player by how accurately their votes/proposals avoided Shadow Moles!
    const oracleScore = new Map<string, number>();
    for (const p of loyalTargets) {
      oracleScore.set(p.userId, rand() * 0.4);
    }

    for (const prop of publicState.proposalHistory) {
      const hasShadow = prop.teamIds.some((id) => knownShadowIds.has(id));
      for (const p of loyalTargets) {
        const vote = prop.votes[p.userId];
        if (hasShadow && vote === "reject") {
          oracleScore.set(p.userId, (oracleScore.get(p.userId) ?? 0) + 1.2);
        } else if (!hasShadow && vote === "approve") {
          oracleScore.set(p.userId, (oracleScore.get(p.userId) ?? 0) + 0.8);
        } else if (hasShadow && vote === "approve") {
          oracleScore.set(p.userId, (oracleScore.get(p.userId) ?? 0) - 0.7);
        }
      }
      if (oracleScore.has(prop.commanderId)) {
        oracleScore.set(
          prop.commanderId,
          (oracleScore.get(prop.commanderId) ?? 0) + (hasShadow ? -1.4 : 1.3)
        );
      }
    }

    const target = [...loyalTargets].sort(
      (a, b) => (oracleScore.get(b.userId) ?? 0) - (oracleScore.get(a.userId) ?? 0)
    )[0]!;
    return { type: "ASSASSINATE", targetId: target.userId };
  }

  return null;
}
