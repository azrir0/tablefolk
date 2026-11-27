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
  Highlighter,
  LogOut,
  MessageCircle,
  RefreshCw,
  Scale,
  Send,
  Shuffle,
  Sparkles,
  Swords,
  X,
} from "lucide-react";
import {
  MASQUE_DEFINITIONS,
  OPENING_SWAP_ONLY_TURNS,
  VELVET_MASQUE_QUICK_BLUFFS,
  slotKey,
  slotsEqual,
  type MasqueId,
  type MasqueSlotRef,
  type VelvetMasqueAction,
  type VelvetMasqueEvent,
  type VelvetMasquePrivateState,
  type VelvetMasquePublicState,
} from "@tablefolk/game-velvet-masque";
import {
  getPlayerColorMeta,
  type BoardMarkerMode,
  type BoardMarkerStroke,
} from "@tablefolk/shared";
import { WS_BASE_URL, getStoredToken } from "@/lib/api";
import { hasCompletedQuickTour } from "@/lib/gameQuickTours";
import { soundEngine } from "@/lib/sound";
import { BoardMarkerLayer, BoardMarkerToolbar } from "./BoardMarkerLayer";
import { GameIcon, masqueToIconName } from "./GameIcons";
import { GameQuickTour } from "./GameQuickTour";
import { GuidedTutorialCoach } from "./GuidedTutorialCoach";
import { buildVelvetMasqueGuide } from "@/lib/guidedTutorials";
import { VelvetMasqueCardSvg } from "./VelvetMasqueCardSvg";

interface VelvetMasqueOverlayProps {
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
  count?: number;
  timestamp: number;
}

interface FlyingChatBubble {
  id: string;
  senderName: string;
  message: string;
  isQuickBluff: boolean;
  isMe: boolean;
  leftPct: number;
  topPct: number;
  comboCount: number;
}

interface CoinDeltaBadge {
  id: string;
  userId: string;
  delta: number;
}

function describeSlot(
  slot: MasqueSlotRef,
  nameOf: (uid: string) => string
): string {
  if (slot.kind === "PLAYER") return nameOf(slot.userId);
  return `Stage #${slot.stageIndex + 1}`;
}

function describeEvent(
  ev: VelvetMasqueEvent,
  nameOf: (uid: string) => string
): string {
  switch (ev.type) {
    case "CURTAIN_CLOSED":
      return "Curtain closed! Masks flipped face-down — let the bluffing begin!";
    case "PLAYER_PEEKED":
      return `${nameOf(ev.actorId)} secretly peeked at their own mask.`;
    case "CLOAK_SWAP_STARTED":
      return `${nameOf(ev.actorId)} pulled ${describeSlot(ev.slotA, nameOf)} & ${describeSlot(ev.slotB, nameOf)} under the Velvet Cloak...`;
    case "CLOAK_SWAP_RESOLVED":
      return `${nameOf(ev.actorId)} juggled ${describeSlot(ev.slotA, nameOf)} ↔ ${describeSlot(ev.slotB, nameOf)} — swapped or bluffed?`;
    case "MASK_ANNOUNCED": {
      const m = MASQUE_DEFINITIONS[ev.maskId];
      return `${nameOf(ev.announcerId)} announced: "I am the ${m.name}!"`;
    }
    case "CHALLENGE_DECLARED": {
      const m = MASQUE_DEFINITIONS[ev.maskId];
      return `${nameOf(ev.challengerId)} challenged! "No, I'm the ${m.name}!"`;
    }
    case "CLAIM_UNCHALLENGED": {
      const m = MASQUE_DEFINITIONS[ev.maskId];
      return `Nobody challenged ${nameOf(ev.announcerId)}'s ${m.name} claim!`;
    }
    case "SHOWDOWN_RESOLVED": {
      const m = MASQUE_DEFINITIONS[ev.showdown.announcedMaskId];
      if (ev.showdown.winnerId) {
        return `SHOWDOWN! ${nameOf(ev.showdown.winnerId)} truly held the ${m.name}!`;
      }
      return `SHOWDOWN! Nobody held the ${m.name} — everyone pays a Fine!`;
    }
    case "COINS_CHANGED":
      return ev.reason;
    case "PATRON_PEEKED":
      return `${nameOf(ev.executorId)} used Patron's sight on ${describeSlot(ev.target, nameOf)}!`;
    case "MATCH_ENDED":
      return ev.reason;
  }
}

interface MasqueChatPanelProps {
  recentEvents: VelvetMasqueEvent[];
  nameOf: (uid: string) => string;
  chatLog: GameChatEntry[];
  chatInput: string;
  onChatInputChange: (val: string) => void;
  onQuickBluff: (pill: string) => void;
  onSendChat: () => void;
}

