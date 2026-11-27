import { z } from "zod";

export type LanternMode = "classic" | "oracle";
export type LanternFaction = "loyal" | "shadow";

export type LanternRoleId =
  | "loyal_courier"
  | "oracle"
  | "warden"
  | "shadow_mole"
  | "nightblade"
  | "mirage"
  | "veiled_mole";

export type LanternPhase =
  | "PROPOSE_TEAM"
  | "VOTE_TEAM"
  | "EXECUTE_MISSION"
  | "SPYGLASS_CHECK"
  | "ASSASSINATE_ORACLE"
  | "FINISHED";

export type VoteChoice = "approve" | "reject";
export type MissionCardChoice = "light" | "sabotage";

export type LanternWinReason =
  | "BEACONS_LIT"
  | "ORACLE_SURVIVED"
  | "BEACONS_EXTINGUISHED"
  | "COUNCIL_COLLAPSE"
  | "ORACLE_ASSASSINATED";

export interface BeaconSpec {
  missionNumber: number; // 1..5
  beaconName: string;
  teamSize: number;
  failsRequired: number;
}

export interface PlayerCountConfig {
  loyalCount: number;
  shadowCount: number;
  missions: BeaconSpec[];
}

export const BEACON_NAMES = [
  "Harbor Light",
  "Cliffside Bell",
  "Foghorn Pier",
  "Tidegate Spire",
  "Starlight Keep",
] as const;

export const MISSION_CONFIG_BY_PLAYERS: Record<number, PlayerCountConfig> = {
  4: {
    loyalCount: 3,
    shadowCount: 1,
    missions: [
      { missionNumber: 1, beaconName: BEACON_NAMES[0], teamSize: 2, failsRequired: 1 },
      { missionNumber: 2, beaconName: BEACON_NAMES[1], teamSize: 2, failsRequired: 1 },
      { missionNumber: 3, beaconName: BEACON_NAMES[2], teamSize: 3, failsRequired: 1 },
      { missionNumber: 4, beaconName: BEACON_NAMES[3], teamSize: 2, failsRequired: 1 },
      { missionNumber: 5, beaconName: BEACON_NAMES[4], teamSize: 3, failsRequired: 1 },
    ],
  },
  5: {
    loyalCount: 3,
    shadowCount: 2,
    missions: [
      { missionNumber: 1, beaconName: BEACON_NAMES[0], teamSize: 2, failsRequired: 1 },
      { missionNumber: 2, beaconName: BEACON_NAMES[1], teamSize: 3, failsRequired: 1 },
      { missionNumber: 3, beaconName: BEACON_NAMES[2], teamSize: 2, failsRequired: 1 },
      { missionNumber: 4, beaconName: BEACON_NAMES[3], teamSize: 3, failsRequired: 1 },
      { missionNumber: 5, beaconName: BEACON_NAMES[4], teamSize: 3, failsRequired: 1 },
    ],
  },
  6: {
    loyalCount: 4,
    shadowCount: 2,
    missions: [
      { missionNumber: 1, beaconName: BEACON_NAMES[0], teamSize: 2, failsRequired: 1 },
      { missionNumber: 2, beaconName: BEACON_NAMES[1], teamSize: 3, failsRequired: 1 },
      { missionNumber: 3, beaconName: BEACON_NAMES[2], teamSize: 4, failsRequired: 1 },
      { missionNumber: 4, beaconName: BEACON_NAMES[3], teamSize: 3, failsRequired: 1 },
      { missionNumber: 5, beaconName: BEACON_NAMES[4], teamSize: 4, failsRequired: 1 },
    ],
  },
  7: {
    loyalCount: 4,
    shadowCount: 3,
    missions: [
      { missionNumber: 1, beaconName: BEACON_NAMES[0], teamSize: 2, failsRequired: 1 },
      { missionNumber: 2, beaconName: BEACON_NAMES[1], teamSize: 3, failsRequired: 1 },
      { missionNumber: 3, beaconName: BEACON_NAMES[2], teamSize: 3, failsRequired: 1 },
      { missionNumber: 4, beaconName: BEACON_NAMES[3], teamSize: 4, failsRequired: 2 },
      { missionNumber: 5, beaconName: BEACON_NAMES[4], teamSize: 4, failsRequired: 1 },
    ],
  },
  8: {
    loyalCount: 5,
    shadowCount: 3,
    missions: [
      { missionNumber: 1, beaconName: BEACON_NAMES[0], teamSize: 3, failsRequired: 1 },
      { missionNumber: 2, beaconName: BEACON_NAMES[1], teamSize: 4, failsRequired: 1 },
      { missionNumber: 3, beaconName: BEACON_NAMES[2], teamSize: 4, failsRequired: 1 },
      { missionNumber: 4, beaconName: BEACON_NAMES[3], teamSize: 5, failsRequired: 2 },
      { missionNumber: 5, beaconName: BEACON_NAMES[4], teamSize: 5, failsRequired: 1 },
    ],
  },
};

