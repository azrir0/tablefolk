"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Client as ColyseusClient, type Room } from "colyseus.js";
import {
  BookOpen,
  Bot,
  Check,
  Crown,
  Eye,
  Flame,
  Highlighter,
  LogOut,
  Map as MapIcon,
  MessageCircle,
  RefreshCw,
  RotateCw,
  Send,
  Sparkles,
  User,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  HEARTHVALE_QUICK_REACTIONS,
  countShrineFill,
  getTileTemplate,
  getValidPlacementsForTemplate,
  tileKey,
  type FolkKind,
  type HearthvaleAction,
  type HearthvaleEvent,
  type HearthvalePrivateState,
  type HearthvalePublicState,
  type HearthvaleTile,
  type SegmentKind,
  type TileRotation,
} from "@tablefolk/game-hearthvale";
import {
  getPlayerColorMeta,
  type BoardMarkerMode,
  type BoardMarkerStroke,
} from "@tablefolk/shared";
import { WS_BASE_URL, getStoredToken } from "@/lib/api";
import { soundEngine } from "@/lib/sound";
import { FOLK_COLOR_STYLES, HearthvaleTileSvg } from "./HearthvaleTileSvg";
import { BoardMarkerLayer, BoardMarkerToolbar } from "./BoardMarkerLayer";

