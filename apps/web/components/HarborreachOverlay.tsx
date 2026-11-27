"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Client as ColyseusClient, type Room } from "colyseus.js";
import {
  ArrowLeftRight,
  BookOpen,
  Bot,
  Check,
  Compass,
  Crown,
  Dices,
  Eye,
  LogOut,
  MessageCircle,
  RefreshCw,
  ScrollText,
  Send,
  Shield,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  BUILD_COSTS,
  COMPASS_CHARGE_THRESHOLD,
  HARBOR_QUICK_LINES,
  RESOURCES,
  RESOURCE_META,
  SCROLL_META,
  countResources,
  createEmptyResources,
  getBanditStealCandidates,
  getValidCottageVertices,
  getValidRoadEdges,
  getValidSetupRoadEdges,
  getValidSetupVertices,
  getValidTownVertices,
  hasResources,
  type HarborAction,
  type HarborEvent,
  type HarborPrivateState,
  type HarborPublicState,
  type ResourcePool,
  type ResourceType,
  type ScrollCard,
} from "@tablefolk/game-harborreach";
import { getPlayerColorMeta } from "@tablefolk/shared";
import { WS_BASE_URL, getStoredToken } from "@/lib/api";
import { hasCompletedQuickTour } from "@/lib/gameQuickTours";
import { soundEngine } from "@/lib/sound";
import { GameIcon, harborResourceToIconName } from "./GameIcons";
import { GameQuickTour } from "./GameQuickTour";
import { HarborreachBoardSvg } from "./HarborreachBoardSvg";

interface HarborreachOverlayProps {
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
  isQuickBluff?: boolean;
  isSpectator?: boolean;
  timestamp: number;
}

type BuildMode = "none" | "road" | "cottage" | "town";