export interface LanternRoleMeta {
  id: LanternRoleId;
  name: string;
  faction: LanternFaction;
  shortTag: string;
  summary: string;
}

export const LANTERN_ROLE_META: Record<LanternRoleId, LanternRoleMeta> = {
  loyal_courier: {
    id: "loyal_courier",
    name: "Loyal Courier",
    faction: "loyal",
    shortTag: "Loyal Watch",
    summary:
      "Read council votes and mission outcomes carefully. You can only play Light Beacon on missions.",
  },
  oracle: {
    id: "oracle",
    name: "The Oracle",
    faction: "loyal",
    shortTag: "Loyal · Seer",
    summary:
      "You secretly see the Shadow Moles (except a Veiled Mole at 7–8p). Guide the council subtly so the Nightblade cannot unmask you!",
  },
  warden: {
    id: "warden",
    name: "The Warden",
    faction: "loyal",
    shortTag: "Loyal · Guardian",
    summary:
      "You see two silhouettes: the true Oracle and the Shadow Mirage. Deduce who is genuine and shield the Oracle!",
  },
  shadow_mole: {
    id: "shadow_mole",
    name: "Shadow Mole",
    faction: "shadow",
    shortTag: "Shadow Agent",
    summary:
      "You know your fellow Moles. Sabotage 3 beacons, push 5 vote rejections, or stay undercover until the final call.",
  },
  nightblade: {
    id: "nightblade",
    name: "Nightblade",
    faction: "shadow",
    shortTag: "Shadow · Assassin",
    summary:
      "You know your fellow Moles. If the Loyal Watch lights 3 beacons, you get one final chance to unmask the Oracle and steal victory!",
  },
  mirage: {
    id: "mirage",
    name: "Mirage",
    faction: "shadow",
    shortTag: "Shadow · Decoy",
    summary:
      "You appear as a second Oracle candidate to the Warden. Sow doubt about the true Oracle's signals!",
  },
  veiled_mole: {
    id: "veiled_mole",
    name: "Veiled Mole",
    faction: "shadow",
    shortTag: "Shadow · Hidden",
    summary:
      "Your cloak hides you from the Oracle's vision! Use your clean aura to slip onto decisive missions.",
  },
};

export interface LanternConfig {
  mode?: LanternMode;
  turnSeconds?: number;
}

export interface SpyglassReport {
  missionNumber: number;
  targetId: string;
  targetName: string;
  faction: LanternFaction;
}

export interface LanternPlayer {
  userId: string;
  displayName: string;
  seatIndex: number;
  role: LanternRoleId;
  faction: LanternFaction;
  spyglassReports: SpyglassReport[];
}

export interface ProposalRecord {
  id: string;
  missionNumber: number;
  proposalAttempt: number; // 1..5 within mission
  commanderId: string;
  commanderName: string;
  teamIds: string[];
  votes: Record<string, VoteChoice>;
  approveCount: number;
  rejectCount: number;
  approved: boolean;
}

export interface MissionRecord {
  missionNumber: number;
  beaconName: string;
  teamSize: number;
  failsRequired: number;
  commanderId: string;
  teamIds: string[];
  lightCount: number;
  sabotageCount: number;
  shuffledCards: MissionCardChoice[];
  outcome: LanternFaction; // "loyal" (Lit) or "shadow" (Extinguished)
}

export interface LanternLogEntry {
  id: string;
  missionNumber: number;
  text: string;
  tone: "neutral" | "loyal" | "shadow" | "gold";
}

export interface LanternState {
  mode: LanternMode;
  turnSeconds: number;
  rngSeed: number;
  phase: LanternPhase;
  players: LanternPlayer[];
  missions: BeaconSpec[];
  missionIndex: number; // 0..4
  commanderIndex: number; // 0..players.length-1
  rejectTrack: number; // 0..5 consecutive rejected proposals
  loyalWins: number;
  shadowWins: number;
  proposedTeamIds: string[];
  pendingVotes: Record<string, VoteChoice>;
  pendingMissionCards: Record<string, MissionCardChoice>;
  proposalHistory: ProposalRecord[];
  missionHistory: MissionRecord[];
  spyglassHolderId: string | null;
  spyglassUsedByIds: string[];
  lastVoteReveal: ProposalRecord | null;
  lastMissionReveal: MissionRecord | null;
  assassinationTargetId: string | null;
  assassinationSuccess: boolean | null;
  winner: LanternFaction | null;
  winReason: LanternWinReason | null;
  log: LanternLogEntry[];
}

