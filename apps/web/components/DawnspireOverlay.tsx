"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Client as ColyseusClient, type Room } from "colyseus.js";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  Clock,
  Coins,
  Compass,
  Crown,
  Eye,
  Hammer,
  Landmark,
  Link2,
  LogOut,
  MessageCircle,
  RotateCcw,
  Send,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { GameResultSummary } from "@tablefolk/game-engine";
import {
  CATEGORY_META,
  DAWNSPIRE_QUICK_LINES,
  RESOURCE_META,
  type CardCategory,
  type DawnCardDef,
  type DawnPrivateState,
  type DawnPublicPlayerView,
  type DawnPublicState,
  type DawnResource,
  type DawnspireAction,
} from "@tablefolk/game-dawnspire";
import { getStoredToken, WS_BASE_URL } from "@/lib/api";
import { hasCompletedQuickTour } from "@/lib/gameQuickTours";
import { soundEngine } from "@/lib/sound";
import { DawnCostPills, DawnspireHandCard } from "./DawnspireCard";
import { dawnResourceToIconName, GameIcon } from "./GameIcons";
import { GameQuickTour } from "./GameQuickTour";

interface DawnspireOverlayProps {
  gameRoomId: string;
  myUserId: string;
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

const ERA_ROMAN: Record<1 | 2 | 3, string> = { 1: "I", 2: "II", 3: "III" };
const CATEGORY_ORDER: CardCategory[] = [
  "raw",
  "craft",
  "civic",
  "commerce",
  "military",
  "science",
  "guild",
];

function collectTradablePreview(player: DawnPublicPlayerView): DawnResource[] {
  const res: DawnResource[] = [player.wonder.startingResource];
  for (const c of player.builtCards) {
    if (c.category !== "raw" && c.category !== "craft") continue;
    if (c.effect.producesFixed) {
      res.push(...c.effect.producesFixed);
    } else if (c.effect.producesChoice && c.effect.producesChoice.length > 0) {
      res.push(c.effect.producesChoice[0]!);
    }
  }
  return res;
}

export function DawnspireOverlay({
  gameRoomId,
  myUserId,
  onExitGame,
  onOpenTutorial,
}: DawnspireOverlayProps) {
  const roomRef = useRef<Room | null>(null);
  const autoTourCheckedRef = useRef(false);

  const [publicState, setPublicState] = useState<DawnPublicState | null>(null);
  const [privateState, setPrivateState] = useState<DawnPrivateState | null>(null);
  const [results, setResults] = useState<GameResultSummary | null>(null);
  const [isSpectator, setIsSpectator] = useState(false);
  const [botControlledUserIds, setBotControlledUserIds] = useState<string[]>([]);
  const [turnEndsAt, setTurnEndsAt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(45);

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [inspectPlayerId, setInspectPlayerId] = useState<string | null>(null);
  const [showQuickTour, setShowQuickTour] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const [chatLog, setChatLog] = useState<GameChatEntry[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [rematchStatus, setRematchStatus] = useState<{ votes: string[]; needed: number }>({
    votes: [],
    needed: 1,
  });
  const [muted, setMuted] = useState(() => soundEngine.isMuted());
  const [notice, setNotice] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const flashNotice = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice((prev) => (prev === msg ? null : prev)), 3200);
  }, []);

  const flashBanner = useCallback((msg: string) => {
    setBanner(msg);
    setTimeout(() => setBanner((prev) => (prev === msg ? null : prev)), 3400);
  }, []);

  // Connect to DawnspireRoom via Colyseus
  useEffect(() => {
    let disposed = false;
    let joinedRoom: Room | null = null;
    const token = getStoredToken();
    if (!token) {
      onExitGame({ notice: "Missing authentication token." });
      return;
    }

    const client = new ColyseusClient(WS_BASE_URL);
    client
      .joinById(gameRoomId, { token })
      .then((room) => {
        if (disposed) {
          void room.leave();
          return;
        }
        joinedRoom = room;
        roomRef.current = room;

        room.onMessage(
          "game.state",
          (payload: {
            publicState: DawnPublicState;
            privateState: DawnPrivateState | null;
            turnEndsAt: number;
            isSpectator: boolean;
            botControlledUserIds: string[];
            results: GameResultSummary | null;
            events?: Array<{ type: string; summary: string }>;
          }) => {
            setPublicState(payload.publicState);
            setPrivateState(payload.privateState);
            setTurnEndsAt(payload.turnEndsAt);
            setIsSpectator(Boolean(payload.isSpectator));
            setBotControlledUserIds(payload.botControlledUserIds ?? []);
            setResults(payload.results ?? null);

            if (payload.events && payload.events.length > 0) {
              const eraEvt = payload.events.find((e) => e.type === "ERA_STARTED");
              const clashEvt = payload.events.find((e) => e.type === "MILITARY_CLASH");
              const finEvt = payload.events.find((e) => e.type === "GAME_FINISHED");
              if (finEvt) {
                soundEngine.playVictory();
                flashBanner(finEvt.summary);
              } else if (eraEvt) {
                soundEngine.playTurnChime();
                flashBanner(eraEvt.summary);
              } else if (clashEvt) {
                soundEngine.playRepair();
                flashBanner(clashEvt.summary);
              } else if (payload.events.some((e) => e.type === "TURN_RESOLVED")) {
                soundEngine.playTilePlace();
              }
            }
          }
        );

        room.onMessage("game.presence", (p: { botControlledUserIds?: string[] }) => {
          if (p.botControlledUserIds) setBotControlledUserIds(p.botControlledUserIds);
        });

        room.onMessage("game.error", (p: { message: string }) => {
          soundEngine.playDecoyReveal();
          flashNotice(p.message);
        });

        room.onMessage("game.chat", (entry: GameChatEntry) => {
          setChatLog((prev) => [...prev.slice(-45), entry]);
          setShowChat((open) => {
            if (!open && entry.senderUserId !== myUserId) {
              setUnreadChat((c) => c + 1);
            }
            return open;
          });
        });

        room.onMessage(
          "game.rematchUpdate",
          (p: { votes: string[]; needed: number }) => {
            setRematchStatus(p);
          }
        );

        room.onLeave(() => {
          if (!disposed) {
            onExitGame({ notice: "Returned to Sunlit Oak Café." });
          }
        });
      })
      .catch((err) => {
        console.error("[DawnspireOverlay] join error:", err);
        if (!disposed) {
          onExitGame({ notice: "Unable to join Dawnspire table." });
        }
      });

    return () => {
      disposed = true;
      roomRef.current = null;
      if (joinedRoom) void joinedRoom.leave();
    };
  }, [gameRoomId, myUserId, onExitGame, flashNotice, flashBanner]);

