"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Client as ColyseusClient, type Room } from "colyseus.js";
import {
  BookOpen,
  Bot,
  Compass,
  Eye,
  EyeOff,
  Flame,
  LogOut,
  MessageCircle,
  RefreshCw,
  RotateCw,
  Send,
  Sparkles,
  Trash2,
  Wrench,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  BOARD_COLS,
  BOARD_ROWS,
  QUICK_BLUFF_PILLS,
  coordKey,
  getOrientedEdges,
  getValidPlacementsForCard,
  type GearType,
  type PathEdges,
  type TreasureTrailsAction,
  type TreasureTrailsCard,
  type TreasureTrailsEvent,
  type TreasureTrailsPrivateState,
  type TreasureTrailsPublicState,
  type VaultKind,
} from "@tablefolk/game-treasure-trails";
import { WS_BASE_URL, getStoredToken } from "@/lib/api";
import { soundEngine } from "@/lib/sound";
import { PathTileSvg } from "./TreasureTrailsTileSvg";

interface TreasureTrailsOverlayProps {
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
  timestamp: number;
}

interface FlyingCardEffect {
  id: string;
  mode: "fly" | "vault-peek";
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  kind:
    | "PATH"
    | "HAZARD"
    | "REPAIR"
    | "FIELD_PATCH"
    | "SPYGLASS"
    | "VAULT"
    | "BOULDER_CLEAR"
    | "DISCARD";
  label: string;
  icon?: string;
  edges?: PathEdges;
  connectedCenter?: boolean;
}

interface ImpactBurst {
  id: string;
  x: number;
  y: number;
  colorClass: string;
  icon: string;
}

interface FlyingChatBubble {
  id: string;
  senderName: string;
  message: string;
  isQuickBluff: boolean;
  isMe: boolean;
  offsetX: number;
}

const GEAR_META: Record<GearType, { label: string; icon: string }> = {
  lantern: { label: "Lantern", icon: "🏮" },
  compass: { label: "Compass", icon: "🧭" },
  grapple: { label: "Grapple", icon: "🪝" },
};

function isRoomSocketOpen(room: Room | null): boolean {
  if (!room) return false;
  const conn = room.connection as
    | { isOpen?: boolean; ws?: { readyState?: number } }
    | undefined;
  if (!conn) return false;
  if (typeof conn.isOpen === "boolean") return conn.isOpen;
  if (typeof conn.ws?.readyState === "number") return conn.ws.readyState === 1;
  return true;
}

function describeEvent(
  ev: TreasureTrailsEvent,
  nameOf: (id: string) => string
): string {
  switch (ev.type) {
    case "ROUND_STARTED":
      return `Round ${ev.roundNumber} begins! ${nameOf(ev.startingPlayerId)} goes first.`;
    case "TILE_PLACED":
      return `${nameOf(ev.actorId)} placed a trail at (${ev.x}, ${ev.y}).`;
    case "TILE_CLEARED":
      return `💥 ${nameOf(ev.actorId)} cleared the tile at (${ev.x}, ${ev.y})!`;
    case "GEAR_BROKEN":
      return `⚡ ${nameOf(ev.actorId)} broke ${nameOf(ev.targetId)}'s ${ev.gear}!`;
    case "GEAR_REPAIRED":
      return `🔧 ${nameOf(ev.actorId)} repaired ${nameOf(ev.targetId)}'s ${ev.gear}!`;
    case "FIELD_PATCHED":
      return `🛠️ ${nameOf(ev.actorId)} Field-Patched their ${ev.gear}!`;
    case "VAULT_SCOUTED":
      return `🔭 ${nameOf(ev.actorId)} scouted Vault (${ev.x}, ${ev.y})!`;
    case "VAULT_REVEALED":
      return ev.vaultKind === "TRUE_RELIC"
        ? `🌟 ${nameOf(ev.actorId)} uncovered the GOLDEN COMPASS!`
        : `🏺 ${nameOf(ev.actorId)} uncovered a Hollow Decoy at (${ev.x}, ${ev.y})!`;
    case "CARD_DISCARDED":
      return ev.timedOut
        ? `${nameOf(ev.actorId)} timed out and discarded a card.`
        : `${nameOf(ev.actorId)} discarded a card face-down.`;
    case "ROUND_ENDED":
      return ev.summary.reason;
    case "MATCH_ENDED":
      return `Match complete — ${ev.winningTeam} win!`;
  }
}

interface GameChatAndLogPanelProps {
  recentEvents: TreasureTrailsEvent[];
  nameOf: (id: string) => string;
  chatLog: GameChatEntry[];
  chatInput: string;
  onChatInputChange: (val: string) => void;
  onQuickBluff: (pill: string) => void;
  onSendChat: () => void;
}

