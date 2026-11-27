"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Client as ColyseusClient, type Room } from "colyseus.js";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Crown,
  Eye,
  EyeOff,
  Flame,
  MessageCircle,
  RotateCcw,
  ScrollText,
  Send,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Volume2,
  VolumeX,
  X,
  XCircle,
} from "lucide-react";
import type { GameResultSummary } from "@tablefolk/game-engine";
import {
  LANTERN_QUICK_LINES,
  LANTERN_ROLE_META,
  type LanternAction,
  type LanternEvent,
  type LanternPrivateState,
  type LanternPublicState,
  type LanternRoleId,
  type MissionCardChoice,
  type VoteChoice,
} from "@tablefolk/game-lantern-watch";
import { WS_BASE_URL, getStoredToken } from "@/lib/api";
import { hasCompletedQuickTour } from "@/lib/gameQuickTours";
import { soundEngine } from "@/lib/sound";
import { GameIcon, type GameIconName } from "./GameIcons";
import { GameQuickTour } from "./GameQuickTour";
import { GuidedTutorialCoach } from "./GuidedTutorialCoach";
import { buildLanternWatchGuide } from "@/lib/guidedTutorials";

interface LanternWatchOverlayProps {
  gameRoomId: string;
  myUserId: string;
  tutorialMode?: boolean;
  onExitGame: (info?: { finished?: boolean; notice?: string }) => void;
  onOpenTutorial: () => void;
}

interface GameChatEntry {
  id: string;
  senderUserId: string;
  senderName: string;
  message: string;
  createdAt: string;
}

function roleToIconName(role: LanternRoleId): GameIconName {
  switch (role) {
    case "oracle":
      return "lw-oracle";
    case "warden":
      return "lw-warden";
    case "nightblade":
      return "lw-nightblade";
    case "mirage":
    case "veiled_mole":
    case "shadow_mole":
      return "lw-mole";
    default:
      return "lw-beacon";
  }
}