interface HearthvaleOverlayProps {
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

interface FlyingTileEffect {
  id: string;
  fromX: number;
  fromY: number;
  midX: number;
  midY: number;
  toX: number;
  toY: number;
  actorName: string;
  templateId: string;
  rotation: TileRotation;
}

interface ScorePopup {
  id: string;
  text: string;
  kind: SegmentKind;
}

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

function featureLabel(kind: SegmentKind): string {
  if (kind === "TOWN") return "Town";
  if (kind === "ROAD") return "Road";
  return "Windmill";
}

function featureEmoji(kind: SegmentKind): string {
  if (kind === "TOWN") return "🏰";
  if (kind === "ROAD") return "🛤️";
  return "🌬️";
}

function describeEvent(ev: HearthvaleEvent, nameOf: (id: string) => string): string {
  switch (ev.type) {
    case "MATCH_STARTED":
      return `Hearthvale begins! ${nameOf(ev.startingPlayerId)} lays the first tile.`;
    case "TILE_PLACED": {
      const tpl = getTileTemplate(ev.templateId);
      return ev.timedOut
        ? `${nameOf(ev.actorId)} timed out — auto-placed ${tpl.name}.`
        : `${nameOf(ev.actorId)} placed ${tpl.name} at (${ev.x}, ${ev.y}).`;
    }
    case "FOLK_PLACED":
      return `${nameOf(ev.actorId)} sent a ${ev.folkKind === "MAYOR" ? "👑 Mayor" : "Villager"} onto (${ev.x}, ${ev.y}).`;
    case "FEATURE_SCORED": {
      const names = ev.winners.map(nameOf).join(" & ");
      return `${featureEmoji(ev.kind)} ${names} scored +${ev.points} ★ (${ev.isEndGame ? "Final " : ""}${featureLabel(ev.kind)})!`;
    }
    case "TILE_REDRAWN":
      return `${nameOf(ev.actorId)} swapped an unplaceable tile.`;
    case "MATCH_ENDED": {
      const names = ev.winners.map(nameOf).join(" & ");
      return `🏆 Match complete — ${names} wins Hearthvale!`;
    }
  }
}

interface HearthvaleChatPanelProps {
  recentEvents: HearthvaleEvent[];
  nameOf: (id: string) => string;
  chatLog: GameChatEntry[];
  chatInput: string;
  onChatInputChange: (val: string) => void;
  onQuickReact: (pill: string) => void;
  onSendChat: () => void;
}

function HearthvaleChatPanel({
  recentEvents,
  nameOf,
  chatLog,
  chatInput,
  onChatInputChange,
  onQuickReact,
  onSendChat,
}: HearthvaleChatPanelProps) {
  const logScrollRef = useRef<HTMLDivElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const scrollLog = () => {
      const el = logScrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    };
    scrollLog();
    const raf = requestAnimationFrame(scrollLog);
    return () => cancelAnimationFrame(raf);
  }, [recentEvents.length]);

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
            Cheer on a build — or warn rivals off your town!
          </p>
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
                  {m.isSpectator ? "👁️ " : ""}
                  {m.senderName}:{" "}
                </span>
              )}
              <span className="text-espresso">{m.message}</span>
            </div>
            {(m.count ?? 1) > 1 && (
              <span className="shrink-0 rounded-full bg-amberwarm-400/90 px-1.5 py-0.5 text-[10px] font-extrabold text-espresso">
                ×{m.count}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1 border-t border-oat-200 bg-oat-100/60 p-2">
        {HEARTHVALE_QUICK_REACTIONS.slice(0, 6).map((pill) => (
          <button
            key={pill}
            type="button"
            onClick={() => onQuickReact(pill)}
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
          placeholder="Say something to the table..."
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

export function HearthvaleOverlay({
  gameRoomId,
  myUserId,
  onExitGame,
  onOpenTutorial,
}: HearthvaleOverlayProps) {
  const roomRef = useRef<Room | null>(null);
  const [pub, setPub] = useState<HearthvalePublicState | null>(null);
  const [priv, setPriv] = useState<HearthvalePrivateState | null>(null);
  const [botControlledUserIds, setBotControlledUserIds] = useState<string[]>([]);
  const [rematchVotes, setRematchVotes] = useState<string[]>([]);
  const [connectedHumanCount, setConnectedHumanCount] = useState(1);
  const [connState, setConnState] = useState<
    "connecting" | "connected" | "reconnecting" | "error"
  >("connecting");
  const [turnEndsAt, setTurnEndsAt] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());

  // Mobile-friendly view toggles
  const [boardZoomed, setBoardZoomed] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Placement & Claim UI state
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [previewSpot, setPreviewSpot] = useState<{
    x: number;
    y: number;
    rotation: TileRotation;
  } | null>(null);
  const [selectedFolkKind, setSelectedFolkKind] = useState<FolkKind>("VILLAGER");

  // Feedback, animations & chat
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<string | null>(null);
  const [lastPlacedCoord, setLastPlacedCoord] = useState<string | null>(null);
  const [scoringFlashCoords, setScoringFlashCoords] = useState<Set<string>>(new Set());
  const [scorePopup, setScorePopup] = useState<ScorePopup | null>(null);
  const [flyingTiles, setFlyingTiles] = useState<FlyingTileEffect[]>([]);
  const [flyingChatBubbles, setFlyingChatBubbles] = useState<FlyingChatBubble[]>([]);
  const [chatLog, setChatLog] = useState<GameChatEntry[]>([]);
  const [chatInput, setChatInput] = useState("");

  // Spectators + Live Board Marker controls
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [markers, setMarkers] = useState<BoardMarkerStroke[]>([]);
  const [markerMode, setMarkerMode] = useState(false);
  const [markerDrawMode, setMarkerDrawMode] = useState<BoardMarkerMode>("fade");

  const playerRefs = useRef(new Map<string, HTMLDivElement>());
  const cellRefs = useRef(new Map<string, HTMLDivElement>());
  const handRef = useRef<HTMLDivElement | null>(null);

  const prevActiveIdRef = useRef("");
  const prevSessionIdRef = useRef("");
  const latestPubRef = useRef<HearthvalePublicState | null>(null);
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

    const id = `hvcb_${seq}_${now}`;
    const bubble: FlyingChatBubble = {
      id,
      senderName: msg.isSpectator ? `👁️ ${msg.senderName}` : msg.senderName,
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
    (events: HearthvaleEvent[], state: HearthvalePublicState) => {
      const lookupName = (uid: string) =>
        state.players.find((p) => p.userId === uid)?.displayName ?? "Architect";

      for (const ev of events) {
        if (ev.type === "TILE_PLACED") {
          const key = tileKey(ev.x, ev.y);
          setLastPlacedCoord(key);
          soundEngine.playTilePlace();

          const from =
            ev.actorId === myUserId && handRef.current
              ? getCenterOf(handRef.current)
              : getCenterOf(playerRefs.current.get(ev.actorId));
          const to = getCenterOf(cellRefs.current.get(key));
          const vw = typeof window !== "undefined" ? window.innerWidth : 800;
          const vh = typeof window !== "undefined" ? window.innerHeight : 700;
          const midX = Math.min(vw - 80, Math.max(80, (from.x + to.x) * 0.5));
          const midY = Math.min(vh - 170, Math.max(105, Math.min(from.y, to.y) - 34));

          const id = `hvfly_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          setFlyingTiles((prev) => [
            ...prev,
            {
              id,
              fromX: from.x,
              fromY: from.y,
              midX,
              midY,
              toX: to.x,
              toY: to.y,
              actorName: lookupName(ev.actorId),
              templateId: ev.templateId,
              rotation: ev.rotation,
            },
          ]);
          setTimeout(() => {
            setFlyingTiles((prev) => prev.filter((f) => f.id !== id));
          }, 1260);
          setActionBanner(describeEvent(ev, lookupName));
        } else if (ev.type === "FOLK_PLACED") {
          soundEngine.playEmotePop();
          setActionBanner(describeEvent(ev, lookupName));
        } else if (ev.type === "FEATURE_SCORED") {
          soundEngine.playVictory();
          const coordSet = new Set(ev.coords.map((c) => tileKey(c.x, c.y)));
          setScoringFlashCoords(coordSet);
          setTimeout(() => setScoringFlashCoords(new Set()), 1700);

          const names = ev.winners.map(lookupName).join(" & ");
          const popId = `sc_${Date.now()}`;
          setScorePopup({
            id: popId,
            kind: ev.kind,
            text: `${featureEmoji(ev.kind)} ${names} +${ev.points} ★`,
          });
          setTimeout(() => {
            setScorePopup((curr) => (curr?.id === popId ? null : curr));
          }, 2400);
          setActionBanner(describeEvent(ev, lookupName));
        } else if (ev.type === "MATCH_ENDED") {
          soundEngine.playVictory();
        }
      }
    },
    [getCenterOf, myUserId]
  );

  useEffect(() => {
    if (!actionBanner) return;
    const t = setTimeout(() => setActionBanner(null), 3200);
    return () => clearTimeout(t);
  }, [actionBanner]);

  // Connect to Colyseus HearthvaleRoom with auto-reconnect + mobile resume watchdog
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
            state: HearthvalePublicState;
            turnEndsAt: number;
            botControlledUserIds?: string[];
            rematchVotes?: string[];
            connectedHumanCount?: number;
            spectatorCount?: number;
            events?: HearthvaleEvent[];
          }) => {
            if (syncWatchdog) {
              clearTimeout(syncWatchdog);
              syncWatchdog = null;
            }
            setConnState("connected");
            if (payload.sessionId) {
              if (prevSessionIdRef.current && prevSessionIdRef.current !== payload.sessionId) {
                setLastPlacedCoord(null);
                setPreviewSpot(null);
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
            if (evs.length > 0) {
              requestAnimationFrame(() => {
                animateEvents(evs, payload.state);
              });
            }

            if (
              payload.state.phase === "IN_PROGRESS" &&
              payload.state.activePlayerId === myUserId &&
              prevActiveIdRef.current !== myUserId
            ) {
              soundEngine.playTurnChime();
            }
            prevActiveIdRef.current = payload.state.activePlayerId;
          }
        );

        room.onMessage("game.privateState", (p: HearthvalePrivateState) => {
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
            if (p?.scope === "all") {
              setMarkers([]);
            } else if (p?.userId) {
              setMarkers((prev) => prev.filter((m) => m.userId !== p.userId));
            }
          }
        );

        room.onMessage(
          "game.actionRejected",
          (err: { code: string; message: string }) => {
            setErrorToast(err.message);
            setTimeout(() => setErrorToast(null), 3500);
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
        const msg = ((err as Error)?.message || "").toLowerCase();
        if (msg.includes("not found") || msg.includes("locked") || msg.includes("4212")) {
          onExitGameRef.current({
            finished: true,
            notice: "That Hearthvale match has already ended.",
          });
          return;
        }
        console.error("Failed to join HearthvaleRoom:", err);
        if (reconnectAttempt < 6) {
          scheduleReconnect();
        } else {
          setConnState("error");
          setErrorToast("Connection interrupted. Tap Retry.");
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
      if (now - lastWakeCheckAt < 450) return;
      lastWakeCheckAt = now;
      setNowMs(now);

      const room = roomRef.current;
      if (!isRoomSocketOpen(room)) {
        reconnectAttempt = 0;
        void connect(true);
        return;
      }

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
  const isSpectator = Boolean(pub && !myPublic);
  const myColorMeta = useMemo(
    () => getPlayerColorMeta(myPublic?.color ?? myPublic?.seatIndex ?? 0),
    [myPublic]
  );
  const myMarkerCount = useMemo(
    () => markers.filter((m) => m.userId === myUserId).length,
    [markers, myUserId]
  );

  // Auto-exit marker mode when the match isn't live anymore
  useEffect(() => {
    if (pub && pub.phase !== "IN_PROGRESS") setMarkerMode(false);
  }, [pub]);

  const isMyTurn =
    !isSpectator && pub?.phase === "IN_PROGRESS" && pub.activePlayerId === myUserId;
  const isPlaceTileStep = isMyTurn && pub?.turnStep === "PLACE_TILE";
  const isPlaceFolkStep = isMyTurn && pub?.turnStep === "PLACE_FOLK";

  // Auto-select first hand tile when none selected (or previous tile was played)
  useEffect(() => {
    const hand = priv?.hand ?? [];
    if (hand.length === 0) {
      setSelectedTileId(null);
      setPreviewSpot(null);
      return;
    }
    if (!selectedTileId || !hand.some((t) => t.id === selectedTileId)) {
      setSelectedTileId(hand[0]!.id);
      setPreviewSpot(null);
    }
  }, [priv?.hand, selectedTileId]);

  // Auto-pick available Folk kind if Villagers run out or Mayor runs out
  useEffect(() => {
    if (!myPublic) return;
    if (selectedFolkKind === "VILLAGER" && myPublic.villagersLeft <= 0 && myPublic.mayorsLeft > 0) {
      setSelectedFolkKind("MAYOR");
    } else if (selectedFolkKind === "MAYOR" && myPublic.mayorsLeft <= 0 && myPublic.villagersLeft > 0) {
      setSelectedFolkKind("VILLAGER");
    }
  }, [myPublic, selectedFolkKind]);

  // Clear preview if no longer in PLACE_TILE step
  useEffect(() => {
    if (!isPlaceTileStep) {
      setPreviewSpot(null);
    }
  }, [isPlaceTileStep]);

  const selectedTile: HearthvaleTile | null = useMemo(
    () => priv?.hand.find((t) => t.id === selectedTileId) ?? null,
    [priv, selectedTileId]
  );

  const validPlacementsMap = useMemo(() => {
    const map = new Map<string, TileRotation[]>();
    if (!pub || !isPlaceTileStep || !selectedTile) return map;
    const spots = getValidPlacementsForTemplate(pub.board, selectedTile.templateId);
    for (const s of spots) {
      map.set(tileKey(s.x, s.y), s.rotations);
    }
    return map;
  }, [pub, isPlaceTileStep, selectedTile]);

  // Compute tight, balanced bounding box around placed tiles + 1-cell frontier padding
  const gridBounds = useMemo(() => {
    if (!pub) return { minX: -2, maxX: 2, minY: -2, maxY: 2 };
    let minX = 0;
    let maxX = 0;
    let minY = 0;
    let maxY = 0;
    for (const tile of Object.values(pub.board)) {
      if (tile.x < minX) minX = tile.x;
      if (tile.x > maxX) maxX = tile.x;
      if (tile.y < minY) minY = tile.y;
      if (tile.y > maxY) maxY = tile.y;
    }
    minX -= 1;
    maxX += 1;
    minY -= 1;
    maxY += 1;

    // Keep at least a 5x5 grid so Turn 1 feels balanced and centered
    while (maxX - minX + 1 < 5) {
      minX -= 1;
      maxX += 1;
    }
    while (maxY - minY + 1 < 5) {
      minY -= 1;
      maxY += 1;
    }
    return { minX, maxX, minY, maxY };
  }, [pub]);

  const cols = gridBounds.maxX - gridBounds.minX + 1;
  const rows = gridBounds.maxY - gridBounds.minY + 1;

  function sendAction(action: HearthvaleAction) {
    roomRef.current?.send("game.action", action);
    setPreviewSpot(null);
  }

  function handleFrontierTap(x: number, y: number) {
    if (markerMode || !isPlaceTileStep || !selectedTile) return;
    const key = tileKey(x, y);
    const validRots = validPlacementsMap.get(key);
    if (!validRots || validRots.length === 0) return;

    // Tapping the same preview spot cycles smoothly through its valid rotations!
    if (previewSpot && previewSpot.x === x && previewSpot.y === y) {
      const idx = validRots.indexOf(previewSpot.rotation);
      const nextRot = validRots[(idx + 1) % validRots.length]!;
      setPreviewSpot({ x, y, rotation: nextRot });
    } else {
      setPreviewSpot({ x, y, rotation: validRots[0]! });
    }
  }

  function handleRotatePreview() {
    if (!previewSpot) return;
    const validRots = validPlacementsMap.get(tileKey(previewSpot.x, previewSpot.y));
    if (!validRots || validRots.length <= 1) return;
    const idx = validRots.indexOf(previewSpot.rotation);
    setPreviewSpot({
      ...previewSpot,
      rotation: validRots[(idx + 1) % validRots.length]!,
    });
  }

  function handleConfirmPlacement() {
    if (!previewSpot || !selectedTile) return;
    sendAction({
      type: "PLACE_TILE",
      tileId: selectedTile.id,
      x: previewSpot.x,
      y: previewSpot.y,
      rotation: previewSpot.rotation,
    });
  }

  function nameOf(userId: string) {
    return pub?.players.find((p) => p.userId === userId)?.displayName ?? "Architect";
  }

  const secondsLeft = Math.max(0, Math.ceil((turnEndsAt - nowMs) / 1000));

  const statusHintText = !pub
    ? ""
    : markerMode
      ? "✏️ Marker Mode ON — drag to draw or tap to ping! Tap Done when finished."
      : !isMyTurn
      ? `Waiting for ${nameOf(pub.activePlayerId)}...`
      : isPlaceFolkStep
        ? "Tap a glowing pin on your new tile to place Folk — or tap Skip!"
        : previewSpot
          ? "Tap Rotate 90° (or tap tile again) to spin, then Confirm!"
          : "Tap any glowing green + spot on the valley map to preview your tile.";

  if (!pub) {
    return (
      <div className="fixed inset-0 z-40 flex h-[100dvh] items-center justify-center bg-espresso/75 p-4 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-3xl bg-oat-50 px-7 py-6 text-center shadow-cozy">
          <div className="font-display text-xl font-bold text-espresso">
            {connState === "error"
              ? "Connection Interrupted"
              : connState === "reconnecting"
                ? "Rejoining Hearthvale..."
                : "Shuffling Hearthvale Tiles..."}
          </div>
          <p className="mt-1 text-xs text-espresso-muted">
            {connState === "error"
              ? "Could not reach the match server right now."
              : "Setting up the sunlit valley and your 2-tile Architect Hand"}
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

  const previewValidRotCount = previewSpot
    ? validPlacementsMap.get(tileKey(previewSpot.x, previewSpot.y))?.length ?? 1
    : 0;

  return (
    <div className="fixed inset-0 z-40 flex h-[100dvh] flex-col overflow-hidden bg-[#2D241E] text-espresso">
      {/* Compact Responsive Header */}
      <header className="shrink-0 border-b border-oat-300/20 bg-oat-50 px-2.5 py-1.5 shadow-sm sm:px-4 sm:py-2.5">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
            <div className="hidden items-center gap-1.5 font-display text-lg font-bold text-espresso sm:flex">
              <MapIcon className="h-5 w-5 text-sage-700" />
              Hearthvale
            </div>
            <span className="shrink-0 rounded-full bg-amberwarm-100 px-2 py-0.5 text-[10px] font-bold text-amberwarm-600 sm:px-2.5 sm:text-xs">
              🗺️ {pub.deckCount} left
            </span>
            {pub.phase === "IN_PROGRESS" && (
              <span
                className={`truncate rounded-full px-2.5 py-0.5 text-[11px] font-extrabold sm:px-3 sm:text-xs ${
                  isMyTurn
                    ? isPlaceFolkStep
                      ? "animate-pulse bg-amberwarm-400 text-espresso"
                      : "animate-pulse bg-sage-500 text-white"
                    : "bg-oat-200 text-espresso"
                }`}
              >
                {isMyTurn
                  ? isPlaceFolkStep
                    ? `Claim Folk · ${secondsLeft}s`
                    : `Your Turn · ${secondsLeft}s`
                  : `${nameOf(pub.activePlayerId)} · ${secondsLeft}s`}
              </span>
            )}
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

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {!isSpectator && pub.phase === "IN_PROGRESS" && (
              <button
                type="button"
                onClick={() => setMarkerMode((v) => !v)}
                title="Draw or tap-ping on the valley so everyone can see!"
                className={`inline-flex items-center gap-1 rounded-xl px-2 py-1 text-[10px] font-extrabold shadow-sm transition sm:px-2.5 sm:py-1.5 sm:text-xs ${
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

            {/* Mobile Chat Drawer Button */}
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

      {/* Main Content Area: Player Strip + Auto-Fit Valley Board + Desktop Sidebar */}
      <div className="grid min-h-0 flex-1 gap-2 overflow-hidden p-2 sm:gap-3 sm:p-3 lg:grid-cols-12">
        <div className="flex min-h-0 flex-col gap-1.5 overflow-hidden sm:gap-2.5 lg:col-span-9">
          {/* Player Roster Strip */}
          <div className="flex shrink-0 gap-1.5 overflow-x-auto pb-0.5 sm:gap-2">
            {pub.players.map((p) => {
              const isActive =
                pub.phase === "IN_PROGRESS" && pub.activePlayerId === p.userId;
              const isMe = p.userId === myUserId;
              const isBotSub = botControlledUserIds.includes(p.userId);
              const colorStyle = FOLK_COLOR_STYLES[p.color];

              return (
                <div
                  key={p.userId}
                  ref={(el) => {
                    if (el) playerRefs.current.set(p.userId, el);
                    else playerRefs.current.delete(p.userId);
                  }}
                  className={`min-w-[122px] shrink-0 rounded-2xl border-2 px-2 py-1.5 transition sm:min-w-[156px] sm:px-3 sm:py-2 ${
                    isActive
                      ? "border-amberwarm-400 bg-oat-50 shadow-md"
                      : "border-oat-300/60 bg-oat-50/90"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 text-[11px] font-bold sm:text-xs">
                    <span className="flex min-w-0 items-center gap-1.5 truncate text-espresso">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full border border-white shadow-sm"
                        style={{ backgroundColor: colorStyle.fill }}
                      />
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
                    <span className="shrink-0 rounded-md bg-amberwarm-100 px-1.5 py-0.5 text-[10px] font-extrabold text-amberwarm-600">
                      ★{p.score}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-1.5 text-[10px] font-bold text-espresso-muted">
                    <span title="Remaining Villagers (strength 1)">
                      🧑 {p.villagersLeft}
                    </span>
                    <span
                      title="Mayor Pawn (strength 2)"
                      className={p.mayorsLeft > 0 ? "text-amberwarm-600" : "opacity-40"}
                    >
                      👑 {p.mayorsLeft}
                    </span>
                    <span title="Tiles in hand">🗺️ {p.handCount}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Growing Sunlit Valley Map */}
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border-2 border-[#594436] bg-[#3E3026] shadow-inner sm:rounded-3xl">
            {/* Zoom / Fit Map Toggle */}
            <button
              type="button"
              onClick={() => setBoardZoomed((z) => !z)}
              className="absolute right-2 top-2 z-20 inline-flex items-center gap-1 rounded-full bg-espresso/85 px-2.5 py-1 text-[10px] font-bold text-oat-50 shadow-md backdrop-blur hover:bg-espresso"
            >
              {boardZoomed ? (
                <>
                  <ZoomOut className="h-3 w-3" /> Fit Map
                </>
              ) : (
                <>
                  <ZoomIn className="h-3 w-3" /> Zoom
                </>
              )}
            </button>

            {/* Live Board Marker Floating Toolbar */}
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
            {actionBanner && !markerMode && (
              <div className="pointer-events-none absolute left-1/2 top-2 z-20 max-w-[74%] -translate-x-1/2 truncate rounded-full border border-amberwarm-400/50 bg-espresso/90 px-3 py-1 text-[11px] font-bold text-oat-50 shadow-lg backdrop-blur sm:px-4 sm:py-1.5 sm:text-xs">
                {actionBanner}
              </div>
            )}

            {/* Big Celebratory Score Burst Pill */}
            {scorePopup && (
              <div className="pointer-events-none absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-full border-2 border-amberwarm-400 bg-oat-50 px-4 py-1.5 font-display text-sm font-bold text-espresso shadow-2xl">
                {scorePopup.text}
              </div>
            )}

            {/* Scrollable & Auto-Fitted Valley Grid */}
            <div
              className={`flex-1 overflow-auto p-2 sm:p-4 ${
                boardZoomed || cols > 9 || rows > 7
                  ? "block"
                  : "flex items-center justify-center"
              }`}
            >
              <div
                className="relative mx-auto grid gap-0.5 sm:gap-1"
                style={{
                  width:
                    boardZoomed || cols > 9
                      ? `${cols * 76}px`
                      : `min(100%, ${cols * 86}px)`,
                  gridTemplateColumns:
                    boardZoomed || cols > 9
                      ? `repeat(${cols}, 72px)`
                      : `repeat(${cols}, minmax(0, 1fr))`,
                }}
              >
                {Array.from({ length: rows }).map((_, rIdx) => {
                  const y = gridBounds.minY + rIdx;
                  return Array.from({ length: cols }).map((__, cIdx) => {
                    const x = gridBounds.minX + cIdx;
                    const key = tileKey(x, y);
                    const placed = pub.board[key];
                    const isPreviewHere =
                      Boolean(previewSpot) &&
                      previewSpot!.x === x &&
                      previewSpot!.y === y &&
                      Boolean(selectedTile);
                    const validRots = validPlacementsMap.get(key);
                    const canPlaceHere = Boolean(validRots && validRots.length > 0);
                    const isLastPlaced = lastPlacedCoord === key && Boolean(placed);
                    const isScoring = scoringFlashCoords.has(key);
                    const isPendingFolkTile =
                      isPlaceFolkStep && pub.pendingTileCoord === key;

                    const shrineFill =
                      placed && getTileTemplate(placed.templateId).hasShrine
                        ? countShrineFill(pub.board, x, y).count
                        : undefined;

                    return (
                      <div
                        key={key}
                        ref={(el) => {
                          if (el) cellRefs.current.set(key, el);
                          else cellRefs.current.delete(key);
                        }}
                        className={`relative aspect-square rounded-md transition sm:rounded-lg ${
                          isLastPlaced && !isPendingFolkTile
                            ? "animate-tt-last-tile z-10"
                            : ""
                        } ${isPendingFolkTile ? "z-20 ring-2 ring-amberwarm-400 sm:ring-4" : ""}`}
                      >
                        {placed ? (
                          <>
                            <HearthvaleTileSvg
                              templateId={placed.templateId}
                              rotation={placed.rotation}
                              folk={placed.folk}
                              shrineFill={shrineFill}
                              isScoringFlash={isScoring}
                              compact={cols >= 8}
                            />
                            {isLastPlaced && !isPendingFolkTile && (
                              <span className="pointer-events-none absolute -right-1 -top-1 z-20 rounded-full bg-amberwarm-400 px-1 py-[1px] text-[7px] font-black uppercase leading-none text-espresso shadow sm:text-[8px]">
                                NEW
                              </span>
                            )}
                            {/* Interactive 1-Tap Feature Claim Pins (Step 2!) */}
                            {isPendingFolkTile &&
                              pub.claimableSegments.map((seg) => (
                                <button
                                  key={seg.segmentId}
                                  type="button"
                                  title={`Claim ${featureLabel(seg.kind)} with ${selectedFolkKind === "MAYOR" ? "Mayor (2)" : "Villager (1)"}`}
                                  onClick={() =>
                                    sendAction({
                                      type: "CLAIM_FEATURE",
                                      segmentId: seg.segmentId,
                                      folkKind: selectedFolkKind,
                                    })
                                  }
                                  style={{
                                    left: `${seg.ax}%`,
                                    top: `${seg.ay}%`,
                                  }}
                                  className="absolute z-30 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 animate-bounce items-center justify-center rounded-full border-2 border-white bg-amberwarm-400 text-xs shadow-lg transition hover:scale-125 hover:bg-sage-500 sm:h-8 sm:w-8 sm:text-sm"
                                >
                                  {featureEmoji(seg.kind)}
                                </button>
                              ))}
                          </>
                        ) : isPreviewHere && selectedTile ? (
                          <button
                            type="button"
                            onClick={() => handleFrontierTap(x, y)}
                            title="Tap to rotate 90°"
                            className="relative h-full w-full cursor-pointer rounded-md ring-2 ring-emerald-400 sm:rounded-lg sm:ring-4"
                          >
                            <HearthvaleTileSvg
                              templateId={selectedTile.templateId}
                              rotation={previewSpot!.rotation}
                              isGhost
                              compact
                            />
                            <span className="pointer-events-none absolute inset-x-0 bottom-0.5 mx-auto w-fit rounded-full bg-espresso/90 px-1.5 py-[1px] text-[8px] font-extrabold text-amberwarm-400">
                              {previewValidRotCount > 1 ? "↻ Tap Spin" : "Ready"}
                            </span>
                          </button>
                        ) : canPlaceHere ? (
                          <button
                            type="button"
                            onClick={() => handleFrontierTap(x, y)}
                            className="flex h-full w-full cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-emerald-400/90 bg-emerald-400/20 text-sm font-extrabold text-emerald-200 transition hover:bg-emerald-400/40 sm:rounded-lg sm:text-lg"
                          >
                            +
                          </button>
                        ) : (
                          <div className="h-full w-full rounded-md border border-white/[0.04] bg-white/[0.02] sm:rounded-lg" />
                        )}
                      </div>
                    );
                  });
                })}

                {/* Shared Live Board Marker / Highlighter Overlay */}
                <BoardMarkerLayer
                  minX={gridBounds.minX}
                  minY={gridBounds.minY}
                  cols={cols}
                  rows={rows}
                  strokes={markers}
                  drawingEnabled={markerMode && !isSpectator}
                  activeColor={myColorMeta.hex}
                  activeMode={markerDrawMode}
                  onCommitStroke={(points, color, mode) =>
                    roomRef.current?.send("game.markerAdd", { points, color, mode })
                  }
                />
              </div>
            </div>

            {/* Reconnect / Error / Auto-Pass Overlays */}
            {(connState === "reconnecting" || connState === "error") && (
              <div className="absolute left-1/2 top-2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amberwarm-400 bg-espresso/95 px-3.5 py-1 text-[11px] font-bold text-oat-50 shadow-lg backdrop-blur">
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
              <div className="absolute bottom-2 left-1/2 z-20 -translate-x-1/2 rounded-full bg-terracotta-500 px-3.5 py-1 text-[11px] font-bold text-white shadow-lg">
                {errorToast}
              </div>
            )}

            {myPublic?.autoPass && (
              <div className="absolute left-1/2 top-10 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-amberwarm-400 px-3.5 py-1 text-[11px] font-bold text-espresso shadow-lg">
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
            Valley Chronicle &amp; Table Talk
          </div>
          <HearthvaleChatPanel
            recentEvents={pub.recentEvents}
            nameOf={nameOf}
            chatLog={chatLog}
            chatInput={chatInput}
            onChatInputChange={setChatInput}
            onQuickReact={(pill) =>
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

      {/* Bottom Architect Hand & Contextual Action Dock (or Spectator Bar when watching) */}
      <footer className="shrink-0 border-t border-oat-300/30 bg-oat-50 px-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-4 sm:py-3">
        {isSpectator ? (
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 text-xs font-bold">
            <div className="flex items-center gap-2 text-espresso">
              <span className="inline-flex items-center gap-1 rounded-full bg-espresso px-2.5 py-1 text-[10px] font-extrabold text-amberwarm-400">
                <Eye className="h-3 w-3" /> Spectator Mode
              </span>
              <span className="text-[11px] text-espresso-soft sm:text-xs">
                Watching the valley grow live · Hands stay hidden · Cheer in chat anytime!
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
        <div className="mx-auto flex max-w-6xl flex-col gap-2">
          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="text-[11px] font-bold text-espresso-soft sm:text-xs">
              {statusHintText}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {/* Step 1 Preview Controls */}
              {isPlaceTileStep && previewSpot && (
                <>
                  {previewValidRotCount > 1 && (
                    <button
                      type="button"
                      onClick={handleRotatePreview}
                      className="inline-flex items-center gap-1 rounded-xl bg-amberwarm-400 px-3 py-1.5 text-[11px] font-bold text-espresso shadow-sm hover:bg-amberwarm-600 hover:text-white sm:text-xs"
                    >
                      <RotateCw className="h-3.5 w-3.5" /> Rotate 90°
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleConfirmPlacement}
                    className="inline-flex items-center gap-1 rounded-xl bg-sage-500 px-3.5 py-1.5 text-[11px] font-extrabold text-white shadow-sm hover:bg-sage-700 sm:text-xs"
                  >
                    <Check className="h-3.5 w-3.5" /> Place Tile
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewSpot(null)}
                    className="rounded-xl bg-oat-200 px-2.5 py-1.5 text-[11px] font-bold text-espresso hover:bg-oat-300 sm:text-xs"
                  >
                    Cancel
                  </button>
                </>
              )}

              {/* Step 2 Folk Placement Controls */}
              {isPlaceFolkStep && myPublic && (
                <>
                  <button
                    type="button"
                    disabled={myPublic.villagersLeft <= 0}
                    onClick={() => setSelectedFolkKind("VILLAGER")}
                    className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-bold shadow-sm transition disabled:opacity-40 sm:text-xs ${
                      selectedFolkKind === "VILLAGER"
                        ? "bg-sage-500 text-white"
                        : "bg-oat-200 text-espresso"
                    }`}
                  >
                    <User className="h-3.5 w-3.5" /> Villager ({myPublic.villagersLeft})
                  </button>
                  <button
                    type="button"
                    disabled={myPublic.mayorsLeft <= 0}
                    onClick={() => setSelectedFolkKind("MAYOR")}
                    className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-bold shadow-sm transition disabled:opacity-40 sm:text-xs ${
                      selectedFolkKind === "MAYOR"
                        ? "bg-amberwarm-400 text-espresso ring-2 ring-amberwarm-600"
                        : "bg-oat-200 text-espresso"
                    }`}
                  >
                    <Crown className="h-3.5 w-3.5" /> Mayor ×2 ({myPublic.mayorsLeft})
                  </button>
                  <button
                    type="button"
                    onClick={() => sendAction({ type: "SKIP_CLAIM" })}
                    className="rounded-xl bg-espresso px-3.5 py-1.5 text-[11px] font-extrabold text-oat-50 shadow-sm hover:bg-espresso-soft sm:text-xs"
                  >
                    Skip Folk →
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 2-Tile Architect Hand Dock */}
          <div
            ref={handRef}
            className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5 pt-1"
          >
            <div className="flex items-center gap-2.5">
              {(priv?.hand ?? []).map((tile, idx) => {
                const tpl = getTileTemplate(tile.templateId);
                const isSelected = selectedTileId === tile.id;
                const spotCount =
                  isPlaceTileStep && pub
                    ? getValidPlacementsForTemplate(pub.board, tile.templateId).length
                    : null;

                return (
                  <button
                    key={tile.id}
                    type="button"
                    onClick={() => {
                      setSelectedTileId(tile.id);
                      setPreviewSpot(null);
                    }}
                    className={`flex items-center gap-2 rounded-2xl border-2 p-1.5 pr-3 text-left transition ${
                      isSelected
                        ? "border-sage-500 bg-sage-100 shadow-md"
                        : "border-oat-300 bg-white hover:border-amberwarm-400"
                    }`}
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-oat-300 sm:h-16 sm:w-16">
                      <HearthvaleTileSvg
                        templateId={tile.templateId}
                        rotation={0}
                        compact
                      />
                    </div>
                    <div className="min-w-[82px]">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-espresso-muted">
                        Tile {idx + 1}
                      </div>
                      <div className="font-display text-xs font-bold text-espresso sm:text-sm">
                        {tpl.name}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] font-bold">
                        {tpl.hasCrest && (
                          <span className="rounded bg-amberwarm-100 px-1 text-amberwarm-600">
                            🛡️ +2
                          </span>
                        )}
                        {tpl.hasLantern && (
                          <span className="rounded bg-amberwarm-100 px-1 text-amberwarm-600">
                            🏮 ×2 Road
                          </span>
                        )}
                        {tpl.hasShrine && (
                          <span className="rounded bg-sage-100 px-1 text-sage-700">
                            🌬️ 9★
                          </span>
                        )}
                        {spotCount !== null && (
                          <span className="text-espresso-muted">
                            {spotCount} spot{spotCount === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Compact Scoring Legend on Desktop */}
            <div className="hidden rounded-2xl bg-oat-100 px-3 py-2 text-[10px] font-bold text-espresso-soft md:block">
              <div>🏰 Town: 3★ (2t) · 2★/t + 2★ 🛡️</div>
              <div>🛤️ Road: 1★/t · 🏮 2★/t · 🌬️ 9★</div>
            </div>
          </div>
        </div>
        )}
      </footer>

      {/* Mobile Slide-Up Table Talk & Log Drawer */}
      {mobileChatOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-espresso/50 backdrop-blur-sm lg:hidden">
          <div className="flex h-[72dvh] w-full flex-col overflow-hidden rounded-t-3xl border-t-2 border-oat-300 bg-oat-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-oat-200 px-4 py-3">
              <span className="font-display text-base font-bold text-espresso">
                💬 Table Talk &amp; Valley Chronicle
              </span>
              <button
                type="button"
                onClick={() => setMobileChatOpen(false)}
                className="rounded-xl bg-oat-200 p-1.5 text-espresso"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <HearthvaleChatPanel
              recentEvents={pub.recentEvents}
              nameOf={nameOf}
              chatLog={chatLog}
              chatInput={chatInput}
              onChatInputChange={setChatInput}
              onQuickReact={(pill) =>
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

      {/* IN-GAME WIDE-SPREAD FLYING CHAT BUBBLES (18-Bubble Storm, Non-Blocking!) */}
      {flyingChatBubbles.length > 0 && (
        <div className="pointer-events-none fixed inset-0 z-[48] overflow-hidden">
          {flyingChatBubbles.map((b) => (
            <div
              key={b.id}
              style={{ left: `${b.leftPct}%`, top: `${b.topPct}%` }}
              className={`animate-tt-chat-bubble fixed max-w-[min(64vw,220px)] rounded-2xl border-2 px-2.5 py-1 text-center shadow-xl backdrop-blur-md ${
                b.isQuickBluff
                  ? "border-amberwarm-400 bg-amberwarm-100/95 text-espresso"
                  : b.isMe
                    ? "border-sage-500 bg-oat-50/95 text-espresso"
                    : "border-oat-300 bg-oat-50/95 text-espresso"
              }`}
            >
              <div className="flex items-center justify-center gap-1 text-[9px] font-extrabold uppercase tracking-wide text-sage-700">
                <span>{b.isQuickBluff ? "🗣️" : "💬"}</span>
                <span className="max-w-[110px] truncate">{b.senderName}</span>
                {b.comboCount > 1 && (
                  <span className="rounded-full bg-amberwarm-400 px-1.5 py-[1px] text-[9px] font-black text-espresso shadow-sm">
                    ×{b.comboCount}
                  </span>
                )}
              </div>
              <div className="mt-0.5 break-words text-[11px] font-bold leading-tight text-espresso sm:text-xs">
                {b.message}
              </div>
              <span
                className={`absolute -bottom-[5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b-2 border-r-2 ${
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

      {/* FLYING TILE VFX STAGE */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {flyingTiles.map((fx) => (
          <div
            key={fx.id}
            style={
              {
                "--from-x": `${fx.fromX - 36}px`,
                "--from-y": `${fx.fromY - 36}px`,
                "--mid-x": `${fx.midX - 36}px`,
                "--mid-y": `${fx.midY - 36}px`,
                "--to-x": `${fx.toX - 36}px`,
                "--to-y": `${fx.toY - 36}px`,
              } as React.CSSProperties
            }
            className="animate-tt-fly fixed left-0 top-0 h-[72px] w-[72px] rounded-xl border-2 border-amberwarm-400 bg-oat-50 p-0.5 shadow-2xl"
          >
            <span className="absolute -top-5 left-1/2 max-w-[120px] -translate-x-1/2 truncate rounded-full bg-espresso/95 px-2 py-0.5 text-[9px] font-extrabold text-oat-50 shadow-md">
              {fx.actorName}
            </span>
            <HearthvaleTileSvg
              templateId={fx.templateId}
              rotation={fx.rotation}
              compact
            />
          </div>
        ))}
      </div>

      {/* Victory Celebration Modal + 1-Tap Play Again Rematch */}
      {pub.phase === "COMPLETED" && pub.endGameSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/65 p-4 backdrop-blur-sm">
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl border-2 border-amberwarm-400 bg-oat-50 p-5 text-center shadow-cozy sm:p-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amberwarm-100 text-3xl">
              🏆
            </div>
            <h2 className="mt-3 font-display text-2xl font-bold text-espresso sm:text-3xl">
              {pub.endGameSummary.winners.length > 1
                ? "Shared Valley Victory!"
                : `${nameOf(pub.endGameSummary.winners[0]!)} Wins!`}
            </h2>
            <p className="mt-1 text-xs font-semibold text-espresso-soft sm:text-sm">
              Final scores include unfinished Towns, Roads &amp; Windmills.
            </p>

            <div className="mt-4 space-y-2 text-left">
              {[...pub.players]
                .sort((a, b) => b.score - a.score || b.completedFeatures - a.completedFeatures)
                .map((p, idx) => {
                  const isWinner = pub.endGameSummary!.winners.includes(p.userId);
                  const style = FOLK_COLOR_STYLES[p.color];
                  return (
                    <div
                      key={p.userId}
                      className={`flex items-center justify-between rounded-2xl px-3.5 py-2.5 text-xs font-bold sm:px-4 sm:text-sm ${
                        isWinner
                          ? "border-2 border-amberwarm-400 bg-amberwarm-100/80"
                          : "bg-oat-100"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-espresso-muted">#{idx + 1}</span>
                        <span
                          className="h-3 w-3 rounded-full border border-white"
                          style={{ backgroundColor: style.fill }}
                        />
                        <span>{p.displayName}</span>
                        {isWinner && (
                          <span className="rounded-full bg-amberwarm-400 px-2 py-0.5 text-[10px] font-extrabold text-espresso">
                            👑 Master Architect
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-espresso-muted">
                          {p.completedFeatures} built
                        </span>
                        <span className="rounded-lg bg-white px-2.5 py-0.5 text-xs font-extrabold text-amberwarm-600 shadow-sm">
                          {p.score} ★
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-2.5">
              {isSpectator ? (
                <>
                  <span className="w-full text-center text-xs font-bold text-espresso-soft">
                    👁️ You&apos;re spectating — waiting to see if the architects go for a rematch...
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
                  ? `Waiting for Rematch (${rematchVotes.length}/${Math.max(1, connectedHumanCount)})`
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
    </div>
  );
}