function GameChatAndLogPanel({
  recentEvents,
  nameOf,
  chatLog,
  chatInput,
  onChatInputChange,
  onQuickBluff,
  onSendChat,
}: GameChatAndLogPanelProps) {
  const logScrollRef = useRef<HTMLDivElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll Expedition Log to latest event on mount & update
  useEffect(() => {
    const scrollLog = () => {
      const el = logScrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    };
    scrollLog();
    const raf = requestAnimationFrame(scrollLog);
    return () => cancelAnimationFrame(raf);
  }, [recentEvents.length]);

  // Auto-scroll Table Talk chat to latest message on mount (drawer open!) & new messages
  useEffect(() => {
    const scrollChat = () => {
      const el = chatScrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    };
    scrollChat();
    const raf = requestAnimationFrame(scrollChat);
    return () => cancelAnimationFrame(raf);
  }, [chatLog.length]);

  return (
    <>
      <div
        ref={logScrollRef}
        className="max-h-32 space-y-1 overflow-y-auto border-b border-oat-200 bg-oat-100/80 p-2.5 text-[11px] font-semibold text-espresso-soft"
      >
        {recentEvents.slice(-6).map((ev, i) => (
          <div key={i} className="rounded-lg bg-white/85 px-2.5 py-1">
            {describeEvent(ev, nameOf)}
          </div>
        ))}
      </div>

      <div
        ref={chatScrollRef}
        className="flex-1 space-y-1.5 overflow-y-auto p-3 text-xs"
      >
        {chatLog.length === 0 && (
          <p className="text-center text-[11px] text-espresso-muted">
            Discuss routes — or bluff the table!
          </p>
        )}
        {chatLog.map((m) => (
          <div
            key={m.id}
            className={`rounded-xl px-2.5 py-1.5 ${
              m.senderUserId === "system"
                ? "border border-amberwarm-400/50 bg-amberwarm-100/90 font-semibold"
                : "bg-oat-100"
            }`}
          >
            {m.senderUserId !== "system" && (
              <span className="font-bold text-sage-700">{m.senderName}: </span>
            )}
            <span className="text-espresso">{m.message}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1 border-t border-oat-200 bg-oat-100/60 p-2">
        {QUICK_BLUFF_PILLS.slice(0, 6).map((pill) => (
          <button
            key={pill}
            type="button"
            onClick={() => onQuickBluff(pill)}
            className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-espresso shadow-sm hover:bg-amberwarm-100"
          >
            {pill}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSendChat();
        }}
        className="flex gap-1.5 border-t border-oat-200 p-2"
      >
        <input
          type="text"
          value={chatInput}
          onChange={(e) => onChatInputChange(e.target.value)}
          placeholder="Accuse or coordinate..."
          maxLength={200}
          className="flex-1 rounded-xl border border-oat-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-sage-500"
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

export function TreasureTrailsOverlay({
  gameRoomId,
  myUserId,
  onExitGame,
  onOpenTutorial,
}: TreasureTrailsOverlayProps) {
  const roomRef = useRef<Room | null>(null);
  const [pub, setPub] = useState<TreasureTrailsPublicState | null>(null);
  const [priv, setPriv] = useState<TreasureTrailsPrivateState | null>(null);
  const [botControlledUserIds, setBotControlledUserIds] = useState<string[]>([]);
  const [connState, setConnState] = useState<
    "connecting" | "connected" | "reconnecting" | "error"
  >("connecting");
  const [turnEndsAt, setTurnEndsAt] = useState(0);
  const [introEndsAt, setIntroEndsAt] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());
  const [roleVisible, setRoleVisible] = useState(true);

  // Mobile-friendly view toggles
  const [boardZoomed, setBoardZoomed] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Pre-round dramatic ceremony state
  const [introStage, setIntroStage] = useState<"none" | "countdown" | "role">("none");
  const [countdownNum, setCountdownNum] = useState<3 | 2 | 1>(3);
  const lastIntroRoundRef = useRef<number>(0);
  const introTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  // Card selection & action state
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [rotation, setRotation] = useState<0 | 180>(0);
  const [fieldPatchMode, setFieldPatchMode] = useState(false);
  const [patchCardIds, setPatchCardIds] = useState<string[]>([]);
  const [patchGear, setPatchGear] = useState<GearType>("lantern");

  // Feedback, animations & chat
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<string | null>(null);
  const [spyglassVision, setSpyglassVision] = useState<{
    coord: string;
    kind: VaultKind;
  } | null>(null);
  const [flyingEffects, setFlyingEffects] = useState<FlyingCardEffect[]>([]);
  const [impactBursts, setImpactBursts] = useState<ImpactBurst[]>([]);
  const [flyingChatBubbles, setFlyingChatBubbles] = useState<FlyingChatBubble[]>([]);
  const [shakingPlayerId, setShakingPlayerId] = useState<string | null>(null);
  const [chatLog, setChatLog] = useState<GameChatEntry[]>([]);
  const [chatInput, setChatInput] = useState("");

  // DOM anchor refs for exact card flight geometry
  const playerRefs = useRef(new Map<string, HTMLDivElement>());
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const handRef = useRef<HTMLDivElement | null>(null);
  const deckRef = useRef<HTMLSpanElement | null>(null);

  const prevActiveIdRef = useRef("");
  const pendingSpyCoordRef = useRef<string | null>(null);
  const latestPubRef = useRef<TreasureTrailsPublicState | null>(null);
  const latestPrivRef = useRef<TreasureTrailsPrivateState | null>(null);
  const introEndsAtRef = useRef(0);
  const mobileChatOpenRef = useRef(false);
  const onExitGameRef = useRef(onExitGame);
  const manualReconnectRef = useRef<(() => void) | null>(null);
  const chatBubbleSeqRef = useRef(0);
  const chatBubbleTimersRef = useRef(new Set<ReturnType<typeof setTimeout>>());

  latestPubRef.current = pub;
  latestPrivRef.current = priv;
  introEndsAtRef.current = introEndsAt;
  mobileChatOpenRef.current = mobileChatOpen;
  onExitGameRef.current = onExitGame;

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const clearIntroTimers = useCallback(() => {
    for (const t of introTimersRef.current) clearTimeout(t);
    introTimersRef.current = [];
  }, []);

  useEffect(() => {
    const timers = chatBubbleTimersRef.current;
    return () => {
      clearIntroTimers();
      for (const t of timers) clearTimeout(t);
      timers.clear();
    };
  }, [clearIntroTimers]);

  const spawnChatBubble = useCallback((msg: GameChatEntry, localUserId: string) => {
    if (msg.senderUserId === "system") return;
    const seq = ++chatBubbleSeqRef.current;
    const offsets = [0, -14, 14, -8, 8];
    const id = `cb_${seq}_${Date.now()}`;
    const bubble: FlyingChatBubble = {
      id,
      senderName: msg.senderName,
      message: msg.message,
      isQuickBluff: Boolean(msg.isQuickBluff),
      isMe: msg.senderUserId === localUserId,
      offsetX: offsets[seq % offsets.length]!,
    };

    setFlyingChatBubbles((prev) => [...prev.slice(-3), bubble]);
    if (msg.senderUserId !== localUserId && !mobileChatOpenRef.current) {
      soundEngine.playEmotePop();
    }

    const timer = setTimeout(() => {
      chatBubbleTimersRef.current.delete(timer);
      setFlyingChatBubbles((prev) => prev.filter((b) => b.id !== id));
    }, 3650);
    chatBubbleTimersRef.current.add(timer);
  }, []);

  const currentRound = pub?.currentRound ?? 0;
  const currentPhase = pub?.phase;
  const myRole = priv?.role;

  useEffect(() => {
    if (!currentRound || currentPhase !== "IN_PROGRESS" || !myRole) return;
    if (lastIntroRoundRef.current === currentRound) return;

    const remainingIntro = introEndsAtRef.current - Date.now();
    // When rejoining an already-running round, jump straight onto the live board!
    if (remainingIntro < 800) {
      lastIntroRoundRef.current = currentRound;
      return;
    }

    lastIntroRoundRef.current = currentRound;
    clearIntroTimers();

    setIntroStage("countdown");
    setCountdownNum(3);
    soundEngine.playCountdownTick(3);

    const t1 = setTimeout(() => {
      setCountdownNum(2);
      soundEngine.playCountdownTick(2);
    }, 680);

    const t2 = setTimeout(() => {
      setCountdownNum(1);
      soundEngine.playCountdownTick(1);
    }, 1360);

    const t3 = setTimeout(() => {
      setIntroStage("role");
      soundEngine.playRoleReveal(myRole === "TRICKSTER");
    }, 2050);

    const finishDelay = Math.max(5400, remainingIntro);
    const t4 = setTimeout(() => {
      setIntroStage("none");
      soundEngine.playCountdownGo();
    }, finishDelay);

    introTimersRef.current = [t1, t2, t3, t4];
  }, [currentRound, currentPhase, myRole, clearIntroTimers]);

  const getCenterOf = useCallback((el: HTMLElement | null | undefined) => {
    if (!el) {
      return {
        x: typeof window !== "undefined" ? window.innerWidth / 2 : 360,
        y: typeof window !== "undefined" ? window.innerHeight / 2 : 360,
      };
    }
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, []);

  const getActorOrigin = useCallback(
    (actorId: string) => {
      if (actorId === myUserId && handRef.current) {
        return getCenterOf(handRef.current);
      }
      return getCenterOf(playerRefs.current.get(actorId));
    },
    [myUserId, getCenterOf]
  );

  const spawnFlying = useCallback(
    (effect: Omit<FlyingCardEffect, "id">, durationMs = 740) => {
      const id = `fly_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setFlyingEffects((prev) => [...prev, { ...effect, id }]);
      setTimeout(() => {
        setFlyingEffects((prev) => prev.filter((e) => e.id !== id));
      }, durationMs);
    },
    []
  );

  const spawnImpact = useCallback(
    (x: number, y: number, colorClass: string, icon: string, delayMs = 460) => {
      setTimeout(() => {
        const id = `imp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        setImpactBursts((prev) => [...prev, { id, x, y, colorClass, icon }]);
        setTimeout(() => {
          setImpactBursts((prev) => prev.filter((b) => b.id !== id));
        }, 650);
      }, delayMs);
    },
    []
  );

  const animateEvents = useCallback(
    (events: TreasureTrailsEvent[], state: TreasureTrailsPublicState) => {
      const lookupName = (uid: string) =>
        state.players.find((p) => p.userId === uid)?.displayName ?? "Explorer";

      for (const ev of events) {
        if (ev.type === "TILE_PLACED") {
          const from = getActorOrigin(ev.actorId);
          const to = getCenterOf(cellRefs.current.get(coordKey(ev.x, ev.y)));
          const placed = state.board[coordKey(ev.x, ev.y)];

          soundEngine.playTilePlace();
          spawnFlying({
            mode: "fly",
            fromX: from.x,
            fromY: from.y,
            toX: to.x,
            toY: to.y,
            kind: "PATH",
            label: "Path",
            edges: placed?.edges ?? { N: true, E: true, S: true, W: true },
            connectedCenter: placed?.connectedCenter ?? true,
          });
          spawnImpact(to.x, to.y, "border-emerald-400 bg-emerald-400/20", "✨", 460);
          setActionBanner(describeEvent(ev, lookupName));
        } else if (ev.type === "GEAR_BROKEN") {
          const from = getActorOrigin(ev.actorId);
          const to = getCenterOf(playerRefs.current.get(ev.targetId));

          soundEngine.playHazard();
          spawnFlying({
            mode: "fly",
            fromX: from.x,
            fromY: from.y,
            toX: to.x,
            toY: to.y,
            kind: "HAZARD",
            label: `Break ${GEAR_META[ev.gear].label}`,
            icon: "⚡",
          });
          spawnImpact(to.x, to.y, "border-terracotta-500 bg-terracotta-500/25", "💥", 480);
          setTimeout(() => {
            setShakingPlayerId(ev.targetId);
            setTimeout(() => setShakingPlayerId(null), 500);
          }, 430);
          setActionBanner(describeEvent(ev, lookupName));
        } else if (ev.type === "GEAR_REPAIRED") {
          const from = getActorOrigin(ev.actorId);
          const to = getCenterOf(playerRefs.current.get(ev.targetId));

          soundEngine.playRepair();
          spawnFlying({
            mode: "fly",
            fromX: from.x,
            fromY: from.y,
            toX: to.x,
            toY: to.y,
            kind: "REPAIR",
            label: `Fix ${GEAR_META[ev.gear].label}`,
            icon: "🔧",
          });
          spawnImpact(to.x, to.y, "border-emerald-400 bg-emerald-400/25", "✨", 480);
          setActionBanner(describeEvent(ev, lookupName));
        } else if (ev.type === "FIELD_PATCHED") {
          const from = getActorOrigin(ev.actorId);
          const to = getCenterOf(playerRefs.current.get(ev.actorId));

          soundEngine.playFieldPatch();
          spawnFlying({
            mode: "fly",
            fromX: from.x,
            fromY: from.y,
            toX: to.x,
            toY: to.y,
            kind: "FIELD_PATCH",
            label: "Field-Patch",
            icon: "🛠️",
          });
          spawnImpact(to.x, to.y, "border-amberwarm-400 bg-amberwarm-400/25", "🔧", 480);
          setActionBanner(describeEvent(ev, lookupName));
        } else if (ev.type === "VAULT_SCOUTED") {
          const actorPt = getActorOrigin(ev.actorId);
          const vaultKey = coordKey(ev.x, ev.y);
          const vaultPt = getCenterOf(cellRefs.current.get(vaultKey));

          soundEngine.playSpyglass();
          spawnFlying(
            {
              mode: "fly",
              fromX: actorPt.x,
              fromY: actorPt.y,
              toX: vaultPt.x,
              toY: vaultPt.y,
              kind: "SPYGLASS",
              label: "Spyglass",
              icon: "🔭",
            },
            680
          );

          setTimeout(() => {
            spawnFlying(
              {
                mode: "vault-peek",
                fromX: vaultPt.x,
                fromY: vaultPt.y,
                toX: actorPt.x,
                toY: actorPt.y,
                kind: "VAULT",
                label: "Sealed Vault",
                icon: "❓",
              },
              1400
            );
          }, 260);

          if (ev.actorId === myUserId) {
            pendingSpyCoordRef.current = vaultKey;
          }
          setActionBanner(describeEvent(ev, lookupName));
        } else if (ev.type === "TILE_CLEARED") {
          const from = getActorOrigin(ev.actorId);
          const to = getCenterOf(cellRefs.current.get(coordKey(ev.x, ev.y)));

          soundEngine.playBoulderClear();
          spawnFlying({
            mode: "fly",
            fromX: from.x,
            fromY: from.y,
            toX: to.x,
            toY: to.y,
            kind: "BOULDER_CLEAR",
            label: "Boulder Clear",
            icon: "💥",
          });
          spawnImpact(to.x, to.y, "border-orange-400 bg-orange-400/30", "💥", 460);
          setActionBanner(describeEvent(ev, lookupName));
        } else if (ev.type === "VAULT_REVEALED") {
          const pt = getCenterOf(cellRefs.current.get(coordKey(ev.x, ev.y)));
          if (ev.vaultKind === "TRUE_RELIC") {
            soundEngine.playVictory();
            spawnImpact(pt.x, pt.y, "border-amberwarm-400 bg-amberwarm-400/40", "🧭", 120);
          } else {
            soundEngine.playDecoyReveal();
            spawnImpact(pt.x, pt.y, "border-oat-300 bg-oat-300/30", "🏺", 120);
          }
          setActionBanner(describeEvent(ev, lookupName));
        } else if (ev.type === "CARD_DISCARDED") {
          const from = getActorOrigin(ev.actorId);
          const to = getCenterOf(deckRef.current);
          soundEngine.playCardDiscard();
          spawnFlying({
            mode: "fly",
            fromX: from.x,
            fromY: from.y,
            toX: to.x,
            toY: to.y,
            kind: "DISCARD",
            label: "Discard",
            icon: "🃏",
          });
          setActionBanner(describeEvent(ev, lookupName));
        } else if (ev.type === "ROUND_ENDED" || ev.type === "MATCH_ENDED") {
          soundEngine.playVictory();
        }
      }
    },
    [getActorOrigin, getCenterOf, myUserId, spawnFlying, spawnImpact]
  );

  useEffect(() => {
    if (!actionBanner) return;
    const t = setTimeout(() => setActionBanner(null), 2600);
    return () => clearTimeout(t);
  }, [actionBanner]);

  // Connect to Colyseus GameRoom with auto-reconnect + mobile background/visibility recovery
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
          // ignore closing dead socket
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
            state: TreasureTrailsPublicState;
            turnEndsAt: number;
            introEndsAt?: number;
            botControlledUserIds?: string[];
            events?: TreasureTrailsEvent[];
          }) => {
            if (syncWatchdog) {
              clearTimeout(syncWatchdog);
              syncWatchdog = null;
            }
            setConnState("connected");
            setPub(payload.state);
            setTurnEndsAt(payload.turnEndsAt);
            if (typeof payload.introEndsAt === "number") {
              setIntroEndsAt(payload.introEndsAt);
            }
            if (Array.isArray(payload.botControlledUserIds)) {
              setBotControlledUserIds(payload.botControlledUserIds);
            }

            const evs = payload.events ?? [];
            if (evs.length > 0) {
              requestAnimationFrame(() => {
                animateEvents(evs, payload.state);
              });
            }

            const introOver = Date.now() >= (payload.introEndsAt ?? 0);
            if (
              introOver &&
              payload.state.phase === "IN_PROGRESS" &&
              payload.state.activePlayerId === myUserId &&
              prevActiveIdRef.current !== myUserId
            ) {
              soundEngine.playTurnChime();
            }
            prevActiveIdRef.current = payload.state.activePlayerId;
          }
        );

        room.onMessage("game.privateState", (p: TreasureTrailsPrivateState) => {
          setPriv(p);
          if (pendingSpyCoordRef.current) {
            const key = pendingSpyCoordRef.current;
            const revealed = p.scoutedVaults[key];
            if (revealed) {
              pendingSpyCoordRef.current = null;
              setTimeout(() => {
                setSpyglassVision({ coord: key, kind: revealed });
                setTimeout(() => setSpyglassVision(null), 4200);
              }, 680);
            }
          }
        });

        room.onMessage(
          "game.actionRejected",
          (err: { code: string; message: string }) => {
            setErrorToast(err.message);
            setTimeout(() => setErrorToast(null), 3500);
          }
        );

        room.onMessage("game.chatReceived", (msg: GameChatEntry) => {
          setChatLog((prev) => [...prev.slice(-39), msg]);
          spawnChatBubble(msg, myUserId);
          if (!mobileChatOpenRef.current && msg.senderUserId !== myUserId) {
            setUnreadChatCount((c) => c + 1);
          }
        });

        room.onLeave(() => {
          if (disposed || mySeq !== connectSeq) return;
          roomRef.current = null;
          // Don't keep reconnecting if the match already finished cleanly
          if (latestPubRef.current?.phase === "COMPLETED") return;
          scheduleReconnect();
        });
      } catch (err) {
        if (disposed || mySeq !== connectSeq) return;
        const msg = ((err as Error)?.message || "").toLowerCase();
        // If room no longer exists on server (finished or aborted while away), return gracefully!
        if (
          msg.includes("not found") ||
          msg.includes("locked") ||
          msg.includes("4212")
        ) {
          onExitGameRef.current({
            finished: true,
            notice: "That Treasure Trails match has already ended.",
          });
          return;
        }
        console.error("Failed to join GameRoom:", err);
        if (reconnectAttempt < 6) {
          scheduleReconnect();
        } else {
          setConnState("error");
          setErrorToast("Connection interrupted. Tap Reconnect.");
        }
      }
    };

    manualReconnectRef.current = () => {
      reconnectAttempt = 0;
      void connect(true);
    };

    void connect(false);

    // Wake up cleanly after mobile minimize / lock screen / network switch!
    const handleResume = () => {
      if (disposed || document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastWakeCheckAt < 450) return;
      lastWakeCheckAt = now;
      setNowMs(now);

      const room = roomRef.current;
      if (!isRoomSocketOpen(room)) {
        reconnectAttempt = 0;
        void connect(true);
        return;
      }

      // Socket claims open — request immediate state sync + start 3.5s zombie-socket watchdog
      if (syncWatchdog) clearTimeout(syncWatchdog);
      try {
        room!.send("game.sync");
        syncWatchdog = setTimeout(() => {
          syncWatchdog = null;
          if (disposed) return;
          const dead = roomRef.current;
          roomRef.current = null;
          try {
            void dead?.leave(false);
          } catch {
            // ignore
          }
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

  const isIntroBlocking = introStage !== "none";
  const isMyTurn =
    !isIntroBlocking &&
    pub?.phase === "IN_PROGRESS" &&
    pub.activePlayerId === myUserId;

  const selectedCard: TreasureTrailsCard | null = useMemo(
    () => priv?.hand.find((c) => c.id === selectedCardId) ?? null,
    [priv, selectedCardId]
  );

  const myBrokenGears: GearType[] = useMemo(() => {
    if (!myPublic) return [];
    return (["lantern", "compass", "grapple"] as GearType[]).filter(
      (g) => !myPublic.gear[g]
    );
  }, [myPublic]);

  const validPlacementKeys = useMemo(() => {
    if (
      !pub ||
      !isMyTurn ||
      !selectedCard ||
      selectedCard.kind !== "PATH" ||
      myBrokenGears.length > 0 ||
      fieldPatchMode
    ) {
      return new Set<string>();
    }
    const coords = getValidPlacementsForCard(pub.board, selectedCard, rotation);
    return new Set(coords.map((c) => coordKey(c.x, c.y)));
  }, [pub, isMyTurn, selectedCard, rotation, myBrokenGears.length, fieldPatchMode]);

  function sendAction(action: TreasureTrailsAction) {
    roomRef.current?.send("game.action", action);
    setSelectedCardId(null);
    setFieldPatchMode(false);
    setPatchCardIds([]);
  }

  function handleCellClick(x: number, y: number) {
    if (!isMyTurn || !selectedCard || !pub) return;
    const key = coordKey(x, y);
    const cell = pub.board[key];

    if (selectedCard.kind === "PATH" && validPlacementKeys.has(key)) {
      sendAction({
        type: "PLACE_PATH",
        cardId: selectedCard.id,
        x,
        y,
        rotation,
      });
    } else if (
      selectedCard.kind === "SPYGLASS" &&
      cell?.kind === "VAULT" &&
      !cell.vaultRevealed
    ) {
      sendAction({ type: "PLAY_SPYGLASS", cardId: selectedCard.id, x, y });
    } else if (selectedCard.kind === "BOULDER_CLEAR" && cell?.kind === "PATH") {
      sendAction({ type: "PLAY_BOULDER_CLEAR", cardId: selectedCard.id, x, y });
    }
  }

  function handlePlayerGearClick(targetUserId: string, gear: GearType) {
    if (!isMyTurn || !selectedCard) return;
    if (selectedCard.kind === "HAZARD" && selectedCard.gear === gear) {
      sendAction({
        type: "PLAY_HAZARD",
        cardId: selectedCard.id,
        targetUserId,
      });
    } else if (
      selectedCard.kind === "REPAIR" &&
      selectedCard.gears.includes(gear)
    ) {
      sendAction({
        type: "PLAY_REPAIR",
        cardId: selectedCard.id,
        targetUserId,
        gear,
      });
    }
  }

  function handleCardSelect(card: TreasureTrailsCard) {
    if (fieldPatchMode) {
      setPatchCardIds((prev) => {
        if (prev.includes(card.id)) return prev.filter((id) => id !== card.id);
        if (prev.length >= 2) return [prev[1]!, card.id];
        return [...prev, card.id];
      });
      return;
    }
    setSelectedCardId((prev) => (prev === card.id ? null : card.id));
  }

  function nameOf(userId: string) {
    return pub?.players.find((p) => p.userId === userId)?.displayName ?? "Explorer";
  }

  const inServerIntro = nowMs < introEndsAt;
  const secondsLeft = inServerIntro
    ? pub?.config.turnSeconds ?? 45
    : Math.max(0, Math.ceil((turnEndsAt - nowMs) / 1000));

  const statusHintText = isIntroBlocking
    ? "Get ready for the expedition!"
    : !isMyTurn
      ? `Waiting for ${nameOf(pub?.activePlayerId ?? "")}...`
      : fieldPatchMode
        ? "Tap any 2 cards in your hand to patch broken gear."
        : !selectedCard
          ? myBrokenGears.length > 0
            ? "⚠️ Gear broken! Repair, Field-Patch (2 cards), or Discard."
            : "Tap a card below to play or discard."
          : selectedCard.kind === "PATH"
            ? myBrokenGears.length > 0
              ? "Repair broken gear before placing paths."
              : "Tap any glowing green cell on the map!"
            : selectedCard.kind === "HAZARD"
              ? `Tap an intact ${selectedCard.gear} icon above to break it!`
              : selectedCard.kind === "REPAIR"
                ? "Tap a broken gear icon above to repair!"
                : selectedCard.kind === "SPYGLASS"
                  ? "Tap any glowing Sealed Vault on the right edge!"
                  : "Tap any placed path tile to clear it!";

  if (!pub) {
    return (
      <div className="fixed inset-0 z-40 flex h-[100dvh] items-center justify-center bg-espresso/75 p-4 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-3xl bg-oat-50 px-7 py-6 text-center shadow-cozy">
          <div className="font-display text-xl font-bold text-espresso">
            {connState === "error"
              ? "Connection Interrupted"
              : connState === "reconnecting"
                ? "Rejoining Treasure Trails..."
                : "Dealing Treasure Trails..."}
          </div>
          <p className="mt-1 text-xs text-espresso-muted">
            {connState === "error"
              ? "Could not reach the match server right now."
              : "Shuffling secret roles and syncing the expedition map"}
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

  return (
    <div className="fixed inset-0 z-40 flex h-[100dvh] flex-col overflow-hidden bg-[#2D241E] text-espresso">
      {/* Compact Responsive Header (Single/Tight Row on Mobile, Rich on Desktop) */}
      <header className="shrink-0 border-b border-oat-300/20 bg-oat-50 px-2.5 py-1.5 shadow-sm sm:px-4 sm:py-2.5">
        <div className="flex items-center justify-between gap-1.5">
          {/* Left: Title (Desktop) + Turn Status + Deck */}
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
            <div className="hidden items-center gap-1.5 font-display text-lg font-bold text-espresso sm:flex">
              <Compass className="h-5 w-5 text-sage-700" />
              Treasure Trails
            </div>
            <span className="shrink-0 rounded-full bg-oat-200 px-2 py-0.5 text-[10px] font-bold text-espresso-soft sm:text-xs">
              R{pub.currentRound}/{pub.config.totalRounds}
            </span>
            <span
              ref={deckRef}
              className="shrink-0 rounded-full bg-amberwarm-100 px-2 py-0.5 text-[10px] font-bold text-amberwarm-600 sm:px-2.5 sm:text-xs"
            >
              🃏{pub.deckCount}
              <span className="hidden sm:inline"> · Disc {pub.discardCount}</span>
            </span>
            {pub.phase === "IN_PROGRESS" && (
              <span
                className={`truncate rounded-full px-2.5 py-0.5 text-[11px] font-extrabold sm:px-3 sm:text-xs ${
                  inServerIntro
                    ? "bg-amberwarm-400 text-espresso"
                    : isMyTurn
                      ? "animate-pulse bg-sage-500 text-white"
                      : "bg-oat-200 text-espresso"
                }`}
              >
                {inServerIntro
                  ? "Starting..."
                  : isMyTurn
                    ? `Your Turn · ${secondsLeft}s`
                    : `${nameOf(pub.activePlayerId)} · ${secondsLeft}s`}
              </span>
            )}
          </div>

          {/* Right: Secret Role Pill + Chat (Mobile) + Rules + Exit */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {priv && (
              <button
                type="button"
                onClick={() => setRoleVisible((v) => !v)}
                className={`inline-flex items-center gap-1 rounded-xl px-2 py-1 text-[10px] font-extrabold shadow-sm transition sm:px-3 sm:py-1.5 sm:text-xs ${
                  !roleVisible
                    ? "bg-oat-200 text-espresso"
                    : priv.role === "TRICKSTER"
                      ? "bg-terracotta-500 text-white"
                      : "bg-sage-500 text-white"
                }`}
              >
                {roleVisible ? <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : <EyeOff className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                {roleVisible
                  ? priv.role === "TRICKSTER"
                    ? "TRICKSTER"
                    : "TRAILBLAZER"
                  : "Hidden"}
              </button>
            )}

            {/* Mobile Chat / Bluff Drawer Button */}
            <button
              type="button"
              onClick={() => {
                setMobileChatOpen(true);
                setUnreadChatCount(0);
              }}
              aria-label="Table Chat & Log"
              className="relative inline-flex items-center justify-center rounded-xl bg-oat-200 p-1.5 text-espresso hover:bg-oat-300 lg:hidden"
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
              onClick={onOpenTutorial}
              aria-label="Rules"
              className="inline-flex items-center gap-1 rounded-xl bg-oat-200 p-1.5 text-xs font-bold text-espresso hover:bg-oat-300 sm:px-3 sm:py-1.5"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Rules</span>
            </button>

            <button
              type="button"
              onClick={() => onExitGame({ finished: pub.phase === "COMPLETED" })}
              aria-label="Back to Café"
              className="inline-flex items-center gap-1 rounded-xl bg-oat-200 p-1.5 text-xs font-bold text-espresso hover:bg-terracotta-100 hover:text-terracotta-700 sm:px-3 sm:py-1.5"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back to Café</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area: Player Strip + 9x5 Board + Desktop Sidebar */}
      <div className="grid min-h-0 flex-1 gap-2 overflow-hidden p-2 sm:gap-3 sm:p-3 lg:grid-cols-12">
        <div className="flex min-h-0 flex-col gap-1.5 overflow-hidden sm:gap-2.5 lg:col-span-9">
          {/* Compact Player Roster Strip */}
          <div className="flex shrink-0 gap-1.5 overflow-x-auto pb-0.5 sm:gap-2">
            {pub.players.map((p) => {
              const isActive =
                !inServerIntro &&
                pub.phase === "IN_PROGRESS" &&
                pub.activePlayerId === p.userId;
              const isMe = p.userId === myUserId;
              const isShaking = shakingPlayerId === p.userId;
              const isBotSub = botControlledUserIds.includes(p.userId);

              return (
                <div
                  key={p.userId}
                  ref={(el) => {
                    if (el) playerRefs.current.set(p.userId, el);
                    else playerRefs.current.delete(p.userId);
                  }}
                  className={`min-w-[118px] shrink-0 rounded-2xl border-2 px-2 py-1.5 transition sm:min-w-[152px] sm:px-3 sm:py-2 ${
                    isShaking
                      ? "animate-tt-shake border-terracotta-500 bg-terracotta-100"
                      : isActive
                        ? "border-amberwarm-400 bg-oat-50 shadow-md"
                        : "border-oat-300/60 bg-oat-50/90"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 text-[11px] font-bold sm:text-xs">
                    <span className="flex min-w-0 items-center gap-1 truncate text-espresso">
                      <span className="truncate">
                        {p.displayName}
                        {isMe ? " ★" : ""}
                      </span>
                      {isBotSub && (
                        <span
                          title="Café Bot subbing in while player is away"
                          className="inline-flex shrink-0 items-center gap-0.5 rounded bg-amberwarm-400/90 px-1 py-0.5 text-[8px] font-extrabold text-espresso"
                        >
                          <Bot className="h-2.5 w-2.5" /> Sub
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 rounded-md bg-amberwarm-100 px-1 py-0.5 text-[9px] text-amberwarm-600 sm:px-1.5 sm:text-[10px]">
                      ★{p.score}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold text-espresso-muted">
                      🃏{p.handCount}
                    </span>
                    <div className="flex gap-0.5 sm:gap-1">
                      {(["lantern", "compass", "grapple"] as GearType[]).map((g) => {
                        const intact = p.gear[g];
                        const canTargetHazard =
                          isMyTurn &&
                          selectedCard?.kind === "HAZARD" &&
                          selectedCard.gear === g &&
                          intact;
                        const canTargetRepair =
                          isMyTurn &&
                          selectedCard?.kind === "REPAIR" &&
                          selectedCard.gears.includes(g) &&
                          !intact;
                        const clickable = canTargetHazard || canTargetRepair;

                        return (
                          <button
                            key={g}
                            type="button"
                            disabled={!clickable}
                            onClick={() => handlePlayerGearClick(p.userId, g)}
                            title={`${p.displayName}'s ${GEAR_META[g].label}: ${intact ? "Intact" : "BROKEN"}`}
                            className={`flex h-5 w-5 items-center justify-center rounded-md border text-[11px] transition sm:h-6 sm:w-6 sm:rounded-lg sm:text-xs ${
                              !intact
                                ? "border-terracotta-500 bg-terracotta-100"
                                : "border-oat-300 bg-oat-100"
                            } ${
                              clickable
                                ? "animate-bounce cursor-pointer ring-2 ring-sage-500"
                                : "cursor-default"
                            }`}
                          >
                            <span className={!intact ? "opacity-45" : ""}>
                              {GEAR_META[g].icon}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 9x5 Expedition Board — Fits 100% On Mobile Screen By Default + Zoom Toggle! */}
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border-2 border-[#594436] bg-[#3E3026] shadow-inner sm:rounded-3xl">
            {/* Mobile Zoom / Fit-All Toggle Pill */}
            <button
              type="button"
              onClick={() => setBoardZoomed((z) => !z)}
              className="absolute right-2 top-2 z-20 inline-flex items-center gap-1 rounded-full bg-espresso/85 px-2.5 py-1 text-[10px] font-bold text-oat-50 shadow-md backdrop-blur hover:bg-espresso sm:hidden"
            >
              {boardZoomed ? (
                <>
                  <ZoomOut className="h-3 w-3" /> Fit All
                </>
              ) : (
                <>
                  <ZoomIn className="h-3 w-3" /> Zoom
                </>
              )}
            </button>

            {/* Live Floating Action Banner */}
            {actionBanner && !isIntroBlocking && (
              <div className="pointer-events-none absolute left-1/2 top-2 z-20 max-w-[78%] -translate-x-1/2 truncate rounded-full border border-amberwarm-400/50 bg-espresso/90 px-3 py-1 text-[11px] font-bold text-oat-50 shadow-lg backdrop-blur sm:px-4 sm:py-1.5 sm:text-xs">
                {actionBanner}
              </div>
            )}

            {/* Private Spyglass Vision Toast */}
            {spyglassVision && (
              <div className="pointer-events-none absolute bottom-3 left-1/2 z-30 w-[90%] max-w-sm -translate-x-1/2 rounded-2xl border-2 border-amberwarm-400 bg-oat-50 px-4 py-2.5 text-center shadow-2xl">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-amberwarm-600">
                  🔭 Secret Spyglass Intel (Only You See This!)
                </div>
                <div className="mt-0.5 font-display text-base font-bold text-espresso sm:text-lg">
                  Vault ({spyglassVision.coord}):{" "}
                  {spyglassVision.kind === "TRUE_RELIC" ? (
                    <span className="text-sage-700">★ GOLDEN COMPASS!</span>
                  ) : (
                    <span className="text-terracotta-700">🏺 Hollow Decoy</span>
                  )}
                </div>
              </div>
            )}

            {/* Scrollable Board Canvas (NEVER clips left/top edges!) */}
            <div
              className={`flex-1 overflow-auto p-1.5 sm:p-3 ${
                boardZoomed
                  ? "block"
                  : "flex items-center justify-center"
              }`}
            >
              <div
                className={`grid gap-1 sm:gap-1.5 ${
                  boardZoomed
                    ? "w-max"
                    : "w-full max-w-[720px]"
                }`}
                style={{
                  gridTemplateColumns: boardZoomed
                    ? `repeat(${BOARD_COLS}, 60px)`
                    : `repeat(${BOARD_COLS}, minmax(0, 1fr))`,
                }}
              >
                {Array.from({ length: BOARD_ROWS }).map((_, y) =>
                  Array.from({ length: BOARD_COLS }).map((__, x) => {
                    const key = coordKey(x, y);
                    const cell = pub.board[key];
                    const canPlaceHere = validPlacementKeys.has(key);
                    const canScoutHere =
                      isMyTurn &&
                      selectedCard?.kind === "SPYGLASS" &&
                      cell?.kind === "VAULT" &&
                      !cell.vaultRevealed;
                    const canClearHere =
                      isMyTurn &&
                      selectedCard?.kind === "BOULDER_CLEAR" &&
                      cell?.kind === "PATH";
                    const interactive = canPlaceHere || canScoutHere || canClearHere;

                    return (
                      <button
                        key={key}
                        ref={(el) => {
                          if (el) cellRefs.current.set(key, el);
                          else cellRefs.current.delete(key);
                        }}
                        type="button"
                        onClick={() => handleCellClick(x, y)}
                        disabled={!interactive}
                        className={`relative aspect-[3/4] rounded-lg transition sm:rounded-xl ${
                          cell
                            ? ""
                            : canPlaceHere
                              ? "cursor-pointer border-2 border-dashed border-emerald-400 bg-emerald-400/25 hover:bg-emerald-400/40"
                              : "border border-white/10 bg-white/[0.04]"
                        } ${
                          canScoutHere
                            ? "cursor-pointer ring-2 ring-amberwarm-400 sm:ring-4"
                            : canClearHere
                              ? "cursor-pointer ring-2 ring-terracotta-500 sm:ring-4"
                              : ""
                        }`}
                      >
                        {cell ? (
                          <PathTileSvg
                            edges={
                              cell.edges ?? { N: false, E: false, S: false, W: false }
                            }
                            connectedCenter={cell.connectedCenter}
                            kind={cell.kind}
                            vaultRevealed={cell.vaultRevealed}
                            vaultKind={cell.vaultKind}
                            privateScoutHint={priv?.scoutedVaults[key]}
                            compact
                          />
                        ) : canPlaceHere ? (
                          <span className="text-sm font-extrabold text-emerald-200 sm:text-lg">
                            +
                          </span>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {(connState === "reconnecting" || connState === "error") && (
              <div className="absolute left-1/2 top-2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amberwarm-400 bg-espresso/95 px-3.5 py-1 text-[11px] font-bold text-oat-50 shadow-lg backdrop-blur">
                <RefreshCw
                  className={`h-3 w-3 text-amberwarm-400 ${
                    connState === "reconnecting" ? "animate-spin" : ""
                  }`}
                />
                <span>
                  {connState === "reconnecting"
                    ? "Reconnecting..."
                    : "Disconnected"}
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
              <div className="absolute bottom-2 left-1/2 z-20 -translate-x-1/2 rounded-full bg-terracotta-500 px-3.5 py-1 text-[11px] font-bold text-white shadow-lg">
                {errorToast}
              </div>
            )}

            {myPublic?.autoPass && (
              <div className="absolute left-1/2 top-9 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-amberwarm-400 px-3.5 py-1 text-[11px] font-bold text-espresso shadow-lg">
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
            Expedition Log &amp; Table Talk
          </div>
          <GameChatAndLogPanel
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

      {/* Mobile-First Stacked Bottom Hand Dock (Full-Width Cards + Clean Action Bar Above!) */}
      <footer className="shrink-0 border-t border-oat-300/30 bg-oat-50 px-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-4 sm:py-3">
        <div className="mx-auto flex max-w-6xl flex-col gap-2">
          {/* Row 1: Action Buttons & Concise Turn Prompt (Full Width — Never Crushes Cards!) */}
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="text-[11px] font-bold text-espresso-soft sm:text-xs">
              {statusHintText}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {selectedCard?.kind === "PATH" && !fieldPatchMode && (
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r === 0 ? 180 : 0))}
                  className="inline-flex items-center gap-1 rounded-xl bg-amberwarm-400 px-3 py-1.5 text-[11px] font-bold text-espresso shadow-sm hover:bg-amberwarm-600 hover:text-white sm:text-xs"
                >
                  <RotateCw className="h-3.5 w-3.5" /> Flip 180°
                </button>
              )}

              {isMyTurn && selectedCard && !fieldPatchMode && (
                <button
                  type="button"
                  onClick={() =>
                    sendAction({ type: "DISCARD", cardId: selectedCard.id })
                  }
                  className="inline-flex items-center gap-1 rounded-xl bg-oat-200 px-3 py-1.5 text-[11px] font-bold text-espresso hover:bg-terracotta-100 hover:text-terracotta-700 sm:text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Discard
                </button>
              )}

              {isMyTurn && myBrokenGears.length > 0 && (priv?.hand.length ?? 0) >= 2 && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setFieldPatchMode((v) => !v);
                      setPatchCardIds([]);
                      setSelectedCardId(null);
                      setPatchGear(myBrokenGears[0]!);
                    }}
                    className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-bold shadow-sm sm:text-xs ${
                      fieldPatchMode
                        ? "bg-espresso text-oat-50"
                        : "bg-terracotta-100 text-terracotta-700"
                    }`}
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    {fieldPatchMode
                      ? `Pick 2 (${patchCardIds.length}/2)`
                      : "Field-Patch"}
                  </button>

                  {fieldPatchMode && patchCardIds.length === 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        sendAction({
                          type: "FIELD_PATCH",
                          cardIds: [patchCardIds[0]!, patchCardIds[1]!],
                          gear: patchGear,
                        })
                      }
                      className="rounded-xl bg-sage-500 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-sage-700 sm:text-xs"
                    >
                      Fix {GEAR_META[patchGear].label}!
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Row 2: Full-Width Card Hand (All 5-6 Cards Clearly Visible on Phone!) */}
          <div
            ref={handRef}
            className="flex w-full items-end gap-1.5 overflow-x-auto pb-0.5 pt-2 sm:gap-2"
          >
            {priv?.hand.map((card) => {
              const isSelected = fieldPatchMode
                ? patchCardIds.includes(card.id)
                : selectedCardId === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => handleCardSelect(card)}
                  className={`relative flex h-[88px] w-[62px] shrink-0 flex-col items-center justify-between rounded-xl border-2 p-1 text-center transition sm:h-28 sm:w-20 sm:rounded-2xl sm:p-1.5 ${
                    isSelected
                      ? "-translate-y-2 border-sage-500 bg-sage-100 shadow-lg"
                      : "border-oat-300 bg-white hover:-translate-y-1 hover:border-amberwarm-400"
                  }`}
                >
                  {card.kind === "PATH" ? (
                    <div className="h-[62px] w-[48px] sm:h-20 sm:w-16">
                      <PathTileSvg
                        edges={getOrientedEdges(
                          card.edges,
                          isSelected ? rotation : 0
                        )}
                        connectedCenter={card.connectedCenter}
                        compact
                      />
                    </div>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center gap-0.5">
                      <span className="text-xl sm:text-2xl">
                        {card.kind === "HAZARD"
                          ? "⚡"
                          : card.kind === "REPAIR"
                            ? "🔧"
                            : card.kind === "SPYGLASS"
                              ? "🔭"
                              : "💥"}
                      </span>
                      <span className="text-[7.5px] font-extrabold uppercase tracking-tight text-espresso-muted sm:text-[9px]">
                        {card.kind.replace("_", " ")}
                      </span>
                    </div>
                  )}
                  <span className="w-full truncate text-[8.5px] font-bold text-espresso sm:text-[9.5px]">
                    {card.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </footer>

      {/* Mobile Slide-Up Table Talk & Log Drawer */}
      {mobileChatOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-espresso/50 backdrop-blur-sm lg:hidden">
          <div className="flex h-[72dvh] w-full flex-col overflow-hidden rounded-t-3xl border-t-2 border-oat-300 bg-oat-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-oat-200 px-4 py-3">
              <span className="font-display text-base font-bold text-espresso">
                💬 Table Talk &amp; Expedition Log
              </span>
              <button
                type="button"
                onClick={() => setMobileChatOpen(false)}
                className="rounded-xl bg-oat-200 p-1.5 text-espresso"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <GameChatAndLogPanel
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

      {/* IN-GAME FLYING CHAT BUBBLES (Centered over the board, non-blocking, fade away!) */}
      {flyingChatBubbles.length > 0 && !isIntroBlocking && (
        <div className="pointer-events-none fixed inset-0 z-[48] flex flex-col items-center justify-center gap-2.5 px-4">
          {flyingChatBubbles.map((b) => (
            <div
              key={b.id}
              style={{ "--bubble-x": `${b.offsetX}px` } as React.CSSProperties}
              className={`animate-tt-chat-bubble relative max-w-[min(86vw,340px)] rounded-2xl border-2 px-4 py-2 text-center shadow-2xl backdrop-blur-md ${
                b.isQuickBluff
                  ? "border-amberwarm-400 bg-amberwarm-100/95 text-espresso"
                  : b.isMe
                    ? "border-sage-500 bg-oat-50/95 text-espresso"
                    : "border-oat-300 bg-oat-50/95 text-espresso"
              }`}
            >
              <div className="flex items-center justify-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-sage-700">
                <span>{b.isQuickBluff ? "🗣️" : "💬"}</span>
                <span className="truncate">{b.senderName}</span>
              </div>
              <div className="mt-0.5 break-words text-xs font-bold leading-snug text-espresso sm:text-sm">
                {b.message}
              </div>
              {/* Speech bubble tail */}
              <span
                className={`absolute -bottom-[7px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b-2 border-r-2 ${
                  b.isQuickBluff
                    ? "border-amberwarm-400 bg-amberwarm-100/95"
                    : b.isMe
                      ? "border-sage-500 bg-oat-50/95"
                      : "border-oat-300 bg-oat-50/95"
                }`}
              />
            </div>
          ))}
        </div>
      )}

      {/* FLYING CARD & IMPACT VFX STAGE */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {flyingEffects.map((fx) => (
          <div
            key={fx.id}
            style={
              {
                "--from-x": `${fx.fromX - 30}px`,
                "--from-y": `${fx.fromY - 40}px`,
                "--to-x": `${fx.toX - 30}px`,
                "--to-y": `${fx.toY - 40}px`,
              } as React.CSSProperties
            }
            className={`fixed left-0 top-0 flex h-20 w-[60px] flex-col items-center justify-center rounded-xl border-2 shadow-2xl sm:h-24 sm:w-[72px] sm:rounded-2xl ${
              fx.mode === "vault-peek" ? "animate-tt-vault-peek" : "animate-tt-fly"
            } ${
              fx.kind === "HAZARD" || fx.kind === "BOULDER_CLEAR"
                ? "border-terracotta-500 bg-terracotta-100"
                : fx.kind === "REPAIR" || fx.kind === "FIELD_PATCH"
                  ? "border-sage-500 bg-sage-100"
                  : fx.kind === "SPYGLASS"
                    ? "border-amberwarm-400 bg-amberwarm-100"
                    : fx.kind === "VAULT"
                      ? "border-amberwarm-400 bg-[#5D4A3E] text-oat-50"
                      : fx.kind === "DISCARD"
                        ? "border-oat-300 bg-espresso text-oat-50"
                        : "border-sage-500 bg-oat-50 p-1"
            }`}
          >
            {fx.kind === "PATH" && fx.edges ? (
              <PathTileSvg
                edges={fx.edges}
                connectedCenter={fx.connectedCenter ?? true}
                compact
              />
            ) : fx.kind === "VAULT" ? (
              <PathTileSvg
                edges={{ N: false, E: false, S: false, W: false }}
                connectedCenter={false}
                kind="VAULT"
                vaultRevealed={false}
                compact
              />
            ) : (
              <>
                <span className="text-2xl sm:text-3xl">{fx.icon}</span>
                <span className="mt-0.5 px-1 text-center text-[8px] font-extrabold leading-tight sm:text-[9px]">
                  {fx.label}
                </span>
              </>
            )}
          </div>
        ))}

        {impactBursts.map((b) => (
          <div
            key={b.id}
            style={{ left: b.x, top: b.y }}
            className={`animate-tt-impact fixed flex h-14 w-14 items-center justify-center rounded-full border-4 text-xl sm:h-16 sm:w-16 sm:text-2xl ${b.colorClass}`}
          >
            {b.icon}
          </div>
        ))}
      </div>

      {/* FULL-SCREEN COUNTDOWN + DRAMATIC SECRET ROLE REVEAL CEREMONY */}
      {isIntroBlocking && priv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1814]/90 p-5 backdrop-blur-md">
          {introStage === "countdown" ? (
            <div className="text-center">
              <div className="text-xs font-extrabold uppercase tracking-[0.25em] text-amberwarm-400">
                Round {pub.currentRound} • Starting Expedition
              </div>
              <div
                key={countdownNum}
                className="animate-tt-countdown mt-4 font-display text-8xl font-bold text-oat-50 drop-shadow-lg sm:text-9xl"
              >
                {countdownNum}
              </div>
              <p className="mt-4 text-sm font-semibold text-oat-200/80">
                Dealing hidden roles &amp; sealing the 3 vaults...
              </p>
            </div>
          ) : (
            <div className="animate-tt-role-card w-full max-w-md overflow-hidden rounded-[2rem] border-4 border-amberwarm-400 bg-oat-50 p-6 text-center shadow-2xl sm:p-7">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-espresso-muted">
                Your Secret Role • Round {pub.currentRound}
              </div>
              <div
                className={`mx-auto mt-3 flex h-20 w-20 items-center justify-center rounded-3xl text-4xl shadow-inner sm:mt-4 sm:h-24 sm:w-24 sm:text-5xl ${
                  priv.role === "TRICKSTER"
                    ? "bg-terracotta-100 ring-4 ring-terracotta-500/30"
                    : "bg-sage-100 ring-4 ring-sage-500/30"
                }`}
              >
                {priv.role === "TRICKSTER" ? "🦊" : "🧭"}
              </div>
              <h2
                className={`mt-3 font-display text-3xl font-bold tracking-tight sm:mt-4 sm:text-4xl ${
                  priv.role === "TRICKSTER" ? "text-terracotta-700" : "text-sage-700"
                }`}
              >
                {priv.role === "TRICKSTER" ? "TRICKSTER" : "TRAILBLAZER"}
              </h2>
              <p className="mt-2.5 text-xs font-semibold leading-relaxed text-espresso-soft sm:text-sm">
                {priv.role === "TRICKSTER"
                  ? "Work in secret to jam explorer gear, drop dead-ends, and misdirect the crew until the Expedition Deck runs dry!"
                  : "Team up to build an unbroken open trail from Base Camp to the hidden Golden Compass Vault before supplies run out!"}
              </p>
              <div className="mt-4 rounded-2xl bg-oat-100 px-4 py-2 text-xs font-bold text-espresso-muted">
                Keep your screen private! First turn:{" "}
                <span className="text-espresso">{nameOf(pub.activePlayerId)}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  clearIntroTimers();
                  setIntroStage("none");
                  soundEngine.playCountdownGo();
                }}
                className={`mt-4 w-full rounded-2xl py-3 font-display text-sm font-bold text-white shadow-sm transition ${
                  priv.role === "TRICKSTER"
                    ? "bg-terracotta-500 hover:bg-terracotta-700"
                    : "bg-sage-500 hover:bg-sage-700"
                }`}
              >
                Got It — Start Playing!
              </button>
            </div>
          )}
        </div>
      )}

      {/* Round End / Victory Celebration Modal */}
      {(pub.phase === "ROUND_END" || pub.phase === "COMPLETED") &&
        pub.lastRoundSummary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/65 p-4 backdrop-blur-sm">
            <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl border-2 border-amberwarm-400 bg-oat-50 p-5 text-center shadow-cozy sm:p-6">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amberwarm-100 text-3xl">
                {pub.lastRoundSummary.winningTeam === "TRAILBLAZER" ? "🧭" : "🦊"}
              </div>
              <h2 className="mt-3 font-display text-2xl font-bold text-espresso sm:text-3xl">
                {pub.lastRoundSummary.winningTeam === "TRAILBLAZER"
                  ? "Trailblazers Win!"
                  : "Tricksters Win!"}
              </h2>
              <p className="mt-1 text-xs font-semibold text-espresso-soft sm:text-sm">
                {pub.lastRoundSummary.reason}
              </p>

              <div className="mt-4 space-y-2 text-left">
                {pub.players.map((p) => {
                  const role = pub.lastRoundSummary!.revealedRoles[p.userId];
                  const earned = pub.lastRoundSummary!.starsAwarded[p.userId] ?? 0;
                  return (
                    <div
                      key={p.userId}
                      className="flex items-center justify-between rounded-2xl bg-oat-100 px-3.5 py-2 text-xs font-bold sm:px-4 sm:py-2.5 sm:text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span>{p.displayName}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ${
                            role === "TRICKSTER"
                              ? "bg-terracotta-100 text-terracotta-700"
                              : "bg-sage-100 text-sage-700"
                          }`}
                        >
                          {role === "TRICKSTER" ? "Trickster" : "Trailblazer"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {earned > 0 && (
                          <span className="text-xs text-sage-700">+{earned} ★</span>
                        )}
                        <span className="rounded-lg bg-amberwarm-100 px-2 py-0.5 text-xs text-amberwarm-600">
                          {p.score} ★
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 flex justify-center gap-3">
                {pub.phase === "ROUND_END" ? (
                  <button
                    type="button"
                    onClick={() => sendAction({ type: "ADVANCE_ROUND" })}
                    className="inline-flex items-center gap-2 rounded-2xl bg-sage-500 px-6 py-3 font-display text-sm font-bold text-white shadow-sm hover:bg-sage-700"
                  >
                    <Sparkles className="h-4 w-4" /> Start Round{" "}
                    {pub.currentRound + 1}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onExitGame({ finished: true })}
                    className="inline-flex items-center gap-2 rounded-2xl bg-sage-500 px-6 py-3 font-display text-sm font-bold text-white shadow-sm hover:bg-sage-700"
                  >
                    <Flame className="h-4 w-4" /> Return to Café Table
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