export interface LanternPublicPlayer {
  userId: string;
  displayName: string;
  seatIndex: number;
  isCommander: boolean;
  isOnProposedTeam: boolean;
  hasVoted: boolean;
  hasSubmittedMissionCard: boolean;
  holdsSpyglass: boolean;
  hasUsedSpyglass: boolean;
  lastVote: VoteChoice | null;
  revealedRole: LanternRoleId | null;
  revealedFaction: LanternFaction | null;
}

export interface LanternPublicState {
  mode: LanternMode;
  phase: LanternPhase;
  turnSeconds: number;
  playerCount: number;
  loyalCount: number;
  shadowCount: number;
  rolesInPlay: LanternRoleId[];
  missions: BeaconSpec[];
  missionIndex: number;
  currentMission: BeaconSpec;
  commanderId: string;
  rejectTrack: number;
  loyalWins: number;
  shadowWins: number;
  proposedTeamIds: string[];
  votedPlayerIds: string[];
  missionSubmittedIds: string[];
  players: LanternPublicPlayer[];
  proposalHistory: ProposalRecord[];
  missionHistory: MissionRecord[];
  spyglassEnabled: boolean;
  spyglassHolderId: string | null;
  spyglassUsedByIds: string[];
  spyglassEligibleTargetIds: string[];
  lastVoteReveal: ProposalRecord | null;
  lastMissionReveal: MissionRecord | null;
  assassinationTargetId: string | null;
  assassinationSuccess: boolean | null;
  winner: LanternFaction | null;
  winReason: LanternWinReason | null;
  log: LanternLogEntry[];
}

export type SightingKind = "shadow_ally" | "shadow_suspect" | "oracle_candidate";

export interface PrivateSighting {
  userId: string;
  displayName: string;
  kind: SightingKind;
  label: string;
}

export interface LanternPrivateState {
  playerId: string;
  role: LanternRoleId;
  roleName: string;
  roleSummary: string;
  faction: LanternFaction;
  sightings: PrivateSighting[];
  veiledMoleWarning: boolean;
  spyglassReports: SpyglassReport[];
  allowedMissionCards: MissionCardChoice[];
  myPendingVote: VoteChoice | null;
  myPendingMissionCard: MissionCardChoice | null;
  canPropose: boolean;
  canVote: boolean;
  canPlayMissionCard: boolean;
  canUseSpyglass: boolean;
  canAssassinate: boolean;
}

export interface LanternDisplayState {
  phase: LanternPhase;
  mode: LanternMode;
  missionNumber: number;
  loyalWins: number;
  shadowWins: number;
  rejectTrack: number;
  winner: LanternFaction | null;
}

export type LanternEvent =
  | { type: "TEAM_PROPOSED"; commanderId: string; teamIds: string[]; missionNumber: number }
  | { type: "VOTE_CAST"; playerId: string }
  | {
      type: "VOTE_RESOLVED";
      approved: boolean;
      approveCount: number;
      rejectCount: number;
      rejectTrack: number;
    }
  | { type: "MISSION_CARD_PLAYED"; playerId: string }
  | {
      type: "MISSION_RESOLVED";
      missionNumber: number;
      outcome: LanternFaction;
      lightCount: number;
      sabotageCount: number;
    }
  | { type: "SPYGLASS_USED"; actorId: string; targetId: string; missionNumber: number }
  | { type: "ASSASSINATION_RESOLVED"; actorId: string; targetId: string; success: boolean }
  | { type: "GAME_FINISHED"; winner: LanternFaction; winReason: LanternWinReason };

export const LanternActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("PROPOSE_TEAM"),
    teamIds: z.array(z.string().min(1)).min(1).max(6),
  }),
  z.object({
    type: z.literal("CAST_VOTE"),
    vote: z.enum(["approve", "reject"]),
  }),
  z.object({
    type: z.literal("PLAY_MISSION_CARD"),
    card: z.enum(["light", "sabotage"]),
  }),
  z.object({
    type: z.literal("USE_SPYGLASS"),
    targetId: z.string().min(1),
  }),
  z.object({
    type: z.literal("ASSASSINATE"),
    targetId: z.string().min(1),
  }),
]);

export type LanternAction = z.infer<typeof LanternActionSchema>;

export const LANTERN_QUICK_LINES = [
  "Trust the ledger — look at who approved that!",
  "This team feels clean. Approving!",
  "Too risky — rejecting this crew.",
  "Two beacons left. Pick carefully!",
  "Someone on that mission extinguished the flame!",
  "Check the Brass Spyglass before trusting them!",
  "Stay sharp, Watch — the Nightblade is listening.",
  "Well played! What a deduction!",
] as const;