function shortInitials(name: string): string {
  const clean = name.trim();
  if (!clean) return "?";
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

export function LanternWatchOverlay({
  gameRoomId,
  myUserId,
  tutorialMode = false,
  onExitGame,
  onOpenTutorial,
}: LanternWatchOverlayProps) {
  const [publicState, setPublicState] = useState<LanternPublicState | null>(null);
  const [privateState, setPrivateState] = useState<LanternPrivateState | null>(null);
  const [results, setResults] = useState<GameResultSummary | null>(null);
  const [isSpectator, setIsSpectator] = useState(false);
  const [turnEndsAt, setTurnEndsAt] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [connectError, setConnectError] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [rematchStatus, setRematchStatus] = useState<{ votes: string[]; needed: number }>({
    votes: [],
    needed: 1,
  });
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [botControlledUserIds, setBotControlledUserIds] = useState<string[]>([]);
  const [spectatorCount, setSpectatorCount] = useState(0);

  // Local interactive selection states
  const [draftTeamIds, setDraftTeamIds] = useState<string[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [hideRole, setHideRole] = useState(false);
  const [showVictoryModal, setShowVictoryModal] = useState(true);
  const [showQuickTour, setShowQuickTour] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<GameChatEntry[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [unreadChat, setUnreadChat] = useState(0);

  const roomRef = useRef<Room | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatOpenRef = useRef(false);
  const prevPhaseKeyRef = useRef<string>("");

  useEffect(() => {
    chatOpenRef.current = chatOpen;
    if (chatOpen) {
      setUnreadChat(0);
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatOpen, chatMessages.length]);

  const showNotice = (msg: string) => {
    setActionToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setActionToast(null), 4200);
  };

  // Connect to LanternWatchRoom
  useEffect(() => {
    let active = true;
    const token = getStoredToken();
    if (!token) {
      setConnectError("Missing auth token — please return to the café.");
      return;
    }

    const client = new ColyseusClient(WS_BASE_URL);
    void client
      .joinById(gameRoomId, { token })
      .then((room) => {
        if (!active) {
          void room.leave();
          return;
        }
        roomRef.current = room;

        room.onMessage(
          "game.state",
          (payload: {
            publicState: LanternPublicState;
            privateState: LanternPrivateState | null;
            turnEndsAt: number;
            isSpectator: boolean;
            botControlledUserIds?: string[];
            results?: GameResultSummary | null;
            events?: LanternEvent[];
          }) => {
            setPublicState(payload.publicState);
            setPrivateState(payload.privateState);
            setTurnEndsAt(payload.turnEndsAt);
            setIsSpectator(Boolean(payload.isSpectator));
            setResults(payload.results ?? null);
            if (payload.botControlledUserIds) {
              setBotControlledUserIds(payload.botControlledUserIds);
            }

            if (payload.publicState.phase === "FINISHED") {
              setShowVictoryModal(true);
            }

            const phaseKey = `${payload.publicState.missionIndex}:${payload.publicState.phase}:${payload.publicState.rejectTrack}`;
            if (prevPhaseKeyRef.current && prevPhaseKeyRef.current !== phaseKey) {
              setDraftTeamIds([]);
              setSelectedTargetId(null);
            }
            prevPhaseKeyRef.current = phaseKey;

            // Cozy tabletop audio feedback for state events
            for (const ev of payload.events ?? []) {
              if (ev.type === "TEAM_PROPOSED") {
                soundEngine.playTurnChime();
              } else if (ev.type === "VOTE_RESOLVED") {
                if (ev.approved) soundEngine.playTurnChime();
                else soundEngine.playHazard();
              } else if (ev.type === "MISSION_RESOLVED") {
                if (ev.outcome === "loyal") soundEngine.playRepair();
                else soundEngine.playHazard();
              } else if (ev.type === "SPYGLASS_USED") {
                soundEngine.playSpyglass();
              } else if (ev.type === "GAME_FINISHED") {
                soundEngine.playVictory();
              }
            }
          }
        );

        room.onMessage(
          "game.presence",
          (p: {
            onlineUserIds: string[];
            botControlledUserIds: string[];
            spectatorCount: number;
          }) => {
            setOnlineUserIds(p.onlineUserIds);
            setBotControlledUserIds(p.botControlledUserIds);
            setSpectatorCount(p.spectatorCount);
          }
        );

        room.onMessage("game.error", (err: { message: string }) => {
          showNotice(err.message);
        });

        room.onMessage("game.chat", (entry: GameChatEntry) => {
          setChatMessages((prev) => [...prev.slice(-60), entry]);
          if (!chatOpenRef.current && entry.senderUserId !== myUserId) {
            setUnreadChat((n) => n + 1);
            soundEngine.playEmotePop();
          }
        });

        room.onMessage("game.rematchUpdate", (rem: { votes: string[]; needed: number }) => {
          setRematchStatus(rem);
        });

        room.onLeave(() => {
          if (active) {
            roomRef.current = null;
          }
        });
      })
      .catch((err) => {
        if (active) {
          setConnectError((err as Error).message || "Unable to connect to Lantern Watch.");
        }
      });

    return () => {
      active = false;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      void roomRef.current?.leave();
      roomRef.current = null;
    };
  }, [gameRoomId, myUserId]);

  // Turn countdown tick
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // Auto-open interactive Quick Tour on first visit (skipped in interactive tutorialMode)
  const hasPublicState = Boolean(publicState);
  useEffect(() => {
    if (!hasPublicState || isSpectator || tutorialMode) return;
    if (!hasCompletedQuickTour("lantern-watch")) {
      const t = setTimeout(() => setShowQuickTour(true), 650);
      return () => clearTimeout(t);
    }
  }, [hasPublicState, isSpectator, tutorialMode]);

  const sendAction = (action: LanternAction) => {
    roomRef.current?.send("game.action", action);
  };

  const handleSendChat = (text: string, quickIndex?: number) => {
    if (typeof quickIndex === "number") {
      roomRef.current?.send("game.chat", { quickIndex });
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;
    roomRef.current?.send("game.chat", { message: trimmed });
    setChatInput("");
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundEngine.setMuted(!next);
  };

  // Private intel quick lookup map (hidden when hideRole === true)
  const privateIntelByUserId = useMemo(() => {
    const map = new Map<
      string,
      { label: string; tone: "shadow" | "loyal" | "mystery" }
    >();
    if (!privateState || hideRole) return map;

    for (const s of privateState.sightings) {
      if (s.kind === "shadow_ally") {
        map.set(s.userId, { label: "Shadow Ally", tone: "shadow" });
      } else if (s.kind === "shadow_suspect") {
        map.set(s.userId, { label: "Shadow Mole", tone: "shadow" });
      } else if (s.kind === "oracle_candidate") {
        map.set(s.userId, { label: "Oracle / Mirage", tone: "mystery" });
      }
    }
    for (const rep of privateState.spyglassReports) {
      map.set(rep.targetId, {
        label: rep.faction === "loyal" ? "Spyglass: Loyal" : "Spyglass: Shadow",
        tone: rep.faction === "loyal" ? "loyal" : "shadow",
      });
    }
    return map;
  }, [privateState, hideRole]);

  const knownShadowIds = useMemo(() => {
    const set = new Set<string>();
    if (!privateState) return set;
    if (privateState.faction === "shadow") set.add(privateState.playerId);
    for (const s of privateState.sightings) {
      if (s.kind === "shadow_ally") set.add(s.userId);
    }
    return set;
  }, [privateState]);

  const remainingSec = Math.max(0, Math.ceil((turnEndsAt - nowMs) / 1000));

  if (connectError) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#182034]/80 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-3xl border-2 border-oat-300 bg-oat-50 p-6 text-center shadow-cozy">
          <GameIcon name="game-lantern" className="mx-auto h-12 w-12" />
          <h2 className="mt-3 font-display text-xl font-bold text-espresso">
            Harbor Connection Lost
          </h2>
          <p className="mt-1 text-sm text-espresso-soft">{connectError}</p>
          <button
            type="button"
            onClick={() => onExitGame({ finished: false })}
            className="mt-4 rounded-2xl bg-[#2D3A59] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:brightness-110"
          >
            Return to Sunlit Oak Café
          </button>
        </div>
      </div>
    );
  }

  if (!publicState) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#182034]/80 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-3 rounded-3xl border-2 border-[#F2B749]/50 bg-[#232D47] px-6 py-4 text-oat-50 shadow-cozy">
          <GameIcon name="game-lantern" className="h-7 w-7 animate-pulse" />
          <span className="font-display text-sm font-bold">
            Lighting the Harbor Lanterns...
          </span>
        </div>
      </div>
    );
  }

  const commander = publicState.players.find((p) => p.isCommander);
  const currentMission = publicState.currentMission;
  const isFinished = publicState.phase === "FINISHED";
  const myPublic = publicState.players.find((p) => p.userId === myUserId);

  const toggleDraftMember = (uid: string) => {
    if (!privateState?.canPropose) return;
    setDraftTeamIds((prev) => {
      if (prev.includes(uid)) return prev.filter((id) => id !== uid);
      if (prev.length >= currentMission.teamSize) {
        return [...prev.slice(1), uid];
      }
      return [...prev, uid];
    });
  };

  const handleSeatClick = (uid: string) => {
    if (privateState?.canPropose) {
      toggleDraftMember(uid);
      return;
    }
    if (
      privateState?.canUseSpyglass &&
      publicState.spyglassEligibleTargetIds.includes(uid)
    ) {
      setSelectedTargetId((cur) => (cur === uid ? null : uid));
      return;
    }
    if (privateState?.canAssassinate && !knownShadowIds.has(uid)) {
      setSelectedTargetId((cur) => (cur === uid ? null : uid));
    }
  };

  const renderPhaseTag = () => {
    switch (publicState.phase) {
      case "PROPOSE_TEAM":
        return `Beacon ${currentMission.missionNumber} · Propose ${currentMission.teamSize}`;
      case "VOTE_TEAM":
        return `Council Vote (${publicState.votedPlayerIds.length}/${publicState.playerCount})`;
      case "EXECUTE_MISSION":
        return `Secret Mission (${publicState.missionSubmittedIds.length}/${publicState.proposedTeamIds.length})`;
      case "SPYGLASS_CHECK":
        return "Brass Spyglass";
      case "ASSASSINATE_ORACLE":
        return "Nightblade Unmasking!";
      case "FINISHED":
        return publicState.winner === "loyal" ? "Loyal Watch Wins" : "Shadow Moles Win";
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-[#1D253B] text-espresso">
      {/* ================= TOP GASLAMP HUD HEADER ================= */}
      <header
        data-tour="lw-header"
        className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#F2B749]/30 bg-gradient-to-r from-[#1E2740] via-[#273352] to-[#1E2740] px-3 py-2 text-oat-50 shadow-md short:flex-nowrap short:gap-1.5 short:px-2.5 short:py-1"
      >
        {/* Left: Game Brand + Mode Pill */}
        <div className="flex min-w-0 items-center gap-2 short:gap-1.5">
          <div className="flex items-center gap-1.5">
            <GameIcon name="game-lantern" className="h-6 w-6 shrink-0 short:h-5 short:w-5" />
            <span className="whitespace-nowrap font-display text-sm font-bold tracking-tight text-[#FDE68A] sm:text-base short:text-xs">
              Lantern Watch
            </span>
          </div>
          <span className="hidden whitespace-nowrap rounded-full border border-[#F2B749]/40 bg-[#F2B749]/15 px-2 py-0.5 text-[10px] font-extrabold text-[#FDE68A] md:inline-flex short:hidden">
            {publicState.mode === "oracle" ? "Oracle & Shade" : "Classic Watch"} ·{" "}
            {publicState.loyalCount}L vs {publicState.shadowCount}S
          </span>
          <span className="whitespace-nowrap rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-extrabold text-oat-100 short:px-1.5 short:text-[9.5px]">
            {renderPhaseTag()}
          </span>
        </div>

        {/* Center: 5 Coastal Beacons Track + Chaos Reject Track */}
        <div className="flex items-center gap-2.5 short:gap-1.5">
          <div
            className="flex items-center gap-1 rounded-xl border border-white/15 bg-black/25 px-2 py-1 short:px-1.5 short:py-0.5"
            title="Coastal Beacons: First to 3 wins!"
          >
            {publicState.missions.map((m, idx) => {
              const rec = publicState.missionHistory[idx];
              const isCurrent = !isFinished && idx === publicState.missionIndex;
              return (
                <div
                  key={m.missionNumber}
                  title={`Beacon ${m.missionNumber}: ${m.beaconName} (${m.teamSize} couriers${m.failsRequired > 1 ? ", 2 Fails required!" : ""})`}
                  className={`relative flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-black transition short:h-5 short:w-5 short:text-[9px] ${
                    rec?.outcome === "loyal"
                      ? "border-[#FDE68A] bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-white shadow-[0_0_8px_rgba(245,158,11,0.7)]"
                      : rec?.outcome === "shadow"
                        ? "border-rose-400 bg-rose-700 text-white shadow-[0_0_8px_rgba(225,29,72,0.6)]"
                        : isCurrent
                          ? "border-[#FDE68A] bg-[#F2B749]/25 text-[#FDE68A] ring-2 ring-[#F2B749]/45"
                          : "border-white/25 bg-white/10 text-oat-200"
                  }`}
                >
                  {rec?.outcome === "loyal" ? (
                    <Flame className="h-3.5 w-3.5" />
                  ) : rec?.outcome === "shadow" ? (
                    <X className="h-3.5 w-3.5" />
                  ) : (
                    m.teamSize
                  )}
                  {m.failsRequired > 1 && !rec && (
                    <span className="absolute -bottom-1.5 rounded bg-rose-600 px-1 text-[7px] font-black leading-tight text-white">
                      2✕
                    </span>
                  )}
                </div>
              );
            })}
            <span className="ml-1 hidden whitespace-nowrap text-[10px] font-extrabold text-oat-100 sm:inline short:inline">
              <span className="text-[#FDE68A]">{publicState.loyalWins}</span>–
              <span className="text-rose-300">{publicState.shadowWins}</span>
            </span>
          </div>

          {/* Chaos Reject Track */}
          <div
            className={`flex items-center gap-1 whitespace-nowrap rounded-xl border px-2 py-1 text-[10px] font-extrabold short:px-1.5 short:py-0.5 ${
              publicState.rejectTrack >= 4
                ? "animate-pulse border-rose-400 bg-rose-600/80 text-white"
                : "border-white/15 bg-black/25 text-oat-200"
            }`}
            title="Consecutive rejected proposals — 5 triggers Shadow Council Collapse win!"
          >
            <span className="hidden sm:inline short:hidden">Chaos</span>
            <span className="font-mono">
              {publicState.rejectTrack}/5
            </span>
          </div>
        </div>

        {/* Right: Role Privacy Pill + Clock + Utility Controls */}
        <div className="flex shrink-0 items-center gap-1.5 short:gap-1">
          {privateState && !isSpectator && (
            <button
              type="button"
              onClick={() => setHideRole((v) => !v)}
              title="Toggle role privacy for couch or stream play"
              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-xl border px-2 py-1 text-[10px] font-extrabold transition short:px-1.5 short:py-0.5 ${
                hideRole
                  ? "border-white/25 bg-white/10 text-oat-200"
                  : privateState.faction === "loyal"
                    ? "border-[#F2B749]/60 bg-[#F2B749]/20 text-[#FDE68A]"
                    : "border-rose-400/60 bg-rose-600/30 text-rose-200"
              }`}
            >
              {hideRole ? (
                <>
                  <Eye className="h-3 w-3" /> Role Hidden
                </>
              ) : (
                <>
                  <EyeOff className="h-3 w-3" /> {privateState.roleName}
                </>
              )}
            </button>
          )}

          {!isFinished && (
            <span
              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-xl px-2 py-1 font-mono text-[11px] font-extrabold short:px-1.5 short:py-0.5 short:text-[10px] ${
                remainingSec <= 10
                  ? "bg-rose-600 text-white"
                  : "bg-white/10 text-oat-100"
              }`}
            >
              <Clock className="h-3 w-3" /> {remainingSec}s
            </span>
          )}

          <button
            type="button"
            onClick={() => setShowQuickTour(true)}
            title="Interactive Quick Tour"
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl bg-white/10 px-2 py-1 text-[11px] font-bold text-oat-50 transition hover:bg-white/20 short:px-1.5 short:py-0.5"
          >
            <Compass className="h-3.5 w-3.5 text-[#FDE68A]" />
            <span className="hidden sm:inline short:hidden">Tour</span>
          </button>

          <button
            type="button"
            onClick={onOpenTutorial}
            title="Rules & Roles Guide"
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl bg-white/10 px-2 py-1 text-[11px] font-bold text-oat-50 transition hover:bg-white/20 short:px-1.5 short:py-0.5"
          >
            <BookOpen className="h-3.5 w-3.5 text-[#FDE68A]" />
            <span className="hidden md:inline short:hidden">Rules</span>
          </button>

          <button
            type="button"
            onClick={toggleSound}
            title={soundEnabled ? "Mute Sound" : "Unmute Sound"}
            className="rounded-xl bg-white/10 p-1.5 text-oat-100 hover:bg-white/20 short:p-1"
          >
            {soundEnabled ? (
              <Volume2 className="h-3.5 w-3.5" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 text-rose-300" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setChatOpen((v) => !v)}
            title="Council Chat & Quick Bluffs"
            className="relative rounded-xl bg-white/10 p-1.5 text-oat-100 hover:bg-white/20 short:p-1"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {unreadChat > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amberwarm-400 text-[9px] font-black text-espresso">
                {unreadChat}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onExitGame({ finished: isFinished })}
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl bg-oat-100/15 px-2 py-1 text-[11px] font-bold text-oat-50 transition hover:bg-rose-600/80 short:px-1.5 short:py-0.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline short:hidden">Café</span>
          </button>
        </div>
      </header>

      {/* Optional Toast Banner */}
      {actionToast && (
        <div className="pointer-events-none fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-2xl border border-[#F2B749]/60 bg-[#232D47]/95 px-4 py-2 text-xs font-extrabold text-[#FDE68A] shadow-cozy">
          {actionToast}
        </div>
      )}

      {/* ================= MAIN RESPONSIVE COUNCIL WORKSPACE ================= */}
      <main className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto bg-gradient-to-b from-oat-100 via-oat-100 to-oat-200/90 p-2.5 lg:flex-row lg:overflow-hidden lg:p-3 short:flex-row short:gap-2 short:overflow-hidden short:p-1.5">
        {/* LEFT COLUMN: Harbor Council Table + Active Phase Action Dock + Vote Ledger */}
        <section className="flex shrink-0 flex-col gap-2.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto short:min-h-0 short:flex-1 short:gap-1.5 short:overflow-y-auto">
          {/* Mission & Last Reveal Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-oat-300 bg-oat-50 px-3 py-2 shadow-sm short:px-2.5 short:py-1.5">
            <div className="flex items-center gap-2">
              <GameIcon
                name={
                  publicState.phase === "SPYGLASS_CHECK"
                    ? "lw-spyglass"
                    : publicState.phase === "ASSASSINATE_ORACLE"
                      ? "lw-nightblade"
                      : "lw-beacon"
                }
                className="h-6 w-6 shrink-0 short:h-5 short:w-5"
              />
              <div>
                <div className="font-display text-sm font-bold leading-tight text-espresso short:text-xs">
                  Beacon {currentMission.missionNumber}: {currentMission.beaconName}
                </div>
                <div className="text-[11px] font-semibold text-espresso-soft short:text-[10px]">
                  Needs <strong>{currentMission.teamSize} couriers</strong>
                  {currentMission.failsRequired > 1 ? (
                    <span className="ml-1.5 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-extrabold text-rose-700">
                      Requires 2 Extinguish cards to fail!
                    </span>
                  ) : (
                    <span> · 1 Extinguish fails the beacon</span>
                  )}
                </div>
              </div>
            </div>

            {publicState.lastMissionReveal && (
              <div
                className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-bold short:px-2 short:py-0.5 short:text-[10px] ${
                  publicState.lastMissionReveal.outcome === "loyal"
                    ? "border-amber-300 bg-amber-50 text-amber-900"
                    : "border-rose-300 bg-rose-50 text-rose-900"
                }`}
              >
                <span className="whitespace-nowrap">
                  M{publicState.lastMissionReveal.missionNumber}{" "}
                  {publicState.lastMissionReveal.outcome === "loyal"
                    ? "LIT"
                    : "EXTINGUISHED"}
                  :
                </span>
                <span className="flex items-center gap-0.5">
                  {publicState.lastMissionReveal.shuffledCards.map((c, idx) => (
                    <GameIcon
                      key={idx}
                      name={c === "light" ? "lw-beacon" : "lw-sabotage"}
                      className="h-4 w-4"
                    />
                  ))}
                </span>
              </div>
            )}
          </div>

          {/* HARBOR COUNCIL SEAT GRID */}
          <div
            data-tour="lw-council"
            className="rounded-3xl border-2 border-[#2D3A59]/20 bg-gradient-to-br from-[#232D47] via-[#2A3656] to-[#1F2840] p-3 text-oat-50 shadow-cozy short:rounded-2xl short:p-2"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5 short:mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#FDE68A] short:text-[10px]">
                <GameIcon name="lw-commander" className="h-4 w-4" />
                Harbor Council ({publicState.playerCount} Couriers)
              </div>
              <div className="text-[11px] font-semibold text-oat-200 short:text-[10px]">
                Commander:{" "}
                <strong className="text-white">{commander?.displayName ?? "—"}</strong>
                {publicState.spyglassEnabled && publicState.spyglassHolderId && (
                  <span className="ml-2 text-cyan-200">
                    · Spyglass:{" "}
                    <strong>
                      {publicState.players.find(
                        (p) => p.userId === publicState.spyglassHolderId
                      )?.displayName ?? "—"}
                    </strong>
                  </span>
                )}
              </div>
            </div>

            <div
              className={`grid gap-2 short:gap-1.5 ${
                publicState.playerCount === 5 || publicState.playerCount === 6
                  ? "grid-cols-2 sm:grid-cols-3 short:grid-cols-3"
                  : "grid-cols-2 sm:grid-cols-4 short:grid-cols-4"
              }`}
            >
              {publicState.players.map((p) => {
                const isMe = p.userId === myUserId;
                const intel = privateIntelByUserId.get(p.userId);
                const isDraftSelected = draftTeamIds.includes(p.userId);
                const isSpyglassCandidate =
                  privateState?.canUseSpyglass &&
                  publicState.spyglassEligibleTargetIds.includes(p.userId);
                const isAssassinateCandidate =
                  privateState?.canAssassinate && !knownShadowIds.has(p.userId);
                const isTargetSelected = selectedTargetId === p.userId;

                const clickable =
                  Boolean(privateState?.canPropose) ||
                  Boolean(isSpyglassCandidate) ||
                  Boolean(isAssassinateCandidate);

                const isBotControlled = botControlledUserIds.includes(p.userId);
                const isOfflineHuman =
                  !p.userId.startsWith("bot_") &&
                  onlineUserIds.length > 0 &&
                  !onlineUserIds.includes(p.userId);

                return (
                  <button
                    key={p.userId}
                    type="button"
                    disabled={!clickable}
                    onClick={() => handleSeatClick(p.userId)}
                    className={`group relative flex flex-col justify-between rounded-2xl border-2 p-2.5 text-left transition short:rounded-xl short:p-1.5 ${
                      isDraftSelected || isTargetSelected
                        ? "border-[#FDE68A] bg-[#F2B749]/25 shadow-[0_0_14px_rgba(242,183,73,0.4)]"
                        : p.isOnProposedTeam
                          ? "border-amber-400/90 bg-amber-500/15"
                          : isSpyglassCandidate
                            ? "border-cyan-300/80 bg-cyan-500/15 hover:bg-cyan-500/25"
                            : isAssassinateCandidate
                              ? "border-rose-400/80 bg-rose-500/15 hover:bg-rose-500/25"
                              : "border-white/15 bg-white/10"
                    } ${clickable ? "cursor-pointer hover:border-[#FDE68A]/80" : "cursor-default"}`}
                  >
                    {/* Top badges row */}
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-[11px] font-black shadow-sm short:h-6 short:w-6 short:text-[10px] ${
                            p.revealedFaction === "shadow"
                              ? "bg-rose-700 text-white"
                              : p.revealedFaction === "loyal"
                                ? "bg-amber-500 text-espresso"
                                : isMe
                                  ? "bg-[#F2B749] text-espresso"
                                  : "bg-white/15 text-oat-50"
                          }`}
                        >
                          {p.revealedRole ? (
                            <GameIcon
                              name={roleToIconName(p.revealedRole)}
                              className="h-5 w-5"
                            />
                          ) : (
                            shortInitials(p.displayName)
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-extrabold leading-tight text-white short:text-[11px]">
                            {p.displayName}
                            {isMe && (
                              <span className="ml-1 text-[9.5px] text-[#FDE68A]">(You)</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1 text-[9.5px] font-bold text-oat-200/80">
                            {p.isCommander && (
                              <span className="inline-flex items-center gap-0.5 text-[#FDE68A]">
                                <Crown className="h-2.5 w-2.5" /> Cmdr
                              </span>
                            )}
                            {p.holdsSpyglass && (
                              <span className="inline-flex items-center gap-0.5 text-cyan-200">
                                <GameIcon name="lw-spyglass" className="h-3 w-3" /> Lens
                              </span>
                            )}
                            {isBotControlled && (
                              <span className="text-amber-200">Auto-Bot</span>
                            )}
                            {isOfflineHuman && !isBotControlled && (
                              <span className="text-rose-300">Away</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Selection Indicator */}
                      {(isDraftSelected || isTargetSelected) && (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F2B749] text-espresso shadow">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </span>
                      )}
                    </div>

                    {/* Status + Intel Row */}
                    <div className="mt-2 flex flex-wrap items-center gap-1 short:mt-1">
                      {!isDraftSelected && p.isOnProposedTeam && (
                        <span className="rounded-md bg-amber-400 px-1.5 py-0.5 text-[9px] font-black uppercase text-espresso">
                          Crew
                        </span>
                      )}
                      {/* Revealed role at end of game */}
                      {p.revealedRole && (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[9.5px] font-extrabold ${
                            p.revealedFaction === "loyal"
                              ? "bg-amber-400/25 text-[#FDE68A]"
                              : "bg-rose-600/40 text-rose-200"
                          }`}
                        >
                          {LANTERN_ROLE_META[p.revealedRole].name}
                        </span>
                      )}

                      {/* Secret Intel Tag (Only visible when Role isn't hidden) */}
                      {!p.revealedRole && intel && (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[9.5px] font-extrabold ${
                            intel.tone === "shadow"
                              ? "bg-rose-600/45 text-rose-100 ring-1 ring-rose-400/60"
                              : intel.tone === "loyal"
                                ? "bg-emerald-600/45 text-emerald-100 ring-1 ring-emerald-400/60"
                                : "bg-indigo-500/45 text-indigo-100 ring-1 ring-indigo-300/60"
                          }`}
                        >
                          {intel.label}
                        </span>
                      )}

                      {/* Live phase progress pill */}
                      {publicState.phase === "VOTE_TEAM" && (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[9.5px] font-extrabold ${
                            p.hasVoted
                              ? "bg-emerald-500/30 text-emerald-200"
                              : "bg-white/10 text-oat-200/70"
                          }`}
                        >
                          {p.hasVoted ? "Voted ✓" : "Deciding..."}
                        </span>
                      )}

                      {publicState.phase === "EXECUTE_MISSION" && p.isOnProposedTeam && (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[9.5px] font-extrabold ${
                            p.hasSubmittedMissionCard
                              ? "bg-amber-400/30 text-[#FDE68A]"
                              : "bg-white/10 text-oat-200/75"
                          }`}
                        >
                          {p.hasSubmittedMissionCard ? "Card Ready ✓" : "On Mission..."}
                        </span>
                      )}

                      {/* Latest public flipped vote badge */}
                      {publicState.phase !== "VOTE_TEAM" && p.lastVote && (
                        <span
                          className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold ${
                            p.lastVote === "approve"
                              ? "bg-emerald-500/25 text-emerald-200"
                              : "bg-rose-500/30 text-rose-200"
                          }`}
                        >
                          {p.lastVote === "approve" ? "✓ Approved" : "✕ Rejected"}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PHASE ACTION DOCK */}
          <div
            data-tour="lw-actions"
            className="rounded-3xl border-2 border-oat-300 bg-oat-50 p-3.5 shadow-sm short:rounded-2xl short:p-2.5"
          >
            {/* 1. PROPOSE_TEAM */}
            {publicState.phase === "PROPOSE_TEAM" && (
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-display text-sm font-bold text-espresso short:text-xs">
                    <Crown className="h-4 w-4 text-amberwarm-600" />
                    {privateState?.canPropose
                      ? `Your Command: Pick ${currentMission.teamSize} Couriers for ${currentMission.beaconName}`
                      : `Waiting for Commander ${commander?.displayName ?? ""} to propose ${currentMission.teamSize} couriers...`}
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-espresso-soft short:text-[11px]">
                    {privateState?.canPropose
                      ? `Tap any ${currentMission.teamSize} seats above (${draftTeamIds.length}/${currentMission.teamSize} selected).`
                      : `Proposal attempt ${publicState.rejectTrack + 1} of 5 before Shadow Collapse.`}
                  </p>
                </div>

                {privateState?.canPropose && (
                  <div className="flex items-center gap-2">
                    {draftTeamIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setDraftTeamIds([])}
                        className="rounded-xl bg-oat-200 px-3 py-2 text-xs font-bold text-espresso hover:bg-oat-300 short:py-1.5"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={draftTeamIds.length !== currentMission.teamSize}
                      onClick={() =>
                        sendAction({ type: "PROPOSE_TEAM", teamIds: draftTeamIds })
                      }
                      className="inline-flex items-center gap-1.5 rounded-2xl bg-[#2D3A59] px-4 py-2 font-display text-xs font-bold text-[#FDE68A] shadow-sm transition hover:brightness-110 disabled:bg-oat-300 disabled:text-espresso-muted short:py-1.5"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Propose Team ({draftTeamIds.length}/{currentMission.teamSize})
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 2. VOTE_TEAM */}
            {publicState.phase === "VOTE_TEAM" && (
              <div className="space-y-2">
                {publicState.rejectTrack >= 4 && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-extrabold text-rose-800">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                    FINAL PROPOSAL (5/5): Rejecting hands immediate Council Collapse victory to Shadow Moles!
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div>
                    <div className="font-display text-sm font-bold text-espresso short:text-xs">
                      Council Vote on{" "}
                      {publicState.proposedTeamIds
                        .map(
                          (id) =>
                            publicState.players.find((p) => p.userId === id)
                              ?.displayName ?? id
                        )
                        .join(" + ")}
                    </div>
                    <p className="text-xs font-medium text-espresso-soft short:text-[11px]">
                      Strict majority approves · All votes flip publicly together and log to the Ledger.
                    </p>
                  </div>

                  {privateState?.canVote ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          sendAction({ type: "CAST_VOTE", vote: "approve" })
                        }
                        className="inline-flex items-center gap-1.5 rounded-2xl bg-sage-500 px-4 py-2 font-display text-xs font-bold text-white shadow-sm transition hover:bg-sage-700 short:py-1.5"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Approve Team
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          sendAction({ type: "CAST_VOTE", vote: "reject" })
                        }
                        className="inline-flex items-center gap-1.5 rounded-2xl bg-terracotta-500 px-4 py-2 font-display text-xs font-bold text-white shadow-sm transition hover:bg-terracotta-700 short:py-1.5"
                      >
                        <XCircle className="h-4 w-4" /> Reject Team
                      </button>
                    </div>
                  ) : (
                    <span className="rounded-xl bg-oat-200 px-3 py-1.5 text-xs font-extrabold text-espresso">
                      {privateState?.myPendingVote
                        ? `You voted ${privateState.myPendingVote.toUpperCase()} · Waiting (${publicState.votedPlayerIds.length}/${publicState.playerCount})`
                        : `Council voting (${publicState.votedPlayerIds.length}/${publicState.playerCount})...`}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 3. EXECUTE_MISSION */}
            {publicState.phase === "EXECUTE_MISSION" && (
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div>
                  <div className="font-display text-sm font-bold text-espresso short:text-xs">
                    {privateState?.canPlayMissionCard
                      ? `Secret Mission Action for ${currentMission.beaconName}`
                      : `Couriers are covertly lighting ${currentMission.beaconName}...`}
                  </div>
                  <p className="text-xs font-medium text-espresso-soft short:text-[11px]">
                    {privateState?.canPlayMissionCard
                      ? privateState.faction === "loyal"
                        ? "As Loyal Watch, submit your secret Light Beacon card. Cards shuffle anonymously!"
                        : "Shadow Choice: Extinguish to sabotage the beacon, or bluff Light Beacon to stay undercover!"
                      : `Submitted: ${publicState.missionSubmittedIds.length}/${publicState.proposedTeamIds.length} couriers.`}
                  </p>
                </div>

                {privateState?.canPlayMissionCard ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        sendAction({ type: "PLAY_MISSION_CARD", card: "light" })
                      }
                      className="inline-flex items-center gap-1.5 rounded-2xl bg-amberwarm-400 px-4 py-2 font-display text-xs font-extrabold text-espresso shadow-sm transition hover:bg-amberwarm-600 hover:text-white short:py-1.5"
                    >
                      <GameIcon name="lw-beacon" className="h-4 w-4" /> Light Beacon (✓)
                    </button>
                    {privateState.allowedMissionCards.includes("sabotage") && (
                      <button
                        type="button"
                        onClick={() =>
                          sendAction({ type: "PLAY_MISSION_CARD", card: "sabotage" })
                        }
                        className="inline-flex items-center gap-1.5 rounded-2xl bg-rose-700 px-4 py-2 font-display text-xs font-extrabold text-white shadow-sm transition hover:bg-rose-800 short:py-1.5"
                      >
                        <GameIcon name="lw-sabotage" className="h-4 w-4" /> Extinguish (✕)
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="rounded-xl bg-oat-200 px-3 py-1.5 text-xs font-extrabold text-espresso">
                    {privateState?.myPendingMissionCard
                      ? "Secret card sealed — waiting for crew..."
                      : myPublic?.isOnProposedTeam
                        ? "Card submitted ✓"
                        : "Watching from the harbor shore..."}
                  </span>
                )}
              </div>
            )}

            {/* 4. SPYGLASS_CHECK */}
            {publicState.phase === "SPYGLASS_CHECK" && (
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div>
                  <div className="flex items-center gap-1.5 font-display text-sm font-bold text-espresso short:text-xs">
                    <GameIcon name="lw-spyglass" className="h-5 w-5" />
                    {privateState?.canUseSpyglass
                      ? "Brass Spyglass: Choose 1 Unchecked Courier to Inspect!"
                      : `${publicState.players.find((p) => p.userId === publicState.spyglassHolderId)?.displayName ?? "Holder"} is peering through the Brass Spyglass...`}
                  </div>
                  <p className="text-xs font-medium text-espresso-soft short:text-[11px]">
                    Privately reveals Loyal Watch or Shadow Mole, then passes the Spyglass to them!
                  </p>
                </div>

                {privateState?.canUseSpyglass && (
                  <button
                    type="button"
                    disabled={!selectedTargetId}
                    onClick={() => {
                      if (selectedTargetId) {
                        sendAction({ type: "USE_SPYGLASS", targetId: selectedTargetId });
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-cyan-700 px-4 py-2 font-display text-xs font-bold text-white shadow-sm transition hover:bg-cyan-800 disabled:bg-oat-300 disabled:text-espresso-muted short:py-1.5"
                  >
                    <Sparkles className="h-4 w-4" />
                    {selectedTargetId
                      ? `Inspect ${publicState.players.find((p) => p.userId === selectedTargetId)?.displayName}`
                      : "Tap Highlighted Courier Above"}
                  </button>
                )}
              </div>
            )}

            {/* 5. ASSASSINATE_ORACLE */}
            {publicState.phase === "ASSASSINATE_ORACLE" && (
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div>
                  <div className="flex items-center gap-1.5 font-display text-sm font-bold text-rose-800 short:text-xs">
                    <Swords className="h-4 w-4 text-rose-600" />
                    {privateState?.canAssassinate
                      ? "Final Unmasking! Name The Oracle to Steal Victory for Shadow!"
                      : "3 Beacons Lit! The Nightblade is hunting The Oracle..."}
                  </div>
                  <p className="text-xs font-medium text-espresso-soft short:text-[11px]">
                    {privateState?.canAssassinate
                      ? "Study the Council Ledger below — tap any highlighted Loyal courier above to strike!"
                      : "If the Nightblade guesses wrong, the Loyal Watch celebrates victory!"}
                  </p>
                </div>

                {privateState?.canAssassinate && (
                  <button
                    type="button"
                    disabled={!selectedTargetId}
                    onClick={() => {
                      if (selectedTargetId) {
                        sendAction({ type: "ASSASSINATE", targetId: selectedTargetId });
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-rose-700 px-4 py-2 font-display text-xs font-extrabold text-white shadow-sm transition hover:bg-rose-800 disabled:bg-oat-300 disabled:text-espresso-muted short:py-1.5"
                  >
                    <GameIcon name="lw-nightblade" className="h-4 w-4" />
                    {selectedTargetId
                      ? `Unmask ${publicState.players.find((p) => p.userId === selectedTargetId)?.displayName}`
                      : "Select Loyal Suspect Above"}
                  </button>
                )}
              </div>
            )}

            {/* 6. FINISHED */}
            {isFinished && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amberwarm-600" />
                  <div>
                    <div className="font-display text-sm font-bold text-espresso">
                      {results?.headline ?? "Watch Complete!"}
                    </div>
                    <div className="text-[11px] font-semibold text-espresso-soft">
                      Inspect the Council Ledger below or reveal full identities.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowVictoryModal(true)}
                  className="rounded-xl bg-[#2D3A59] px-3.5 py-2 text-xs font-bold text-[#FDE68A] hover:brightness-110"
                >
                  Show Role Reveal
                </button>
              </div>
            )}
          </div>

          {/* ALWAYS-VISIBLE COUNCIL VOTE LEDGER */}
          <div
            data-tour="lw-ledger"
            className="rounded-3xl border border-oat-300 bg-oat-50 p-3 shadow-sm short:rounded-2xl short:p-2"
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wider text-espresso">
                <ScrollText className="h-4 w-4 text-[#2D3A59]" />
                Council Vote Ledger
              </h3>
              <span className="text-[10px] font-bold text-espresso-muted">
                Every Proposal · Public Votes · Shuffled Results
              </span>
            </div>

            {publicState.proposalHistory.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-oat-300 bg-oat-100/70 px-3 py-3 text-center text-xs font-semibold text-espresso-muted">
                No proposals voted on yet — every team vote &amp; mission tally will log here automatically!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[440px] border-collapse text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-oat-300 text-[10px] font-extrabold uppercase text-espresso-muted">
                      <th className="py-1 pr-2">Mission</th>
                      <th className="py-1 pr-2">Proposed Crew</th>
                      {publicState.players.map((p) => (
                        <th key={p.userId} className="px-1 py-1 text-center" title={p.displayName}>
                          {shortInitials(p.displayName)}
                        </th>
                      ))}
                      <th className="py-1 pl-2 text-right">Outcome</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-oat-200/80">
                    {publicState.proposalHistory.map((prop) => {
                      const missionRec = prop.approved
                        ? publicState.missionHistory.find(
                            (m) => m.missionNumber === prop.missionNumber
                          )
                        : null;
                      return (
                        <tr key={prop.id} className="hover:bg-oat-100/60">
                          <td className="whitespace-nowrap py-1.5 pr-2 font-extrabold text-espresso">
                            M{prop.missionNumber}·{prop.proposalAttempt}
                            <div className="text-[9.5px] font-semibold text-espresso-muted">
                              by {prop.commanderName.split(" ")[0]}
                            </div>
                          </td>
                          <td className="py-1.5 pr-2">
                            <div className="flex flex-wrap gap-1">
                              {prop.teamIds.map((id) => {
                                const pl = publicState.players.find((x) => x.userId === id);
                                return (
                                  <span
                                    key={id}
                                    className="rounded-md bg-[#2D3A59]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#2D3A59]"
                                  >
                                    {pl?.displayName.split(" ")[0] ?? id}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          {publicState.players.map((p) => {
                            const v: VoteChoice | undefined = prop.votes[p.userId];
                            const onTeam = prop.teamIds.includes(p.userId);
                            return (
                              <td key={p.userId} className="px-1 py-1.5 text-center">
                                <span
                                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                                    v === "approve"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-rose-100 text-rose-700"
                                  } ${onTeam ? "ring-2 ring-amber-400" : ""}`}
                                  title={`${p.displayName}: ${v ?? "—"}${onTeam ? " (On Crew)" : ""}`}
                                >
                                  {v === "approve" ? "✓" : "✕"}
                                </span>
                              </td>
                            );
                          })}
                          <td className="whitespace-nowrap py-1.5 pl-2 text-right font-extrabold">
                            {!prop.approved ? (
                              <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700">
                                Rejected {prop.approveCount}–{prop.rejectCount}
                              </span>
                            ) : missionRec ? (
                              <span
                                className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                                  missionRec.outcome === "loyal"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-rose-700 text-white"
                                }`}
                              >
                                {missionRec.outcome === "loyal"
                                  ? `LIT (${missionRec.lightCount}✓)`
                                  : `FAIL (${missionRec.sabotageCount}✕)`}
                              </span>
                            ) : (
                              <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800">
                                Departed
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT SIDEBAR: Secret Identity Dossier + Roles In Play + Chronicle */}
        <aside className="flex w-full shrink-0 flex-col gap-2.5 lg:min-h-0 lg:w-80 lg:overflow-y-auto short:min-h-0 short:w-64 short:gap-1.5 short:overflow-y-auto">
          {/* SECRET IDENTITY DOSSIER */}
          <div
            data-tour="lw-dossier"
            className={`rounded-3xl border-2 p-3.5 shadow-sm short:rounded-2xl short:p-2.5 ${
              hideRole || isSpectator
                ? "border-oat-300 bg-oat-50"
                : privateState?.faction === "shadow"
                  ? "border-rose-400/70 bg-gradient-to-br from-[#2B1B28] to-[#1E1929] text-oat-50"
                  : "border-[#F2B749]/70 bg-gradient-to-br from-[#FFFDF7] to-[#FEF6E4] text-espresso"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-75">
                {isSpectator ? "Spectator Seat" : "Secret Dossier"}
              </span>
              {!isSpectator && (
                <button
                  type="button"
                  onClick={() => setHideRole((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-lg bg-black/10 px-2 py-0.5 text-[10px] font-bold hover:bg-black/20"
                >
                  {hideRole ? (
                    <>
                      <Eye className="h-3 w-3" /> Show
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3 w-3" /> Hide
                    </>
                  )}
                </button>
              )}
            </div>

            {isSpectator ? (
              <p className="mt-1.5 text-xs font-semibold text-espresso-soft">
                Watching live from Sunlit Oak Café — secret roles reveal when the final beacon resolves!
              </p>
            ) : hideRole ? (
              <div className="mt-2 rounded-2xl border border-dashed border-oat-300 bg-oat-100 px-3 py-4 text-center text-xs font-bold text-espresso-muted">
                Secret identity &amp; sightings hidden for local privacy. Tap <strong>Show</strong> to peek!
              </div>
            ) : privateState ? (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-black/15 shadow-sm short:h-9 short:w-9">
                    <GameIcon
                      name={roleToIconName(privateState.role)}
                      className="h-7 w-7 short:h-6 short:w-6"
                    />
                  </span>
                  <div className="min-w-0">
                    <div className="font-display text-base font-bold leading-tight short:text-sm">
                      {privateState.roleName}
                    </div>
                    <span
                      className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                        privateState.faction === "loyal"
                          ? "bg-amberwarm-400/35 text-amber-900"
                          : "bg-rose-500/35 text-rose-100"
                      }`}
                    >
                      <Shield className="h-3 w-3" />
                      {privateState.faction === "loyal"
                        ? "Loyal Watch"
                        : "Shadow Moles"}
                    </span>
                  </div>
                </div>

                <p
                  className={`text-[11px] font-medium leading-relaxed short:text-[10.5px] ${
                    privateState.faction === "shadow" ? "text-oat-200" : "text-espresso-soft"
                  }`}
                >
                  {privateState.roleSummary}
                </p>

                {/* Private Sightings */}
                {privateState.sightings.length > 0 && (
                  <div className="rounded-xl bg-black/10 p-2">
                    <div className="text-[9.5px] font-extrabold uppercase tracking-wider opacity-80">
                      Private Sightings
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {privateState.sightings.map((s) => (
                        <span
                          key={s.userId}
                          className={`rounded-lg px-2 py-0.5 text-[10.5px] font-extrabold ${
                            s.kind === "oracle_candidate"
                              ? "bg-indigo-600 text-white"
                              : "bg-rose-600 text-white"
                          }`}
                        >
                          {s.displayName} · {s.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {privateState.veiledMoleWarning && (
                  <div className="rounded-xl border border-amber-400/50 bg-amber-100/90 px-2.5 py-1.5 text-[10.5px] font-bold text-amber-950">
                    Note: 1 Veiled Mole is hidden from your Oracle vision!
                  </div>
                )}

                {/* Private Spyglass Reports */}
                {privateState.spyglassReports.length > 0 && (
                  <div className="rounded-xl bg-cyan-900/20 p-2">
                    <div className="text-[9.5px] font-extrabold uppercase tracking-wider text-cyan-700">
                      Your Brass Spyglass Intel
                    </div>
                    <div className="mt-1 space-y-1">
                      {privateState.spyglassReports.map((rep, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-lg bg-white/90 px-2 py-1 text-[10.5px] font-bold text-espresso"
                        >
                          <span>
                            M{rep.missionNumber}: {rep.targetName}
                          </span>
                          <span
                            className={
                              rep.faction === "loyal"
                                ? "text-emerald-700"
                                : "text-rose-700"
                            }
                          >
                            {rep.faction === "loyal" ? "Loyal Watch" : "Shadow Mole"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Roles in Play Reference */}
            <div className="mt-2.5 border-t border-current/15 pt-2">
              <div className="text-[9.5px] font-extrabold uppercase tracking-wider opacity-70">
                Roles at This Table ({publicState.loyalCount}L · {publicState.shadowCount}S)
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {publicState.rolesInPlay.map((r, i) => (
                  <span
                    key={`${r}-${i}`}
                    className={`rounded-md px-1.5 py-0.5 text-[9.5px] font-bold ${
                      LANTERN_ROLE_META[r].faction === "loyal"
                        ? "bg-amber-400/20 text-current"
                        : "bg-rose-500/25 text-current"
                    }`}
                  >
                    {LANTERN_ROLE_META[r].name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* HARBOR CHRONICLE */}
          <div
            data-tour="lw-chronicle"
            className="flex min-h-[140px] flex-1 flex-col rounded-3xl border border-oat-300 bg-oat-50 p-3 shadow-sm short:min-h-[100px] short:rounded-2xl short:p-2"
          >
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-espresso">
                Watch Chronicle
              </h3>
              {spectatorCount > 0 && (
                <span className="text-[10px] font-bold text-espresso-muted">
                  {spectatorCount} watching
                </span>
              )}
            </div>
            <div className="flex-1 space-y-1.5 overflow-y-auto pr-1 text-[11px] leading-snug">
              {[...publicState.log].reverse().map((entry) => (
                <div
                  key={entry.id}
                  className={`rounded-xl px-2.5 py-1.5 font-semibold ${
                    entry.tone === "loyal"
                      ? "bg-amber-100/80 text-amber-950"
                      : entry.tone === "shadow"
                        ? "bg-rose-100/80 text-rose-950"
                        : entry.tone === "gold"
                          ? "bg-[#2D3A59]/10 text-[#232D47]"
                          : "bg-oat-100 text-espresso-soft"
                  }`}
                >
                  {entry.text}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      {/* ================= COUNCIL CHAT DRAWER ================= */}
      {chatOpen && (
        <div className="fixed bottom-3 right-3 z-50 flex h-80 w-80 max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-3xl border-2 border-[#2D3A59]/30 bg-oat-50 shadow-cozy">
          <div className="flex items-center justify-between border-b border-oat-200 bg-[#232D47] px-3.5 py-2 text-oat-50">
            <span className="font-display text-xs font-bold">Council Table Chat</span>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="rounded-lg p-1 hover:bg-white/15"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto p-3 text-xs">
            {chatMessages.length === 0 ? (
              <p className="text-center text-espresso-muted">
                Debate proposed teams or send a 1-tap bluff below!
              </p>
            ) : (
              chatMessages.map((m) => (
                <div key={m.id} className="rounded-xl bg-oat-100 px-2.5 py-1.5">
                  <span className="font-extrabold text-[#2D3A59]">{m.senderName}: </span>
                  <span className="text-espresso">{m.message}</span>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="flex gap-1 overflow-x-auto border-t border-oat-200 bg-oat-100/80 px-2 py-1.5">
            {LANTERN_QUICK_LINES.slice(0, 4).map((line, idx) => (
              <button
                key={line}
                type="button"
                onClick={() => handleSendChat("", idx)}
                className="shrink-0 rounded-lg bg-white px-2 py-1 text-[10px] font-bold text-espresso shadow-sm hover:bg-amberwarm-100"
              >
                {line}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChat(chatInput);
            }}
            className="flex items-center gap-1.5 border-t border-oat-200 bg-white p-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Debate the crew..."
              maxLength={220}
              className="min-w-0 flex-1 rounded-xl bg-oat-100 px-3 py-1.5 text-xs outline-none"
            />
            <button
              type="submit"
              className="rounded-xl bg-[#2D3A59] p-1.5 text-[#FDE68A] hover:brightness-110"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* ================= FULL ROLE REVEAL VICTORY MODAL ================= */}
      {isFinished && showVictoryModal && results && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141B2D]/75 p-4 backdrop-blur-sm">
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl border-2 border-[#F2B749]/70 bg-oat-50 p-6 shadow-cozy">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#232D47] shadow-md">
                <GameIcon
                  name={publicState.winner === "loyal" ? "lw-beacon" : "lw-nightblade"}
                  className="h-9 w-9"
                />
              </div>
              <span
                className={`mt-3 inline-block rounded-full px-3 py-0.5 text-xs font-extrabold uppercase tracking-wider ${
                  publicState.winner === "loyal"
                    ? "bg-amberwarm-100 text-amberwarm-600"
                    : "bg-rose-100 text-rose-700"
                }`}
              >
                {results.winningTeam} Victory!
              </span>
              <h2 className="mt-1 font-display text-2xl font-bold text-espresso">
                {results.headline}
              </h2>
              <p className="mt-1 text-xs font-bold text-espresso-soft">
                Beacons: {publicState.loyalWins} Lit · {publicState.shadowWins} Extinguished
              </p>
            </div>

            {/* Full Identities Reveal Grid */}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {publicState.players.map((p) => {
                const role = p.revealedRole ?? "loyal_courier";
                const meta = LANTERN_ROLE_META[role];
                const isWinner = p.revealedFaction === publicState.winner;
                return (
                  <div
                    key={p.userId}
                    className={`flex items-center justify-between rounded-2xl border-2 px-3 py-2 ${
                      p.revealedFaction === "loyal"
                        ? "border-amber-300 bg-amber-50/80"
                        : "border-rose-300 bg-rose-50/80"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <GameIcon name={roleToIconName(role)} className="h-6 w-6 shrink-0" />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-extrabold text-espresso">
                          {p.displayName}
                        </div>
                        <div className="text-[10.5px] font-bold text-espresso-soft">
                          {meta.name}
                        </div>
                      </div>
                    </div>
                    {isWinner && (
                      <span className="rounded-full bg-amberwarm-400 px-2 py-0.5 text-[10px] font-black text-espresso">
                        ★ Win
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {!isSpectator && (
                <button
                  type="button"
                  onClick={() => roomRef.current?.send("game.rematch")}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-[#2D3A59] px-5 py-2.5 font-display text-sm font-bold text-[#FDE68A] shadow-sm transition hover:brightness-110"
                >
                  <RotateCcw className="h-4 w-4" />
                  Play Again
                  {rematchStatus.votes.length > 0
                    ? ` (${rematchStatus.votes.length}/${rematchStatus.needed})`
                    : ""}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowVictoryModal(false)}
                className="rounded-2xl border border-oat-300 bg-white px-4 py-2.5 text-xs font-bold text-espresso hover:bg-oat-100"
              >
                Inspect Ledger
              </button>
              <button
                type="button"
                onClick={() => onExitGame({ finished: true })}
                className="rounded-2xl bg-oat-200 px-4 py-2.5 text-xs font-bold text-espresso hover:bg-oat-300"
              >
                Back to Café
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= INTERACTIVE SPOTLIGHT QUICK TOUR ================= */}
      <GameQuickTour
        gameSlug="lantern-watch"
        open={showQuickTour}
        onClose={() => setShowQuickTour(false)}
      />

      {tutorialMode && !isSpectator && publicState && privateState && (
        <GuidedTutorialCoach
          model={buildLanternWatchGuide({
            phase: publicState.phase,
            roleName: privateState.roleName,
            faction: privateState.faction,
            role: privateState.role,
            canPropose: privateState.canPropose,
            canVote: privateState.canVote,
            canPlayMissionCard: privateState.canPlayMissionCard,
            canUseSpyglass: privateState.canUseSpyglass,
            canAssassinate: privateState.canAssassinate,
            draftCount: draftTeamIds.length,
            requiredTeamSize: currentMission.teamSize,
            missionNumber: currentMission.missionNumber,
            rejectTrack: publicState.rejectTrack,
            ledgerRows: publicState.proposalHistory.length,
            loyalWins: publicState.loyalWins,
            shadowWins: publicState.shadowWins,
          })}
          onOpenRules={onOpenTutorial}
          onExitTutorial={() => onExitGame({ finished: isFinished })}
        />
      )}
    </div>
  );
}
