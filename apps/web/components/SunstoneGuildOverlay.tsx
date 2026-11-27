"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Client as ColyseusClient, type Room } from "colyseus.js";
import {
  BookOpen,
  Bot,
  Check,
  Compass,
  Crown,
  Eye,
  Flame,
  Lock,
  LogOut,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import {
  BASE_GEM_COLORS,
  GEM_META,
  MAX_HAND_TOKENS,
  MAX_RESERVED_CARDS,
  SUNSTONE_QUICK_LINES,
  TOKEN_COLORS,
  calculateCardPayment,
  countTokens,
  type BaseGemColor,
  type RelicCard,
  type RelicTier,
  type SunstoneAction,
  type SunstoneEvent,
  type SunstonePrivateState,
  type SunstonePublicState,
  type TokenColor,
} from "@tablefolk/game-sunstone-guild";
import { getPlayerColorMeta } from "@tablefolk/shared";
import { WS_BASE_URL, getStoredToken } from "@/lib/api";
import { hasCompletedQuickTour } from "@/lib/gameQuickTours";
import { soundEngine } from "@/lib/sound";
import { GameIcon, sunstoneGemToIconName } from "./GameIcons";
import { GameQuickTour } from "./GameQuickTour";
import { GuidedTutorialCoach } from "./GuidedTutorialCoach";
import { buildSunstoneGuildGuide } from "@/lib/guidedTutorials";
import {
  GemBankButton,
  PatronTile,
  RelicCardTile,
  TierDeckPile,
} from "./SunstoneCardSvg";

interface SunstoneGuildOverlayProps {
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
  isQuickBluff?: boolean;
  isSpectator?: boolean;
  timestamp: number;
}

interface SelectedCardState {
  card: RelicCard;
  source: "market" | "reserved";
}

export function SunstoneGuildOverlay({
  gameRoomId,
  myUserId,
  tutorialMode = false,
  onExitGame,
  onOpenTutorial,
}: SunstoneGuildOverlayProps) {
  const [publicState, setPublicState] = useState<SunstonePublicState | null>(null);
  const [privateState, setPrivateState] = useState<SunstonePrivateState | null>(null);
  const [turnEndsAt, setTurnEndsAt] = useState<number>(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(45);
  const [botControlledUserIds, setBotControlledUserIds] = useState<string[]>([]);
  const [rematchVotes, setRematchVotes] = useState<string[]>([]);
  const [connectedHumanCount, setConnectedHumanCount] = useState<number>(1);
  const [spectatorCount, setSpectatorCount] = useState<number>(0);
  const [isSpectator, setIsSpectator] = useState<boolean>(false);

  const [stagedGems, setStagedGems] = useState<BaseGemColor[]>([]);
  const [discardSelection, setDiscardSelection] = useState<TokenColor[]>([]);
  const [selectedCard, setSelectedCard] = useState<SelectedCardState | null>(null);

  const [notice, setNotice] = useState<string | null>(null);
  const [eventBanner, setEventBanner] = useState<string | null>(null);
  const [chatLog, setChatLog] = useState<GameChatEntry[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const [muted, setMuted] = useState(() => soundEngine.isMuted());
  const [showQuickTour, setShowQuickTour] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const autoTourCheckedRef = useRef(false);
  const prevActiveTurnRef = useRef<string | null>(null);

  const flashNotice = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => {
      setNotice((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  const flashBanner = useCallback((msg: string) => {
    setEventBanner(msg);
    setTimeout(() => {
      setEventBanner((prev) => (prev === msg ? null : prev));
    }, 3600);
  }, []);

  // Connect to SunstoneGuildRoom via Colyseus
  useEffect(() => {
    let disposed = false;
    let joinedRoom: Room | null = null;

    async function connect() {
      const token = getStoredToken();
      if (!token) {
        onExitGame({ notice: "Sign-in expired. Returning to café..." });
        return;
      }
      try {
        const client = new ColyseusClient(WS_BASE_URL);
        const room = await client.joinById(gameRoomId, { token });
        if (disposed) {
          void room.leave();
          return;
        }
        joinedRoom = room;
        roomRef.current = room;

        room.onMessage(
          "game.publicState",
          (payload: {
            state: SunstonePublicState;
            turnEndsAt: number;
            botControlledUserIds?: string[];
            rematchVotes?: string[];
            connectedHumanCount?: number;
            spectatorCount?: number;
            isSpectator?: boolean;
            events?: SunstoneEvent[];
          }) => {
            setPublicState(payload.state);
            setTurnEndsAt(payload.turnEndsAt || 0);
            if (payload.botControlledUserIds) setBotControlledUserIds(payload.botControlledUserIds);
            if (payload.rematchVotes) setRematchVotes(payload.rematchVotes);
            if (typeof payload.connectedHumanCount === "number") {
              setConnectedHumanCount(payload.connectedHumanCount);
            }
            if (typeof payload.spectatorCount === "number") {
              setSpectatorCount(payload.spectatorCount);
            }
            if (typeof payload.isSpectator === "boolean") {
              setIsSpectator(payload.isSpectator);
            }

            // Clear staged UI selections whenever turn or step changes
            setStagedGems([]);
            setSelectedCard(null);
            setDiscardSelection([]);

            // Audio & headline cues
            const evs = payload.events ?? [];
            for (const ev of evs) {
              if (ev.type === "GAME_FINISHED") {
                soundEngine.playVictory();
                flashBanner(ev.summary);
              } else if (ev.type === "PATRON_CLAIMED") {
                soundEngine.playSpyglass();
                flashBanner(`👑 ${ev.summary}`);
              } else if (ev.type === "CATALYST_TRIGGERED") {
                soundEngine.playRepair();
                flashBanner(ev.summary);
              } else if (ev.type === "FINAL_ROUND_TRIGGERED") {
                soundEngine.playCountdownGo();
                flashBanner(`🔥 ${ev.summary}`);
              } else if (ev.type === "CARD_CRAFTED") {
                soundEngine.playTilePlace();
              } else if (ev.type === "CARD_RESERVED") {
                soundEngine.playCardWhoosh();
              } else if (ev.type === "GEMS_TAKEN") {
                soundEngine.playEmotePop();
              }
            }

            if (
              payload.state.phase === "IN_PROGRESS" &&
              payload.state.activePlayerId === myUserId &&
              prevActiveTurnRef.current !== `${payload.state.turnNumber}:${payload.state.step}`
            ) {
              soundEngine.playTurnChime();
            }
            prevActiveTurnRef.current = `${payload.state.turnNumber}:${payload.state.step}`;
          }
        );

        room.onMessage("game.privateState", (priv: SunstonePrivateState) => {
          setPrivateState(priv);
        });

        room.onMessage("game.actionRejected", (err: { message?: string }) => {
          flashNotice(err?.message || "Action could not be completed.");
        });

        room.onMessage("game.chatReceived", (entry: GameChatEntry) => {
          setChatLog((prev) => [...prev.slice(-39), entry]);
          setShowChat((isOpen) => {
            if (!isOpen && entry.senderUserId !== myUserId) {
              setUnreadChat((u) => u + 1);
            }
            return isOpen;
          });
        });

        room.onLeave(() => {
          if (!disposed) {
            roomRef.current = null;
          }
        });

        room.send("game.sync");
      } catch (err) {
        if (!disposed) {
          onExitGame({
            notice:
              err instanceof Error
                ? `Could not connect to Sunstone Guild: ${err.message}`
                : "Could not connect to Sunstone Guild.",
          });
        }
      }
    }

    void connect();

    return () => {
      disposed = true;
      roomRef.current = null;
      if (joinedRoom) {
        void joinedRoom.leave();
      }
    };
  }, [gameRoomId, myUserId, onExitGame, flashNotice, flashBanner]);

  // First-time automatic Quick Tour launch once state loads (skipped in interactive tutorialMode)
  useEffect(() => {
    if (!publicState || isSpectator || tutorialMode || autoTourCheckedRef.current) return;
    autoTourCheckedRef.current = true;
    if (!hasCompletedQuickTour("sunstone-guild")) {
      const t = setTimeout(() => setShowQuickTour(true), 650);
      return () => clearTimeout(t);
    }
  }, [publicState, isSpectator, tutorialMode]);

  // Turn countdown tick
  useEffect(() => {
    const tick = () => {
      if (!turnEndsAt) return;
      const diff = Math.max(0, Math.ceil((turnEndsAt - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    tick();
    const id = setInterval(tick, 300);
    return () => clearInterval(id);
  }, [turnEndsAt]);

  const sendAction = useCallback((action: SunstoneAction) => {
    roomRef.current?.send("game.action", action);
  }, []);

  const me = useMemo(
    () => publicState?.players.find((p) => p.userId === myUserId) ?? null,
    [publicState, myUserId]
  );

  const isMyTurn = Boolean(
    publicState &&
      !isSpectator &&
      publicState.phase === "IN_PROGRESS" &&
      publicState.activePlayerId === myUserId
  );

  const step = publicState?.step ?? "MAIN_ACTION";
  const myReservedFull = privateState?.reserved ?? [];
  const myTokenCount = me ? countTokens(me.tokens) : 0;
  const excessToDiscard =
    isMyTurn && step === "DISCARD_GEMS"
      ? Math.max(0, myTokenCount - MAX_HAND_TOKENS)
      : 0;

  // Gem staging logic: supports up to 3 distinct colors OR 2 of same color (when bank >= 4)
  const handleStageGem = useCallback(
    (color: BaseGemColor) => {
      if (!publicState || !isMyTurn || step !== "MAIN_ACTION") return;
      const bankCount = publicState.bank[color];
      if (bankCount <= 0) return;

      setSelectedCard(null);
      setStagedGems((prev) => {
        const countOfColor = prev.filter((c) => c === color).length;
        // Already picked 2 of this color -> deselect both
        if (countOfColor >= 2) {
          return prev.filter((c) => c !== color);
        }
        // Picked 1 of this color -> if it's the ONLY staged color and bank >= 4, upgrade to 2! Otherwise remove it.
        if (countOfColor === 1) {
          if (prev.length === 1 && bankCount >= 4) {
            return [color, color];
          }
          return prev.filter((c) => c !== color);
        }
        // If we currently have a pair of another color, switch to this new single color
        if (prev.length === 2 && prev[0] === prev[1]) {
          return [color];
        }
        // Add distinct color up to 3
        if (prev.length >= 3) {
          return [...prev.slice(1), color];
        }
        return [...prev, color];
      });
    },
    [publicState, isMyTurn, step]
  );

  const stagedCounts = useMemo(() => {
    const map: Record<BaseGemColor, number> = {
      ruby: 0,
      sapphire: 0,
      emerald: 0,
      amethyst: 0,
      pearl: 0,
    };
    for (const g of stagedGems) map[g] += 1;
    return map;
  }, [stagedGems]);

  const isStagedValid = useMemo(() => {
    if (!publicState || stagedGems.length === 0) return false;
    if (stagedGems.length === 2 && stagedGems[0] === stagedGems[1]) {
      return publicState.bank[stagedGems[0]!] >= 4;
    }
    const uniq = new Set(stagedGems);
    if (uniq.size !== stagedGems.length) return false;
    return stagedGems.every((g) => publicState.bank[g] >= 1);
  }, [publicState, stagedGems]);

  const handleConfirmTakeGems = () => {
    if (!isStagedValid) return;
    sendAction({ type: "TAKE_GEMS", gems: stagedGems });
    setStagedGems([]);
  };

  const handleToggleDiscardToken = (color: TokenColor) => {
    if (!me || excessToDiscard <= 0) return;
    setDiscardSelection((prev) => {
      const alreadySelected = prev.filter((c) => c === color).length;
      if (prev.length >= excessToDiscard) {
        if (alreadySelected > 0) {
          const idx = prev.lastIndexOf(color);
          return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
        }
        return prev;
      }
      if (alreadySelected < me.tokens[color]) {
        return [...prev, color];
      }
      // Tap again when maxed to remove one
      const idx = prev.lastIndexOf(color);
      if (idx >= 0) return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
      return prev;
    });
  };

  const handleConfirmDiscard = () => {
    if (discardSelection.length !== excessToDiscard) return;
    sendAction({ type: "DISCARD_GEMS", gems: discardSelection });
    setDiscardSelection([]);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    roomRef.current?.send("game.chat", { message: trimmed });
    setChatInput("");
  };

  const handleQuickLine = (text: string) => {
    roomRef.current?.send("game.quickBluff", { text });
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundEngine.setMuted(next);
  };

  const handleLeave = () => {
    onExitGame({ finished: publicState?.phase === "GAME_END" });
  };

  const selectedPayment = useMemo(() => {
    if (!selectedCard || !me) return null;
    return calculateCardPayment(me.tokens, me.bonuses, selectedCard.card);
  }, [selectedCard, me]);

  if (!publicState) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/60 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-amberwarm-400/60 bg-oat-50 px-8 py-6 shadow-cozy">
          <GameIcon name="game-sunstone" className="h-12 w-12 animate-bounce" />
          <p className="font-display text-lg font-bold text-espresso">
            Opening the Sunstone Atelier...
          </p>
        </div>
      </div>
    );
  }

  const activePlayer = publicState.players[publicState.activePlayerIndex];
  const canReserveMore = isMyTurn && step === "MAIN_ACTION" && myReservedFull.length < MAX_RESERVED_CARDS;
  const projectedOverCap = Math.max(0, myTokenCount + stagedGems.length - MAX_HAND_TOKENS);

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-gradient-to-br from-[#F7EFE1] via-[#F3E7D2] to-[#EADBC2] text-espresso">
      {/* ==================== TOP HEADER BAR ==================== */}
      <header
        data-tour="sg-header"
        className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b-2 border-oat-300 bg-oat-50/95 px-3 py-2 shadow-sm backdrop-blur short:px-2.5 short:py-1"
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-amberwarm-400/60 bg-gradient-to-br from-[#2B5096] to-[#1E3B73] shadow-sm short:h-7 short:w-7">
            <GameIcon name="game-sunstone" className="h-5 w-5 short:h-4 short:w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate font-display text-sm font-extrabold text-espresso sm:text-base short:text-xs">
                Sunstone Guild
              </h2>
              <span className="rounded-full bg-oat-200 px-2 py-0.5 text-[10px] font-extrabold text-espresso-soft short:px-1.5 short:text-[9px]">
                Rd {publicState.roundNumber} · Goal {publicState.targetPrestige}★
              </span>
              {publicState.finalRoundTriggered && publicState.phase === "IN_PROGRESS" && (
                <span className="inline-flex animate-pulse items-center gap-0.5 rounded-full bg-terracotta-500 px-2 py-0.5 text-[10px] font-black text-white shadow-sm">
                  <Flame className="h-3 w-3" /> FINAL ROUND
                </span>
              )}
              {isSpectator && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amberwarm-100 px-2 py-0.5 text-[10px] font-bold text-amberwarm-600">
                  <Eye className="h-3 w-3" /> Spectating
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center Active Turn Pill + Countdown */}
        {publicState.phase === "IN_PROGRESS" && activePlayer && (
          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-extrabold shadow-sm short:px-2.5 short:py-0.5 short:text-[11px] ${
              isMyTurn
                ? "border-emerald-500 bg-emerald-100 text-emerald-900"
                : "border-oat-300 bg-white text-espresso"
            }`}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: getPlayerColorMeta(activePlayer.colorIndex).hex }}
            />
            <span>
              {isMyTurn
                ? step === "DISCARD_GEMS"
                  ? `Return ${excessToDiscard} Excess Gem${excessToDiscard === 1 ? "" : "s"}!`
                  : step === "CLAIM_PATRON"
                    ? "Choose Your Guild Patron!"
                    : "Your Turn — Draft, Reserve, or Craft"
                : `${activePlayer.displayName}'s Turn`}
            </span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                secondsLeft <= 10 ? "bg-terracotta-500 text-white" : "bg-oat-200 text-espresso"
              }`}
            >
              {secondsLeft}s
            </span>
          </div>
        )}

        {/* Right Controls */}
        <div className="flex items-center gap-1.5">
          {spectatorCount > 0 && (
            <span className="hidden items-center gap-1 rounded-full bg-oat-200 px-2 py-1 text-[10px] font-bold text-espresso-soft sm:inline-flex">
              <Eye className="h-3 w-3" /> {spectatorCount}
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowQuickTour(true)}
            className="inline-flex items-center gap-1 rounded-xl border border-sage-300 bg-sage-100 px-2.5 py-1.5 text-[11px] font-bold text-sage-700 transition hover:bg-sage-200 short:px-2 short:py-1"
            title="Interactive 6-Step Tour"
          >
            <Compass className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Tour</span>
          </button>
          <button
            type="button"
            onClick={onOpenTutorial}
            className="inline-flex items-center gap-1 rounded-xl border border-oat-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-espresso transition hover:bg-oat-100 short:px-2 short:py-1"
            title="Rules & Reference"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Rules</span>
          </button>
          <button
            type="button"
            onClick={toggleMute}
            className="rounded-xl border border-oat-300 bg-white p-1.5 text-espresso transition hover:bg-oat-100 short:p-1"
            title={muted ? "Unmute Audio" : "Mute Audio"}
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowChat((v) => !v);
              setUnreadChat(0);
            }}
            className="relative rounded-xl border border-oat-300 bg-white p-1.5 text-espresso transition hover:bg-oat-100 short:p-1"
            title="Table Chat"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {unreadChat > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta-500 px-1 text-[9px] font-black text-white">
                {unreadChat}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={handleLeave}
            className="inline-flex items-center gap-1 rounded-xl border border-terracotta-500/35 bg-terracotta-100 px-2.5 py-1.5 text-[11px] font-bold text-terracotta-700 transition hover:bg-terracotta-500 hover:text-white short:px-2 short:py-1"
            title="Return to Café"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Café</span>
          </button>
        </div>
      </header>

      {/* Transient Event / Error Banners */}
      {(eventBanner || notice) && (
        <div className="pointer-events-none fixed left-1/2 top-14 z-[60] flex -translate-x-1/2 flex-col items-center gap-1.5">
          {eventBanner && (
            <div className="rounded-full border-2 border-amberwarm-400 bg-espresso/95 px-4 py-1.5 text-xs font-extrabold text-amberwarm-100 shadow-lg">
              {eventBanner}
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
        {/* LEFT COLUMN: Patrons + 3-Tier Market + Gem Bank */}
        <div className="flex shrink-0 flex-col gap-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto short:min-h-0 short:flex-1 short:gap-1.5 short:overflow-y-auto">
          {/* 1. ROYAL GUILD PATRONS ROW */}
          <section
            data-tour="sg-patrons"
            className={`shrink-0 rounded-2xl border-2 p-2 shadow-sm short:rounded-xl short:p-1.5 ${
              isMyTurn && step === "CLAIM_PATRON"
                ? "border-amberwarm-600 bg-amberwarm-100/90"
                : "border-oat-300 bg-oat-50/90"
            }`}
          >
            <div className="mb-1.5 flex items-center justify-between short:mb-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-espresso-soft short:text-[10px]">
                <GameIcon name="sg-crown" className="h-3.5 w-3.5" />
                Royal Guild Patrons (+3 Prestige on Auto-Visit)
              </span>
              {isMyTurn && step === "CLAIM_PATRON" && (
                <span className="rounded-full bg-amberwarm-600 px-2 py-0.5 text-[10px] font-black text-white">
                  Tap a glowing Patron to welcome!
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
              {publicState.patrons.length === 0 ? (
                <span className="text-xs font-semibold text-espresso-muted">
                  All Royal Patrons have visited guilds this match!
                </span>
              ) : (
                publicState.patrons.map((patron) => {
                  const selectable =
                    isMyTurn &&
                    step === "CLAIM_PATRON" &&
                    publicState.pendingPatronIds.includes(patron.id);
                  return (
                    <PatronTile
                      key={patron.id}
                      patron={patron}
                      bonuses={me?.bonuses}
                      selectable={selectable}
                      onSelect={() =>
                        sendAction({ type: "CLAIM_PATRON", patronId: patron.id })
                      }
                    />
                  );
                })
              )}
            </div>
          </section>

          {/* 2. 3-TIER ARTISAN RELIC MARKET */}
          <section
            data-tour="sg-market"
            className="flex shrink-0 flex-col gap-1.5 rounded-2xl border-2 border-oat-300 bg-oat-50/90 p-2 shadow-sm lg:min-h-0 lg:flex-1 short:gap-1 short:rounded-xl short:p-1.5"
          >
            <div className="flex flex-col gap-1.5 overflow-x-auto pb-0.5 lg:flex-1 lg:gap-2 lg:overflow-x-visible short:gap-1">
              {([3, 2, 1] as RelicTier[]).map((tier) => (
                <div
                  key={tier}
                  className="grid min-w-[490px] grid-cols-[68px_repeat(4,minmax(0,1fr))] gap-1.5 sm:min-w-0 sm:grid-cols-[84px_repeat(4,minmax(0,1fr))] sm:gap-2 lg:flex-1 short:min-w-0 short:grid-cols-[60px_repeat(4,minmax(0,1fr))] short:gap-1"
                >
                  <TierDeckPile
                    tier={tier}
                    count={publicState.deckCounts[tier]}
                    canReserve={canReserveMore}
                    onReserveBlind={() => sendAction({ type: "RESERVE_DECK", tier })}
                  />
                  {publicState.market[tier].map((card, slotIdx) => {
                    if (!card) {
                      return (
                        <div
                          key={`empty_${tier}_${slotIdx}`}
                          className="flex min-h-[104px] items-center justify-center rounded-2xl border-2 border-dashed border-oat-300/80 bg-oat-100/50 text-[10px] font-bold text-espresso-muted short:min-h-[76px] short:rounded-xl"
                        >
                          Empty
                        </div>
                      );
                    }
                    const payment = me
                      ? calculateCardPayment(me.tokens, me.bonuses, card)
                      : undefined;
                    const isSel =
                      selectedCard?.source === "market" && selectedCard.card.id === card.id;

                    return (
                      <RelicCardTile
                        key={card.id}
                        card={card}
                        payment={payment}
                        bonuses={me?.bonuses}
                        isSelected={isSel}
                        isInteractive={isMyTurn && step === "MAIN_ACTION"}
                        onClick={() => {
                          setStagedGems([]);
                          setSelectedCard((prev) =>
                            prev?.card.id === card.id && prev.source === "market"
                              ? null
                              : { card, source: "market" }
                          );
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Selected Card Action Bar (Zero-scroll inline Craft / Reserve dock!) */}
            {selectedCard && (
              <div className="mt-1 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-espresso/25 bg-white px-3 py-2 shadow-md short:rounded-xl short:px-2 short:py-1.5">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-oat-300 bg-oat-100">
                    <GameIcon
                      name={sunstoneGemToIconName(selectedCard.card.gem)}
                      className="h-5 w-5"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-espresso">
                      <span className="truncate">{selectedCard.card.name}</span>
                      {selectedCard.card.prestige > 0 && (
                        <span className="rounded-full bg-amberwarm-100 px-1.5 py-0.5 text-[10px] font-black text-amberwarm-600">
                          +{selectedCard.card.prestige}★
                        </span>
                      )}
                      {selectedCard.card.catalyst && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amberwarm-100 px-1.5 py-0.5 text-[10px] font-black text-espresso">
                          <Zap className="h-2.5 w-2.5" /> +1 {GEM_META[selectedCard.card.gem].label}
                        </span>
                      )}
                      {selectedCard.card.bonusCount === 2 && (
                        <span className="rounded-full bg-amberwarm-100 px-1.5 py-0.5 text-[10px] font-black text-espresso">
                          2× Discount
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-semibold text-espresso-soft">
                      {!isMyTurn || step !== "MAIN_ACTION"
                        ? "Inspecting Relic"
                        : selectedPayment?.canAfford
                          ? selectedPayment.goldUsed > 0
                            ? `Ready to Craft (uses ${selectedPayment.goldUsed} ★ Sunstone Gold)`
                            : "Ready to Craft with your gems & engine!"
                          : `Need ${selectedPayment?.missingCount ?? 1} more gem${(selectedPayment?.missingCount ?? 1) === 1 ? "" : "s"} to craft`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {isMyTurn && step === "MAIN_ACTION" && (
                    <>
                      <button
                        type="button"
                        disabled={!selectedPayment?.canAfford}
                        onClick={() =>
                          sendAction({
                            type: "BUY_CARD",
                            cardId: selectedCard.card.id,
                            source: selectedCard.source,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Craft Relic
                      </button>

                      {selectedCard.source === "market" && (
                        <button
                          type="button"
                          disabled={!canReserveMore}
                          onClick={() =>
                            sendAction({
                              type: "RESERVE_MARKET",
                              cardId: selectedCard.card.id,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-xl bg-amberwarm-400 px-3 py-1.5 text-xs font-extrabold text-espresso shadow-sm transition hover:bg-amberwarm-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Lock className="h-3.5 w-3.5" />
                          Reserve{publicState.bank.gold > 0 ? " (+1★)" : ""}
                        </button>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedCard(null)}
                    className="rounded-xl bg-oat-200 p-1.5 text-espresso hover:bg-oat-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* 3. INTERACTIVE GEM BANK TRAY */}
          <section
            data-tour="sg-bank"
            className="shrink-0 rounded-2xl border-2 border-oat-300 bg-oat-50/95 p-2.5 shadow-sm short:sticky short:bottom-0 short:z-10 short:rounded-xl short:bg-oat-50 short:p-1.5 short:shadow-md"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="grid flex-1 grid-cols-6 gap-1.5 sm:gap-2 short:gap-1">
                {TOKEN_COLORS.map((color) => {
                  const isBase = color !== "gold";
                  const count = publicState.bank[color];
                  const selCount = isBase ? stagedCounts[color] : 0;
                  const canDouble = isBase && stagedGems.length === 1 && stagedGems[0] === color && count >= 4;
                  return (
                    <GemBankButton
                      key={color}
                      color={color}
                      count={count}
                      selectedCount={selCount}
                      highlightDouble={canDouble}
                      disabled={!isMyTurn || step !== "MAIN_ACTION" || count <= 0}
                      onClick={isBase ? () => handleStageGem(color) : undefined}
                    />
                  );
                })}
              </div>

              {/* Confirm / Clear Staged Gems Controls */}
              <div className="flex shrink-0 items-center gap-1.5">
                {stagedGems.length > 0 ? (
                  <>
                    <div className="flex flex-col items-end">
                      <button
                        type="button"
                        disabled={!isStagedValid}
                        onClick={handleConfirmTakeGems}
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-40 short:px-2.5 short:py-1.5"
                      >
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                        Take {stagedGems.length} Gem{stagedGems.length === 1 ? "" : "s"}
                      </button>
                      {projectedOverCap > 0 && (
                        <span className="mt-0.5 text-[9px] font-bold text-terracotta-700">
                          Will return {projectedOverCap} excess
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setStagedGems([])}
                      className="rounded-xl bg-oat-200 p-2 text-espresso hover:bg-oat-300 short:p-1.5"
                      title="Clear selection"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <div className="hidden max-w-[148px] text-[10px] font-semibold leading-snug text-espresso-soft xl:block">
                    Tap <strong>3 different</strong> gems, or tap <strong>1 stack twice</strong> (4+ left) to take 2.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: Guild Players + Your Atelier + Log */}
        <aside className="flex w-full shrink-0 flex-col gap-2 lg:w-[320px] lg:overflow-y-auto xl:w-[348px] short:w-[270px] short:gap-1.5 short:overflow-y-auto">
          {/* 1. YOUR ATELIER & RESERVES */}
          {me && !isSpectator && (
            <section
              data-tour="sg-atelier"
              className="rounded-2xl border-2 border-sage-300 bg-white/95 p-2.5 shadow-sm short:rounded-xl short:p-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-xs font-extrabold text-espresso short:text-[11px]">
                  Your Atelier ({me.prestige}/{publicState.targetPrestige}★)
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                    myTokenCount > MAX_HAND_TOKENS
                      ? "bg-terracotta-500 text-white"
                      : myTokenCount >= 9
                        ? "bg-amberwarm-100 text-amberwarm-600"
                        : "bg-oat-100 text-espresso-soft"
                  }`}
                >
                  {myTokenCount}/{MAX_HAND_TOKENS} Gems
                </span>
              </div>

              {/* Engine Discounts (Cards) + Hand Gems Grid */}
              <div className="mt-2 grid grid-cols-6 gap-1 short:mt-1">
                {TOKEN_COLORS.map((c) => {
                  const meta = GEM_META[c];
                  const bonus = c === "gold" ? null : me.bonuses[c];
                  const held = me.tokens[c];
                  return (
                    <div
                      key={c}
                      className="flex flex-col items-center rounded-xl border px-1 py-1 text-center"
                      style={{
                        backgroundColor: meta.softBg,
                        borderColor: meta.border,
                      }}
                    >
                      <GameIcon name={sunstoneGemToIconName(c)} className="h-3.5 w-3.5" />
                      <div className="mt-0.5 text-[11px] font-black leading-none text-espresso">
                        {held}
                      </div>
                      {bonus !== null ? (
                        <div
                          className="mt-0.5 rounded px-1 text-[9px] font-extrabold leading-tight"
                          style={{
                            backgroundColor: bonus > 0 ? meta.hex : "rgba(255,255,255,0.65)",
                            color: bonus > 0 ? "#FFFFFF" : meta.text,
                          }}
                          title={`Permanent ${meta.label} discount: -${bonus}`}
                        >
                          −{bonus}
                        </div>
                      ) : (
                        <div className="mt-0.5 text-[8.5px] font-bold text-amberwarm-600">
                          Wild
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Your Reserved Cards Tray */}
              <div className="mt-2 border-t border-oat-200 pt-2 short:mt-1.5 short:pt-1.5">
                <div className="mb-1 flex items-center justify-between text-[10px] font-extrabold text-espresso-soft">
                  <span className="inline-flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Reserved Relics ({myReservedFull.length}/{MAX_RESERVED_CARDS})
                  </span>
                  {myReservedFull.length > 0 && (
                    <span className="text-[9px] text-emerald-700">Tap to Craft</span>
                  )}
                </div>
                {myReservedFull.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-oat-300 bg-oat-50 px-2 py-1.5 text-center text-[10px] font-semibold text-espresso-muted">
                    Reserve any Market card or Tier Deck to hold it & gain +1 ★ Wild Gold!
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {myReservedFull.map((slot) => {
                      const payment = calculateCardPayment(me.tokens, me.bonuses, slot.card);
                      const isSel =
                        selectedCard?.source === "reserved" &&
                        selectedCard.card.id === slot.card.id;
                      return (
                        <RelicCardTile
                          key={slot.card.id}
                          card={slot.card}
                          payment={payment}
                          bonuses={me.bonuses}
                          compact
                          isSelected={isSel}
                          isInteractive={isMyTurn && step === "MAIN_ACTION"}
                          onClick={() => {
                            setStagedGems([]);
                            setSelectedCard((prev) =>
                              prev?.source === "reserved" && prev.card.id === slot.card.id
                                ? null
                                : { card: slot.card, source: "reserved" }
                            );
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 2. ALL GUILD ARTISANS LEADERBOARD */}
          <section
            data-tour="sg-players"
            className="rounded-2xl border-2 border-oat-300 bg-oat-50/95 p-2.5 shadow-sm short:rounded-xl short:p-1.5"
          >
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-espresso-soft short:text-[10px]">
                Guild Artisans
              </span>
              <span className="text-[10px] font-bold text-espresso-muted">
                Tiebreak: Fewer Relics
              </span>
            </div>
            <div className="space-y-1.5">
              {publicState.players.map((p) => {
                const isActive =
                  publicState.phase === "IN_PROGRESS" &&
                  publicState.activePlayerId === p.userId;
                const isMe = p.userId === myUserId;
                const isSubBot = botControlledUserIds.includes(p.userId);
                const colorMeta = getPlayerColorMeta(p.colorIndex);

                return (
                  <div
                    key={p.userId}
                    className={`rounded-xl border-2 p-2 transition short:p-1.5 ${
                      isActive
                        ? "border-emerald-500 bg-white shadow-sm ring-1 ring-emerald-400/40"
                        : isMe
                          ? "border-sage-300 bg-white/85"
                          : "border-oat-200 bg-white/75"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: colorMeta.hex }}
                        />
                        <span className="truncate text-xs font-extrabold text-espresso">
                          {p.displayName}
                          {isMe && (
                            <span className="ml-1 text-[10px] text-sage-700">(You)</span>
                          )}
                        </span>
                        {isSubBot && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-amberwarm-100 px-1 text-[9px] font-bold text-amberwarm-600">
                            <Bot className="h-2.5 w-2.5" /> Bot
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="text-[10px] font-bold text-espresso-muted">
                          {p.craftedCount}R · {p.tokenCount}G
                        </span>
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amberwarm-100 px-2 py-0.5 font-display text-xs font-black text-amberwarm-600">
                          {p.prestige}★
                        </span>
                      </div>
                    </div>

                    {/* Compact Engine Discount + Held Gem Mini-Row */}
                    <div className="mt-1.5 flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        {BASE_GEM_COLORS.map((c) => {
                          const meta = GEM_META[c];
                          return (
                            <span
                              key={c}
                              title={`${meta.label}: ${p.bonuses[c]} permanent discount / ${p.tokens[c]} gems in hand`}
                              className="inline-flex items-center gap-0.5 rounded-md border px-1 py-0.5 text-[9.5px] font-black leading-none"
                              style={{
                                backgroundColor: meta.softBg,
                                borderColor: meta.border,
                                color: meta.text,
                              }}
                            >
                              <span>{p.bonuses[c]}</span>
                              <span className="opacity-45">/</span>
                              <span className="opacity-80">{p.tokens[c]}</span>
                            </span>
                          );
                        })}
                        {p.tokens.gold > 0 && (
                          <span
                            title={`Sunstone Gold Wilds: ${p.tokens.gold}`}
                            className="inline-flex items-center gap-0.5 rounded-md border border-amberwarm-400 bg-amberwarm-100 px-1 py-0.5 text-[9.5px] font-black leading-none text-amberwarm-600"
                          >
                            ★{p.tokens.gold}
                          </span>
                        )}
                      </div>

                      {/* Reserved indicators */}
                      {p.reserved.length > 0 && (
                        <div className="flex items-center gap-0.5">
                          {p.reserved.map((slot, idx) => (
                            <span
                              key={`${p.userId}_res_${idx}`}
                              title={
                                slot.card
                                  ? `Reserved: ${slot.card.name} (${slot.card.prestige}★)`
                                  : `Hidden Tier ${slot.tier} Reserve`
                              }
                              className="inline-flex items-center rounded bg-oat-200 px-1 py-0.5 text-[9px] font-extrabold text-espresso-soft"
                            >
                              <Lock className="mr-0.5 h-2.5 w-2.5" />
                              {slot.card ? `${slot.card.prestige}★` : `T${slot.tier}`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3. ACTIVITY LOG (Compact) */}
          <section className="hidden min-h-0 flex-1 flex-col rounded-2xl border-2 border-oat-300 bg-oat-50/90 p-2.5 shadow-sm lg:flex">
            <span className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-espresso-soft">
              Atelier Ledger
            </span>
            <div className="flex-1 space-y-1 overflow-y-auto pr-1 text-[11px]">
              {publicState.log.slice(0, 14).map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg bg-white/80 px-2 py-1 leading-snug text-espresso-soft"
                >
                  {item.text}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {/* ==================== EXCESS GEM DISCARD MODAL (> 10 GEMS) ==================== */}
      {isMyTurn && step === "DISCARD_GEMS" && me && excessToDiscard > 0 && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-espresso/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border-2 border-amberwarm-400 bg-oat-50 p-5 shadow-cozy">
            <h3 className="font-display text-lg font-extrabold text-espresso">
              Gem Pouch Full ({myTokenCount}/{MAX_HAND_TOKENS})
            </h3>
            <p className="mt-1 text-xs font-semibold text-espresso-soft">
              Choose <strong>{excessToDiscard}</strong> gem{excessToDiscard === 1 ? "" : "s"} to
              return to the bank before ending your turn.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {TOKEN_COLORS.filter((c) => me.tokens[c] > 0).map((c) => {
                const chosenCount = discardSelection.filter((d) => d === c).length;
                const meta = GEM_META[c];
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleToggleDiscardToken(c)}
                    className={`flex flex-col items-center rounded-2xl border-2 p-2.5 transition ${
                      chosenCount > 0
                        ? "border-terracotta-500 bg-terracotta-100/70 shadow-sm"
                        : "border-oat-300 bg-white hover:border-espresso/40"
                    }`}
                  >
                    <GameIcon name={sunstoneGemToIconName(c)} className="h-6 w-6" />
                    <span className="mt-1 text-xs font-extrabold" style={{ color: meta.text }}>
                      {meta.label}
                    </span>
                    <span className="text-[10px] font-bold text-espresso-muted">
                      Hold {me.tokens[c]}
                      {chosenCount > 0 ? ` (−${chosenCount})` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDiscardSelection([])}
                className="rounded-xl bg-oat-200 px-3 py-2 text-xs font-bold text-espresso hover:bg-oat-300"
              >
                Reset
              </button>
              <button
                type="button"
                disabled={discardSelection.length !== excessToDiscard}
                onClick={handleConfirmDiscard}
                className="rounded-xl bg-terracotta-500 px-4 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-terracotta-700 disabled:opacity-40"
              >
                Return {discardSelection.length}/{excessToDiscard} Gem
                {excessToDiscard === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SLIDE-OUT CHAT & QUICK LINES ==================== */}
      {showChat && (
        <div className="fixed bottom-3 right-3 z-[56] flex h-[340px] w-[300px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-3xl border-2 border-oat-300 bg-oat-50/95 shadow-cozy backdrop-blur">
          <div className="flex items-center justify-between border-b border-oat-200 bg-white px-3.5 py-2">
            <span className="font-display text-xs font-extrabold text-espresso">
              Guild Table Chat
            </span>
            <button
              type="button"
              onClick={() => setShowChat(false)}
              className="rounded-lg p-1 text-espresso-soft hover:bg-oat-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-1.5 overflow-y-auto p-3 text-xs">
            {chatLog.length === 0 ? (
              <p className="text-center text-espresso-muted">
                Cheer on great crafts or bluff your next target!
              </p>
            ) : (
              chatLog.map((m) => (
                <div key={m.id} className="rounded-xl bg-white px-2.5 py-1.5 shadow-sm">
                  <span className="font-extrabold text-espresso">{m.senderName}: </span>
                  <span className="text-espresso-soft">{m.message}</span>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-1 overflow-x-auto border-t border-oat-200 bg-oat-100/80 px-2 py-1.5">
            {SUNSTONE_QUICK_LINES.map((line) => (
              <button
                key={line}
                type="button"
                onClick={() => handleQuickLine(line)}
                className="shrink-0 rounded-full border border-oat-300 bg-white px-2.5 py-0.5 text-[10px] font-bold text-espresso hover:bg-amberwarm-100"
              >
                {line}
              </button>
            ))}
          </div>

          <form
            onSubmit={handleSendChat}
            className="flex items-center gap-1.5 border-t border-oat-200 bg-white p-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Say something cozy..."
              className="min-w-0 flex-1 rounded-xl border border-oat-300 bg-oat-50 px-2.5 py-1.5 text-xs font-medium text-espresso outline-none focus:border-sage-500"
            />
            <button
              type="submit"
              className="rounded-xl bg-sage-500 p-2 text-white hover:bg-sage-700"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* ==================== VICTORY CELEBRATION OVERLAY ==================== */}
      {publicState.phase === "GAME_END" && publicState.results && (
        <div className="fixed inset-0 z-[58] flex items-center justify-center bg-espresso/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border-2 border-amberwarm-400 bg-gradient-to-b from-oat-50 to-amberwarm-100/40 p-6 text-center shadow-cozy">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-amberwarm-400 bg-amberwarm-100 shadow">
              <Crown className="h-8 w-8 text-amberwarm-600" />
            </div>
            <h3 className="mt-3 font-display text-2xl font-black text-espresso">
              Guild Crown Awarded!
            </h3>
            <p className="mt-1 text-sm font-bold text-espresso-soft">
              {publicState.results.headline}
            </p>

            <div className="mt-4 space-y-2 text-left">
              {publicState.results.players.map((p, idx) => (
                <div
                  key={p.userId}
                  className={`flex items-center justify-between rounded-2xl border-2 px-3.5 py-2.5 ${
                    p.isWinner
                      ? "border-amberwarm-400 bg-amberwarm-100/90 shadow-sm"
                      : "border-oat-200 bg-white/90"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-extrabold text-espresso">
                      <span>#{idx + 1}</span>
                      <span>{p.displayName}</span>
                      {p.isWinner && <Crown className="h-4 w-4 text-amberwarm-600" />}
                    </div>
                    {p.roleLabel && (
                      <div className="text-[11px] font-semibold text-espresso-muted">
                        {p.roleLabel}
                      </div>
                    )}
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 font-display text-base font-black text-amberwarm-600 shadow-sm">
                    {p.score}★
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-center gap-2.5">
              {!isSpectator && (
                <button
                  type="button"
                  onClick={() => roomRef.current?.send("game.playAgain")}
                  disabled={rematchVotes.includes(myUserId)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-sage-500 px-4 py-2.5 font-display text-sm font-extrabold text-white shadow-sm transition hover:bg-sage-700 disabled:opacity-60"
                >
                  <RefreshCw className="h-4 w-4" />
                  {rematchVotes.includes(myUserId)
                    ? `Waiting (${rematchVotes.length}/${connectedHumanCount})`
                    : "Play Again"}
                </button>
              )}
              <button
                type="button"
                onClick={handleLeave}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 border-oat-300 bg-white px-4 py-2.5 font-display text-sm font-extrabold text-espresso transition hover:bg-oat-100"
              >
                <LogOut className="h-4 w-4" /> Back to Café
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 6-STEP LIVE SPOTLIGHT QUICK TOUR ==================== */}
      <GameQuickTour
        gameSlug="sunstone-guild"
        open={showQuickTour}
        onClose={() => setShowQuickTour(false)}
        onOpenFullRules={() => {
          setShowQuickTour(false);
          onOpenTutorial();
        }}
      />

      {tutorialMode && !isSpectator && publicState && me && (
        <GuidedTutorialCoach
          model={buildSunstoneGuildGuide({
            phase: publicState.phase,
            step,
            isMyTurn,
            stagedGemCount: stagedGems.length,
            myTokenCount,
            myRelicCount: me.craftedCount,
            myPrestige: me.prestige,
            targetPrestige: publicState.targetPrestige,
            canAffordAnyRelic:
              ([1, 2, 3] as RelicTier[]).some((tier) =>
                publicState.market[tier].some(
                  (card) => card && calculateCardPayment(me.tokens, me.bonuses, card).canAfford
                )
              ) ||
              myReservedFull.some(
                (slot) => calculateCardPayment(me.tokens, me.bonuses, slot.card).canAfford
              ),
            reservedCount: myReservedFull.length,
          })}
          onOpenRules={onOpenTutorial}
          onExitTutorial={() => onExitGame({ finished: publicState.phase === "GAME_END" })}
        />
      )}
    </div>
  );
}