export function HarborreachOverlay({
  gameRoomId,
  myUserId,
  onExitGame,
  onOpenTutorial,
}: HarborreachOverlayProps) {
  const [publicState, setPublicState] = useState<HarborPublicState | null>(null);
  const [privateState, setPrivateState] = useState<HarborPrivateState | null>(null);
  const [turnEndsAt, setTurnEndsAt] = useState<number>(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(45);
  const [botControlledUserIds, setBotControlledUserIds] = useState<string[]>([]);
  const [rematchVotes, setRematchVotes] = useState<string[]>([]);
  const [connectedHumanCount, setConnectedHumanCount] = useState<number>(1);
  const [spectatorCount, setSpectatorCount] = useState<number>(0);
  const [isSpectator, setIsSpectator] = useState<boolean>(false);

  const [buildMode, setBuildMode] = useState<BuildMode>("none");
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeTab, setTradeTab] = useState<"bank" | "player">("bank");
  const [bankGive, setBankGive] = useState<ResourceType>("timber");
  const [bankReceive, setBankReceive] = useState<ResourceType>("ore");
  const [offerGive, setOfferGive] = useState<ResourcePool>(() => createEmptyResources());
  const [offerWant, setOfferWant] = useState<ResourcePool>(() => createEmptyResources());

  const [showCompassPicker, setShowCompassPicker] = useState(false);
  const [pendingBanditHex, setPendingBanditHex] = useState<number | null>(null);
  const [pendingScrollModal, setPendingScrollModal] = useState<ScrollCard | null>(null);
  const [plentyPick, setPlentyPick] = useState<[ResourceType, ResourceType]>(["grain", "ore"]);
  const [monopolyPick, setMonopolyPick] = useState<ResourceType>("ore");

  const [discardPool, setDiscardPool] = useState<ResourcePool>(() => createEmptyResources());

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
  const prevTurnKeyRef = useRef<string | null>(null);

  const flashNotice = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice((prev) => (prev === msg ? null : prev)), 3200);
  }, []);

  const flashBanner = useCallback((msg: string) => {
    setEventBanner(msg);
    setTimeout(() => setEventBanner((prev) => (prev === msg ? null : prev)), 3600);
  }, []);

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
            state: HarborPublicState;
            turnEndsAt: number;
            botControlledUserIds?: string[];
            rematchVotes?: string[];
            connectedHumanCount?: number;
            spectatorCount?: number;
            isSpectator?: boolean;
            events?: HarborEvent[];
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

            setBuildMode("none");
            setPendingBanditHex(null);
            if (payload.state.step !== "DISCARD_RESOURCES") {
              setDiscardPool(createEmptyResources());
            }

            for (const ev of payload.events ?? []) {
              if (ev.type === "GAME_FINISHED") {
                soundEngine.playVictory();
                flashBanner(ev.summary);
              } else if (ev.type === "AWARD_CLAIMED") {
                soundEngine.playSpyglass();
                flashBanner(`🏆 ${ev.summary}`);
              } else if (ev.type === "DICE_ROLLED") {
                soundEngine.playEmotePop();
              } else if (ev.type === "BUILT_COTTAGE" || ev.type === "UPGRADED_TOWN" || ev.type === "BUILT_ROAD") {
                soundEngine.playTilePlace();
              } else if (ev.type === "BANDIT_MOVED") {
                soundEngine.playHazard();
                flashBanner(`🦊 ${ev.summary}`);
              } else if (ev.type === "TRADE_COMPLETED") {
                soundEngine.playRepair();
                flashBanner(`🤝 ${ev.summary}`);
              } else if (ev.type === "COMPASS_REDEEMED") {
                soundEngine.playFieldPatch();
                flashBanner(ev.summary);
              }
            }

            const key = `${payload.state.turnNumber}:${payload.state.step}:${payload.state.activePlayerId}`;
            if (
              payload.state.phase === "IN_PROGRESS" &&
              payload.state.activePlayerId === myUserId &&
              prevTurnKeyRef.current !== key
            ) {
              soundEngine.playTurnChime();
            }
            prevTurnKeyRef.current = key;
          }
        );

        room.onMessage("game.privateState", (priv: HarborPrivateState) => {
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
          if (!disposed) roomRef.current = null;
        });

        room.send("game.sync");
      } catch (err) {
        if (!disposed) {
          onExitGame({
            notice:
              err instanceof Error
                ? `Could not connect to Harborreach: ${err.message}`
                : "Could not connect to Harborreach.",
          });
        }
      }
    }

    void connect();

    return () => {
      disposed = true;
      roomRef.current = null;
      if (joinedRoom) void joinedRoom.leave();
    };
  }, [gameRoomId, myUserId, onExitGame, flashNotice, flashBanner]);

  const hasPublicState = Boolean(publicState);
  useEffect(() => {
    if (!hasPublicState || isSpectator || autoTourCheckedRef.current) return;
    autoTourCheckedRef.current = true;
    if (!hasCompletedQuickTour("harborreach")) {
      const t = setTimeout(() => setShowQuickTour(true), 650);
      return () => clearTimeout(t);
    }
  }, [hasPublicState, isSpectator]);

  useEffect(() => {
    const tick = () => {
      if (!turnEndsAt) return;
      setSecondsLeft(Math.max(0, Math.ceil((turnEndsAt - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 300);
    return () => clearInterval(id);
  }, [turnEndsAt]);

  const sendAction = useCallback((action: HarborAction) => {
    roomRef.current?.send("game.action", action);
  }, []);

  const me = useMemo(
    () => publicState?.players.find((p) => p.userId === myUserId) ?? null,
    [publicState, myUserId]
  );

  const playerColorById = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of publicState?.players ?? []) {
      map[p.userId] = p.colorIndex;
    }
    return map;
  }, [publicState]);

  const isMyTurn = Boolean(
    publicState &&
      !isSpectator &&
      publicState.phase === "IN_PROGRESS" &&
      publicState.activePlayerId === myUserId
  );

  const step = publicState?.step ?? "SETUP_SETTLE";
  const myResources = privateState?.resources ?? createEmptyResources();
  const myRates = privateState?.tradeRates ?? { timber: 4, clay: 4, wool: 4, grain: 4, ore: 4 };
  const myScrolls = privateState?.scrolls ?? [];
  const mustDiscard = privateState?.mustDiscardCount ?? 0;

  // Affordability + Legal placement sets
  const validRoadEdgeList = useMemo(() => {
    if (!publicState || !isMyTurn) return [];
    if (step === "SETUP_ROAD" && publicState.setupLastVertexId !== null) {
      return getValidSetupRoadEdges(publicState.board, publicState.roads, publicState.setupLastVertexId);
    }
    if (step === "FREE_ROADS" || step === "MAIN_PHASE") {
      return getValidRoadEdges(publicState.board, publicState.buildings, publicState.roads, myUserId);
    }
    return [];
  }, [publicState, isMyTurn, step, myUserId]);

  const validCottageVertexList = useMemo(() => {
    if (!publicState || !isMyTurn) return [];
    if (step === "SETUP_SETTLE") {
      return getValidSetupVertices(publicState.board, publicState.buildings);
    }
    if (step === "MAIN_PHASE") {
      return getValidCottageVertices(publicState.board, publicState.buildings, publicState.roads, myUserId);
    }
    return [];
  }, [publicState, isMyTurn, step, myUserId]);

  const validTownVertexList = useMemo(() => {
    if (!publicState || !isMyTurn || step !== "MAIN_PHASE") return [];
    return getValidTownVertices(publicState.buildings, myUserId);
  }, [publicState, isMyTurn, step, myUserId]);

  const canBuildRoad =
    isMyTurn &&
    step === "MAIN_PHASE" &&
    (me?.roadsRemaining ?? 0) > 0 &&
    validRoadEdgeList.length > 0 &&
    hasResources(myResources, BUILD_COSTS.road);

  const canBuildCottage =
    isMyTurn &&
    step === "MAIN_PHASE" &&
    (me?.cottagesRemaining ?? 0) > 0 &&
    validCottageVertexList.length > 0 &&
    hasResources(myResources, BUILD_COSTS.cottage);

  const canUpgradeTown =
    isMyTurn &&
    step === "MAIN_PHASE" &&
    (me?.townsRemaining ?? 0) > 0 &&
    validTownVertexList.length > 0 &&
    hasResources(myResources, BUILD_COSTS.town);

  const canBuyScroll =
    isMyTurn &&
    step === "MAIN_PHASE" &&
    (publicState?.scrollDeckCount ?? 0) > 0 &&
    hasResources(myResources, BUILD_COSTS.scroll);

  // Active highlighted sets rendered on the SVG board (context-sensitive = zero mis-taps!)
  const highlightedVertices = useMemo(() => {
    if (!isMyTurn) return new Set<number>();
    if (step === "SETUP_SETTLE") return new Set(validCottageVertexList);
    if (step === "MAIN_PHASE" && buildMode === "cottage") return new Set(validCottageVertexList);
    if (step === "MAIN_PHASE" && buildMode === "town") return new Set(validTownVertexList);
    return new Set<number>();
  }, [isMyTurn, step, buildMode, validCottageVertexList, validTownVertexList]);

  const highlightedEdges = useMemo(() => {
    if (!isMyTurn) return new Set<number>();
    if (step === "SETUP_ROAD" || step === "FREE_ROADS") return new Set(validRoadEdgeList);
    if (step === "MAIN_PHASE" && buildMode === "road") return new Set(validRoadEdgeList);
    return new Set<number>();
  }, [isMyTurn, step, buildMode, validRoadEdgeList]);

  const canMoveBandit = isMyTurn && step === "MOVE_BANDIT";

  const handleClickVertex = (vertexId: number) => {
    if (!isMyTurn) return;
    if (step === "SETUP_SETTLE") {
      sendAction({ type: "SETUP_PLACE_COTTAGE", vertexId });
    } else if (step === "MAIN_PHASE" && buildMode === "cottage") {
      sendAction({ type: "BUILD_COTTAGE", vertexId });
    } else if (step === "MAIN_PHASE" && buildMode === "town") {
      sendAction({ type: "UPGRADE_TOWN", vertexId });
    }
  };

  const handleClickEdge = (edgeId: number) => {
    if (!isMyTurn) return;
    if (step === "SETUP_ROAD") {
      sendAction({ type: "SETUP_PLACE_ROAD", edgeId });
    } else if (step === "FREE_ROADS" || (step === "MAIN_PHASE" && buildMode === "road")) {
      sendAction({ type: "BUILD_ROAD", edgeId });
    }
  };

  const handleClickHex = (hexId: number) => {
    if (!publicState || !canMoveBandit || hexId === publicState.banditHexId) return;
    const resCounts: Record<string, number> = {};
    for (const p of publicState.players) resCounts[p.userId] = p.resourceCount;
    const candidates = getBanditStealCandidates(
      publicState.board,
      publicState.buildings,
      hexId,
      myUserId,
      resCounts
    );
    if (candidates.length <= 1) {
      sendAction({
        type: "MOVE_BANDIT",
        hexId,
        stealFromUserId: candidates[0] ?? null,
      });
    } else {
      setPendingBanditHex(hexId);
    }
  };

  const banditVictimCandidates = useMemo(() => {
    if (!publicState || pendingBanditHex === null) return [];
    const resCounts: Record<string, number> = {};
    for (const p of publicState.players) resCounts[p.userId] = p.resourceCount;
    const ids = getBanditStealCandidates(
      publicState.board,
      publicState.buildings,
      pendingBanditHex,
      myUserId,
      resCounts
    );
    return publicState.players.filter((p) => ids.includes(p.userId));
  }, [publicState, pendingBanditHex, myUserId]);

  const handlePlayScrollClick = (card: ScrollCard) => {
    if (!publicState || !isMyTurn) return;
    if (card.kind === "victory_point") return;
    if (card.kind === "knight" || card.kind === "road_builder") {
      sendAction({ type: "PLAY_SCROLL", scrollId: card.id });
    } else {
      setPendingScrollModal(card);
    }
  };

  const handleAdjustDiscard = (r: ResourceType, delta: 1 | -1) => {
    setDiscardPool((prev) => {
      const nextVal = prev[r] + delta;
      if (nextVal < 0 || nextVal > myResources[r]) return prev;
      const total = countResources(prev) + delta;
      if (delta > 0 && total > mustDiscard) return prev;
      return { ...prev, [r]: nextVal };
    });
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    roomRef.current?.send("game.chat", { message: trimmed });
    setChatInput("");
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundEngine.setMuted(next);
  };

  if (!publicState) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/60 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-amberwarm-400/60 bg-oat-50 px-8 py-6 shadow-cozy">
          <GameIcon name="game-harbor" className="h-12 w-12 animate-bounce" />
          <p className="font-display text-lg font-bold text-espresso">
            Charting Harborreach Island...
          </p>
        </div>
      </div>
    );
  }

  const activePlayer = publicState.players[publicState.activePlayerIndex];
  const lastRollSum = publicState.lastDice
    ? publicState.lastDice[0] + publicState.lastDice[1]
    : null;
  const compassReady =
    isMyTurn && step === "MAIN_PHASE" && (me?.compassCharges ?? 0) >= COMPASS_CHARGE_THRESHOLD;
  const activeOffer = publicState.activeTrade;
  const canRespondOffer =
    Boolean(activeOffer) &&
    !isSpectator &&
    activeOffer!.fromUserId !== myUserId &&
    !activeOffer!.declinedByUserIds.includes(myUserId);
  const canAffordOffer = canRespondOffer && hasResources(myResources, activeOffer!.want);

  const turnStatusLabel = isMyTurn
    ? step === "SETUP_SETTLE"
      ? "Tap a glowing corner to found your Cottage!"
      : step === "SETUP_ROAD"
        ? "Tap a glowing coastal road beside your Cottage!"
        : step === "ROLL_DICE"
          ? "Roll 2d6 to harvest the island!"
          : step === "MOVE_BANDIT"
            ? "Tap any other hex to send the Bandit Fox!"
            : step === "FREE_ROADS"
              ? `Place Free Road (${publicState.freeRoadsLeft} left)!`
              : step === "DISCARD_RESOURCES"
                ? "Waiting for pioneers to discard..."
                : "Trade & Build — then End Turn"
    : `${activePlayer?.displayName ?? "Pioneer"}'s Turn`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-gradient-to-br from-[#F6EFE2] via-[#EFE4D0] to-[#E5D5BC] text-espresso">
      {/* ==================== TOP HEADER BAR ==================== */}
      <header
        data-tour="hr-header"
        className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b-2 border-oat-300 bg-oat-50/95 px-3 py-2 shadow-sm backdrop-blur short:px-2.5 short:py-1"
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-amberwarm-400/60 bg-[#1E7D74]/15 shadow-sm short:h-7 short:w-7">
            <GameIcon name="game-harbor" className="h-5 w-5 short:h-4 short:w-4" />
          </div>
          <div className="flex items-center gap-1.5">
            <h2 className="truncate font-display text-sm font-extrabold text-espresso sm:text-base short:text-xs">
              Harborreach
            </h2>
            <span className="rounded-full bg-oat-200 px-2 py-0.5 text-[10px] font-extrabold text-espresso-soft short:px-1.5 short:text-[9px]">
              {publicState.roundNumber === 0 ? "Founding" : `Rd ${publicState.roundNumber}`} · Goal{" "}
              {publicState.targetVP} VP
            </span>
            {publicState.lastDice && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amberwarm-400 bg-amberwarm-100 px-2 py-0.5 text-[10px] font-black text-espresso">
                <Dices className="h-3 w-3 text-amberwarm-600" />
                {publicState.lastDice[0]}+{publicState.lastDice[1]}={lastRollSum}
              </span>
            )}
            {isSpectator && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amberwarm-100 px-2 py-0.5 text-[10px] font-bold text-amberwarm-600">
                <Eye className="h-3 w-3" /> Spectating
              </span>
            )}
          </div>
        </div>

        {/* Center Active Turn Pill */}
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
            <span className="max-w-[240px] truncate sm:max-w-none">{turnStatusLabel}</span>
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
            onClick={() => onExitGame({ finished: publicState.phase === "GAME_END" })}
            className="inline-flex items-center gap-1 rounded-xl border border-terracotta-500/35 bg-terracotta-100 px-2.5 py-1.5 text-[11px] font-bold text-terracotta-700 transition hover:bg-terracotta-500 hover:text-white short:px-2 short:py-1"
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
        {/* LEFT/CENTER: Interactive 19-Hex Coastal Island Board */}
        <section
          data-tour="hr-board"
          className="relative flex aspect-[10/9] w-full shrink-0 flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-[#2B6475]/55 bg-[radial-gradient(circle_at_45%_40%,#64B4C4_0%,#428D9F_58%,#2C697B_100%)] p-1.5 shadow-cozy lg:aspect-auto lg:min-h-0 lg:flex-1 short:aspect-auto short:min-h-0 short:flex-1 short:rounded-2xl short:p-1"
        >
          <HarborreachBoardSvg
            board={publicState.board}
            buildings={publicState.buildings}
            roads={publicState.roads}
            banditHexId={publicState.banditHexId}
            lastRollSum={lastRollSum}
            playerColorById={playerColorById}
            validVertices={highlightedVertices}
            validEdges={highlightedEdges}
            canMoveBandit={canMoveBandit}
            onClickVertex={handleClickVertex}
            onClickEdge={handleClickEdge}
            onClickHex={handleClickHex}
          />

          {/* Floating Big Roll Dice CTA */}
          {isMyTurn && step === "ROLL_DICE" && (
            <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
              <button
                type="button"
                onClick={() => sendAction({ type: "ROLL_DICE" })}
                className="inline-flex items-center gap-2 rounded-2xl border-2 border-white/80 bg-emerald-600 px-5 py-2.5 font-display text-sm font-black text-white shadow-lg transition hover:scale-105 hover:bg-emerald-700 active:scale-95 short:px-4 short:py-1.5 short:text-xs"
              >
                <Dices className="h-5 w-5" /> Roll 2d6
              </button>
            </div>
          )}

          {/* Active Build Mode Hint Banner */}
          {isMyTurn && step === "MAIN_PHASE" && buildMode !== "none" && (
            <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border-2 border-emerald-500 bg-white/95 px-3.5 py-1.5 text-xs font-extrabold text-emerald-900 shadow-lg">
              <span>
                {buildMode === "road"
                  ? "Tap a glowing dashed Road edge"
                  : buildMode === "cottage"
                    ? "Tap a glowing green corner to build Cottage"
                    : "Tap a glowing Cottage to upgrade into a Town"}
              </span>
              <button
                type="button"
                onClick={() => setBuildMode("none")}
                className="rounded-full bg-oat-200 p-0.5 text-espresso hover:bg-oat-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Active Player-to-Player Trade Offer Pill */}
          {activeOffer && (
            <div className="absolute left-1/2 top-2.5 z-10 flex w-[94%] max-w-md -translate-x-1/2 flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-amberwarm-400 bg-oat-50/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
              <div className="min-w-0">
                <div className="font-extrabold text-espresso">
                  🤝 Trade from {activeOffer.fromName}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] font-bold text-espresso-soft">
                  <span>Offers:</span>
                  {RESOURCES.filter((r) => activeOffer.give[r] > 0).map((r) => (
                    <span
                      key={`g_${r}`}
                      className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800"
                    >
                      {activeOffer.give[r]} {RESOURCE_META[r].label}
                    </span>
                  ))}
                  <span>for</span>
                  {RESOURCES.filter((r) => activeOffer.want[r] > 0).map((r) => (
                    <span
                      key={`w_${r}`}
                      className="rounded bg-amberwarm-100 px-1.5 py-0.5 text-amberwarm-600"
                    >
                      {activeOffer.want[r]} {RESOURCE_META[r].label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {activeOffer.fromUserId === myUserId ? (
                  <button
                    type="button"
                    onClick={() => sendAction({ type: "CANCEL_TRADE" })}
                    className="rounded-xl bg-oat-200 px-2.5 py-1 text-[11px] font-extrabold text-espresso hover:bg-terracotta-100"
                  >
                    Cancel
                  </button>
                ) : canRespondOffer ? (
                  <>
                    <button
                      type="button"
                      disabled={!canAffordOffer}
                      onClick={() =>
                        sendAction({ type: "RESPOND_TRADE", tradeId: activeOffer.id, accept: true })
                      }
                      className="rounded-xl bg-emerald-600 px-2.5 py-1 text-[11px] font-extrabold text-white hover:bg-emerald-700 disabled:opacity-40"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        sendAction({
                          type: "RESPOND_TRADE",
                          tradeId: activeOffer.id,
                          accept: false,
                        })
                      }
                      className="rounded-xl bg-oat-200 px-2.5 py-1 text-[11px] font-extrabold text-espresso hover:bg-oat-300"
                    >
                      Decline
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </section>

        {/* RIGHT/BOTTOM PIONEER COMMAND PANEL */}
        <aside className="flex w-full shrink-0 flex-col gap-2 lg:w-[344px] lg:overflow-y-auto xl:w-[372px] short:w-[300px] short:gap-1.5 short:overflow-y-auto">
          {/* 1. YOUR HAND & HARBOR COMPASS */}
          {me && !isSpectator && (
            <section
              data-tour="hr-hand"
              className="rounded-2xl border-2 border-sage-300 bg-white/95 p-2.5 shadow-sm short:rounded-xl short:p-1.5"
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="font-display text-xs font-extrabold text-espresso short:text-[11px]">
                  Your Resources ({privateState?.totalVP ?? me.publicVP}/{publicState.targetVP} VP)
                </span>
                {compassReady ? (
                  <button
                    type="button"
                    onClick={() => setShowCompassPicker(true)}
                    className="inline-flex animate-pulse items-center gap-1 rounded-full bg-amberwarm-400 px-2.5 py-0.5 text-[10px] font-black text-espresso shadow-sm hover:bg-amberwarm-600 hover:text-white"
                  >
                    <Compass className="h-3 w-3" /> Claim +1 Any!
                  </button>
                ) : (
                  <span
                    title="Gain +1 Compass Charge on dry non-7 rolls. Redeem 3 Charges for any 1 resource!"
                    className="inline-flex items-center gap-1 rounded-full bg-oat-100 px-2 py-0.5 text-[10px] font-bold text-espresso-soft"
                  >
                    <Compass className="h-3 w-3 text-amberwarm-600" />
                    Compass {me.compassCharges}/{COMPASS_CHARGE_THRESHOLD}
                  </span>
                )}
              </div>

              <div className="mt-2 grid grid-cols-5 gap-1.5 short:mt-1 short:gap-1">
                {RESOURCES.map((r) => {
                  const meta = RESOURCE_META[r];
                  const rate = myRates[r];
                  return (
                    <div
                      key={r}
                      className="flex flex-col items-center rounded-xl border-2 px-1 py-1.5 text-center short:py-1"
                      style={{ backgroundColor: meta.softBg, borderColor: meta.border }}
                    >
                      <GameIcon name={harborResourceToIconName(r)} className="h-4 w-4 short:h-3.5 short:w-3.5" />
                      <span className="mt-0.5 text-xs font-black leading-none text-espresso">
                        {myResources[r]}
                      </span>
                      <span className="mt-0.5 text-[8.5px] font-extrabold leading-none" style={{ color: meta.text }}>
                        {meta.label}
                      </span>
                      <span className="mt-0.5 rounded bg-white/80 px-1 text-[8px] font-bold text-espresso-muted">
                        {rate}:1
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 2. TAP-SAFE BUILD & TRADE DOCK */}
          {me && !isSpectator && (
            <section
              data-tour="hr-build"
              className="rounded-2xl border-2 border-oat-300 bg-oat-50/95 p-2.5 shadow-sm short:rounded-xl short:p-1.5"
            >
              <div className="grid grid-cols-2 gap-1.5 short:gap-1">
                <button
                  type="button"
                  disabled={!canBuildRoad}
                  onClick={() => setBuildMode((m) => (m === "road" ? "none" : "road"))}
                  className={`flex flex-col items-start rounded-xl border-2 px-2.5 py-1.5 text-left transition short:px-2 short:py-1 ${
                    buildMode === "road"
                      ? "border-emerald-600 bg-emerald-100 shadow-sm"
                      : canBuildRoad
                        ? "border-sage-300 bg-white hover:border-emerald-500"
                        : "border-oat-200 bg-oat-100/70 opacity-50"
                  }`}
                >
                  <div className="flex w-full items-center justify-between text-[11px] font-extrabold text-espresso">
                    <span>Road</span>
                    <span className="text-[9.5px] font-bold text-espresso-muted">
                      {me.roadsRemaining} left
                    </span>
                  </div>
                  <span className="text-[9.5px] font-bold text-espresso-soft">1 Timber · 1 Clay</span>
                </button>

                <button
                  type="button"
                  disabled={!canBuildCottage}
                  onClick={() => setBuildMode((m) => (m === "cottage" ? "none" : "cottage"))}
                  className={`flex flex-col items-start rounded-xl border-2 px-2.5 py-1.5 text-left transition short:px-2 short:py-1 ${
                    buildMode === "cottage"
                      ? "border-emerald-600 bg-emerald-100 shadow-sm"
                      : canBuildCottage
                        ? "border-sage-300 bg-white hover:border-emerald-500"
                        : "border-oat-200 bg-oat-100/70 opacity-50"
                  }`}
                >
                  <div className="flex w-full items-center justify-between text-[11px] font-extrabold text-espresso">
                    <span>Cottage (+1)</span>
                    <span className="text-[9.5px] font-bold text-espresso-muted">
                      {me.cottagesRemaining} left
                    </span>
                  </div>
                  <span className="text-[9.5px] font-bold text-espresso-soft">1T · 1C · 1W · 1G</span>
                </button>

                <button
                  type="button"
                  disabled={!canUpgradeTown}
                  onClick={() => setBuildMode((m) => (m === "town" ? "none" : "town"))}
                  className={`flex flex-col items-start rounded-xl border-2 px-2.5 py-1.5 text-left transition short:px-2 short:py-1 ${
                    buildMode === "town"
                      ? "border-amberwarm-600 bg-amberwarm-100 shadow-sm"
                      : canUpgradeTown
                        ? "border-amberwarm-400/70 bg-white hover:border-amberwarm-600"
                        : "border-oat-200 bg-oat-100/70 opacity-50"
                  }`}
                >
                  <div className="flex w-full items-center justify-between text-[11px] font-extrabold text-espresso">
                    <span>Town (+2★)</span>
                    <span className="text-[9.5px] font-bold text-espresso-muted">
                      {me.townsRemaining} left
                    </span>
                  </div>
                  <span className="text-[9.5px] font-bold text-espresso-soft">2 Grain · 3 Ore</span>
                </button>

                <button
                  type="button"
                  disabled={!canBuyScroll}
                  onClick={() => sendAction({ type: "BUY_SCROLL" })}
                  className={`flex flex-col items-start rounded-xl border-2 px-2.5 py-1.5 text-left transition short:px-2 short:py-1 ${
                    canBuyScroll
                      ? "border-[#2B5096]/45 bg-white hover:border-[#2B5096]"
                      : "border-oat-200 bg-oat-100/70 opacity-50"
                  }`}
                >
                  <div className="flex w-full items-center justify-between text-[11px] font-extrabold text-espresso">
                    <span>Guild Scroll</span>
                    <span className="text-[9.5px] font-bold text-espresso-muted">
                      {publicState.scrollDeckCount} deck
                    </span>
                  </div>
                  <span className="text-[9.5px] font-bold text-espresso-soft">1W · 1G · 1O</span>
                </button>
              </div>

              {/* Trade + End Turn Row */}
              <div className="mt-2 flex items-center gap-1.5 short:mt-1.5">
                <button
                  type="button"
                  disabled={!isMyTurn || step !== "MAIN_PHASE"}
                  onClick={() => setShowTradeModal(true)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-amberwarm-400 bg-amberwarm-100 py-2 text-xs font-extrabold text-espresso shadow-sm transition hover:bg-amberwarm-400 disabled:opacity-40 short:py-1.5"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" /> Trade
                </button>
                <button
                  type="button"
                  disabled={!isMyTurn || step !== "MAIN_PHASE"}
                  onClick={() => sendAction({ type: "END_TURN" })}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-40 short:py-1.5"
                >
                  <Check className="h-3.5 w-3.5 stroke-[3]" /> End Turn
                </button>
              </div>
            </section>
          )}

          {/* 3. YOUR GUILD SCROLLS (always mounted so Quick Tour spotlight works on Turn 1) */}
          {me && !isSpectator && (
            <section
              data-tour="hr-scrolls"
              className="rounded-2xl border-2 border-oat-300 bg-oat-50/95 p-2 shadow-sm short:rounded-xl short:p-1.5"
            >
              <div className="mb-1 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wide text-espresso-soft">
                <span className="inline-flex items-center gap-1">
                  <ScrollText className="h-3 w-3" /> Your Guild Scrolls ({myScrolls.length})
                </span>
                <span className="text-[9.5px] font-bold normal-case text-espresso-muted">
                  1W · 1G · 1O
                </span>
              </div>
              {myScrolls.length === 0 ? (
                <p className="text-[10.5px] font-semibold text-espresso-muted">
                  Buy Guild Scrolls for Ranger Scouts, Road Builders, Harvest Plenty, Guild
                  Monopoly, or secret +1★ Landmark Charters.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {myScrolls.map((card) => {
                    const meta = SCROLL_META[card.kind];
                    const isVP = card.kind === "victory_point";
                    const canPlayNow =
                      isMyTurn &&
                      !isVP &&
                      !publicState.playedScrollThisTurn &&
                      card.boughtOnTurn < publicState.turnNumber &&
                      (step === "MAIN_PHASE" || (step === "ROLL_DICE" && card.kind === "knight"));

                    return (
                      <button
                        key={card.id}
                        type="button"
                        disabled={!canPlayNow}
                        onClick={() => handlePlayScrollClick(card)}
                        title={meta.description}
                        className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-[10px] font-extrabold transition ${
                          isVP
                            ? "border-amberwarm-400 bg-amberwarm-100 text-amberwarm-600"
                            : canPlayNow
                              ? "border-[#2B5096] bg-white text-espresso shadow-sm hover:bg-[#2B5096] hover:text-white"
                              : "border-oat-300 bg-oat-100 text-espresso-muted opacity-70"
                        }`}
                      >
                        <GameIcon name="hr-scroll" className="h-3.5 w-3.5" />
                        <span>{meta.title}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* 4. ISLAND PIONEERS & AWARDS */}
          <section
            data-tour="hr-players"
            className="rounded-2xl border-2 border-oat-300 bg-oat-50/95 p-2.5 shadow-sm short:rounded-xl short:p-1.5"
          >
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-espresso-soft">
                Island Pioneers
              </span>
              <span className="text-[10px] font-bold text-espresso-muted">
                Route 5+ (+2) · Watch 3+ (+2)
              </span>
            </div>
            <div className="space-y-1.5">
              {publicState.players.map((p) => {
                const isActive =
                  publicState.phase === "IN_PROGRESS" && publicState.activePlayerId === p.userId;
                const isMe = p.userId === myUserId;
                const isSubBot = botControlledUserIds.includes(p.userId);
                const colorMeta = getPlayerColorMeta(p.colorIndex);
                const shownVP =
                  p.finalVP !== null
                    ? p.finalVP
                    : isMe && privateState
                      ? privateState.totalVP
                      : p.publicVP;

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
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: colorMeta.hex }}
                        />
                        <span className="truncate text-xs font-extrabold text-espresso">
                          {p.displayName}
                          {isMe && <span className="ml-1 text-[10px] text-sage-700">(You)</span>}
                        </span>
                        {isSubBot && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-amberwarm-100 px-1 text-[9px] font-bold text-amberwarm-600">
                            <Bot className="h-2.5 w-2.5" /> Bot
                          </span>
                        )}
                      </div>
                      <span className="rounded-full bg-amberwarm-100 px-2 py-0.5 font-display text-xs font-black text-amberwarm-600">
                        {shownVP} VP
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] font-bold text-espresso-muted">
                      <span>{p.resourceCount} cards</span>
                      <span>·</span>
                      <span>{p.scrollCount} scrolls</span>
                      <span>·</span>
                      <span>Route {p.longestRoadLength}</span>
                      <span>·</span>
                      <span>Watch {p.knightsPlayed}</span>
                      {p.hasLongestRoad && (
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black text-emerald-800">
                          🛤️ Route +2
                        </span>
                      )}
                      {p.hasLargestWatch && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amberwarm-100 px-1.5 py-0.5 text-[9px] font-black text-amberwarm-600">
                          <Shield className="h-2.5 w-2.5" /> Watch +2
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 5. ISLAND CHRONICLE (Desktop) */}
          <section className="hidden min-h-0 flex-1 flex-col rounded-2xl border-2 border-oat-300 bg-oat-50/90 p-2.5 shadow-sm lg:flex">
            <span className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-espresso-soft">
              Island Chronicle
            </span>
            <div className="flex-1 space-y-1 overflow-y-auto pr-1 text-[11px]">
              {publicState.log.slice(0, 14).map((item) => (
                <div key={item.id} className="rounded-lg bg-white/80 px-2 py-1 leading-snug text-espresso-soft">
                  {item.text}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {/* ==================== 7-ROLL DISCARD MODAL ==================== */}
      {mustDiscard > 0 && !isSpectator && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-espresso/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border-2 border-terracotta-500 bg-oat-50 p-5 shadow-cozy">
            <h3 className="font-display text-lg font-extrabold text-espresso">
              🦊 Bandit Fox Prowls! Discard {mustDiscard} Cards
            </h3>
            <p className="mt-1 text-xs font-semibold text-espresso-soft">
              You hold more than 7 cards — pick <strong>{mustDiscard}</strong> to shed.
            </p>
            <div className="mt-3 grid grid-cols-5 gap-1.5">
              {RESOURCES.map((r) => {
                const meta = RESOURCE_META[r];
                return (
                  <div
                    key={r}
                    className="flex flex-col items-center rounded-xl border p-1.5"
                    style={{ backgroundColor: meta.softBg, borderColor: meta.border }}
                  >
                    <GameIcon name={harborResourceToIconName(r)} className="h-5 w-5" />
                    <span className="mt-1 text-[10px] font-black text-espresso">
                      {discardPool[r]}/{myResources[r]}
                    </span>
                    <div className="mt-1 flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleAdjustDiscard(r, -1)}
                        className="h-5 w-5 rounded bg-white text-xs font-black text-espresso shadow-sm"
                      >
                        −
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustDiscard(r, 1)}
                        className="h-5 w-5 rounded bg-terracotta-500 text-xs font-black text-white shadow-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              disabled={countResources(discardPool) !== mustDiscard}
              onClick={() => sendAction({ type: "DISCARD_RESOURCES", resources: discardPool })}
              className="mt-4 w-full rounded-2xl bg-terracotta-500 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-terracotta-700 disabled:opacity-40"
            >
              Discard {countResources(discardPool)}/{mustDiscard} Cards
            </button>
          </div>
        </div>
      )}

      {/* ==================== BANDIT STEAL VICTIM PICKER ==================== */}
      {pendingBanditHex !== null && banditVictimCandidates.length > 1 && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-espresso/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border-2 border-amberwarm-400 bg-oat-50 p-5 shadow-cozy">
            <h3 className="font-display text-base font-extrabold text-espresso">
              🦊 Choose Pioneer to Swipe 1 Card From
            </h3>
            <div className="mt-3 space-y-2">
              {banditVictimCandidates.map((p) => (
                <button
                  key={p.userId}
                  type="button"
                  onClick={() => {
                    sendAction({
                      type: "MOVE_BANDIT",
                      hexId: pendingBanditHex,
                      stealFromUserId: p.userId,
                    });
                    setPendingBanditHex(null);
                  }}
                  className="flex w-full items-center justify-between rounded-2xl border-2 border-oat-300 bg-white px-4 py-2.5 text-sm font-extrabold text-espresso hover:border-terracotta-500 hover:bg-terracotta-100/50"
                >
                  <span>{p.displayName}</span>
                  <span className="text-xs text-espresso-muted">{p.resourceCount} cards</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== COMPASS REDEEM PICKER ==================== */}
      {showCompassPicker && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-espresso/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border-2 border-amberwarm-400 bg-oat-50 p-5 shadow-cozy">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-extrabold text-espresso">
                🧭 Redeem Harbor Compass (+1 Any)
              </h3>
              <button
                type="button"
                onClick={() => setShowCompassPicker(false)}
                className="rounded-lg p-1 text-espresso-soft hover:bg-oat-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-1.5">
              {RESOURCES.map((r) => {
                const meta = RESOURCE_META[r];
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      sendAction({ type: "REDEEM_COMPASS", receive: r });
                      setShowCompassPicker(false);
                    }}
                    className="flex flex-col items-center rounded-xl border-2 p-2 transition hover:-translate-y-0.5 hover:shadow-md"
                    style={{ backgroundColor: meta.softBg, borderColor: meta.border }}
                  >
                    <GameIcon name={harborResourceToIconName(r)} className="h-6 w-6" />
                    <span className="mt-1 text-[10px] font-black" style={{ color: meta.text }}>
                      {meta.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== PLENTY / MONOPOLY SCROLL MODAL ==================== */}
      {pendingScrollModal && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-espresso/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border-2 border-[#2B5096] bg-oat-50 p-5 shadow-cozy">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-extrabold text-espresso">
                {SCROLL_META[pendingScrollModal.kind].title}
              </h3>
              <button
                type="button"
                onClick={() => setPendingScrollModal(null)}
                className="rounded-lg p-1 text-espresso-soft hover:bg-oat-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs font-semibold text-espresso-soft">
              {SCROLL_META[pendingScrollModal.kind].description}
            </p>

            {pendingScrollModal.kind === "year_of_plenty" ? (
              <div className="mt-3 space-y-2.5">
                {([0, 1] as const).map((slot) => (
                  <div key={slot} className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-espresso">Resource #{slot + 1}:</span>
                    <div className="flex gap-1">
                      {RESOURCES.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() =>
                            setPlentyPick((prev) =>
                              slot === 0 ? [r, prev[1]] : [prev[0], r]
                            )
                          }
                          className={`rounded-lg border p-1.5 ${
                            plentyPick[slot] === r
                              ? "border-emerald-600 bg-emerald-100 ring-2 ring-emerald-400"
                              : "border-oat-300 bg-white"
                          }`}
                        >
                          <GameIcon name={harborResourceToIconName(r)} className="h-4 w-4" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    sendAction({
                      type: "PLAY_SCROLL",
                      scrollId: pendingScrollModal.id,
                      plentyResources: plentyPick,
                    });
                    setPendingScrollModal(null);
                  }}
                  className="w-full rounded-2xl bg-emerald-600 py-2 text-xs font-extrabold text-white hover:bg-emerald-700"
                >
                  Claim {RESOURCE_META[plentyPick[0]].label} &amp; {RESOURCE_META[plentyPick[1]].label}
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-5 gap-1.5">
                  {RESOURCES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setMonopolyPick(r)}
                      className={`flex flex-col items-center rounded-xl border-2 p-2 ${
                        monopolyPick === r
                          ? "border-emerald-600 bg-emerald-100"
                          : "border-oat-300 bg-white"
                      }`}
                    >
                      <GameIcon name={harborResourceToIconName(r)} className="h-5 w-5" />
                      <span className="mt-1 text-[9px] font-black">{RESOURCE_META[r].label}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    sendAction({
                      type: "PLAY_SCROLL",
                      scrollId: pendingScrollModal.id,
                      monopolyResource: monopolyPick,
                    });
                    setPendingScrollModal(null);
                  }}
                  className="w-full rounded-2xl bg-[#2B5096] py-2 text-xs font-extrabold text-white hover:brightness-110"
                >
                  Collect All {RESOURCE_META[monopolyPick].label}!
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== HARBOR BANK & PLAYER TRADE MODAL ==================== */}
      {showTradeModal && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-espresso/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border-2 border-amberwarm-400 bg-oat-50 p-5 shadow-cozy">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-extrabold text-espresso">
                Harbor &amp; Pioneer Trade
              </h3>
              <button
                type="button"
                onClick={() => setShowTradeModal(false)}
                className="rounded-lg p-1 text-espresso-soft hover:bg-oat-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-white p-1 text-xs font-extrabold shadow-sm">
              <button
                type="button"
                onClick={() => setTradeTab("bank")}
                className={`rounded-lg py-1.5 ${
                  tradeTab === "bank" ? "bg-amberwarm-400 text-espresso" : "text-espresso-soft"
                }`}
              >
                Harbor / Bank Swap
              </button>
              <button
                type="button"
                onClick={() => setTradeTab("player")}
                className={`rounded-lg py-1.5 ${
                  tradeTab === "player" ? "bg-sage-500 text-white" : "text-espresso-soft"
                }`}
              >
                Offer to Pioneers
              </button>
            </div>

            {tradeTab === "bank" ? (
              <div className="mt-3 space-y-3">
                <div>
                  <div className="mb-1 text-xs font-bold text-espresso-soft">
                    Give (using your best Harbor rate):
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {RESOURCES.map((r) => {
                      const rate = myRates[r];
                      const ok = myResources[r] >= rate;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setBankGive(r)}
                          className={`flex flex-col items-center rounded-xl border-2 p-1.5 ${
                            bankGive === r
                              ? "border-espresso bg-amberwarm-100"
                              : ok
                                ? "border-oat-300 bg-white"
                                : "border-oat-200 bg-oat-100 opacity-50"
                          }`}
                        >
                          <GameIcon name={harborResourceToIconName(r)} className="h-5 w-5" />
                          <span className="mt-0.5 text-[10px] font-black">
                            {myResources[r]}/{rate}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-xs font-bold text-espresso-soft">Receive (+1):</div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {RESOURCES.map((r) => (
                      <button
                        key={r}
                        type="button"
                        disabled={r === bankGive}
                        onClick={() => setBankReceive(r)}
                        className={`flex flex-col items-center rounded-xl border-2 p-1.5 disabled:opacity-35 ${
                          bankReceive === r
                            ? "border-emerald-600 bg-emerald-100"
                            : "border-oat-300 bg-white"
                        }`}
                      >
                        <GameIcon name={harborResourceToIconName(r)} className="h-5 w-5" />
                        <span className="mt-0.5 text-[9.5px] font-black">
                          {RESOURCE_META[r].label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={bankGive === bankReceive || myResources[bankGive] < myRates[bankGive]}
                  onClick={() => {
                    sendAction({ type: "BANK_TRADE", give: bankGive, receive: bankReceive });
                    setShowTradeModal(false);
                  }}
                  className="w-full rounded-2xl bg-emerald-600 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40"
                >
                  Swap {myRates[bankGive]} {RESOURCE_META[bankGive].label} → 1{" "}
                  {RESOURCE_META[bankReceive].label}
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div>
                  <div className="mb-1 text-xs font-bold text-espresso-soft">You Offer:</div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {RESOURCES.map((r) => (
                      <div key={r} className="flex flex-col items-center rounded-xl border border-oat-300 bg-white p-1.5">
                        <GameIcon name={harborResourceToIconName(r)} className="h-4 w-4" />
                        <span className="text-[10px] font-black">
                          {offerGive[r]}/{myResources[r]}
                        </span>
                        <div className="mt-0.5 flex gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setOfferGive((p) => ({ ...p, [r]: Math.max(0, p[r] - 1) }))
                            }
                            className="h-5 w-5 rounded bg-oat-200 text-xs font-black"
                          >
                            −
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setOfferGive((p) => ({
                                ...p,
                                [r]: Math.min(myResources[r], p[r] + 1),
                              }))
                            }
                            className="h-5 w-5 rounded bg-sage-500 text-xs font-black text-white"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-xs font-bold text-espresso-soft">You Request:</div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {RESOURCES.map((r) => (
                      <div key={r} className="flex flex-col items-center rounded-xl border border-oat-300 bg-white p-1.5">
                        <GameIcon name={harborResourceToIconName(r)} className="h-4 w-4" />
                        <span className="text-[10px] font-black">{offerWant[r]}</span>
                        <div className="mt-0.5 flex gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setOfferWant((p) => ({ ...p, [r]: Math.max(0, p[r] - 1) }))
                            }
                            className="h-5 w-5 rounded bg-oat-200 text-xs font-black"
                          >
                            −
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setOfferWant((p) => ({ ...p, [r]: Math.min(4, p[r] + 1) }))
                            }
                            className="h-5 w-5 rounded bg-amberwarm-400 text-xs font-black text-espresso"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={
                    countResources(offerGive) === 0 ||
                    countResources(offerWant) === 0 ||
                    RESOURCES.some((r) => offerGive[r] > 0 && offerWant[r] > 0)
                  }
                  onClick={() => {
                    sendAction({ type: "OFFER_TRADE", give: offerGive, want: offerWant });
                    setOfferGive(createEmptyResources());
                    setOfferWant(createEmptyResources());
                    setShowTradeModal(false);
                  }}
                  className="w-full rounded-2xl bg-sage-500 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-sage-700 disabled:opacity-40"
                >
                  Send Trade Offer to Table
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== SLIDE-OUT CHAT & QUICK LINES ==================== */}
      {showChat && (
        <div className="fixed bottom-3 right-3 z-[56] flex h-[340px] w-[300px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-3xl border-2 border-oat-300 bg-oat-50/95 shadow-cozy backdrop-blur">
          <div className="flex items-center justify-between border-b border-oat-200 bg-white px-3.5 py-2">
            <span className="font-display text-xs font-extrabold text-espresso">
              Harbor Table Chat
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
                Negotiate trades or cheer on lucky 6s &amp; 8s!
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
            {HARBOR_QUICK_LINES.map((line) => (
              <button
                key={line}
                type="button"
                onClick={() => roomRef.current?.send("game.quickBluff", { text: line })}
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
              placeholder="Offer a trade..."
              className="min-w-0 flex-1 rounded-xl border border-oat-300 bg-oat-50 px-2.5 py-1.5 text-xs font-medium text-espresso outline-none focus:border-sage-500"
            />
            <button type="submit" className="rounded-xl bg-sage-500 p-2 text-white hover:bg-sage-700">
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
              Ruler of Harborreach!
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
                    {p.score} VP
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
                onClick={() => onExitGame({ finished: true })}
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
        gameSlug="harborreach"
        open={showQuickTour}
        onClose={() => setShowQuickTour(false)}
        onOpenFullRules={() => {
          setShowQuickTour(false);
          onOpenTutorial();
        }}
      />
    </div>
  );
}