  // First-time auto-opening 6-step spotlight tour (uses boolean so bot locks never clear timer!)
  const hasPublicState = Boolean(publicState);
  useEffect(() => {
    if (!hasPublicState || isSpectator || autoTourCheckedRef.current) return;
    autoTourCheckedRef.current = true;
    if (!hasCompletedQuickTour("dawnspire")) {
      const t = setTimeout(() => setShowQuickTour(true), 650);
      return () => clearTimeout(t);
    }
  }, [hasPublicState, isSpectator]);

  // Turn countdown tick
  useEffect(() => {
    const tick = () => {
      if (!turnEndsAt) return;
      setSecondsLeft(Math.max(0, Math.ceil((turnEndsAt - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 300);
    return () => clearInterval(id);
  }, [turnEndsAt]);

  // Keep selectedCardId synced with current hand (auto-select first affordable card on new turn!)
  const handKey = useMemo(
    () => (privateState?.hand ?? []).map((h) => h.card.id).join(","),
    [privateState?.hand]
  );

  useEffect(() => {
    const hand = privateState?.hand ?? [];
    if (hand.length === 0) {
      setSelectedCardId(null);
      return;
    }
    if (privateState?.pendingAction) {
      setSelectedCardId(privateState.pendingAction.cardId);
      return;
    }
    setSelectedCardId((prev) => {
      if (prev && hand.some((h) => h.card.id === prev)) return prev;
      const firstGood = hand.find((h) => h.buildPlan.affordable && !h.buildPlan.isDuplicate);
      return (firstGood ?? hand[0]!).card.id;
    });
  }, [handKey, privateState?.pendingAction, privateState?.hand]);

  const sendAction = useCallback((action: DawnspireAction) => {
    soundEngine.playEmotePop();
    roomRef.current?.send("game.action", action);
  }, []);

  const me = useMemo(
    () => publicState?.players.find((p) => p.userId === myUserId) ?? null,
    [publicState, myUserId]
  );

  const selectedEval = useMemo(
    () => (privateState?.hand ?? []).find((h) => h.card.id === selectedCardId) ?? null,
    [privateState?.hand, selectedCardId]
  );

  const leftNeighbor = useMemo(() => {
    if (!publicState || !privateState?.leftNeighborId) return null;
    return publicState.players.find((p) => p.userId === privateState.leftNeighborId) ?? null;
  }, [publicState, privateState?.leftNeighborId]);

  const rightNeighbor = useMemo(() => {
    if (!publicState || !privateState?.rightNeighborId) return null;
    if (publicState.isTwoPlayerCaravan) return null;
    return publicState.players.find((p) => p.userId === privateState.rightNeighborId) ?? null;
  }, [publicState, privateState?.rightNeighborId]);

  const inspectedPlayer = useMemo(
    () => publicState?.players.find((p) => p.userId === inspectPlayerId) ?? null,
    [publicState, inspectPlayerId]
  );

  if (!publicState) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-espresso/60 backdrop-blur-sm">
        <div className="rounded-3xl border-2 border-oat-300 bg-oat-50 px-7 py-5 text-center shadow-cozy">
          <GameIcon name="game-dawnspire" className="mx-auto h-11 w-11 animate-bounce" />
          <div className="mt-2 font-display text-lg font-bold text-espresso">
            Unfurling Dawnspire Wonders...
          </div>
        </div>
      </div>
    );
  }

  const nextStage = me ? me.wonder.stages[me.wonderStagesBuilt] ?? null : null;
  const wonderPlan = privateState?.nextWonderStagePlan ?? null;
  const myLocked = Boolean(privateState?.pendingAction);
  const lockedCount = publicState.players.filter((p) => p.hasLockedIn).length;

  const groupedMyCards = CATEGORY_ORDER.map((cat) => ({
    cat,
    cards: (me?.builtCards ?? []).filter((c) => c.category === cat),
  })).filter((g) => g.cards.length > 0);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#F6EFE2] text-espresso">
      {/* ==================== TOP HUD HEADER ==================== */}
      <header
        data-tour="ds-header"
        className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b-2 border-oat-300 bg-oat-50/95 px-3 py-2 shadow-sm short:flex-nowrap short:gap-1.5 short:px-2 short:py-1"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#8B3A62]/40 bg-[#8B3A62]/15 short:h-7 short:w-7">
            <GameIcon name="game-dawnspire" className="h-5 w-5" />
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <h1 className="font-display text-base font-black text-espresso short:text-sm">
              Dawnspire
            </h1>
            <span className="rounded-full bg-[#8B3A62] px-2 py-0.5 text-[10.5px] font-black text-white">
              Era {ERA_ROMAN[publicState.era]} · Turn {publicState.turnInEra}/6
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amberwarm-100 px-2 py-0.5 text-[10.5px] font-extrabold text-espresso">
              {publicState.passDirection === "left" ? (
                <>
                  <ArrowLeft className="h-3 w-3 text-[#8B3A62]" /> Pass Left
                </>
              ) : (
                <>
                  Pass Right <ArrowRight className="h-3 w-3 text-[#8B3A62]" />
                </>
              )}
            </span>
            <span className="hidden rounded-full bg-oat-200 px-2 py-0.5 text-[10px] font-bold text-espresso-soft sm:inline-block short:hidden">
              {publicState.wonderSide === "starlit" ? "✦ Starlit" : "☀ Sunlit"}
              {publicState.isTwoPlayerCaravan ? " · 2p Caravan" : ""}
            </span>
          </div>
        </div>

        {/* Center Status Pill */}
        <div className="flex shrink-0 items-center gap-1.5">
          {publicState.phase === "FINISHED" ? (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-amberwarm-400 bg-amberwarm-100 px-3 py-1 text-xs font-black text-espresso">
              <Crown className="h-3.5 w-3.5 text-amberwarm-600" /> Match Complete!
            </span>
          ) : isSpectator ? (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-sage-100 px-3 py-1 text-xs font-extrabold text-sage-700">
              <Eye className="h-3.5 w-3.5" /> Spectating ({lockedCount}/{publicState.players.length})
            </span>
          ) : (
            <div
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-3 py-1 text-xs font-extrabold shadow-sm short:px-2 short:py-0.5 short:text-[11px] ${
                myLocked
                  ? "border-sage-500 bg-sage-100 text-sage-700"
                  : "border-[#8B3A62] bg-[#8B3A62]/10 text-[#6B2547]"
              }`}
            >
              <span>
                {myLocked ? (
                  `✓ Locked (${lockedCount}/${publicState.players.length})`
                ) : (
                  <>
                    Draft 1 Card<span className="short:hidden"> Simultaneously</span>
                  </>
                )}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-white/90 px-1.5 py-0.5 font-mono text-[10.5px] font-black text-espresso">
                <Clock className="h-3 w-3" /> {secondsLeft}s
              </span>
            </div>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5">
          {!isSpectator && (
            <button
              type="button"
              onClick={() => setShowQuickTour(true)}
              className="inline-flex items-center gap-1 rounded-xl border border-sage-300 bg-sage-100 px-2.5 py-1.5 text-xs font-extrabold text-sage-700 hover:bg-sage-300/60 short:px-2 short:py-1"
            >
              <Compass className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tour</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenTutorial}
            className="inline-flex items-center gap-1 rounded-xl border border-oat-300 bg-white px-2.5 py-1.5 text-xs font-bold text-espresso hover:bg-oat-100 short:px-2 short:py-1"
          >
            <BookOpen className="h-3.5 w-3.5 text-sage-700" />
            <span className="hidden sm:inline">Rules</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !muted;
              setMuted(next);
              soundEngine.setMuted(next);
            }}
            className="rounded-xl border border-oat-300 bg-white p-1.5 text-espresso hover:bg-oat-100 short:p-1"
            title={muted ? "Unmute SFX" : "Mute SFX"}
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowChat((v) => !v);
              setUnreadChat(0);
            }}
            className="relative rounded-xl border border-oat-300 bg-white p-1.5 text-espresso hover:bg-oat-100 short:p-1"
            title="Table Chat"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {unreadChat > 0 && !showChat && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-terracotta-500 px-1 text-[9px] font-black text-white">
                {unreadChat}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => onExitGame({ finished: publicState.phase === "FINISHED" })}
            className="inline-flex items-center gap-1 rounded-xl border border-terracotta-500/40 bg-terracotta-100 px-2.5 py-1.5 text-xs font-bold text-terracotta-700 hover:bg-terracotta-500 hover:text-white short:px-2 short:py-1"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Café</span>
          </button>
        </div>
      </header>

      {/* Transient Event / Error Banners */}
      {(banner || notice) && (
        <div className="pointer-events-none fixed left-1/2 top-14 z-[60] flex -translate-x-1/2 flex-col items-center gap-1.5">
          {banner && (
            <div className="rounded-full border-2 border-amberwarm-400 bg-espresso/95 px-4 py-1.5 text-xs font-extrabold text-amberwarm-100 shadow-lg">
              {banner}
            </div>
          )}
          {notice && (
            <div className="rounded-full border border-terracotta-500 bg-terracotta-100 px-4 py-1 text-xs font-bold text-terracotta-700 shadow">
              {notice}
            </div>
          )}
        </div>
      )}

      {/* ==================== MAIN WORKSPACE BODY ==================== */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-2.5 lg:flex-row lg:overflow-hidden lg:p-3 short:flex-row short:gap-2 short:overflow-hidden short:p-1.5">
        {/* LEFT / CENTER: Wonder Board + Built Tableau + Drafting Hand + Action Dock */}
        <div className="flex w-full shrink-0 flex-col gap-2.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto short:min-h-0 short:flex-1 short:gap-1.5 short:overflow-y-auto">
          {/* 1. YOUR WONDER BOARD & BUILT KINGDOM TABLEAU */}
          {me && (
            <section
              data-tour="ds-wonder"
              className="rounded-3xl border-2 border-[#8B3A62]/35 bg-gradient-to-br from-[#FFFDF7] via-[#FDF7EA] to-[#F7ECDC] p-3 shadow-cozy short:rounded-2xl short:p-2"
            >
              {/* Wonder Header Banner */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border-2 border-white/80 shadow-sm short:h-8 short:w-8"
                    style={{ backgroundColor: `${me.wonder.accentHex}22` }}
                  >
                    <GameIcon name="ds-wonder" className="h-6 w-6 short:h-5 short:w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h2 className="font-display text-base font-black text-espresso short:text-sm">
                        {me.wonder.name}
                      </h2>
                      <span
                        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black"
                        style={{
                          backgroundColor: RESOURCE_META[me.wonder.startingResource].softBg,
                          borderColor: `${RESOURCE_META[me.wonder.startingResource].hex}66`,
                          color: RESOURCE_META[me.wonder.startingResource].text,
                        }}
                      >
                        <GameIcon
                          name={dawnResourceToIconName(me.wonder.startingResource)}
                          className="h-3 w-3"
                        />
                        Starts: {RESOURCE_META[me.wonder.startingResource].label}
                      </span>
                      {me.freeBuildAvailable && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-[#8B3A62] px-2 py-0.5 text-[10px] font-black text-white">
                          <Sparkles className="h-2.5 w-2.5" /> Free Build Ready!
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-semibold text-espresso-muted short:hidden">
                      {me.wonder.subtitle} · {me.builtCards.length} Structures Built
                    </p>
                  </div>
                </div>

                {/* Live KPI Strip: Gold, Shields, Military Tokens, Live VP */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-black">
                  <span className="inline-flex items-center gap-1 rounded-xl border border-amberwarm-400/70 bg-amberwarm-100 px-2.5 py-1 text-espresso">
                    <GameIcon name="coin-gold" className="h-4 w-4" />
                    {me.coins}g
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-xl border border-terracotta-500/40 bg-terracotta-100 px-2.5 py-1 text-terracotta-700">
                    <Shield className="h-3.5 w-3.5" />
                    {me.shields}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-100 px-2.5 py-1 text-emerald-800">
                    <Trophy className="h-3.5 w-3.5" />~{me.liveScoreEstimate.total}★
                  </span>
                </div>
              </div>

              {/* Wonder Stages Progress Row */}
              <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3 short:mt-1.5 short:gap-1.5">
                {me.wonder.stages.map((st) => {
                  const built = st.stageIndex < me.wonderStagesBuilt;
                  const isNext = st.stageIndex === me.wonderStagesBuilt;
                  return (
                    <div
                      key={st.stageIndex}
                      className={`rounded-2xl border-2 p-2 transition short:rounded-xl short:p-1.5 ${
                        built
                          ? "border-amberwarm-400 bg-amberwarm-100/80 shadow-sm"
                          : isNext
                            ? "border-[#8B3A62]/60 bg-white shadow-sm"
                            : "border-dashed border-oat-300 bg-oat-100/60 opacity-75"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-[10.5px] font-black text-espresso">
                          Stage {st.stageIndex + 1}: {st.name}
                        </span>
                        {built ? (
                          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-black text-white">
                            <Check className="h-2.5 w-2.5 stroke-[3]" /> BUILT
                          </span>
                        ) : isNext ? (
                          <span className="shrink-0 rounded-full bg-[#8B3A62]/15 px-1.5 py-0.5 text-[9px] font-extrabold text-[#8B3A62]">
                            NEXT
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-1">
                        <DawnCostPills cost={st.cost} compact />
                        <span className="rounded-lg bg-oat-100 px-1.5 py-0.5 text-[10px] font-black text-espresso">
                          {st.shortEffect}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Built Kingdom Tableau (Color-Coded Pills) */}
              <div className="mt-2.5 rounded-2xl border border-oat-200 bg-white/80 p-2 short:mt-1.5 short:p-1.5">
                {groupedMyCards.length === 0 ? (
                  <div className="text-center text-[11px] font-semibold text-espresso-muted">
                    Your kingdom tableau is ready — draft Era I structures below to build your
                    resource engine, monuments, and armies!
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {groupedMyCards.map(({ cat, cards }) => {
                      const meta = CATEGORY_META[cat];
                      return (
                        <div
                          key={cat}
                          className="flex flex-wrap items-center gap-1 rounded-xl border px-2 py-1"
                          style={{
                            backgroundColor: meta.softBg,
                            borderColor: `${meta.hex}44`,
                          }}
                        >
                          <span
                            className="text-[9.5px] font-black uppercase tracking-wider"
                            style={{ color: meta.text }}
                          >
                            {meta.label.split(" ")[0]} ({cards.length}):
                          </span>
                          {cards.map((c) => (
                            <span
                              key={c.id}
                              title={`${c.name} — ${c.shortEffect}`}
                              className="rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-extrabold text-espresso shadow-sm"
                            >
                              {c.name}{" "}
                              <span style={{ color: meta.text }} className="font-black">
                                ({c.shortEffect})
                              </span>
                            </span>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 2. YOUR DRAFTING HAND */}
          {!isSpectator && privateState && publicState.phase === "IN_PROGRESS" && (
            <section
              data-tour="ds-hand"
              className="rounded-3xl border-2 border-oat-300 bg-oat-50/95 p-3 shadow-sm short:rounded-2xl short:p-2"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 short:mb-1">
                <span className="text-xs font-extrabold uppercase tracking-wide text-espresso-soft">
                  Era {ERA_ROMAN[publicState.era]} Hand ({privateState.hand.length} cards) — Tap a
                  card to choose
                </span>
                <span className="text-[11px] font-bold text-espresso-muted">
                  Passing remaining {Math.max(0, privateState.hand.length - 1)} cards{" "}
                  <strong className="text-[#8B3A62]">
                    {publicState.passDirection === "left" ? "LEFT ⬅" : "RIGHT ➡"}
                  </strong>
                </span>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1.5 pt-1">
                {privateState.hand.map((ev) => {
                  const isLockedCard = privateState.pendingAction?.cardId === ev.card.id;
                  return (
                    <DawnspireHandCard
                      key={ev.card.id}
                      evaluation={ev}
                      selected={selectedCardId === ev.card.id}
                      lockedActionType={
                        isLockedCard ? privateState.pendingAction!.type : null
                      }
                      onSelect={() => setSelectedCardId(ev.card.id)}
                    />
                  );
                })}
              </div>

              {/* 3. SELECTED CARD ACTION DOCK (3 Crisp One-Click Choices!) */}
              <div
                data-tour="ds-actions"
                className="mt-2.5 rounded-2xl border-2 border-[#8B3A62]/30 bg-white p-2.5 shadow-sm short:mt-1.5 short:p-2"
              >
                {selectedEval ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className="rounded-md px-1.5 py-0.5 text-[10px] font-black text-white"
                          style={{ backgroundColor: CATEGORY_META[selectedEval.card.category].hex }}
                        >
                          {CATEGORY_META[selectedEval.card.category].label}
                        </span>
                        <span className="font-display text-sm font-black text-espresso">
                          {selectedEval.card.name}
                        </span>
                        <span className="text-xs font-extrabold text-espresso-soft">
                          — {selectedEval.card.shortEffect}
                        </span>
                      </div>
                      {selectedEval.buildPlan.isFreeChain && selectedEval.buildPlan.chainSourceName && (
                        <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                          <Link2 className="h-3.5 w-3.5" /> Free Chain unlocked by your{" "}
                          {selectedEval.buildPlan.chainSourceName}!
                        </div>
                      )}
                      {!selectedEval.buildPlan.isFreeChain &&
                        selectedEval.buildPlan.affordable &&
                        (selectedEval.buildPlan.leftTradeCoins > 0 ||
                          selectedEval.buildPlan.rightTradeCoins > 0) && (
                          <div className="mt-0.5 text-[11px] font-bold text-amberwarm-600">
                            Auto-Trade:{" "}
                            {selectedEval.buildPlan.leftTradeCoins > 0
                              ? `${selectedEval.buildPlan.leftTradeCoins}g → ${leftNeighbor?.displayName ?? "Left"}`
                              : ""}
                            {selectedEval.buildPlan.leftTradeCoins > 0 &&
                            selectedEval.buildPlan.rightTradeCoins > 0
                              ? " · "
                              : ""}
                            {selectedEval.buildPlan.rightTradeCoins > 0
                              ? `${selectedEval.buildPlan.rightTradeCoins}g → ${rightNeighbor?.displayName ?? "Right"}`
                              : ""}
                          </div>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Action A: Build Structure */}
                      {selectedEval.buildPlan.affordable && !selectedEval.buildPlan.isDuplicate ? (
                        <button
                          type="button"
                          onClick={() =>
                            sendAction({
                              type: "BUILD_CARD",
                              cardId: selectedEval.card.id,
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 short:px-2.5 short:py-1.5"
                        >
                          <Hammer className="h-3.5 w-3.5" />
                          {selectedEval.buildPlan.isFreeChain
                            ? "Build FREE (Chain!)"
                            : selectedEval.buildPlan.totalCoins === 0
                              ? "Build Free"
                              : `Build (${selectedEval.buildPlan.totalCoins}g)`}
                        </button>
                      ) : selectedEval.canUseWonderFreeBuild ? (
                        <button
                          type="button"
                          onClick={() =>
                            sendAction({
                              type: "BUILD_CARD",
                              cardId: selectedEval.card.id,
                              useFreeBuild: true,
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#8B3A62] px-3.5 py-2 text-xs font-black text-white shadow-sm transition hover:brightness-110 short:px-2.5 short:py-1.5"
                        >
                          <Sparkles className="h-3.5 w-3.5" /> Wonder Free Build (0g)
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center gap-1.5 rounded-xl bg-oat-200 px-3 py-2 text-xs font-bold text-espresso-muted opacity-65 short:px-2.5 short:py-1.5"
                        >
                          <Hammer className="h-3.5 w-3.5" />
                          {selectedEval.buildPlan.isDuplicate ? "Already Built" : "Can't Afford"}
                        </button>
                      )}

                      {/* Action B: Build Next Wonder Stage */}
                      {nextStage && (
                        <button
                          type="button"
                          disabled={!wonderPlan?.affordable}
                          onClick={() =>
                            sendAction({
                              type: "BUILD_WONDER",
                              cardId: selectedEval.card.id,
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl bg-amberwarm-600 px-3 py-2 text-xs font-black text-white shadow-sm transition hover:brightness-105 disabled:bg-oat-200 disabled:text-espresso-muted disabled:opacity-65 short:px-2.5 short:py-1.5"
                        >
                          <Landmark className="h-3.5 w-3.5" />
                          Stage {nextStage.stageIndex + 1}
                          {wonderPlan?.affordable && wonderPlan.totalCoins > 0
                            ? ` (${wonderPlan.totalCoins}g)`
                            : ""}
                        </button>
                      )}

                      {/* Action C: Sell Card for Gold (+Caravan Bonus!) */}
                      <button
                        type="button"
                        onClick={() =>
                          sendAction({
                            type: "SELL_CARD",
                            cardId: selectedEval.card.id,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-xl border-2 border-amberwarm-400 bg-amberwarm-100 px-3 py-2 text-xs font-black text-espresso shadow-sm transition hover:bg-amberwarm-400 short:px-2.5 short:py-1.5"
                      >
                        <Coins className="h-3.5 w-3.5 text-amberwarm-600" />
                        Sell +{privateState.sellGoldAmount}g
                        {privateState.hasCaravanBonus && (
                          <span className="rounded bg-amberwarm-600 px-1 text-[9px] text-white">
                            Caravan!
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-xs font-bold text-espresso-muted">
                    Select any card from your hand above to Build, Raise a Wonder Stage, or Sell for
                    Gold!
                  </p>
                )}
              </div>
            </section>
          )}
        </div>

        {/* RIGHT SIDEBAR: Immediate Neighbors + All Kingdoms + Simultaneous Chronicle */}
        <aside className="flex w-full shrink-0 flex-col gap-2.5 lg:w-[340px] lg:min-h-0 lg:overflow-y-auto short:w-[270px] short:min-h-0 short:gap-1.5 short:overflow-y-auto">
          {/* 1. TRADE NEIGHBORS & MILITARY BORDERS */}
          {!isSpectator && leftNeighbor && (
            <section
              data-tour="ds-neighbors"
              className="rounded-2xl border-2 border-oat-300 bg-oat-50/95 p-2.5 shadow-sm short:rounded-xl short:p-1.5"
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wide text-espresso-soft">
                  {publicState.isTwoPlayerCaravan
                    ? "Caravan Duel Neighbor"
                    : "Your Trade & Military Neighbors"}
                </span>
                <span className="text-[10px] font-bold text-espresso-muted">
                  Era {ERA_ROMAN[publicState.era]} Win = +
                  {publicState.era === 1 ? 1 : publicState.era === 2 ? 3 : 5}★
                </span>
              </div>

              <div className="space-y-1.5">
                {[
                  { label: publicState.isTwoPlayerCaravan ? "⚔ Rival" : "⬅ Left", p: leftNeighbor },
                  ...(rightNeighbor ? [{ label: "Right ➡", p: rightNeighbor }] : []),
                ].map(({ label, p }) => {
                  const tradable = collectTradablePreview(p);
                  const myS = me?.shields ?? 0;
                  const diff = myS - p.shields;
                  return (
                    <button
                      key={`${label}_${p.userId}`}
                      type="button"
                      onClick={() => setInspectPlayerId(p.userId)}
                      className="w-full rounded-xl border border-oat-300 bg-white p-2 text-left transition hover:border-[#8B3A62]/60"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="rounded bg-[#8B3A62]/15 px-1.5 py-0.5 text-[9.5px] font-black text-[#8B3A62]">
                            {label}
                          </span>
                          <span className="truncate text-xs font-extrabold text-espresso">
                            {p.displayName}
                          </span>
                        </div>
                        <span
                          className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                            diff > 0
                              ? "bg-emerald-100 text-emerald-800"
                              : diff < 0
                                ? "bg-terracotta-100 text-terracotta-700"
                                : "bg-oat-200 text-espresso-soft"
                          }`}
                        >
                          <Swords className="h-3 w-3" /> {p.shields}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className="text-[9.5px] font-bold text-espresso-muted">
                          Tradable:
                        </span>
                        {tradable.slice(0, 7).map((r, i) => (
                          <span
                            key={`${r}_${i}`}
                            className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-extrabold"
                            style={{
                              backgroundColor: RESOURCE_META[r].softBg,
                              color: RESOURCE_META[r].text,
                            }}
                          >
                            <GameIcon name={dawnResourceToIconName(r)} className="h-2.5 w-2.5" />
                            {RESOURCE_META[r].short}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* 2. ALL KINGDOMS & LIVE STANDINGS */}
          <section
            data-tour="ds-kingdoms"
            className="rounded-2xl border-2 border-oat-300 bg-oat-50/95 p-2.5 shadow-sm short:rounded-xl short:p-1.5"
          >
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-espresso-soft">
                Realms of Dawnspire ({publicState.players.length})
              </span>
              <span className="text-[10px] font-bold text-espresso-muted">Tap to inspect</span>
            </div>

            <div className="space-y-1.5">
              {publicState.players.map((p) => {
                const isMe = p.userId === myUserId;
                const isSubBot = botControlledUserIds.includes(p.userId);
                return (
                  <button
                    key={p.userId}
                    type="button"
                    onClick={() => setInspectPlayerId(p.userId)}
                    className={`w-full rounded-xl border-2 p-2 text-left transition short:p-1.5 ${
                      isMe
                        ? "border-[#8B3A62]/60 bg-white shadow-sm"
                        : "border-oat-200 bg-white/85 hover:border-oat-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: p.wonder.accentHex }}
                        />
                        <span className="truncate text-xs font-extrabold text-espresso">
                          {p.displayName}
                          {isMe && <span className="ml-1 text-[10px] text-[#8B3A62]">(You)</span>}
                        </span>
                        {isSubBot && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-amberwarm-100 px-1 text-[9px] font-bold text-amberwarm-600">
                            <Bot className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {publicState.phase === "IN_PROGRESS" && (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-black ${
                              p.hasLockedIn
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-oat-200 text-espresso-muted"
                            }`}
                          >
                            {p.hasLockedIn ? "✓ Ready" : "Drafting"}
                          </span>
                        )}
                        <span className="rounded-full bg-amberwarm-100 px-1.5 py-0.5 font-display text-[11px] font-black text-amberwarm-600">
                          {p.finalScore?.total ?? p.liveScoreEstimate.total}★
                        </span>
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[10px] font-bold text-espresso-muted">
                      <span className="truncate">{p.wonder.name}</span>
                      <span>
                        Stage {p.wonderStagesBuilt}/{p.wonder.stages.length} · {p.coins}g · ⚔
                        {p.shields}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 3. SIMULTANEOUS CHRONICLE */}
          <section className="rounded-2xl border border-oat-300 bg-oat-50/90 p-2.5 shadow-sm short:hidden">
            <div className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-espresso-soft">
              Realm Chronicle
            </div>
            <div className="max-h-36 space-y-1 overflow-y-auto text-[11px]">
              {publicState.log.slice(0, 10).map((entry, idx) => (
                <div
                  key={`${idx}_${entry.slice(0, 14)}`}
                  className="rounded-lg bg-white/85 px-2 py-1 font-semibold leading-snug text-espresso-soft"
                >
                  {entry}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {/* ==================== KINGDOM INSPECTOR MODAL ==================== */}
      {inspectedPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border-2 border-oat-300 bg-oat-50 p-5 shadow-cozy">
            <div className="flex items-center justify-between gap-2 border-b border-oat-200 pb-3">
              <div>
                <h3 className="font-display text-lg font-black text-espresso">
                  {inspectedPlayer.displayName} — {inspectedPlayer.wonder.name}
                </h3>
                <p className="text-xs font-bold text-espresso-muted">
                  Stage {inspectedPlayer.wonderStagesBuilt}/{inspectedPlayer.wonder.stages.length} ·{" "}
                  {inspectedPlayer.coins} Gold · ⚔ {inspectedPlayer.shields} Shields · ~
                  {inspectedPlayer.liveScoreEstimate.total}★
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectPlayerId(null)}
                className="rounded-xl p-1 text-espresso-muted hover:bg-oat-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
              {inspectedPlayer.builtCards.length === 0 ? (
                <p className="py-6 text-center text-xs font-semibold text-espresso-muted">
                  No structures built yet.
                </p>
              ) : (
                CATEGORY_ORDER.map((cat) => {
                  const list = inspectedPlayer.builtCards.filter((c) => c.category === cat);
                  if (list.length === 0) return null;
                  const meta = CATEGORY_META[cat];
                  return (
                    <div
                      key={cat}
                      className="rounded-2xl border p-2.5"
                      style={{
                        backgroundColor: meta.softBg,
                        borderColor: `${meta.hex}55`,
                      }}
                    >
                      <div
                        className="mb-1 text-[10px] font-black uppercase tracking-wider"
                        style={{ color: meta.text }}
                      >
                        {meta.label} ({list.length})
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {list.map((c: DawnCardDef) => (
                          <span
                            key={c.id}
                            className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-espresso shadow-sm"
                          >
                            {c.name} ·{" "}
                            <span style={{ color: meta.text }} className="font-black">
                              {c.shortEffect}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TABLE CHAT DRAWER ==================== */}
      {showChat && (
        <div className="fixed bottom-3 right-3 z-50 flex h-72 w-80 max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-3xl border-2 border-oat-300 bg-oat-50 shadow-cozy">
          <div className="flex items-center justify-between border-b border-oat-200 px-3.5 py-2">
            <span className="text-xs font-black text-espresso">Dawnspire Table Chat</span>
            <button
              type="button"
              onClick={() => setShowChat(false)}
              className="rounded-lg p-1 text-espresso-muted hover:bg-oat-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto p-3 text-xs">
            {chatLog.length === 0 && (
              <p className="py-4 text-center text-[11px] text-espresso-muted">
                Send a quick line or banter with your neighbors!
              </p>
            )}
            {chatLog.map((m) => (
              <div key={m.id} className="rounded-xl bg-oat-100 px-2.5 py-1.5">
                <span className="font-bold text-[#8B3A62]">{m.senderName}: </span>
                <span className="text-espresso">{m.message}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-1 overflow-x-auto border-t border-oat-200 bg-oat-100/70 px-2 py-1.5">
            {DAWNSPIRE_QUICK_LINES.map((line, idx) => (
              <button
                key={line}
                type="button"
                onClick={() => roomRef.current?.send("game.chat", { quickIndex: idx })}
                className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold text-espresso shadow-sm hover:bg-amberwarm-100"
              >
                {line}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!chatInput.trim()) return;
              roomRef.current?.send("game.chat", { message: chatInput });
              setChatInput("");
            }}
            className="flex gap-1.5 border-t border-oat-200 p-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Say something..."
              maxLength={220}
              className="flex-1 rounded-xl border border-oat-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-[#8B3A62]"
            />
            <button
              type="submit"
              className="rounded-xl bg-[#8B3A62] p-2 text-white hover:brightness-110"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* ==================== FINAL 7-CATEGORY SCOREBOARD MODAL ==================== */}
      {publicState.phase === "FINISHED" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/60 p-3 backdrop-blur-sm">
          <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border-2 border-amberwarm-400 bg-oat-50 p-5 shadow-cozy">
            <div className="text-center">
              <Crown className="mx-auto h-10 w-10 text-amberwarm-600" />
              <h2 className="mt-1 font-display text-2xl font-black text-espresso">
                {results?.headline ?? "Dawnspire Complete!"}
              </h2>
              <p className="text-xs font-bold text-espresso-muted">
                Final 7-Category Civilization Scoreboard (Tiebreaker: Most Gold)
              </p>
            </div>

            <div className="mt-4 flex-1 overflow-x-auto overflow-y-auto rounded-2xl border border-oat-300 bg-white">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="bg-oat-100 text-[10.5px] font-black uppercase text-espresso-soft">
                  <tr>
                    <th className="px-3 py-2">Realm</th>
                    <th className="px-2 py-2 text-center text-[#C7463E]">⚔ Mil</th>
                    <th className="px-2 py-2 text-center text-[#B45309]">🪙 Gold</th>
                    <th className="px-2 py-2 text-center text-[#8B3A62]">🏛 Wnd</th>
                    <th className="px-2 py-2 text-center text-[#2D6BB0]">Blue</th>
                    <th className="px-2 py-2 text-center text-[#D49523]">Yel</th>
                    <th className="px-2 py-2 text-center text-[#7E3F8F]">Gld</th>
                    <th className="px-2 py-2 text-center text-[#2E8A57]">Sci</th>
                    <th className="px-3 py-2 text-right text-espresso">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-oat-200 font-bold">
                  {[...publicState.players]
                    .sort(
                      (a, b) =>
                        (b.finalScore?.total ?? 0) - (a.finalScore?.total ?? 0) ||
                        b.coins - a.coins
                    )
                    .map((p) => {
                      const s = p.finalScore ?? p.liveScoreEstimate;
                      const isWinner = publicState.winnerIds.includes(p.userId);
                      return (
                        <tr
                          key={p.userId}
                          className={isWinner ? "bg-amberwarm-100/75" : undefined}
                        >
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5 font-extrabold text-espresso">
                              {isWinner && <Crown className="h-3.5 w-3.5 text-amberwarm-600" />}
                              <span>{p.displayName}</span>
                            </div>
                            <div className="text-[10px] font-semibold text-espresso-muted">
                              {p.wonder.name} · {p.coins}g
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center">{s.military}</td>
                          <td className="px-2 py-2 text-center">{s.treasury}</td>
                          <td className="px-2 py-2 text-center">{s.wonder}</td>
                          <td className="px-2 py-2 text-center">{s.civic}</td>
                          <td className="px-2 py-2 text-center">{s.commerce}</td>
                          <td className="px-2 py-2 text-center">{s.guild}</td>
                          <td className="px-2 py-2 text-center">{s.science}</td>
                          <td className="px-3 py-2 text-right font-display text-base font-black text-espresso">
                            {s.total}★
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              {!isSpectator && (
                <button
                  type="button"
                  onClick={() => roomRef.current?.send("game.rematch")}
                  disabled={rematchStatus.votes.includes(myUserId)}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-[#8B3A62] px-5 py-2.5 font-display text-sm font-black text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
                >
                  <RotateCcw className="h-4 w-4" />
                  {rematchStatus.votes.includes(myUserId)
                    ? `Voted Rematch (${rematchStatus.votes.length}/${rematchStatus.needed})`
                    : "Play Again"}
                </button>
              )}
              <button
                type="button"
                onClick={() => onExitGame({ finished: true })}
                className="rounded-2xl border-2 border-oat-300 bg-white px-5 py-2.5 font-display text-sm font-bold text-espresso hover:bg-oat-100"
              >
                Return to Café
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 6-STEP SPOTLIGHT QUICK TOUR ==================== */}
      <GameQuickTour
        gameSlug="dawnspire"
        open={showQuickTour}
        onClose={() => setShowQuickTour(false)}
      />
    </div>
  );
}