function MasqueChatPanel({
  recentEvents,
  nameOf,
  chatLog,
  chatInput,
  onChatInputChange,
  onQuickBluff,
  onSendChat,
}: MasqueChatPanelProps) {
  return (
    <>
      {/* Gala Chronicle */}
      <div className="max-h-36 shrink-0 space-y-1 overflow-y-auto border-b border-oat-200 px-3 py-2 text-[11px] font-medium text-espresso-soft sm:max-h-44">
        {recentEvents.length === 0 && (
          <div className="text-espresso-muted">Study the Masks while the curtain is up!</div>
        )}
        {[...recentEvents].reverse().map((ev, i) => (
          <div key={i} className="rounded-lg bg-oat-100 px-2 py-1 leading-snug">
            {describeEvent(ev, nameOf)}
          </div>
        ))}
      </div>

      {/* Quick Bluff Pills */}
      <div className="shrink-0 border-b border-oat-200 px-3 py-2">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-espresso-muted">
          Quick Table Bluff
        </div>
        <div className="flex flex-wrap gap-1">
          {VELVET_MASQUE_QUICK_BLUFFS.map((pill) => (
            <button
              key={pill}
              type="button"
              onClick={() => onQuickBluff(pill)}
              className="rounded-full bg-oat-200 px-2 py-0.5 text-[10px] font-bold text-espresso transition hover:bg-amberwarm-100 active:scale-95"
            >
              {pill}
            </button>
          ))}
        </div>
      </div>

      {/* Live Chat */}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-2 text-xs">
        {chatLog.length === 0 && (
          <div className="text-center text-[11px] text-espresso-muted">
            Bluff, accuse &amp; laugh in table chat!
          </div>
        )}
        {chatLog.map((m) => (
          <div
            key={m.id}
            className={`flex items-start justify-between gap-1.5 rounded-xl px-2.5 py-1.5 ${
              m.senderUserId === "system"
                ? "border border-amberwarm-400/50 bg-amberwarm-100/90 font-semibold"
                : "bg-oat-100"
            }`}
          >
            <div className="min-w-0">
              {m.senderUserId !== "system" && (
                <span className="font-bold text-sage-700">
                  {m.isSpectator && (
                    <Eye className="mr-0.5 inline h-3 w-3 align-text-bottom text-espresso-soft" />
                  )}
                  {m.senderName}:{" "}
                </span>
              )}
              <span className="text-espresso">{m.message}</span>
            </div>
            {(m.count ?? 1) > 1 && (
              <span className="shrink-0 rounded-full bg-amberwarm-400 px-1.5 py-0.5 text-[10px] font-black text-espresso shadow-sm">
                ×{m.count}
              </span>
            )}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSendChat();
        }}
        className="flex shrink-0 gap-1.5 border-t border-oat-200 p-2.5"
      >
        <input
          value={chatInput}
          onChange={(e) => onChatInputChange(e.target.value)}
          placeholder="Say something suspicious..."
          maxLength={200}
          className="flex-1 rounded-xl border border-oat-300 bg-white px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-sage-500"
        />
        <button
          type="submit"
          className="rounded-xl bg-sage-500 p-2 text-white hover:bg-sage-700"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </>
  );
}

export function VelvetMasqueOverlay({
  gameRoomId,
  myUserId,
  tutorialMode = false,
  onExitGame,
  onOpenTutorial,
}: VelvetMasqueOverlayProps) {
  const roomRef = useRef<Room | null>(null);
  const [pub, setPub] = useState<VelvetMasquePublicState | null>(null);
  const [priv, setPriv] = useState<VelvetMasquePrivateState | null>(null);
  const [botControlledUserIds, setBotControlledUserIds] = useState<string[]>([]);
  const [rematchVotes, setRematchVotes] = useState<string[]>([]);
  const [connectedHumanCount, setConnectedHumanCount] = useState(1);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [connState, setConnState] = useState<
    "connecting" | "connected" | "reconnecting" | "error"
  >("connecting");
  const [turnEndsAt, setTurnEndsAt] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());

  // UI controls + Board Marker
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [markers, setMarkers] = useState<BoardMarkerStroke[]>([]);
  const [markerMode, setMarkerMode] = useState(false);
  const [markerDrawMode, setMarkerDrawMode] = useState<BoardMarkerMode>("fade");

  // Local turn interaction mode (for Turn 3+ CHOOSE_ACTION & Jester 2-slot pick)
  const [actionMode, setActionMode] = useState<"announce" | "swap">("announce");
  const [jesterFirstSlot, setJesterFirstSlot] = useState<MasqueSlotRef | null>(null);

  // Timed theatrical visuals
  const [activePeek, setActivePeek] = useState<{
    id: string;
    slot: MasqueSlotRef;
    maskId: MasqueId;
    reason: "SELF_PEEK" | "PATRON_PEEK" | "SMUGGLER_PEEK";
  } | null>(null);
  const lastSeenPeekIdRef = useRef<string>("");

  const [cloakAnim, setCloakAnim] = useState<{
    id: string;
    actorName: string;
    labelA: string;
    labelB: string;
  } | null>(null);
  const [privateSwapNote, setPrivateSwapNote] = useState<string | null>(null);
  const lastSeenSwapTurnRef = useRef<number>(0);

  const [coinDeltas, setCoinDeltas] = useState<CoinDeltaBadge[]>([]);
  const [actionBanner, setActionBanner] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Match-end reveal staging: show all final masks on table for 3.2s BEFORE modal
  const [endModalStage, setEndModalStage] = useState<
    "hidden" | "revealing" | "modal" | "inspecting"
  >("hidden");
  const [endRevealEndsAt, setEndRevealEndsAt] = useState(0);
  const endRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPhaseRef = useRef<VelvetMasquePublicState["phase"] | null>(null);

  // Chat & flying bubbles
  const [chatLog, setChatLog] = useState<GameChatEntry[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [flyingChatBubbles, setFlyingChatBubbles] = useState<FlyingChatBubble[]>([]);

  const latestPubRef = useRef<VelvetMasquePublicState | null>(null);
  const prevActiveIdRef = useRef("");
  const prevSessionIdRef = useRef("");
  const mobileChatOpenRef = useRef(false);
  const onExitGameRef = useRef(onExitGame);
  const manualReconnectRef = useRef<(() => void) | null>(null);
  const chatBubbleSeqRef = useRef(0);
  const chatBubbleTimersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const quickComboRef = useRef(new Map<string, { count: number; lastAt: number }>());
  const lastBubbleSoundAtRef = useRef(0);

  latestPubRef.current = pub;
  mobileChatOpenRef.current = mobileChatOpen;
  onExitGameRef.current = onExitGame;

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const timers = chatBubbleTimersRef.current;
    return () => {
      for (const t of timers) clearTimeout(t);
      timers.clear();
    };
  }, []);

  const spawnChatBubble = useCallback((msg: GameChatEntry, localUserId: string) => {
    if (msg.senderUserId === "system") return;
    const seq = ++chatBubbleSeqRef.current;
    const now = Date.now();

    let comboCount = 1;
    if (msg.isQuickBluff) {
      const key = `${msg.senderUserId}::${msg.message}`;
      const prev = quickComboRef.current.get(key);
      comboCount = prev && now - prev.lastAt < 6500 ? prev.count + 1 : 1;
      quickComboRef.current.set(key, { count: comboCount, lastAt: now });
    }

    const xLanes = [50, 24, 76, 36, 64, 19, 81, 43, 57, 29, 71, 47, 53];
    const yLanes = [46, 35, 57, 40, 52, 32, 62, 44, 54, 38, 60, 48, 36];
    const jitterX = ((seq * 7) % 7) - 3;
    const jitterY = ((seq * 5) % 5) - 2;
    const leftPct = Math.min(84, Math.max(16, xLanes[seq % xLanes.length]! + jitterX));
    const topPct = Math.min(66, Math.max(30, yLanes[seq % yLanes.length]! + jitterY));

    const id = `vmcb_${seq}_${now}`;
    const bubble: FlyingChatBubble = {
      id,
      senderName: msg.isSpectator ? `[Spec] ${msg.senderName}` : msg.senderName,
      message: msg.message,
      isQuickBluff: Boolean(msg.isQuickBluff),
      isMe: msg.senderUserId === localUserId,
      leftPct,
      topPct,
      comboCount,
    };

    setFlyingChatBubbles((prev) => [...prev.slice(-17), bubble]);
    if (
      msg.senderUserId !== localUserId &&
      !mobileChatOpenRef.current &&
      now - lastBubbleSoundAtRef.current > 240
    ) {
      lastBubbleSoundAtRef.current = now;
      soundEngine.playEmotePop();
    }

    const timer = setTimeout(() => {
      chatBubbleTimersRef.current.delete(timer);
      setFlyingChatBubbles((prev) => prev.filter((b) => b.id !== id));
    }, 3250);
    chatBubbleTimersRef.current.add(timer);
  }, []);

  const animateEvents = useCallback(
    (events: VelvetMasqueEvent[], state: VelvetMasquePublicState) => {
      const lookupName = (uid: string) =>
        state.players.find((p) => p.userId === uid)?.displayName ?? "Guest";

      for (const ev of events) {
        if (ev.type === "CURTAIN_CLOSED") {
          soundEngine.playCountdownGo();
          setActionBanner(describeEvent(ev, lookupName));
        } else if (ev.type === "CLOAK_SWAP_RESOLVED") {
          soundEngine.playCardDiscard();
          const id = `clk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          setCloakAnim({
            id,
            actorName: lookupName(ev.actorId),
            labelA: describeSlot(ev.slotA, lookupName),
            labelB: describeSlot(ev.slotB, lookupName),
          });
          setTimeout(() => {
            setCloakAnim((cur) => (cur?.id === id ? null : cur));
          }, 2100);
          setActionBanner(describeEvent(ev, lookupName));
        } else if (ev.type === "MASK_ANNOUNCED") {
          soundEngine.playEmotePop();
          setActionBanner(describeEvent(ev, lookupName));
        } else if (ev.type === "CHALLENGE_DECLARED") {
          soundEngine.playHazard();
          setActionBanner(describeEvent(ev, lookupName));
        } else if (ev.type === "SHOWDOWN_RESOLVED") {
          if (ev.showdown.winnerId) soundEngine.playVictory();
          else soundEngine.playDecoyReveal();
          setActionBanner(describeEvent(ev, lookupName));
        } else if (ev.type === "COINS_CHANGED") {
          if (ev.deltas.length > 0) {
            const batch = ev.deltas.map((d, i) => ({
              id: `cd_${Date.now()}_${i}_${d.userId}`,
              userId: d.userId,
              delta: d.delta,
            }));
            setCoinDeltas((prev) => [...prev, ...batch]);
            setTimeout(() => {
              const ids = new Set(batch.map((b) => b.id));
              setCoinDeltas((prev) => prev.filter((x) => !ids.has(x.id)));
            }, 2300);
          }
          setActionBanner(ev.reason);
        } else if (ev.type === "PLAYER_PEEKED" || ev.type === "PATRON_PEEKED") {
          soundEngine.playSpyglass();
          setActionBanner(describeEvent(ev, lookupName));
        } else if (ev.type === "MATCH_ENDED") {
          soundEngine.playVictory();
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!actionBanner) return;
    const t = setTimeout(() => setActionBanner(null), 3400);
    return () => clearTimeout(t);
  }, [actionBanner]);

  // Trigger 4-second private card peek whenever a new private peek record arrives!
  useEffect(() => {
    const pk = priv?.latestPeek;
    if (!pk || pk.id === lastSeenPeekIdRef.current) return;
    lastSeenPeekIdRef.current = pk.id;
    setActivePeek(pk);
    soundEngine.playSpyglass();
    const t = setTimeout(() => {
      setActivePeek((cur) => (cur?.id === pk.id ? null : cur));
    }, 4200);
    return () => clearTimeout(t);
  }, [priv?.latestPeek]);

  // Brief private confirmation note for the player who performed a Cloak Swap!
  useEffect(() => {
    const sw = priv?.latestSwap;
    if (!sw || sw.turnNumber === lastSeenSwapTurnRef.current) return;
    lastSeenSwapTurnRef.current = sw.turnNumber;
    setPrivateSwapNote(
      sw.actuallySwap
        ? "Private: You ACTUALLY SWAPPED those two masks!"
        : "Private: FAKE SWAP — masks stayed where they were!"
    );
    const t = setTimeout(() => setPrivateSwapNote(null), 3200);
    return () => clearTimeout(t);
  }, [priv?.latestSwap]);

  // Reset Jester 1st selection if step leaves RESOLVE_POWER
  useEffect(() => {
    if (pub?.step !== "RESOLVE_POWER" || pub.pendingPower?.maskId !== "jester") {
      setJesterFirstSlot(null);
    }
  }, [pub?.step, pub?.pendingPower?.maskId]);

  // Connect to Colyseus VelvetMasqueRoom
  useEffect(() => {
    let disposed = false;
    let connectSeq = 0;
    let reconnectAttempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let syncWatchdog: ReturnType<typeof setTimeout> | null = null;
    let lastWakeCheckAt = 0;

    const clearTimers = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (syncWatchdog) {
        clearTimeout(syncWatchdog);
        syncWatchdog = null;
      }
    };

    const scheduleReconnect = () => {
      if (disposed) return;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      const delayMs = [750, 1500, 3000, 5000, 7000][Math.min(reconnectAttempt, 4)]!;
      reconnectAttempt += 1;
      setConnState("reconnecting");
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void connect(true);
      }, delayMs);
    };

    const connect = async (isReconnect: boolean) => {
      const token = getStoredToken();
      if (!token || disposed) return;

      clearTimers();
      const mySeq = ++connectSeq;
      setConnState(isReconnect ? "reconnecting" : "connecting");

      if (roomRef.current) {
        const old = roomRef.current;
        roomRef.current = null;
        try {
          await old.leave();
        } catch {
          // ignore
        }
      }

      try {
        const client = new ColyseusClient(WS_BASE_URL);
        const room = await client.joinById(gameRoomId, { token });

        if (disposed || mySeq !== connectSeq) {
          void room.leave();
          return;
        }

        roomRef.current = room;
        reconnectAttempt = 0;
        setConnState("connected");

        room.onMessage(
          "game.publicState",
          (payload: {
            sessionId?: string;
            state: VelvetMasquePublicState;
            turnEndsAt: number;
            botControlledUserIds?: string[];
            rematchVotes?: string[];
            connectedHumanCount?: number;
            spectatorCount?: number;
            events?: VelvetMasqueEvent[];
          }) => {
            if (syncWatchdog) {
              clearTimeout(syncWatchdog);
              syncWatchdog = null;
            }
            setConnState("connected");
            if (payload.sessionId) {
              if (prevSessionIdRef.current && prevSessionIdRef.current !== payload.sessionId) {
                lastSeenPeekIdRef.current = "";
                lastSeenSwapTurnRef.current = 0;
                setActivePeek(null);
                setPrivateSwapNote(null);
              }
              prevSessionIdRef.current = payload.sessionId;
            }

            setPub(payload.state);
            setTurnEndsAt(payload.turnEndsAt);
            if (Array.isArray(payload.botControlledUserIds)) {
              setBotControlledUserIds(payload.botControlledUserIds);
            }
            if (Array.isArray(payload.rematchVotes)) {
              setRematchVotes(payload.rematchVotes);
            }
            if (typeof payload.connectedHumanCount === "number") {
              setConnectedHumanCount(payload.connectedHumanCount);
            }
            if (typeof payload.spectatorCount === "number") {
              setSpectatorCount(payload.spectatorCount);
            }

            const evs = payload.events ?? [];
            const nextPhase = payload.state.phase;
            if (nextPhase !== "COMPLETED") {
              if (endRevealTimerRef.current) {
                clearTimeout(endRevealTimerRef.current);
                endRevealTimerRef.current = null;
              }
              setEndModalStage("hidden");
              setEndRevealEndsAt(0);
            } else {
              const justEnded =
                prevPhaseRef.current === "IN_PROGRESS" ||
                evs.some((e) => e.type === "MATCH_ENDED");
              if (justEnded) {
                setMarkerMode(false);
                if (endRevealTimerRef.current) clearTimeout(endRevealTimerRef.current);
                const REVEAL_MS = 3500;
                setEndModalStage("revealing");
                setEndRevealEndsAt(Date.now() + REVEAL_MS);
                endRevealTimerRef.current = setTimeout(() => {
                  endRevealTimerRef.current = null;
                  setEndModalStage((cur) => (cur === "revealing" ? "modal" : cur));
                }, REVEAL_MS);
              } else if (prevPhaseRef.current === null) {
                setEndModalStage("modal");
              }
            }
            prevPhaseRef.current = nextPhase;

            if (evs.length > 0) {
              requestAnimationFrame(() => {
                animateEvents(evs, payload.state);
              });
            }

            if (
              payload.state.phase === "IN_PROGRESS" &&
              payload.state.step === "CHOOSE_ACTION" &&
              payload.state.activePlayerId === myUserId &&
              prevActiveIdRef.current !== myUserId
            ) {
              soundEngine.playTurnChime();
            }
            prevActiveIdRef.current = payload.state.activePlayerId;
          }
        );

        room.onMessage("game.privateState", (p: VelvetMasquePrivateState) => {
          setPriv(p);
        });

        room.onMessage("game.markersSync", (list: BoardMarkerStroke[]) => {
          if (Array.isArray(list)) setMarkers(list);
        });

        room.onMessage("game.markerAdded", (stroke: BoardMarkerStroke) => {
          if (!stroke?.id) return;
          setMarkers((prev) => [...prev.slice(-34), stroke]);
        });

        room.onMessage(
          "game.markersCleared",
          (p: { scope?: "mine" | "all"; userId?: string }) => {
            if (p?.scope === "all") setMarkers([]);
            else if (p?.userId) {
              setMarkers((prev) => prev.filter((m) => m.userId !== p.userId));
            }
          }
        );

        room.onMessage(
          "game.actionRejected",
          (err: { code: string; message: string }) => {
            setErrorToast(err.message);
            setTimeout(() => setErrorToast(null), 3400);
          }
        );

        room.onMessage("game.chatReceived", (msg: GameChatEntry) => {
          spawnChatBubble(msg, myUserId);
          setChatLog((prev) => {
            if (msg.isQuickBluff && msg.senderUserId !== "system") {
              const existingIdx = [...prev]
                .reverse()
                .findIndex(
                  (entry) =>
                    entry.isQuickBluff &&
                    entry.senderUserId === msg.senderUserId &&
                    entry.message === msg.message
                );
              if (existingIdx !== -1) {
                const realIdx = prev.length - 1 - existingIdx;
                const next = [...prev];
                const existing = next[realIdx]!;
                next[realIdx] = {
                  ...existing,
                  count: (existing.count ?? 1) + 1,
                  timestamp: msg.timestamp,
                };
                return next;
              }
            }
            return [...prev.slice(-39), { ...msg, count: 1 }];
          });

          if (!mobileChatOpenRef.current && msg.senderUserId !== myUserId) {
            setUnreadChatCount((c) => c + 1);
          }
        });

        room.onLeave(() => {
          if (disposed || mySeq !== connectSeq) return;
          roomRef.current = null;
          if (latestPubRef.current?.phase === "COMPLETED") return;
          scheduleReconnect();
        });
      } catch (err) {
        if (disposed || mySeq !== connectSeq) return;
        const msg = (err as Error)?.message ?? "";
        const isGone = /not found|expired|404/i.test(msg);
        if (isGone) {
          onExitGameRef.current({
            finished: true,
            notice: "That Velvet Masque gala has already ended — welcome back to the café!",
          });
          return;
        }
        if (reconnectAttempt < 5) {
          scheduleReconnect();
        } else {
          setConnState("error");
          setErrorToast(msg || "Could not connect to Velvet Masque.");
        }
      }
    };

    manualReconnectRef.current = () => {
      reconnectAttempt = 0;
      void connect(true);
    };

    void connect(false);

    const handleResume = () => {
      if (disposed || document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastWakeCheckAt < 1200) return;
      lastWakeCheckAt = now;

      const current = roomRef.current;
      if (!current) {
        reconnectAttempt = 0;
        void connect(true);
        return;
      }
      try {
        current.send("game.sync");
        if (syncWatchdog) clearTimeout(syncWatchdog);
        syncWatchdog = setTimeout(() => {
          if (disposed) return;
          reconnectAttempt = 0;
          void connect(true);
        }, 3500);
      } catch {
        reconnectAttempt = 0;
        void connect(true);
      }
    };

    document.addEventListener("visibilitychange", handleResume);
    window.addEventListener("pageshow", handleResume);
    window.addEventListener("online", handleResume);

    return () => {
      disposed = true;
      connectSeq += 1;
      clearTimers();
      if (endRevealTimerRef.current) {
        clearTimeout(endRevealTimerRef.current);
        endRevealTimerRef.current = null;
      }
      manualReconnectRef.current = null;
      document.removeEventListener("visibilitychange", handleResume);
      window.removeEventListener("pageshow", handleResume);
      window.removeEventListener("online", handleResume);
      const current = roomRef.current;
      roomRef.current = null;
      void current?.leave();
    };
  }, [gameRoomId, myUserId, animateEvents, spawnChatBubble]);

  const myPublic = useMemo(
    () => pub?.players.find((p) => p.userId === myUserId) ?? null,
    [pub, myUserId]
  );
  const isSpectator = Boolean(pub && !myPublic);
  const myColorMeta = useMemo(
    () => getPlayerColorMeta(myPublic?.color ?? myPublic?.seatIndex ?? 0),
    [myPublic]
  );
  const myMarkerCount = useMemo(
    () => markers.filter((m) => m.userId === myUserId).length,
    [markers, myUserId]
  );

  useEffect(() => {
    if (pub && pub.phase !== "IN_PROGRESS") setMarkerMode(false);
  }, [pub]);

  const [showQuickTour, setShowQuickTour] = useState(false);
  const autoTourCheckedRef = useRef(false);

  // Auto-launch the 6-step spotlight tour once for first-time players right after Curtain Call closes
  useEffect(() => {
    if (
      autoTourCheckedRef.current ||
      !pub ||
      pub.phase !== "IN_PROGRESS" ||
      isSpectator ||
      tutorialMode ||
      pub.step === "CURTAIN_CALL"
    ) {
      return;
    }
    autoTourCheckedRef.current = true;
    if (!hasCompletedQuickTour("velvet-masque")) {
      const t = window.setTimeout(() => setShowQuickTour(true), 450);
      return () => window.clearTimeout(t);
    }
  }, [pub, isSpectator, tutorialMode]);

  const isOpeningSwapOnly = Boolean(
    pub && pub.step === "CHOOSE_ACTION" && pub.turnNumber <= OPENING_SWAP_ONLY_TURNS
  );
  const isMyChooseAction =
    !isSpectator &&
    pub?.phase === "IN_PROGRESS" &&
    pub.step === "CHOOSE_ACTION" &&
    pub.activePlayerId === myUserId;
  const isMyCloakChoice =
    !isSpectator &&
    pub?.phase === "IN_PROGRESS" &&
    pub.step === "RESOLVE_SWAP" &&
    pub.pendingSwap?.actorId === myUserId;
  const isMyPowerChoice =
    !isSpectator &&
    pub?.phase === "IN_PROGRESS" &&
    pub.step === "RESOLVE_POWER" &&
    pub.pendingPower?.executorId === myUserId;
  const myChallengeDecision =
    !isSpectator && pub?.step === "CHALLENGE_WINDOW" && pub.pendingClaim
      ? pub.pendingClaim.responses[myUserId]
      : undefined;
  const needsMyChallengeResponse =
    !isSpectator &&
    pub?.phase === "IN_PROGRESS" &&
    pub.step === "CHALLENGE_WINDOW" &&
    pub.pendingClaim?.announcerId !== myUserId &&
    myChallengeDecision === "PENDING";

  // Automatically switch to Swap tab on Opening Shuffle turns 1-2
  useEffect(() => {
    if (isOpeningSwapOnly) setActionMode("swap");
  }, [isOpeningSwapOnly]);

  function sendAction(action: VelvetMasqueAction) {
    roomRef.current?.send("game.action", action);
  }

  function nameOf(uid: string): string {
    return pub?.players.find((p) => p.userId === uid)?.displayName ?? "Guest";
  }

  const openEndModalNow = useCallback(() => {
    if (endRevealTimerRef.current) {
      clearTimeout(endRevealTimerRef.current);
      endRevealTimerRef.current = null;
    }
    setEndModalStage("modal");
  }, []);

  // Determine whether a given seat or Stage slot is currently tappable for our action/power
  function isSlotTargetable(slot: MasqueSlotRef): boolean {
    if (!pub || isSpectator || markerMode || pub.phase !== "IN_PROGRESS") return false;
    const isSelfSlot = slot.kind === "PLAYER" && slot.userId === myUserId;

    if (isMyChooseAction && (isOpeningSwapOnly || actionMode === "swap")) {
      return !isSelfSlot;
    }
    if (isMyPowerChoice && pub.pendingPower) {
      if (pub.pendingPower.maskId === "patron") return !isSelfSlot;
      if (pub.pendingPower.maskId === "illusionist") {
        return slot.kind === "PLAYER" && !isSelfSlot;
      }
      if (pub.pendingPower.maskId === "jester") {
        return !isSelfSlot;
      }
      if (pub.pendingPower.maskId === "taxmaster") {
        return (
          slot.kind === "PLAYER" &&
          Boolean(pub.pendingPower.eligibleTargetUserIds?.includes(slot.userId))
        );
      }
    }
    return false;
  }

  function handleSlotTap(slot: MasqueSlotRef) {
    if (!isSlotTargetable(slot) || !pub) return;

    if (isMyChooseAction && (isOpeningSwapOnly || actionMode === "swap")) {
      sendAction({ type: "INITIATE_SWAP", target: slot });
      return;
    }

    if (isMyPowerChoice && pub.pendingPower) {
      if (pub.pendingPower.maskId === "patron") {
        sendAction({ type: "RESOLVE_PATRON_PEEK", target: slot });
      } else if (
        pub.pendingPower.maskId === "illusionist" &&
        slot.kind === "PLAYER"
      ) {
        sendAction({ type: "RESOLVE_ILLUSIONIST_SWAP", targetUserId: slot.userId });
      } else if (
        pub.pendingPower.maskId === "taxmaster" &&
        slot.kind === "PLAYER"
      ) {
        sendAction({ type: "RESOLVE_TAXMASTER_TARGET", targetUserId: slot.userId });
      } else if (pub.pendingPower.maskId === "jester") {
        if (!jesterFirstSlot) {
          setJesterFirstSlot(slot);
        } else if (slotsEqual(jesterFirstSlot, slot)) {
          setJesterFirstSlot(null);
        } else {
          sendAction({
            type: "RESOLVE_JESTER_SELECT",
            slotA: jesterFirstSlot,
            slotB: slot,
          });
          setJesterFirstSlot(null);
        }
      }
    }
  }

  const secondsLeft = Math.max(0, Math.ceil((turnEndsAt - nowMs) / 1000));
  const endRevealSec = Math.max(0, Math.ceil((endRevealEndsAt - nowMs) / 1000));

  if (!pub) {
    return (
      <div className="fixed inset-0 z-40 flex h-[100dvh] items-center justify-center bg-[#230E16]/85 p-4 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-3xl border-2 border-amberwarm-400 bg-oat-50 px-7 py-6 text-center shadow-cozy">
          <div className="font-display text-xl font-bold text-espresso">
            {connState === "error"
              ? "Connection Interrupted"
              : connState === "reconnecting"
                ? "Rejoining Velvet Masque..."
                : "Drawing the Velvet Curtains..."}
          </div>
          <p className="mt-1 text-xs text-espresso-muted">
            {connState === "error"
              ? "Could not reach the gala server right now."
              : "Dealing secret Masks & setting out the Fine Box"}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            {connState === "error" && (
              <button
                type="button"
                onClick={() => manualReconnectRef.current?.()}
                className="rounded-xl bg-sage-500 px-4 py-2 text-xs font-bold text-white hover:bg-sage-700"
              >
                Retry
              </button>
            )}
            <button
              type="button"
              onClick={() => onExitGame({ finished: false })}
              className="rounded-xl bg-oat-200 px-4 py-2 text-xs font-bold text-espresso hover:bg-oat-300"
            >
              Back to Café
            </button>
          </div>
        </div>
      </div>
    );
  }

  const stepHeadline =
    pub.phase === "COMPLETED"
      ? "Final Curtain!"
      : pub.step === "CURTAIN_CALL"
        ? `Memorize Masks · ${secondsLeft}s`
        : pub.step === "CHALLENGE_WINDOW" && pub.pendingClaim
          ? `Challenge ${MASQUE_DEFINITIONS[pub.pendingClaim.maskId].name}? · ${secondsLeft}s`
          : pub.step === "RESOLVE_SWAP" && pub.pendingSwap
            ? `${nameOf(pub.pendingSwap.actorId)} Under Cloak · ${secondsLeft}s`
            : pub.step === "RESOLVE_POWER" && pub.pendingPower
              ? `${nameOf(pub.pendingPower.executorId)} Using ${MASQUE_DEFINITIONS[pub.pendingPower.maskId].name} · ${secondsLeft}s`
              : isMyChooseAction
                ? `Your Turn · ${secondsLeft}s`
                : `${nameOf(pub.activePlayerId)} · ${secondsLeft}s`;

  const gridColsClass =
    pub.players.length <= 3
      ? "grid-cols-3"
      : pub.players.length <= 4
        ? "grid-cols-2 sm:grid-cols-4"
        : pub.players.length <= 6
          ? "grid-cols-2 sm:grid-cols-3"
          : "grid-cols-2 sm:grid-cols-4";

  return (
    <div className="fixed inset-0 z-40 flex h-[100dvh] flex-col overflow-hidden bg-[#261119] text-espresso">
      {/* Compact Theatrical Header */}
      <header
        data-tour="vm-header"
        className="shrink-0 border-b border-oat-300/20 bg-oat-50 px-2.5 py-1.5 shadow-sm sm:px-4 sm:py-2.5 short:px-2.5 short:py-1"
      >
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2 short:gap-1.5">
            <div className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap font-display text-lg font-bold text-espresso sm:flex short:text-sm">
              <GameIcon name="game-masque" className="h-5 w-5 short:h-4 short:w-4" />
              Velvet Masque
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-amberwarm-100 px-2 py-0.5 text-[10px] font-bold text-amberwarm-600 sm:px-2.5 sm:text-xs short:px-2 short:text-[10px]">
              <GameIcon name="trophy" className="h-3.5 w-3.5" />
              {pub.config.targetCoins}g Goal
            </span>
            <span className="hidden shrink-0 whitespace-nowrap rounded-full bg-oat-200 px-2 py-0.5 text-[10px] font-bold text-espresso-soft md:inline-block sm:text-xs short:hidden">
              Turn {pub.turnNumber}/{pub.maxTurns}
            </span>
            <span
              className={`truncate whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-extrabold sm:px-3 sm:text-xs short:shrink-0 short:px-2 short:text-[11px] ${
                needsMyChallengeResponse || isMyCloakChoice || isMyPowerChoice
                  ? "animate-pulse bg-terracotta-500 text-white"
                  : isMyChooseAction
                    ? "animate-pulse bg-sage-500 text-white"
                    : pub.step === "CURTAIN_CALL"
                      ? "bg-amberwarm-400 text-espresso"
                      : "bg-oat-200 text-espresso"
              }`}
            >
              {stepHeadline}
            </span>
            {isSpectator && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-espresso px-2 py-0.5 text-[10px] font-extrabold text-amberwarm-400 sm:px-2.5 sm:text-xs">
                <Eye className="h-3 w-3" /> Spectating
              </span>
            )}
            {spectatorCount > 0 && (
              <span
                title={`${spectatorCount} spectator${spectatorCount === 1 ? "" : "s"} watching`}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-oat-200 px-2 py-0.5 text-[10px] font-bold text-espresso-soft sm:text-xs"
              >
                <Eye className="h-3 w-3 text-sage-700" /> {spectatorCount}
              </span>
            )}
          </div>

          <div
            data-tour="vm-tools"
            className="flex shrink-0 items-center gap-1 sm:gap-2 short:gap-1"
          >
            {!isSpectator && pub.phase === "IN_PROGRESS" && (
              <button
                type="button"
                onClick={() => setMarkerMode((v) => !v)}
                title="Draw or tap-ping on the table using your personal color!"
                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-xl px-2 py-1 text-[10px] font-extrabold shadow-sm transition sm:px-2.5 sm:py-1.5 sm:text-xs short:px-2 short:py-1 short:text-[11px] ${
                  markerMode
                    ? "bg-amberwarm-400 text-espresso ring-2 ring-amberwarm-600"
                    : "bg-oat-200 text-espresso hover:bg-amberwarm-100"
                }`}
              >
                <span
                  style={{ backgroundColor: myColorMeta.hex }}
                  className="h-2.5 w-2.5 shrink-0 rounded-full border border-white shadow-sm"
                />
                <Highlighter className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{markerMode ? "Drawing" : "Mark"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setMobileChatOpen(true);
                setUnreadChatCount(0);
              }}
              aria-label="Table Chat & Log"
              className="relative inline-flex items-center justify-center rounded-xl bg-oat-200 p-1.5 text-espresso hover:bg-oat-300 lg:hidden short:p-1"
            >
              <MessageCircle className="h-4 w-4" />
              {unreadChatCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-terracotta-500 px-1 text-[9px] font-extrabold text-white">
                  {unreadChatCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowQuickTour(true)}
              aria-label="Quick Tour"
              title="Step-by-step spotlight tour of Velvet Masque"
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl bg-sage-100 p-1.5 text-xs font-extrabold text-sage-700 hover:bg-sage-300/60 sm:px-2.5 sm:py-1.5 short:px-2 short:py-1 short:text-[11px]"
            >
              <Compass className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tour</span>
            </button>

            <button
              type="button"
              onClick={onOpenTutorial}
              aria-label="Rules"
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl bg-oat-200 p-1.5 text-xs font-bold text-espresso hover:bg-oat-300 sm:px-3 sm:py-1.5 short:px-2 short:py-1 short:text-[11px]"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Rules</span>
            </button>

            <button
              type="button"
              onClick={() => onExitGame({ finished: pub.phase === "COMPLETED" })}
              aria-label="Back to Café"
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl bg-oat-200 p-1.5 text-xs font-bold text-espresso hover:bg-terracotta-100 hover:text-terracotta-700 sm:px-3 sm:py-1.5 short:px-2 short:py-1 short:text-[11px]"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline short:hidden">Back to Café</span>
              <span className="hidden short:inline">Café</span>
            </button>
          </div>
        </div>
      </header>

      {/* Responsive Workspace: Stacked on Portrait/Desktop, Handheld Split (Salon Left + Gala Actions Right) in Mobile Landscape! */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden short:flex-row">
      {/* Main Content Area: Velvet Salon Arena + Desktop Chronicle/Chat Sidebar */}
      <div className="grid min-h-0 flex-1 gap-2 overflow-hidden p-2 sm:gap-3 sm:p-3 lg:grid-cols-12 short:gap-1.5 short:p-1.5">
        <div className="flex min-h-0 flex-col gap-1.5 overflow-hidden sm:gap-2 lg:col-span-9 short:gap-1">
          {/* Active Mask Roster Quick Reference Ribbon */}
          <div
            data-tour="vm-roster"
            className="flex shrink-0 items-center gap-1.5 overflow-x-auto pb-0.5 text-[10px] font-bold short:gap-1 short:pb-0 short:text-[9.5px]"
          >
            <span className="shrink-0 uppercase tracking-wider text-oat-200/75">
              In Play:
            </span>
            {pub.roster.map((mId) => {
              const def = MASQUE_DEFINITIONS[mId];
              const isClaimed =
                pub.step === "CHALLENGE_WINDOW" && pub.pendingClaim?.maskId === mId;
              return (
                <span
                  key={mId}
                  title={`${def.name}: ${def.fullPower}`}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 shadow-sm transition short:px-1.5 ${
                    isClaimed
                      ? "bg-amberwarm-400 text-espresso ring-2 ring-white"
                      : "border border-[#7C3B50]/60 bg-[#421B28] text-oat-100"
                  }`}
                >
                  <GameIcon name={masqueToIconName(mId)} className="h-3.5 w-3.5 short:h-3 short:w-3" />
                  <span>{def.name}</span>
                  <span className="opacity-75">({def.shortPower})</span>
                </span>
              );
            })}
          </div>

          {/* Velvet Salon Tabletop Container (Relative for Live Board Markers!) */}
          <div className="relative flex min-h-0 flex-1 flex-col justify-between overflow-y-auto rounded-2xl border-2 border-[#7A3548] bg-gradient-to-b from-[#491927] via-[#3A1320] to-[#2B0E18] p-2.5 shadow-inner sm:rounded-3xl sm:p-4 short:rounded-2xl short:p-2">
            {/* Live Board Marker Toolbar */}
            {markerMode && !isSpectator && (
              <BoardMarkerToolbar
                activeColor={myColorMeta.hex}
                colorLabel={myColorMeta.label}
                activeMode={markerDrawMode}
                myStrokeCount={myMarkerCount}
                totalStrokeCount={markers.length}
                onSelectMode={setMarkerDrawMode}
                onClearMine={() =>
                  roomRef.current?.send("game.markerClear", { scope: "mine" })
                }
                onClearAll={() =>
                  roomRef.current?.send("game.markerClear", { scope: "all" })
                }
                onClose={() => setMarkerMode(false)}
              />
            )}

            {/* Live Action Banner */}
            {actionBanner && !markerMode && endModalStage === "hidden" && (
              <div className="pointer-events-none sticky top-0 z-20 mx-auto mb-1.5 max-w-[92%] truncate rounded-full border border-amberwarm-400/60 bg-espresso/95 px-3.5 py-1 text-[11px] font-bold text-oat-50 shadow-lg backdrop-blur sm:text-xs short:mb-1 short:px-2.5 short:py-0.5 short:text-[10px]">
                {actionBanner}
              </div>
            )}

            {/* Private Swap Confirmation Note (Only swapper sees this!) */}
            {privateSwapNote && (
              <div className="pointer-events-none absolute right-3 top-11 z-30 rounded-xl border border-amberwarm-400 bg-espresso/95 px-3 py-1.5 text-[11px] font-extrabold text-amberwarm-400 shadow-xl">
                {privateSwapNote}
              </div>
            )}

            {/* Center Velvet Stage + Fine Box + Interactive Spotlight Hub */}
            <div className="mx-auto my-1 flex w-full max-w-3xl flex-col items-center gap-2 short:my-0.5 short:gap-1.5">
              {/* Fine Box & Velvet Stage Cards Row */}
              <div
                data-tour="vm-stage"
                className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-[#8E495C]/50 bg-[#2A0D16]/75 px-3.5 py-2 shadow-inner short:gap-2 short:rounded-xl short:px-2.5 short:py-1"
              >
                <div
                  title="Wrong bluffs & failed challenges drop 1 Gold here — Magistrate claims up to 4 Gold!"
                  className="flex items-center gap-2 rounded-xl border border-amberwarm-400/50 bg-[#3E1824] px-3 py-1.5 text-oat-50 short:px-2 short:py-1"
                >
                  <Scale className="h-4 w-4 text-amberwarm-400 short:h-3.5 short:w-3.5" />
                  <div>
                    <div className="text-[9px] font-extrabold uppercase tracking-wider text-oat-200/70">
                      Fine Box
                    </div>
                    <div className="inline-flex items-center gap-1 font-display text-sm font-bold text-amberwarm-400 short:text-xs">
                      <GameIcon name="coin-gold" className="h-4 w-4 short:h-3.5 short:w-3.5" />
                      {pub.fineBox} Gold
                    </div>
                  </div>
                </div>

                {pub.stageCount > 0 && (
                  <div className="flex items-center gap-2 short:gap-1.5">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-oat-200/75">
                      Velvet Stage:
                    </div>
                    {Array.from({ length: pub.stageCount }).map((_, sIdx) => {
                      const slot: MasqueSlotRef = { kind: "STAGE", stageIndex: sIdx };
                      const targetable = isSlotTargetable(slot);
                      const isJesterPicked =
                        Boolean(jesterFirstSlot) && slotsEqual(jesterFirstSlot!, slot);
                      const peekMatches =
                        activePeek && slotsEqual(activePeek.slot, slot)
                          ? activePeek.maskId
                          : undefined;
                      const shownMask =
                        pub.revealedStageMasks?.[sIdx] ?? peekMatches;
                      const inPendingSwap =
                        pub.step === "RESOLVE_SWAP" &&
                        pub.pendingSwap &&
                        (slotsEqual(pub.pendingSwap.slotA, slot) ||
                          slotsEqual(pub.pendingSwap.slotB, slot));

                      return (
                        <button
                          key={sIdx}
                          type="button"
                          disabled={!targetable}
                          onClick={() => handleSlotTap(slot)}
                          className={`relative flex flex-col items-center rounded-xl p-1 transition short:p-0.5 ${
                            targetable
                              ? "cursor-pointer bg-emerald-400/15 ring-2 ring-emerald-400 hover:scale-105"
                              : ""
                          } ${isJesterPicked ? "scale-105 ring-4 ring-amberwarm-400" : ""} ${
                            inPendingSwap ? "animate-pulse ring-2 ring-amberwarm-400" : ""
                          }`}
                        >
                          <div className="h-16 w-12 sm:h-20 sm:w-14 short:h-14 short:w-10">
                            <VelvetMasqueCardSvg
                              maskId={shownMask}
                              compact
                              highlight={
                                peekMatches
                                  ? "gold"
                                  : isJesterPicked
                                    ? "gold"
                                    : targetable
                                      ? "emerald"
                                      : "none"
                              }
                            />
                          </div>
                          <span className="mt-0.5 text-[9px] font-bold text-oat-200">
                            Stage #{sIdx + 1}
                          </span>
                          {peekMatches && (
                            <span className="pointer-events-none absolute -top-2 left-1/2 inline-flex -translate-x-1/2 items-center gap-0.5 whitespace-nowrap rounded-full bg-amberwarm-400 px-1.5 py-[1px] text-[8px] font-black text-espresso shadow">
                              <Eye className="h-2.5 w-2.5" /> PEEK
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* CURTAIN CALL BANNER */}
              {pub.phase === "IN_PROGRESS" && pub.step === "CURTAIN_CALL" && (
                <div className="flex w-full max-w-xl flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-amberwarm-400 bg-oat-50 px-4 py-2.5 text-espresso shadow-2xl">
                  <div className="flex items-center gap-2.5">
                    <GameIcon name="game-masque" className="h-7 w-7 shrink-0" />
                    <div>
                      <div className="font-display text-sm font-bold sm:text-base">
                        Curtain Call — Memorize Every Mask!
                      </div>
                      <div className="text-[11px] font-semibold text-espresso-soft">
                        All masks flip face-down in <strong>{secondsLeft}s</strong>. Remember who holds what!
                      </div>
                    </div>
                  </div>
                  {!isSpectator && (
                    <button
                      type="button"
                      disabled={pub.curtainReadyIds.includes(myUserId)}
                      onClick={() => sendAction({ type: "CURTAIN_READY" })}
                      className={`inline-flex items-center gap-1 rounded-xl px-3.5 py-2 text-xs font-extrabold shadow-sm transition ${
                        pub.curtainReadyIds.includes(myUserId)
                          ? "bg-oat-200 text-espresso-muted"
                          : "bg-sage-500 text-white hover:bg-sage-700"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                      {pub.curtainReadyIds.includes(myUserId)
                        ? "Ready!"
                        : "I Memorized It!"}
                    </button>
                  )}
                </div>
              )}

              {/* UNDER THE VELVET CLOAK (RESOLVE_SWAP) */}
              {pub.phase === "IN_PROGRESS" &&
                pub.step === "RESOLVE_SWAP" &&
                pub.pendingSwap && (
                  <div className="w-full max-w-xl rounded-2xl border-2 border-amberwarm-400 bg-[#230912]/95 px-4 py-3 text-center text-oat-50 shadow-2xl">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-amberwarm-400/20 px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amberwarm-400">
                      <Shuffle className="h-3.5 w-3.5 animate-spin" /> Under the Velvet Cloak
                    </div>
                    <div className="mt-1 font-display text-sm font-bold sm:text-base">
                      {describeSlot(pub.pendingSwap.slotA, nameOf)} ↔{" "}
                      {describeSlot(pub.pendingSwap.slotB, nameOf)}
                    </div>
                    {isMyCloakChoice ? (
                      <>
                        <p className="mt-0.5 text-[11px] text-oat-200">
                          Only YOU know what happens under the curtain ({secondsLeft}s):
                        </p>
                        <div className="mt-2.5 flex flex-wrap justify-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              sendAction({ type: "COMMIT_SWAP", actuallySwap: true })
                            }
                            className="inline-flex items-center gap-1.5 rounded-xl bg-amberwarm-400 px-4 py-2 font-display text-xs font-extrabold text-espresso shadow hover:bg-amberwarm-600 hover:text-white sm:text-sm"
                          >
                            <Shuffle className="h-4 w-4" /> Really Swap Masks
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              sendAction({ type: "COMMIT_SWAP", actuallySwap: false })
                            }
                            className="inline-flex items-center gap-1.5 rounded-xl bg-oat-200 px-4 py-2 font-display text-xs font-extrabold text-espresso shadow hover:bg-oat-300 sm:text-sm"
                          >
                            <GameIcon name="game-masque" className="h-4 w-4" /> Fake Swap (Keep Original)
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="mt-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-oat-200/85">
                        <Eye className="h-3.5 w-3.5 text-amberwarm-400" />
                        Watching {nameOf(pub.pendingSwap.actorId)}&apos;s hands beneath the velvet curtain...
                      </p>
                    )}
                  </div>
                )}

              {/* CLOAK SHUFFLE ANIMATION (1.8s Identical Crossing Swirl after resolve) */}
              {cloakAnim && pub.step !== "RESOLVE_SWAP" && (
                <div className="pointer-events-none flex items-center gap-2.5 rounded-2xl border border-amberwarm-400/80 bg-[#260A14]/95 px-4 py-2 text-xs font-bold text-oat-50 shadow-2xl">
                  <Shuffle className="h-4 w-4 animate-spin text-amberwarm-400" />
                  <span>
                    {cloakAnim.actorName} juggled{" "}
                    <strong className="text-amberwarm-400">{cloakAnim.labelA}</strong> ↔{" "}
                    <strong className="text-amberwarm-400">{cloakAnim.labelB}</strong> —
                    swapped or bluffed?
                  </span>
                </div>
              )}

              {/* SIMULTANEOUS 8-SECOND CHALLENGE SHOWDOWN PROMPT */}
              {pub.phase === "IN_PROGRESS" &&
                pub.step === "CHALLENGE_WINDOW" &&
                pub.pendingClaim && (
                  <div className="w-full max-w-xl rounded-2xl border-2 border-amberwarm-400 bg-oat-50 px-4 py-3 text-center text-espresso shadow-2xl">
                    <div className="flex items-center justify-center gap-2.5">
                      <GameIcon
                        name={masqueToIconName(pub.pendingClaim.maskId)}
                        className="h-8 w-8 shrink-0"
                      />
                      <div className="text-left">
                        <div className="font-display text-sm font-bold sm:text-base">
                          {nameOf(pub.pendingClaim.announcerId)} claims:{" "}
                          <span className="text-terracotta-700">
                            &ldquo;I am the{" "}
                            {MASQUE_DEFINITIONS[pub.pendingClaim.maskId].name}!&rdquo;
                          </span>
                        </div>
                        <div className="text-[11px] font-semibold text-espresso-soft">
                          {MASQUE_DEFINITIONS[pub.pendingClaim.maskId].fullPower} ·{" "}
                          <strong className="text-terracotta-700">{secondsLeft}s left</strong>
                        </div>
                      </div>
                    </div>

                    {needsMyChallengeResponse ? (
                      <div className="mt-2.5 flex flex-wrap justify-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            sendAction({ type: "RESPOND_CHALLENGE", decision: "PASS" })
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl bg-oat-200 px-4 py-2 font-display text-xs font-extrabold text-espresso shadow-sm transition hover:bg-oat-300 sm:text-sm"
                        >
                          <Check className="h-4 w-4 text-sage-700" /> Let It Slide
                        </button>
                        <button
                          type="button"
                          disabled={(myPublic?.coins ?? 0) <= 0}
                          onClick={() =>
                            sendAction({
                              type: "RESPOND_CHALLENGE",
                              decision: "CHALLENGE",
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl bg-terracotta-500 px-4 py-2 font-display text-xs font-extrabold text-white shadow-sm transition hover:bg-terracotta-700 disabled:opacity-45 sm:text-sm"
                        >
                          <Swords className="h-4 w-4" /> No, I&apos;M the{" "}
                          {MASQUE_DEFINITIONS[pub.pendingClaim.maskId].name}!
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs font-bold text-espresso-soft">
                        {pub.pendingClaim.announcerId === myUserId
                          ? "Waiting to see who dares challenge your claim..."
                          : isSpectator
                            ? "Players are deciding whether to challenge..."
                            : myChallengeDecision === "CHALLENGE"
                              ? "You challenged! Waiting for others..."
                              : "You let it slide. Waiting for others..."}
                      </div>
                    )}

                    {/* Live Response Status Chips */}
                    <div className="mt-2 flex flex-wrap justify-center gap-1 text-[10px] font-bold">
                      {Object.entries(pub.pendingClaim.responses).map(([uid, dec]) => (
                        <span
                          key={uid}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                            dec === "CHALLENGE"
                              ? "bg-terracotta-100 text-terracotta-700"
                              : dec === "PASS"
                                ? "bg-sage-100 text-sage-700"
                                : "bg-oat-200 text-espresso-muted"
                          }`}
                        >
                          <span>{nameOf(uid)}:</span>
                          {dec === "CHALLENGE" ? (
                            <Swords className="h-3 w-3" />
                          ) : dec === "PASS" ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <span>...</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {/* SHOWDOWN RESULT BANNER (brief spotlight when cards flipped) */}
              {pub.phase === "IN_PROGRESS" &&
                pub.lastShowdown?.wasChallenged &&
                pub.step !== "CHALLENGE_WINDOW" && (
                  <div className="flex w-full max-w-xl flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-amberwarm-400/80 bg-espresso/95 px-3.5 py-2 text-center text-xs font-bold text-oat-50 shadow-xl">
                    <GameIcon
                      name={masqueToIconName(pub.lastShowdown.announcedMaskId)}
                      className="h-4 w-4 shrink-0"
                    />
                    <span>
                      Showdown for{" "}
                      {MASQUE_DEFINITIONS[pub.lastShowdown.announcedMaskId].name}:
                    </span>
                    {pub.lastShowdown.winnerId ? (
                      <span className="text-amberwarm-400">
                        {nameOf(pub.lastShowdown.winnerId)} held the true Mask!
                      </span>
                    ) : (
                      <span className="text-terracotta-100">
                        NOBODY held it — every claimant paid 1 Gold fine!
                      </span>
                    )}
                  </div>
                )}
            </div>

            {/* Player Seats Arena Grid */}
            <div
              data-tour="vm-players"
              className={`mx-auto my-auto grid w-full max-w-4xl gap-2 py-1 sm:gap-3 short:gap-1.5 short:py-0.5 ${gridColsClass}`}
            >
              {pub.players.map((p) => {
                const slot: MasqueSlotRef = { kind: "PLAYER", userId: p.userId };
                const isMe = p.userId === myUserId;
                const isActive =
                  pub.phase === "IN_PROGRESS" &&
                  pub.step === "CHALLENGE_WINDOW" ? false :
                  pub.phase === "IN_PROGRESS" &&
                  pub.step === "CHOOSE_ACTION" &&
                  pub.activePlayerId === p.userId;
                const isBotSub = botControlledUserIds.includes(p.userId);
                const pColor = getPlayerColorMeta(p.color ?? p.seatIndex);
                const targetable = isSlotTargetable(slot);
                const isJesterPicked =
                  Boolean(jesterFirstSlot) && slotsEqual(jesterFirstSlot!, slot);
                const inPendingSwap =
                  pub.step === "RESOLVE_SWAP" &&
                  pub.pendingSwap &&
                  (slotsEqual(pub.pendingSwap.slotA, slot) ||
                    slotsEqual(pub.pendingSwap.slotB, slot));

                const peekMatches =
                  activePeek && slotsEqual(activePeek.slot, slot)
                    ? activePeek.maskId
                    : undefined;
                const visibleMask = p.revealedMask ?? peekMatches;

                const showdownEntry = pub.lastShowdown?.wasChallenged
                  ? pub.lastShowdown.revealed.find((r) => r.userId === p.userId)
                  : undefined;
                const myDeltas = coinDeltas.filter((d) => d.userId === p.userId);
                const isWinner = pub.phase === "COMPLETED" && pub.winnerIds.includes(p.userId);
                const recentlyJuggled =
                  p.juggledTurn > 0 && pub.turnNumber - p.juggledTurn <= 1;

                return (
                  <div
                    key={p.userId}
                    onClick={() => {
                      if (targetable) handleSlotTap(slot);
                    }}
                    className={`relative flex flex-col items-center rounded-2xl border-2 p-2 transition sm:p-2.5 short:rounded-xl short:p-1.5 ${
                      isWinner
                        ? "border-amberwarm-400 bg-amberwarm-100/95 shadow-[0_0_24px_rgba(251,191,36,0.65)]"
                        : isJesterPicked
                          ? "border-amberwarm-400 bg-oat-50 ring-4 ring-amberwarm-400/60"
                          : targetable
                            ? "cursor-pointer border-emerald-400 bg-oat-50 shadow-lg ring-2 ring-emerald-400/50 hover:scale-[1.03]"
                            : isActive
                              ? "border-amberwarm-400 bg-oat-50 shadow-lg"
                              : "border-oat-300/40 bg-oat-50/95"
                    } ${inPendingSwap ? "animate-pulse ring-2 ring-amberwarm-400" : ""}`}
                  >
                    {/* Floating Coin Delta Badges */}
                    {myDeltas.map((d) => (
                      <span
                        key={d.id}
                        className={`pointer-events-none absolute -top-3 right-2 z-30 inline-flex animate-bounce items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-black shadow-lg ${
                          d.delta > 0
                            ? "bg-sage-500 text-white"
                            : "bg-terracotta-500 text-white"
                        }`}
                      >
                        {d.delta > 0 ? `+${d.delta}` : d.delta}
                        <GameIcon name="coin-gold" className="h-3.5 w-3.5" />
                      </span>
                    ))}

                    {/* Player Name + Color Dot + Coins */}
                    <div className="flex w-full items-center justify-between gap-1 text-[11px] font-bold sm:text-xs short:text-[10.5px]">
                      <span className="flex min-w-0 items-center gap-1.5 truncate text-espresso">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full border border-white shadow-sm"
                          style={{ backgroundColor: pColor.hex }}
                        />
                        <span className="truncate">
                          {p.displayName}
                          {isMe ? " (You)" : ""}
                        </span>
                        {isBotSub && (
                          <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-amberwarm-400 px-1 py-0.5 text-[8px] font-extrabold text-espresso">
                            <Bot className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-amberwarm-100 px-1.5 py-0.5 text-[11px] font-black text-amberwarm-600 short:text-[10px]">
                        <GameIcon name="coin-gold" className="h-3.5 w-3.5 short:h-3 short:w-3" />
                        {p.coins}
                      </span>
                    </div>

                    {/* Gold Progress Bar toward targetCoins */}
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-oat-200 short:mt-0.5 short:h-1">
                      <div
                        className="h-full rounded-full bg-amberwarm-400 transition-all duration-500"
                        style={{
                          width: `${Math.min(100, Math.round((p.coins / pub.config.targetCoins) * 100))}%`,
                        }}
                      />
                    </div>

                    {/* Mask Card */}
                    <div className="relative mt-2 h-24 w-[68px] sm:h-28 sm:w-20 short:mt-1 short:h-16 short:w-12">
                      <VelvetMasqueCardSvg
                        maskId={visibleMask}
                        juggled={recentlyJuggled && !visibleMask}
                        highlight={
                          isWinner
                            ? "gold"
                            : showdownEntry?.wonClaim
                              ? "emerald"
                              : showdownEntry?.paidFine
                                ? "crimson"
                                : peekMatches
                                  ? "gold"
                                  : targetable
                                    ? "emerald"
                                    : "none"
                        }
                      />

                      {peekMatches && (
                        <span className="pointer-events-none absolute -top-2 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-0.5 whitespace-nowrap rounded-full bg-amberwarm-400 px-1.5 py-[1px] text-[8px] font-black text-espresso shadow">
                          <Eye className="h-2.5 w-2.5" /> ONLY YOU
                        </span>
                      )}

                      {showdownEntry && (
                        <span
                          className={`pointer-events-none absolute -bottom-2 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-[1px] text-[8px] font-black shadow ${
                            showdownEntry.wonClaim
                              ? "bg-sage-500 text-white"
                              : "bg-terracotta-500 text-white"
                          }`}
                        >
                          {showdownEntry.wonClaim ? "TRUE MASK" : "-1 GOLD"}
                        </span>
                      )}

                      {targetable && !peekMatches && (
                        <span className="pointer-events-none absolute inset-x-0 bottom-1 mx-auto w-fit rounded-full bg-emerald-600 px-2 py-0.5 text-[8px] font-extrabold text-white shadow">
                          {isJesterPicked ? "1st Pick" : "Tap"}
                        </span>
                      )}
                    </div>

                    {isWinner && (
                      <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amberwarm-400 px-2 py-0.5 text-[9px] font-black text-espresso">
                        <Crown className="h-3 w-3" /> WINNER!
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Match-End Non-Blocking Final Reveal Banner (before Victory Modal / during Inspect!) */}
            {pub.phase === "COMPLETED" &&
              (endModalStage === "revealing" || endModalStage === "inspecting") && (
                <div className="sticky bottom-0 z-40 mx-auto mt-2 flex w-full max-w-xl flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-amberwarm-400 bg-espresso/95 px-4 py-2.5 text-oat-50 shadow-2xl backdrop-blur">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <GameIcon name="game-masque" className="h-7 w-7 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-display text-xs font-bold text-amberwarm-400 sm:text-sm">
                        All Masks Revealed!
                      </div>
                      <div className="truncate text-[11px] font-semibold text-oat-200">
                        {pub.endReason}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={openEndModalNow}
                    className="shrink-0 rounded-xl bg-amberwarm-400 px-3 py-1.5 font-display text-xs font-extrabold text-espresso hover:bg-amberwarm-600 hover:text-white"
                  >
                    {endModalStage === "revealing" && endRevealSec > 0
                      ? `Final Standings (${endRevealSec}s) →`
                      : "Final Standings →"}
                  </button>
                </div>
              )}

            {/* Shared Live Single-Color Board Marker Overlay */}
            <BoardMarkerLayer
              minX={0}
              minY={0}
              cols={10}
              rows={6}
              strokes={markers}
              drawingEnabled={markerMode && !isSpectator}
              activeColor={myColorMeta.hex}
              activeMode={markerDrawMode}
              onCommitStroke={(points, color, mode) =>
                roomRef.current?.send("game.markerAdd", { points, color, mode })
              }
            />

            {/* Reconnect / Error / Auto-Pass */}
            {(connState === "reconnecting" || connState === "error") && (
              <div className="absolute left-1/2 top-2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amberwarm-400 bg-espresso/95 px-3.5 py-1 text-[11px] font-bold text-oat-50 shadow-lg">
                <RefreshCw
                  className={`h-3 w-3 text-amberwarm-400 ${
                    connState === "reconnecting" ? "animate-spin" : ""
                  }`}
                />
                <span>
                  {connState === "reconnecting" ? "Reconnecting..." : "Disconnected"}
                </span>
                <button
                  type="button"
                  onClick={() => manualReconnectRef.current?.()}
                  className="rounded-full bg-amberwarm-400 px-2 py-0.5 text-[10px] font-extrabold text-espresso"
                >
                  Retry
                </button>
              </div>
            )}

            {errorToast && (
              <div className="absolute bottom-2 left-1/2 z-30 -translate-x-1/2 rounded-full bg-terracotta-500 px-3.5 py-1 text-[11px] font-bold text-white shadow-lg">
                {errorToast}
              </div>
            )}

            {myPublic?.autoPass && (
              <div className="absolute left-1/2 top-11 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-amberwarm-400 px-3.5 py-1 text-[11px] font-bold text-espresso shadow-lg">
                <span>Auto-Pass</span>
                <button
                  type="button"
                  onClick={() => roomRef.current?.send("game.imBack")}
                  className="rounded-full bg-espresso px-2.5 py-0.5 text-oat-50"
                >
                  I&apos;m Back!
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Right Sidebar */}
        <aside className="hidden flex-col overflow-hidden rounded-3xl border border-oat-300/30 bg-oat-50/95 lg:col-span-3 lg:flex">
          <div className="border-b border-oat-200 px-4 py-2.5 font-display text-sm font-bold text-espresso">
            Gala Chronicle &amp; Bluff Chat
          </div>
          <MasqueChatPanel
            recentEvents={pub.recentEvents}
            nameOf={nameOf}
            chatLog={chatLog}
            chatInput={chatInput}
            onChatInputChange={setChatInput}
            onQuickBluff={(pill) =>
              roomRef.current?.send("game.quickBluff", { text: pill })
            }
            onSendChat={() => {
              if (!chatInput.trim()) return;
              roomRef.current?.send("game.chat", { message: chatInput });
              setChatInput("");
            }}
          />
        </aside>
      </div>

      {/* Bottom Interactive Gala Action Dock (Right-Side Handheld Dock in Mobile Landscape!) */}
      <footer
        data-tour="vm-dock"
        className="shrink-0 border-t border-oat-300/30 bg-oat-50 px-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-4 sm:py-2.5 short:flex short:w-[244px] short:flex-col short:overflow-y-auto short:border-l short:border-t-0 short:px-2 short:pb-2 short:pt-1.5"
      >
        {isSpectator ? (
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 text-xs font-bold short:flex-col short:items-stretch">
            <div className="flex items-center gap-2 text-espresso short:flex-col short:items-start short:gap-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-espresso px-2.5 py-1 text-[10px] font-extrabold text-amberwarm-400">
                <Eye className="h-3 w-3" /> Spectator Mode
              </span>
              <span className="text-[11px] text-espresso-soft sm:text-xs short:text-[10px]">
                Watching the masquerade live · Secret peeks &amp; cloak swaps stay hidden · Cheer in chat!
              </span>
            </div>
            <button
              type="button"
              onClick={() => onExitGame({ finished: pub.phase === "COMPLETED" })}
              className="rounded-xl bg-oat-200 px-3 py-1.5 text-xs font-bold text-espresso hover:bg-terracotta-100 hover:text-terracotta-700"
            >
              Leave Spectator View
            </button>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 short:gap-1.5">
            {/* Action Mode / Contextual Status Row */}
            {markerMode ? (
              <div className="text-center text-xs font-bold text-espresso-soft short:text-left short:text-[10px]">
                Marker Mode ON ({myColorMeta.label} Pen) — circle suspicious seats or tap to ping! Tap Done when finished.
              </div>
            ) : isMyPowerChoice && pub.pendingPower ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-amberwarm-100 px-3 py-2 text-xs font-bold text-espresso short:rounded-xl short:p-2 short:text-[11px]">
                <span className="inline-flex items-center gap-1.5">
                  <GameIcon
                    name={masqueToIconName(pub.pendingPower.maskId)}
                    className="h-4 w-4 shrink-0"
                  />
                  <span>
                    {pub.pendingPower.maskId === "patron" &&
                      "Patron Bonus: Tap any highlighted rival or Velvet Stage mask above to secretly peek!"}
                    {pub.pendingPower.maskId === "illusionist" &&
                      "Illusionist Power: Tap any rival above to swap fortunes (capped at ±4 Gold)!"}
                    {pub.pendingPower.maskId === "jester" &&
                      `Jester Chaos: Tap TWO other masks above to juggle under the cloak (${jesterFirstSlot ? "1/2" : "0/2"} selected)!`}
                    {pub.pendingPower.maskId === "taxmaster" &&
                      "Taxmaster Tie-Break: Tap one of the highlighted richest rivals to tax 2 Gold!"}
                  </span>
                </span>
                {jesterFirstSlot && (
                  <button
                    type="button"
                    onClick={() => setJesterFirstSlot(null)}
                    className="rounded-lg bg-oat-200 px-2 py-1 text-[11px] font-bold hover:bg-oat-300"
                  >
                    Clear 1st Pick
                  </button>
                )}
              </div>
            ) : isMyChooseAction ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 short:flex-col short:items-stretch short:gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5 short:grid short:grid-cols-1 short:gap-1">
                    {!isOpeningSwapOnly && (
                      <button
                        type="button"
                        onClick={() => setActionMode("announce")}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition short:px-2 short:py-1 short:text-[11px] ${
                          actionMode === "announce"
                            ? "bg-espresso text-amberwarm-400 shadow-sm"
                            : "bg-oat-200 text-espresso hover:bg-oat-300"
                        }`}
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Announce a Mask
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setActionMode("swap")}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition short:px-2 short:py-1 short:text-[11px] ${
                        isOpeningSwapOnly || actionMode === "swap"
                          ? "bg-amberwarm-400 text-espresso shadow-sm"
                          : "bg-oat-200 text-espresso hover:bg-oat-300"
                      }`}
                    >
                      <Shuffle className="h-3.5 w-3.5" /> Swap / Fake-Swap
                    </button>
                    {!isOpeningSwapOnly && (
                      <button
                        type="button"
                        onClick={() => sendAction({ type: "PEEK_SELF" })}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-sage-500 px-3 py-1.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-sage-700 short:px-2 short:py-1 short:text-[11px]"
                      >
                        <Eye className="h-3.5 w-3.5" /> Peek My Mask
                      </button>
                    )}
                  </div>
                  <div className="text-[11px] font-bold text-espresso-soft short:text-[10px] short:leading-tight">
                    {isOpeningSwapOnly
                      ? `Opening Shuffle (${pub.turnNumber}/${OPENING_SWAP_ONLY_TURNS}): Tap any highlighted seat or Stage mask!`
                      : actionMode === "swap"
                        ? "Tap any glowing green rival or Stage mask to take Under the Cloak!"
                        : "Pick ANY Mask below to announce (bluff or truth — no peeking first!):"}
                  </div>
                </div>

                {/* Announce Mask Picker Bar (Compact 2-Col Grid in Mobile Landscape!) */}
                {!isOpeningSwapOnly && actionMode === "announce" && (
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5 short:grid short:grid-cols-2 short:gap-1 short:overflow-x-visible">
                    {pub.roster.map((mId) => {
                      const def = MASQUE_DEFINITIONS[mId];
                      return (
                        <button
                          key={mId}
                          type="button"
                          title={def.fullPower}
                          onClick={() => sendAction({ type: "ANNOUNCE_MASK", maskId: mId })}
                          className="flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-oat-300 bg-white px-2.5 py-1.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-amberwarm-400 hover:bg-amberwarm-100/50 active:scale-95 short:w-full short:gap-1 short:px-1.5 short:py-1"
                        >
                          <GameIcon name={masqueToIconName(mId)} className="h-6 w-6 shrink-0 short:h-5 short:w-5" />
                          <div className="min-w-0">
                            <div className="truncate text-[11px] font-extrabold leading-tight text-espresso short:text-[10px]">
                              {def.name}
                            </div>
                            <div className="truncate text-[9px] font-bold text-espresso-muted short:text-[8.5px]">
                              {def.shortPower}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-espresso-soft short:flex-col short:items-start short:text-[11px]">
                <span>
                  {pub.phase === "COMPLETED"
                    ? pub.endReason ?? "Gala complete!"
                    : pub.step === "CURTAIN_CALL"
                      ? "Study every face-up Mask before the velvet curtain closes!"
                      : pub.step === "CHALLENGE_WINDOW"
                        ? "Simultaneous Challenge Window open — decide on the table!"
                        : pub.step === "RESOLVE_SWAP"
                          ? "Two masks are hidden under the Velvet Cloak..."
                          : `Waiting for ${nameOf(pub.activePlayerId)}...`}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amberwarm-100 px-2.5 py-0.5 text-[11px] font-extrabold text-amberwarm-600">
                  <GameIcon name="coin-gold" className="h-3.5 w-3.5" /> Your Pouch:{" "}
                  {myPublic?.coins ?? 0} / {pub.config.targetCoins} Gold
                </span>
              </div>
            )}
          </div>
        )}
      </footer>
      </div>

      {/* Mobile Slide-Up Chat & Log Drawer */}
      {mobileChatOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-espresso/50 backdrop-blur-sm lg:hidden">
          <div className="flex h-[72dvh] w-full flex-col overflow-hidden rounded-t-3xl border-t-2 border-oat-300 bg-oat-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-oat-200 px-4 py-3">
              <span className="font-display text-sm font-bold text-espresso">
                Gala Chronicle &amp; Bluff Chat
              </span>
              <button
                type="button"
                onClick={() => setMobileChatOpen(false)}
                className="rounded-xl bg-oat-200 p-1.5 text-espresso hover:bg-oat-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <MasqueChatPanel
              recentEvents={pub.recentEvents}
              nameOf={nameOf}
              chatLog={chatLog}
              chatInput={chatInput}
              onChatInputChange={setChatInput}
              onQuickBluff={(pill) =>
                roomRef.current?.send("game.quickBluff", { text: pill })
              }
              onSendChat={() => {
                if (!chatInput.trim()) return;
                roomRef.current?.send("game.chat", { message: chatInput });
                setChatInput("");
              }}
            />
          </div>
        </div>
      )}

      {/* LIVE FLOATING CHAT & BLUFF SPEECH BUBBLES */}
      <div className="pointer-events-none fixed inset-0 z-[52] overflow-hidden">
        {flyingChatBubbles.map((b) => (
          <div
            key={b.id}
            style={{ left: `${b.leftPct}%`, top: `${b.topPct}%` }}
            className="animate-tt-chat-bubble fixed max-w-[215px] sm:max-w-[260px]"
          >
            <div
              className={`relative rounded-2xl border-2 px-2.5 py-1 shadow-xl backdrop-blur-sm ${
                b.isQuickBluff
                  ? "border-amberwarm-400 bg-oat-50/95 text-espresso"
                  : b.isMe
                    ? "border-sage-500 bg-sage-100/95 text-espresso"
                    : "border-oat-300 bg-white/95 text-espresso"
              }`}
            >
              <div className="flex items-center justify-between gap-1.5 text-[9px] font-extrabold uppercase tracking-wide text-sage-700">
                <span className="max-w-[115px] truncate">{b.senderName}</span>
                {b.comboCount > 1 && (
                  <span className="rounded-full bg-amberwarm-400 px-1.5 py-[1px] text-[9px] font-black text-espresso shadow-sm">
                    ×{b.comboCount}
                  </span>
                )}
              </div>
              <div className="text-[11px] font-bold leading-snug text-espresso sm:text-xs">
                {b.message}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* GALA VICTORY MODAL (Opens AFTER the 3.5s full-table Mask Reveal!) */}
      {pub.phase === "COMPLETED" && endModalStage === "modal" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/65 p-4 backdrop-blur-sm short:p-2">
          <div className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl border-2 border-amberwarm-400 bg-oat-50 p-5 text-center shadow-cozy sm:p-6 short:max-h-[94dvh] short:rounded-2xl short:p-3.5">
            <button
              type="button"
              onClick={() => setEndModalStage("inspecting")}
              className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-xl bg-oat-200 px-2.5 py-1 text-[11px] font-bold text-espresso transition hover:bg-oat-300 short:right-3 short:top-3"
            >
              <Eye className="h-3.5 w-3.5" /> View Table
            </button>

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amberwarm-100 shadow-inner short:h-11 short:w-11">
              <GameIcon name="game-masque" className="h-11 w-11 short:h-8 short:w-8" />
            </div>
            <h2 className="mt-3 font-display text-2xl font-bold text-espresso sm:text-3xl short:mt-1.5 short:text-xl">
              Gala Complete!
            </h2>
            <p className="mt-1 text-xs font-semibold text-espresso-soft sm:text-sm">
              {pub.endReason}
            </p>

            <div className="mt-4 space-y-2 text-left">
              {[...pub.players]
                .sort((a, b) => b.coins - a.coins || a.finesPaid - b.finesPaid)
                .map((p) => {
                  const isWinner = pub.winnerIds.includes(p.userId);
                  const pColor = getPlayerColorMeta(p.color ?? p.seatIndex);
                  const maskDef = p.revealedMask
                    ? MASQUE_DEFINITIONS[p.revealedMask]
                    : null;
                  return (
                    <div
                      key={p.userId}
                      className={`flex items-center justify-between rounded-2xl px-3.5 py-2.5 text-xs font-bold sm:text-sm ${
                        isWinner
                          ? "border-2 border-amberwarm-400 bg-amberwarm-100/80"
                          : "bg-oat-100"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full border border-white shadow-sm"
                          style={{ backgroundColor: pColor.hex }}
                        />
                        <span className="truncate">{p.displayName}</span>
                        {maskDef && p.revealedMask && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-espresso shadow-sm">
                            <GameIcon
                              name={masqueToIconName(p.revealedMask)}
                              className="h-3.5 w-3.5"
                            />
                            {maskDef.name}
                          </span>
                        )}
                        {isWinner && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amberwarm-400 px-2 py-0.5 text-[10px] font-black text-espresso">
                            <Crown className="h-3 w-3" /> Crown
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {p.bluffsWon > 0 && (
                          <span className="hidden text-[10px] text-sage-700 sm:inline">
                            {p.bluffsWon} bluff{p.bluffsWon === 1 ? "" : "s"}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-0.5 rounded-lg bg-white px-2.5 py-0.5 text-xs font-black text-amberwarm-600 shadow-sm">
                          <GameIcon name="coin-gold" className="h-3.5 w-3.5" />
                          {p.coins}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-2.5">
              {isSpectator ? (
                <>
                  <span className="inline-flex w-full items-center justify-center gap-1.5 text-center text-xs font-bold text-espresso-soft">
                    <Eye className="h-3.5 w-3.5 text-sage-700" />
                    You&apos;re spectating — waiting to see if the guests go for an Encore...
                  </span>
                  <button
                    type="button"
                    onClick={() => onExitGame({ finished: true })}
                    className="inline-flex items-center gap-2 rounded-2xl border border-oat-300 bg-oat-200 px-5 py-3 font-display text-sm font-bold text-espresso shadow-sm hover:bg-oat-300"
                  >
                    <Flame className="h-4 w-4" /> Back to Café
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={rematchVotes.includes(myUserId)}
                    onClick={() => roomRef.current?.send("game.playAgain")}
                    className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-display text-sm font-bold shadow-sm transition ${
                      rematchVotes.includes(myUserId)
                        ? "bg-amberwarm-400 text-espresso"
                        : "bg-sage-500 text-white hover:bg-sage-700"
                    }`}
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${
                        rematchVotes.includes(myUserId) ? "animate-spin" : ""
                      }`}
                    />
                    {rematchVotes.includes(myUserId)
                      ? `Waiting for Encore (${rematchVotes.length}/${Math.max(1, connectedHumanCount)})`
                      : rematchVotes.length > 0
                        ? `Play Again! (${rematchVotes.length}/${Math.max(1, connectedHumanCount)})`
                        : "Play Again!"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onExitGame({ finished: true })}
                    className="inline-flex items-center gap-2 rounded-2xl border border-oat-300 bg-oat-200 px-5 py-3 font-display text-sm font-bold text-espresso shadow-sm hover:bg-oat-300"
                  >
                    <Flame className="h-4 w-4" /> Back to Table
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Interactive 6-Step Live Spotlight Quick Tour */}
      <GameQuickTour
        gameSlug="velvet-masque"
        open={showQuickTour}
        onClose={() => setShowQuickTour(false)}
        onOpenFullRules={onOpenTutorial}
      />

      {tutorialMode && !isSpectator && pub && myPublic && (
        <GuidedTutorialCoach
          model={buildVelvetMasqueGuide({
            phase: pub.phase,
            step: pub.step,
            isMyChooseAction,
            isMyCloakChoice,
            isMyPowerChoice,
            needsMyChallengeResponse,
            isOpeningSwapOnly,
            myCoins: myPublic.coins,
            targetCoins: pub.config.targetCoins,
            turnNumber: pub.turnNumber,
          })}
          onOpenRules={onOpenTutorial}
          onExitTutorial={() => onExitGame({ finished: pub.phase === "COMPLETED" })}
        />
      )}
    </div>
  );
}
