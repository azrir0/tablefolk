"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Client as ColyseusClient, type Room } from "colyseus.js";
import {
  BookOpen,
  Check,
  Coffee,
  Copy,
  Crown,
  Eye,
  Flag,
  Gamepad2,
  LogOut,
  MessageCircle,
  RefreshCw,
  Send,
  Share2,
  Smile,
  Sparkles,
  UserCheck,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  DEFAULT_AVATAR_CONFIG,
  EMOTE_LIST,
  QUICK_CHAT_MESSAGES,
  generateRandomAvatarConfig,
  type AvatarConfig,
  type ChatMessageDTO,
  type Direction,
  type InteractableDefinition,
  type UserProfileDTO,
} from "@tablefolk/shared";
import type {
  CafeEngineHandle,
  SyncedPlayerSnapshot,
  SyncedTableSnapshot,
} from "@tablefolk/cafe-engine";
import { AvatarSvg } from "@tablefolk/ui";
import {
  WS_BASE_URL,
  clearStoredToken,
  fetchMyActiveGame,
  fetchMyProfile,
  getStoredToken,
  loginAsGuest,
  resolvePrivateCafeCode,
  saveMyAvatar,
  submitPlayerReport,
  upgradeGuestAccount,
  type ActiveGameRef,
} from "@/lib/api";
import { soundEngine } from "@/lib/sound";
import { AvatarCustomizerModal } from "./AvatarCustomizerModal";
import { CafeLobbySwitcherModal } from "./CafeLobbySwitcherModal";
import { CashierTutorialModal } from "./CashierTutorialModal";
import {
  GameIcon,
  emoteIdToIconName,
  gameSlugToIconName,
} from "./GameIcons";
import { HearthvaleOverlay } from "./HearthvaleOverlay";
import { TableLobbyDrawer } from "./TableLobbyDrawer";
import { TreasureTrailsOverlay } from "./TreasureTrailsOverlay";
import { VelvetMasqueOverlay } from "./VelvetMasqueOverlay";
import { VirtualJoystick } from "./VirtualJoystick";
import { WardrobeModal } from "./WardrobeModal";

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

// Helpers to extract plain JS snapshots from Colyseus MapSchema/ArraySchema safely
interface RawPlayer {
  sessionId: string;
  userId: string;
  displayName: string;
  avatarJson: string;
  x: number;
  y: number;
  facing: string;
  isMoving: boolean;
  carryingGameSlug: string;
  seatedTableId: string;
  seatIndex: number;
  isReady: boolean;
  inGameSessionId: string;
  emote: string;
  emoteSeq: number;
  speechText: string;
  speechSeq: number;
}

interface RawSeat {
  seatIndex: number;
  status: string;
  occupantUserId: string;
  occupantName: string;
  isBot: boolean;
  isReady: boolean;
}

interface RawTable {
  tableId: string;
  name: string;
  category: string;
  capacity: number;
  status: string;
  selectedGameSlug: string;
  hostUserId: string;
  activeGameRoomId: string;
  seats: Iterable<RawSeat>;
}

interface RawCafeState {
  cafeName: string;
  instanceLabel: string;
  isPrivate: boolean;
  accessCode: string;
  players: { forEach: (cb: (p: RawPlayer) => void) => void };
  tables: { forEach: (cb: (t: RawTable) => void) => void };
}

function parseAvatarSafe(json: string): AvatarConfig {
  try {
    return JSON.parse(json) as AvatarConfig;
  } catch {
    return DEFAULT_AVATAR_CONFIG;
  }
}

export function CafeExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCodeParam = searchParams.get("code")?.trim().toUpperCase() || "";
  const roomIdParam = searchParams.get("room")?.trim() || "";

  // Auth & Profile state
  const [profile, setProfile] = useState<UserProfileDTO | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestAvatar, setGuestAvatar] = useState<AvatarConfig>(() =>
    generateRandomAvatarConfig(2026)
  );

  useEffect(() => {
    setGuestAvatar(generateRandomAvatarConfig());
  }, []);

  // Colyseus + Phaser refs
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CafeEngineHandle | null>(null);
  const cafeRoomRef = useRef<Room | null>(null);

  // Live synced café state
  const [roomMeta, setRoomMeta] = useState({
    roomId: "",
    cafeName: "Sunlit Oak Café",
    instanceLabel: "Connecting...",
    isPrivate: false,
    accessCode: "",
  });
  const [mySessionId, setMySessionId] = useState("");
  const [players, setPlayers] = useState<SyncedPlayerSnapshot[]>([]);
  const [tables, setTables] = useState<SyncedTableSnapshot[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "reconnecting" | "error"
  >("connecting");

  // Interactive UI states
  const [nearbyPrompt, setNearbyPrompt] = useState<{
    label: string;
    subtitle: string;
    interactableId: string;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showJoystick, setShowJoystick] = useState(false);

  // Modals & Drawers
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showWardrobeModal, setShowWardrobeModal] = useState(false);
  const [showCashierModal, setShowCashierModal] = useState(false);
  const [tutorialGameSlug, setTutorialGameSlug] = useState<string>("treasure-trails");
  const [showLobbySwitcher, setShowLobbySwitcher] = useState(false);
  const [showNoticeBoard, setShowNoticeBoard] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeEmail, setUpgradeEmail] = useState("");
  const [upgradePassword, setUpgradePassword] = useState("");
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  // Chat & Emotes & Moderation (starts closed on mobile so café floor & table drawer stay uncluttered!)
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCafeChat, setUnreadCafeChat] = useState(0);
  const [emoteOpen, setEmoteOpen] = useState(false);
  const [chatScope, setChatScope] = useState<"cafe" | "table">("cafe");
  const [chatMessages, setChatMessages] = useState<ChatMessageDTO[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [mutedUserIds, setMutedUserIds] = useState<Set<string>>(new Set());
  const [reportTarget, setReportTarget] = useState<{
    userId: string;
    name: string;
  } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const cafeChatScrollRef = useRef<HTMLDivElement | null>(null);

  // Active Board Game overlay (Treasure Trails / Hearthvale) + Rejoin tracker
  const [activeGame, setActiveGame] = useState<{
    gameRoomId: string;
    gameSlug: string;
    isSpectator?: boolean;
  } | null>(null);
  const [rejoinGame, setRejoinGame] = useState<ActiveGameRef | null>(null);

  const chatOpenRef = useRef(chatOpen);
  const activeGameRef = useRef<{
    gameRoomId: string;
    gameSlug: string;
    isSpectator?: boolean;
  } | null>(activeGame);
  const userIdRef = useRef<string | null>(null);
  chatOpenRef.current = chatOpen;
  activeGameRef.current = activeGame;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3600);
  }, []);

  const handleShareInvite = useCallback(async () => {
    if (typeof window === "undefined") return;
    const url =
      roomMeta.isPrivate && roomMeta.accessCode
        ? `${window.location.origin}/cafe?code=${roomMeta.accessCode}`
        : roomMeta.roomId
          ? `${window.location.origin}/cafe?room=${roomMeta.roomId}`
          : `${window.location.origin}/cafe`;

    const shareText =
      roomMeta.isPrivate && roomMeta.accessCode
        ? `Join my private TableFolk Café (${roomMeta.cafeName})! Code: ${roomMeta.accessCode}`
        : `Come hang out & play board games with me at ${roomMeta.cafeName}!`;

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Join me on TableFolk!",
          text: shareText,
          url,
        });
        return;
      } catch (err) {
        // User cancelled share sheet -> do nothing; other errors fall back to clipboard copy
        if ((err as Error)?.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopiedCode(true);
      showToast(
        roomMeta.isPrivate && roomMeta.accessCode
          ? `Invite link copied! Code: ${roomMeta.accessCode}`
          : "Café invite link copied! Send it to friends."
      );
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      showToast(`Share this link: ${url}`);
    }
  }, [roomMeta.accessCode, roomMeta.cafeName, roomMeta.isPrivate, roomMeta.roomId, showToast]);

  // Detect touch devices for auto-showing mobile joystick; open chat by default only on desktop
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("ontouchstart" in window) {
      setShowJoystick(true);
    }
    if (window.innerWidth >= 768) {
      setChatOpen(true);
    }
  }, []);

  // Restore profile from stored JWT token
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setAuthChecked(true);
      return;
    }
    fetchMyProfile()
      .then((p) => setProfile(p))
      .catch(() => clearStoredToken())
      .finally(() => setAuthChecked(true));
  }, []);

  // Pause Phaser canvas while playing a board game to save mobile battery!
  useEffect(() => {
    engineRef.current?.setPaused(Boolean(activeGame));
  }, [activeGame]);

  const handleInteract = useCallback((obj: InteractableDefinition) => {
    if (obj.type === "cashier") setShowCashierModal(true);
    else if (obj.type === "wardrobe") setShowWardrobeModal(true);
    else if (obj.type === "notice_board") setShowNoticeBoard(true);
    else if (obj.type === "exit") setShowLobbySwitcher(true);
  }, []);

  const [engineReady, setEngineReady] = useState(false);
  const connectSeqRef = useRef(0);
  const lastCafeTargetRef = useRef<
    { roomId?: string; accessCode?: string } | undefined
  >(undefined);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const pongWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalLeaveRef = useRef(false);
  const lastWakeCheckAtRef = useRef(0);
  const connectToCafeRef = useRef<
    ((
      opts?: { roomId?: string; accessCode?: string },
      meta?: { isReconnect?: boolean }
    ) => Promise<void>) | null
  >(null);

  const userId = profile?.userId ?? null;
  userIdRef.current = userId;

  // Mount Phaser 3 engine dynamically on client once authenticated
  useEffect(() => {
    if (!userId || !mountRef.current) return;
    let disposed = false;

    import("@tablefolk/cafe-engine").then(({ mountCafeEngine }) => {
      if (disposed || !mountRef.current) return;
      const handle = mountCafeEngine(mountRef.current, {
        onLocalMove: (payload) => {
          cafeRoomRef.current?.send("player.move", payload);
        },
        onChairClick: (tableId, seatIndex) => {
          cafeRoomRef.current?.send("table.reserveSeat", { tableId, seatIndex });
        },
        onSpectateTable: (tableId) => {
          cafeRoomRef.current?.send("table.spectate", { tableId });
        },
        onInteract: handleInteract,
        onNearbyPromptChange: setNearbyPrompt,
      });
      engineRef.current = handle;
      setEngineReady(true);
    });

    return () => {
      disposed = true;
      setEngineReady(false);
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [userId, handleInteract]);

  const latestPlayersRef = useRef<SyncedPlayerSnapshot[]>([]);
  const latestTablesRef = useRef<SyncedTableSnapshot[]>([]);
  const lastUiSigRef = useRef("");

  // Push initial sessionId + cached snapshots into Phaser ONLY when engine mounts or room changes
  useEffect(() => {
    if (!engineReady || !engineRef.current) return;
    if (mySessionId) {
      engineRef.current.setLocalSessionId(mySessionId);
    }
    if (latestPlayersRef.current.length > 0) {
      engineRef.current.syncPlayers(latestPlayersRef.current);
    }
    if (latestTablesRef.current.length > 0) {
      engineRef.current.syncTables(latestTablesRef.current);
    }
  }, [engineReady, mySessionId]);

  const clearReconnectTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pongWatchdogRef.current) {
      clearTimeout(pongWatchdogRef.current);
      pongWatchdogRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (intentionalLeaveRef.current) return;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    const attempt = reconnectAttemptRef.current;
    const delayMs = [900, 1800, 3500, 5000, 7000][Math.min(attempt, 4)]!;
    reconnectAttemptRef.current = attempt + 1;
    setConnectionStatus("reconnecting");
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      void connectToCafeRef.current?.(lastCafeTargetRef.current, {
        isReconnect: true,
      });
    }, delayMs);
  }, []);

  const connectToCafe = useCallback(
    async (
      opts?: { roomId?: string; accessCode?: string },
      meta?: { isReconnect?: boolean }
    ) => {
      const token = getStoredToken();
      if (!token) return;

      const isReconnect = Boolean(meta?.isReconnect);
      clearReconnectTimers();
      intentionalLeaveRef.current = false;
      if (!isReconnect) {
        reconnectAttemptRef.current = 0;
        lastCafeTargetRef.current = opts;
      }

      const mySeq = ++connectSeqRef.current;
      setConnectionStatus(isReconnect ? "reconnecting" : "connecting");

      if (cafeRoomRef.current) {
        const old = cafeRoomRef.current;
        cafeRoomRef.current = null;
        try {
          await old.leave();
        } catch {
          // Ignore errors closing a dead socket
        }
      }

      try {
        const client = new ColyseusClient(WS_BASE_URL);
        let room: Room;

        if (opts?.roomId) {
          try {
            room = await client.joinById(opts.roomId, {
              token,
              accessCode: opts.accessCode,
            });
          } catch (roomErr) {
            // If a specific room expired (while sleeping or from an older shared link), fall back gracefully!
            if (opts.accessCode) {
              if (isReconnect) {
                const resolved = await resolvePrivateCafeCode(opts.accessCode);
                room = await client.joinById(resolved.roomId, {
                  token,
                  accessCode: resolved.accessCode,
                });
              } else {
                throw roomErr;
              }
            } else {
              room = await client.joinOrCreate("cafe", { token });
              if (!isReconnect) {
                showToast("That café room closed — joined an active Sunlit Oak Café!");
              }
            }
          }
        } else if (opts?.accessCode) {
          const resolved = await resolvePrivateCafeCode(opts.accessCode);
          room = await client.joinById(resolved.roomId, {
            token,
            accessCode: resolved.accessCode,
          });
        } else {
          room = await client.joinOrCreate("cafe", { token });
        }

        // Guard against React StrictMode unmount or newer switch request
        if (mySeq !== connectSeqRef.current) {
          void room.leave();
          return;
        }

        cafeRoomRef.current = room;
        reconnectAttemptRef.current = 0;
        lastCafeTargetRef.current = {
          roomId: room.roomId,
          accessCode: opts?.accessCode,
        };
        lastUiSigRef.current = "";
        setMySessionId(room.sessionId);
        engineRef.current?.setLocalSessionId(room.sessionId);
        setConnectionStatus("connected");

        const syncFromState = (raw: RawCafeState) => {
          const nextPlayers: SyncedPlayerSnapshot[] = [];
          raw.players?.forEach((p) => {
            nextPlayers.push({
              sessionId: p.sessionId,
              userId: p.userId,
              displayName: p.displayName,
              avatarConfig: parseAvatarSafe(p.avatarJson),
              x: p.x,
              y: p.y,
              facing: (p.facing as Direction) || "south",
              isMoving: Boolean(p.isMoving),
              carryingGameSlug: p.carryingGameSlug || "",
              seatedTableId: p.seatedTableId || "",
              seatIndex: p.seatIndex ?? -1,
              inGameSessionId: p.inGameSessionId || "",
              emote: p.emote || "",
              emoteSeq: p.emoteSeq || 0,
              speechText: p.speechText || "",
              speechSeq: p.speechSeq || 0,
            });
          });

          const nextTables: SyncedTableSnapshot[] = [];
          raw.tables?.forEach((t) => {
            const seatArr = Array.from(t.seats || []).map((s) => ({
              seatIndex: s.seatIndex,
              status: s.status,
              occupantUserId: s.occupantUserId || "",
              occupantName: s.occupantName,
              isBot: Boolean(s.isBot),
              isReady: Boolean(s.isReady),
            }));
            nextTables.push({
              tableId: t.tableId,
              name: t.name,
              category: t.category,
              capacity: t.capacity,
              status: t.status,
              selectedGameSlug: t.selectedGameSlug,
              hostUserId: t.hostUserId,
              activeGameRoomId: t.activeGameRoomId,
              seats: seatArr,
            });
          });

          if (raw.accessCode) {
            lastCafeTargetRef.current = {
              roomId: room.roomId,
              accessCode: raw.accessCode,
            };
          }

          // Push directly to Phaser at full speed with ZERO React re-render overhead!
          latestPlayersRef.current = nextPlayers;
          latestTablesRef.current = nextTables;
          engineRef.current?.syncPlayers(nextPlayers);
          engineRef.current?.syncTables(nextTables);

          // Only re-render React HUD when non-movement UI data actually changes!
          const uiSig = JSON.stringify({
            cafeName: raw.cafeName,
            instanceLabel: raw.instanceLabel,
            accessCode: raw.accessCode,
            players: nextPlayers.map((p) => [
              p.sessionId,
              p.displayName,
              p.carryingGameSlug,
              p.seatedTableId,
              p.seatIndex,
              p.inGameSessionId,
            ]),
            tables: nextTables,
          });

          if (uiSig !== lastUiSigRef.current) {
            lastUiSigRef.current = uiSig;
            setRoomMeta({
              roomId: room.roomId,
              cafeName: raw.cafeName || "Sunlit Oak Café",
              instanceLabel: raw.instanceLabel || "Public",
              isPrivate: Boolean(raw.isPrivate),
              accessCode: raw.accessCode || "",
            });
            setPlayers(nextPlayers);
            setTables(nextTables);
          }
        };

        room.onStateChange((state) => {
          syncFromState(state as unknown as RawCafeState);
        });

        // Also flush immediately if initial state already decoded
        if (room.state) {
          syncFromState(room.state as unknown as RawCafeState);
        }

        room.onMessage("cafe.pong", () => {
          if (pongWatchdogRef.current) {
            clearTimeout(pongWatchdogRef.current);
            pongWatchdogRef.current = null;
          }
        });

        room.onMessage("game.rejoinAvailable", (ag: ActiveGameRef) => {
          setRejoinGame(ag);
        });

        room.onMessage("chat.received", (msg: ChatMessageDTO) => {
          setChatMessages((prev) => [...prev.slice(-59), msg]);
          if (!chatOpenRef.current && msg.senderUserId !== userIdRef.current) {
            setUnreadCafeChat((c) => c + 1);
          }
        });

        room.onMessage("cafe.error", (p: { message: string }) => {
          showToast(p.message);
        });

        room.onMessage("cafe.notice", (p: { message: string }) => {
          showToast(p.message);
        });

        room.onMessage("player.emoted", () => {
          soundEngine.playEmotePop();
        });

        room.onMessage(
          "table.gameStarted",
          (p: { tableId: string; gameRoomId: string; gameSlug: string }) => {
            soundEngine.playTurnChime();
            const slug = p.gameSlug || "treasure-trails";
            setRejoinGame({
              gameRoomId: p.gameRoomId,
              cafeRoomId: room.roomId,
              tableId: p.tableId,
              gameSlug: slug,
              startedAt: Date.now(),
            });
            setActiveGame({ gameRoomId: p.gameRoomId, gameSlug: slug });
          }
        );

        room.onMessage(
          "table.spectateStarted",
          (p: {
            tableId: string;
            tableName?: string;
            gameRoomId: string;
            gameSlug: string;
          }) => {
            const slug = p.gameSlug || "treasure-trails";
            showToast(`Spectating ${p.tableName || "live match"}!`);
            setActiveGame({
              gameRoomId: p.gameRoomId,
              gameSlug: slug,
              isSpectator: true,
            });
          }
        );

        room.onLeave(() => {
          if (mySeq !== connectSeqRef.current || intentionalLeaveRef.current) return;
          cafeRoomRef.current = null;
          scheduleReconnect();
        });
      } catch (err) {
        if (mySeq !== connectSeqRef.current) return;
        console.error("Cafe connection error:", err);
        if (isReconnect && reconnectAttemptRef.current < 5) {
          scheduleReconnect();
          return;
        }
        setConnectionStatus("error");
        showToast((err as Error).message || "Could not connect to café server.");
      }
    },
    [clearReconnectTimers, scheduleReconnect, showToast]
  );

  connectToCafeRef.current = connectToCafe;

  // Connect automatically once authenticated userId is ready + check for any active match to rejoin
  useEffect(() => {
    if (!userId) return;
    void connectToCafe(
      inviteCodeParam
        ? { accessCode: inviteCodeParam }
        : roomIdParam
          ? { roomId: roomIdParam }
          : undefined
    );
    void fetchMyActiveGame()
      .then((ag) => {
        if (ag) setRejoinGame(ag);
      })
      .catch(() => {});

    return () => {
      intentionalLeaveRef.current = true;
      connectSeqRef.current += 1;
      clearReconnectTimers();
      const current = cafeRoomRef.current;
      cafeRoomRef.current = null;
      void current?.leave();
    };
  }, [userId, inviteCodeParam, roomIdParam, connectToCafe, clearReconnectTimers]);

  // Recover seamlessly when returning from mobile browser minimize / sleep / network switch!
  useEffect(() => {
    if (!userId) return;

    const handleResume = () => {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastWakeCheckAtRef.current < 450) return;
      lastWakeCheckAtRef.current = now;

      // Clear any stuck touch/keyboard state and wake Phaser loop if visible
      engineRef.current?.resetInput();
      if (!activeGameRef.current) {
        engineRef.current?.setPaused(false);
        void fetchMyActiveGame()
          .then((ag) => setRejoinGame(ag))
          .catch(() => {});
      }

      const room = cafeRoomRef.current;
      if (!isRoomSocketOpen(room)) {
        reconnectAttemptRef.current = 0;
        void connectToCafeRef.current?.(lastCafeTargetRef.current, {
          isReconnect: true,
        });
        return;
      }

      // Socket claims open — verify it's not a half-open mobile zombie socket via ping watchdog
      if (pongWatchdogRef.current) clearTimeout(pongWatchdogRef.current);
      try {
        room!.send("cafe.ping");
        pongWatchdogRef.current = setTimeout(() => {
          pongWatchdogRef.current = null;
          if (intentionalLeaveRef.current) return;
          const dead = cafeRoomRef.current;
          cafeRoomRef.current = null;
          try {
            void dead?.leave(false);
          } catch {
            // ignore
          }
          reconnectAttemptRef.current = 0;
          void connectToCafeRef.current?.(lastCafeTargetRef.current, {
            isReconnect: true,
          });
        }, 3500);
      } catch {
        reconnectAttemptRef.current = 0;
        void connectToCafeRef.current?.(lastCafeTargetRef.current, {
          isReconnect: true,
        });
      }
    };

    document.addEventListener("visibilitychange", handleResume);
    window.addEventListener("pageshow", handleResume);
    window.addEventListener("online", handleResume);
    return () => {
      document.removeEventListener("visibilitychange", handleResume);
      window.removeEventListener("pageshow", handleResume);
      window.removeEventListener("online", handleResume);
    };
  }, [userId]);

  const myPlayer = useMemo(
    () => players.find((p) => p.sessionId === mySessionId) ?? null,
    [players, mySessionId]
  );

  const mySeatedTable = useMemo(
    () =>
      myPlayer?.seatedTableId
        ? tables.find((t) => t.tableId === myPlayer.seatedTableId) ?? null
        : null,
    [myPlayer, tables]
  );

  // If the table for a known rejoinGame finished while we're in the café, clear the stale banner!
  useEffect(() => {
    if (!rejoinGame) return;
    if (rejoinGame.cafeRoomId && rejoinGame.cafeRoomId !== roomMeta.roomId) return;
    const tbl = tables.find((t) => t.tableId === rejoinGame.tableId);
    if (tbl && tbl.activeGameRoomId !== rejoinGame.gameRoomId) {
      setRejoinGame(null);
    }
  }, [tables, rejoinGame, roomMeta.roomId]);

  const effectiveRejoinGame = useMemo(() => {
    if (rejoinGame) {
      return {
        gameRoomId: rejoinGame.gameRoomId,
        gameSlug: rejoinGame.gameSlug || "treasure-trails",
      };
    }
    if (mySeatedTable?.status === "IN_PROGRESS" && mySeatedTable.activeGameRoomId) {
      return {
        gameRoomId: mySeatedTable.activeGameRoomId,
        gameSlug:
          mySeatedTable.selectedGameSlug ||
          (mySeatedTable.capacity < 3 ? "hearthvale" : "treasure-trails"),
      };
    }
    return null;
  }, [rejoinGame, mySeatedTable]);

  const myReady = useMemo(() => {
    if (!mySeatedTable || !myPlayer) return false;
    return mySeatedTable.seats[myPlayer.seatIndex]?.isReady ?? false;
  }, [mySeatedTable, myPlayer]);

  const visibleChat = useMemo(
    () =>
      chatMessages.filter((m) => {
        if (mutedUserIds.has(m.senderUserId)) return false;
        if (chatScope === "table") return m.scope === "table";
        return true;
      }),
    [chatMessages, mutedUserIds, chatScope]
  );

  // Auto-scroll Café Chat to the latest message whenever opened, switched scope, or new msg arrives
  useEffect(() => {
    if (!chatOpen || activeGame) return;
    setUnreadCafeChat(0);
    const scrollBottom = () => {
      const el = cafeChatScrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    };
    scrollBottom();
    const raf = requestAnimationFrame(scrollBottom);
    return () => cancelAnimationFrame(raf);
  }, [chatOpen, chatScope, visibleChat.length, activeGame]);

  // Inline Instant Guest Join Gate if arriving directly at /cafe or via invite link
  if (authChecked && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-oat-100 p-4">
        <div className="w-full max-w-md rounded-3xl border-2 border-oat-300 bg-oat-50 p-6 shadow-cozy">
          <div className="text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sage-500 text-white">
              <Coffee className="h-6 w-6" />
            </span>
            <h1 className="mt-3 font-display text-2xl font-bold text-espresso">
              {inviteCodeParam
                ? `Invited to Private Café (${inviteCodeParam})`
                : "Step Into TableFolk"}
            </h1>
            <p className="mt-1 text-xs text-espresso-soft">
              Pick a quick display name to enter immediately as a guest!
            </p>
          </div>

          <div className="my-4 flex flex-col items-center">
            <AvatarSvg config={guestAvatar} size={96} />
            <button
              type="button"
              onClick={() => setGuestAvatar(generateRandomAvatarConfig())}
              className="mt-2 rounded-xl bg-oat-200 px-3 py-1 text-xs font-bold text-espresso hover:bg-oat-300"
            >
              Shuffle Look
            </button>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await loginAsGuest(
                guestName.trim() || "Cozy Visitor",
                guestAvatar
              );
              setProfile(res.profile);
            }}
            className="space-y-3"
          >
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Your nickname..."
              maxLength={24}
              required
              className="w-full rounded-xl border border-oat-300 bg-white px-4 py-2.5 text-sm font-bold outline-none focus:border-sage-500"
            />
            <button
              type="submit"
              className="w-full rounded-2xl bg-sage-500 py-3 font-display text-sm font-bold text-white hover:bg-sage-700"
            >
              Enter Café Now
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-[#F3E7D3] select-none">
      {/* Full-Viewport Phaser 3 Walkable Café */}
      <div ref={mountRef} className="h-full w-full" />

      {/* TOP FLOATING BAR */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-20 flex flex-wrap items-center justify-between gap-2 p-3">
        {/* Left: Café Instance Pill + Private Invite Copy */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLobbySwitcher(true)}
            className="flex items-center gap-2 rounded-2xl border border-oat-300 bg-oat-50/95 px-3.5 py-2 shadow-cozy backdrop-blur transition hover:bg-white"
          >
            <Coffee className="h-4 w-4 text-sage-700" />
            <div className="text-left leading-tight">
              <div className="font-display text-sm font-bold text-espresso">
                {roomMeta.cafeName}
              </div>
              <div className="text-[10px] font-bold text-espresso-muted">
                {roomMeta.instanceLabel} • {players.length} Online
              </div>
            </div>
          </button>

          {roomMeta.roomId && (
            <button
              type="button"
              onClick={() => void handleShareInvite()}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-amberwarm-400 bg-amberwarm-100/95 px-3 py-2 text-xs font-bold text-espresso shadow-sm transition hover:bg-amberwarm-400"
            >
              {copiedCode ? (
                <Check className="h-3.5 w-3.5 text-sage-700" />
              ) : roomMeta.isPrivate && roomMeta.accessCode ? (
                <Copy className="h-3.5 w-3.5" />
              ) : (
                <Share2 className="h-3.5 w-3.5" />
              )}
              {roomMeta.isPrivate && roomMeta.accessCode
                ? `Code: ${roomMeta.accessCode}`
                : "Invite"}
            </button>
          )}

          {!activeGame &&
            tables.some((t) => t.status === "IN_PROGRESS" && Boolean(t.activeGameRoomId)) && (
              <button
                type="button"
                onClick={() => {
                  const live = tables.filter(
                    (t) => t.status === "IN_PROGRESS" && Boolean(t.activeGameRoomId)
                  );
                  if (live.length === 1) {
                    cafeRoomRef.current?.send("table.spectate", {
                      tableId: live[0]!.tableId,
                    });
                  } else {
                    setShowNoticeBoard(true);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-sage-500 bg-sage-500 px-3 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-sage-700"
              >
                <Eye className="h-3.5 w-3.5" />
                Watch Live (
                {
                  tables.filter(
                    (t) => t.status === "IN_PROGRESS" && Boolean(t.activeGameRoomId)
                  ).length
                }
                )
              </button>
            )}
        </div>

        {/* Right: Shortcuts & Profile */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowWardrobeModal(true)}
            className="hidden items-center gap-1.5 rounded-2xl border border-oat-300 bg-oat-50/95 px-3 py-2 text-xs font-bold text-espresso shadow-sm hover:bg-white sm:inline-flex"
          >
            <Sparkles className="h-3.5 w-3.5 text-amberwarm-600" /> Wardrobe
          </button>

          <button
            type="button"
            onClick={() => setShowCashierModal(true)}
            className="hidden items-center gap-1.5 rounded-2xl border border-oat-300 bg-oat-50/95 px-3 py-2 text-xs font-bold text-espresso shadow-sm hover:bg-white sm:inline-flex"
          >
            <BookOpen className="h-3.5 w-3.5 text-sage-700" /> Rules
          </button>

          <button
            type="button"
            onClick={() => setShowAvatarModal(true)}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-oat-300 bg-oat-50/95 px-3 py-1.5 text-xs font-bold text-espresso shadow-sm hover:bg-white"
          >
            {profile && <AvatarSvg config={profile.avatarConfig} size={24} />}
            <span className="max-w-[90px] truncate">{profile?.displayName}</span>
          </button>

          {profile?.isGuest && (
            <button
              type="button"
              onClick={() => setShowUpgradeModal(true)}
              className="hidden rounded-2xl bg-amberwarm-400 px-3 py-2 text-xs font-bold text-espresso shadow-sm hover:bg-amberwarm-600 hover:text-white md:inline-block"
            >
              Save Account
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowJoystick((v) => !v)}
            title="Toggle On-Screen Joystick"
            className={`rounded-2xl border border-oat-300 p-2 shadow-sm ${
              showJoystick ? "bg-sage-500 text-white" : "bg-oat-50/95 text-espresso"
            }`}
          >
            <Gamepad2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              const next = !muted;
              setMuted(next);
              soundEngine.setMuted(next);
            }}
            title={muted ? "Unmute SFX" : "Mute SFX"}
            className="rounded-2xl border border-oat-300 bg-oat-50/95 p-2 text-espresso shadow-sm hover:bg-white"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => {
              intentionalLeaveRef.current = true;
              clearReconnectTimers();
              void cafeRoomRef.current?.leave();
              router.push("/");
            }}
            title="Leave Café"
            className="rounded-2xl border border-oat-300 bg-oat-50/95 p-2 text-espresso shadow-sm hover:bg-terracotta-100 hover:text-terracotta-700"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* TOAST BANNER */}
      {toast && (
        <div className="fixed left-1/2 top-20 z-30 -translate-x-1/2 rounded-full bg-espresso px-5 py-2 text-xs font-bold text-oat-50 shadow-cozy">
          {toast}
        </div>
      )}

      {/* ACTIVE MATCH REJOIN BANNER (impossible to miss if user accidentally tapped out or refreshed!) */}
      {effectiveRejoinGame && !activeGame && (
        <div className="fixed left-1/2 top-16 z-30 flex w-[calc(100%-24px)] max-w-md -translate-x-1/2 items-center justify-between gap-2.5 rounded-2xl border-2 border-amberwarm-400 bg-oat-50/95 px-3.5 py-2 shadow-cozy backdrop-blur sm:top-20">
          <div className="min-w-0 text-left">
            <div className="flex items-center gap-1.5 truncate font-display text-xs font-bold text-espresso sm:text-sm">
              <GameIcon
                name={gameSlugToIconName(effectiveRejoinGame.gameSlug)}
                className="h-4 w-4 shrink-0"
              />
              <span className="truncate">
                {effectiveRejoinGame.gameSlug === "hearthvale"
                  ? "Active Hearthvale Match"
                  : effectiveRejoinGame.gameSlug === "velvet-masque"
                    ? "Active Velvet Masque Gala"
                    : "Active Treasure Trails Match"}
              </span>
            </div>
            <div className="truncate text-[10px] font-semibold text-espresso-muted">
              A Café Bot subs in while you&apos;re away — rejoin anytime!
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveGame(effectiveRejoinGame)}
            className="shrink-0 rounded-xl bg-sage-500 px-3.5 py-1.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-sage-700"
          >
            Rejoin
          </button>
        </div>
      )}

      {connectionStatus === "reconnecting" && !activeGame && (
        <div className="fixed left-1/2 top-28 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amberwarm-400 bg-espresso/95 px-4 py-1.5 text-xs font-bold text-oat-50 shadow-cozy backdrop-blur">
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-amberwarm-400" />
          <span>Reconnecting to café...</span>
          <button
            type="button"
            onClick={() => {
              reconnectAttemptRef.current = 0;
              void connectToCafe(lastCafeTargetRef.current, { isReconnect: true });
            }}
            className="ml-1 rounded-full bg-amberwarm-400 px-2.5 py-0.5 text-[10px] font-extrabold text-espresso"
          >
            Retry
          </button>
        </div>
      )}

      {connectionStatus === "error" && (
        <div className="fixed left-1/2 top-28 z-30 -translate-x-1/2 rounded-2xl bg-terracotta-500 px-5 py-3 text-center text-xs font-bold text-white shadow-cozy">
          Disconnected from TableFolk server.
          <button
            type="button"
            onClick={() => {
              reconnectAttemptRef.current = 0;
              void connectToCafe(lastCafeTargetRef.current);
            }}
            className="ml-3 rounded-lg bg-white px-2.5 py-1 text-terracotta-700"
          >
            Reconnect
          </button>
        </div>
      )}

      {/* NEARBY INTERACTABLE FLOATING PROMPT (Cashier / Wardrobe / Board / Exit) */}
      {nearbyPrompt && !mySeatedTable && (
        <button
          type="button"
          onClick={() => engineRef.current?.triggerNearbyInteract()}
          className="fixed bottom-24 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2.5 rounded-2xl border-2 border-sage-500 bg-oat-50/95 px-5 py-2.5 shadow-cozy backdrop-blur transition hover:scale-105"
        >
          <span className="rounded-lg bg-sage-500 px-2 py-0.5 text-xs font-extrabold text-white">
            E
          </span>
          <div className="text-left">
            <div className="font-display text-sm font-bold text-espresso">
              {nearbyPrompt.label}
            </div>
            <div className="text-[10px] font-semibold text-espresso-muted">
              {nearbyPrompt.subtitle}
            </div>
          </div>
        </button>
      )}

      {/* SEATED TABLE LOBBY DRAWER */}
      {mySeatedTable && profile && !activeGame && (
        <div className="pointer-events-none fixed bottom-20 left-1/2 z-20 flex w-full -translate-x-1/2 justify-center px-3">
          <TableLobbyDrawer
            table={mySeatedTable}
            myUserId={profile.userId}
            myReady={myReady}
            onToggleReady={(ready) => cafeRoomRef.current?.send("table.ready", { ready })}
            onStandUp={() => cafeRoomRef.current?.send("table.releaseSeat")}
            onAddBot={() =>
              cafeRoomRef.current?.send("table.addBot", {
                tableId: mySeatedTable.tableId,
              })
            }
            onRemoveBot={() =>
              cafeRoomRef.current?.send("table.removeBot", {
                tableId: mySeatedTable.tableId,
              })
            }
            onSelectGame={(gameSlug) =>
              cafeRoomRef.current?.send("table.setGame", {
                tableId: mySeatedTable.tableId,
                gameSlug,
              })
            }
            onStartGame={(opts) =>
              cafeRoomRef.current?.send("table.startGame", {
                tableId: mySeatedTable.tableId,
                ...opts,
              })
            }
            onResumeGame={(gameRoomId) =>
              setActiveGame({
                gameRoomId,
                gameSlug:
                  mySeatedTable.selectedGameSlug ||
                  (mySeatedTable.capacity < 3 ? "hearthvale" : "treasure-trails"),
              })
            }
            onShareInvite={() => void handleShareInvite()}
            onOpenTutorial={() => {
              setTutorialGameSlug(
                mySeatedTable.selectedGameSlug ||
                  (mySeatedTable.capacity < 3 ? "hearthvale" : "treasure-trails")
              );
              setShowCashierModal(true);
            }}
          />
        </div>
      )}

      {/* MOBILE VIRTUAL JOYSTICK */}
      {showJoystick && !mySeatedTable && !activeGame && (
        <div className="fixed bottom-20 left-5 z-20">
          <VirtualJoystick
            onVectorChange={(vx, vy) =>
              engineRef.current?.setJoystickVector(vx, vy)
            }
          />
        </div>
      )}

      {/* BOTTOM-RIGHT SOCIAL CHAT DRAWER */}
      {chatOpen && !activeGame && (
        <div className="fixed bottom-16 right-3 z-20 flex h-72 w-80 max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-3xl border border-oat-300 bg-oat-50/95 shadow-cozy backdrop-blur">
          <div className="flex items-center justify-between border-b border-oat-200 px-3.5 py-2">
            <div className="flex gap-1 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setChatScope("cafe")}
                className={`rounded-lg px-2.5 py-1 ${
                  chatScope === "cafe"
                    ? "bg-sage-500 text-white"
                    : "text-espresso-soft hover:bg-oat-200"
                }`}
              >
                Café Chat
              </button>
              <button
                type="button"
                onClick={() => setChatScope("table")}
                disabled={!mySeatedTable}
                className={`rounded-lg px-2.5 py-1 disabled:opacity-40 ${
                  chatScope === "table"
                    ? "bg-sage-500 text-white"
                    : "text-espresso-soft hover:bg-oat-200"
                }`}
              >
                Table Only
              </button>
            </div>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="rounded-lg p-1 text-espresso-muted hover:bg-oat-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div
            ref={cafeChatScrollRef}
            className="flex-1 space-y-1.5 overflow-y-auto p-3 text-xs"
          >
            {visibleChat.length === 0 && (
              <p className="py-4 text-center text-[11px] text-espresso-muted">
                Walk with WASD / click floor. Approach any table to sit!
              </p>
            )}
            {visibleChat.map((m) => (
              <div
                key={m.id}
                className="group flex items-start justify-between gap-1 rounded-xl bg-oat-100/90 px-2.5 py-1.5"
              >
                <div>
                  <span className="font-bold text-sage-700">
                    {m.senderName}
                    {m.scope === "table" ? " [Table]" : ""}:{" "}
                  </span>
                  <span className="text-espresso">{m.message}</span>
                </div>
                {m.senderUserId !== profile?.userId && (
                  <button
                    type="button"
                    title="Mute or Report player"
                    onClick={() =>
                      setReportTarget({
                        userId: m.senderUserId,
                        name: m.senderName,
                      })
                    }
                    className="opacity-0 transition group-hover:opacity-100 text-espresso-muted hover:text-terracotta-700"
                  >
                    <Flag className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Quick Chat Strip */}
          <div className="flex gap-1 overflow-x-auto border-t border-oat-200 bg-oat-100/70 px-2 py-1.5">
            {QUICK_CHAT_MESSAGES.map((qc) => (
              <button
                key={qc}
                type="button"
                onClick={() =>
                  cafeRoomRef.current?.send("chat.send", {
                    scope: mySeatedTable && chatScope === "table" ? "table" : "cafe",
                    message: qc,
                    isQuickChat: true,
                  })
                }
                className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold text-espresso shadow-sm hover:bg-amberwarm-100"
              >
                {qc}
              </button>
            ))}
          </div>

          {/* Text Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!chatDraft.trim()) return;
              cafeRoomRef.current?.send("chat.send", {
                scope: mySeatedTable && chatScope === "table" ? "table" : "cafe",
                message: chatDraft,
              });
              setChatDraft("");
            }}
            className="flex gap-1.5 border-t border-oat-200 p-2"
          >
            <input
              type="text"
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              placeholder="Say hi to the café..."
              maxLength={240}
              className="flex-1 rounded-xl border border-oat-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-sage-500"
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

      {/* BOTTOM ACTION BAR (Emotes + Chat Toggle + Controls Hint) */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex items-end justify-between p-3">
        <div className="pointer-events-auto hidden rounded-2xl border border-oat-300/80 bg-oat-50/90 px-3.5 py-1.5 text-[11px] font-bold text-espresso-soft shadow-sm backdrop-blur md:block">
          Move: <span className="text-espresso">WASD / Arrows / Click Floor</span> •
          Interact: <span className="text-espresso">E or Click Object</span> • Sit:{" "}
          <span className="text-espresso">Walk near table &amp; click glowing chair</span>
        </div>

        <div className="pointer-events-auto relative ml-auto flex items-center gap-2">
          {emoteOpen && (
            <div className="absolute bottom-12 right-0 flex gap-1 rounded-2xl border border-oat-300 bg-oat-50 p-2 shadow-cozy">
              {EMOTE_LIST.map((em) => (
                <button
                  key={em.id}
                  type="button"
                  title={em.label}
                  onClick={() => {
                    cafeRoomRef.current?.send("player.emote", { emote: em.id });
                    setEmoteOpen(false);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl transition hover:scale-125 hover:bg-oat-200"
                >
                  <GameIcon name={emoteIdToIconName(em.id)} className="h-7 w-7" />
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setEmoteOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-oat-300 bg-oat-50/95 px-3.5 py-2 text-xs font-bold text-espresso shadow-cozy hover:bg-white"
          >
            <Smile className="h-4 w-4 text-amberwarm-600" /> Emote
          </button>

          <button
            type="button"
            onClick={() => {
              setChatOpen((v) => !v);
              setUnreadCafeChat(0);
            }}
            className="relative inline-flex items-center gap-1.5 rounded-2xl border border-oat-300 bg-oat-50/95 px-3.5 py-2 text-xs font-bold text-espresso shadow-cozy hover:bg-white"
          >
            <MessageCircle className="h-4 w-4 text-sage-700" /> Chat
            {!chatOpen && unreadCafeChat > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-terracotta-500 px-1 text-[10px] font-extrabold text-white shadow-sm">
                {unreadCafeChat}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* MODALS */}
      {showAvatarModal && profile && (
        <AvatarCustomizerModal
          initialConfig={profile.avatarConfig}
          initialDisplayName={profile.displayName}
          onSave={async (cfg, name) => {
            const updated = await saveMyAvatar(cfg, name);
            setProfile(updated);
            cafeRoomRef.current?.send("player.refreshProfile");
            showToast("Character updated!");
          }}
          onClose={() => setShowAvatarModal(false)}
        />
      )}

      {showWardrobeModal && (
        <WardrobeModal
          carryingSlug={myPlayer?.carryingGameSlug ?? ""}
          onCarryGame={(slug) =>
            cafeRoomRef.current?.send("player.carryGame", { gameSlug: slug })
          }
          onOpenTutorial={(slug) => {
            setTutorialGameSlug(slug);
            setShowCashierModal(true);
          }}
          onClose={() => setShowWardrobeModal(false)}
        />
      )}

      {showCashierModal && (
        <CashierTutorialModal
          gameSlug={tutorialGameSlug}
          onClose={() => setShowCashierModal(false)}
        />
      )}

      {showLobbySwitcher && (
        <CafeLobbySwitcherModal
          currentRoomId={roomMeta.roomId}
          onJoinPublic={(roomId) => void connectToCafe({ roomId })}
          onJoinPrivate={(roomId, accessCode) =>
            void connectToCafe({ roomId, accessCode })
          }
          onClose={() => setShowLobbySwitcher(false)}
        />
      )}

      {/* Open Tables Notice Board Modal */}
      {showNoticeBoard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border-2 border-oat-300 bg-oat-50 p-6 shadow-cozy">
            <div className="flex items-center justify-between">
              <h2 className="inline-flex items-center gap-2 font-display text-xl font-bold text-espresso">
                <GameIcon name="notice-pin" className="h-6 w-6" />
                Open Café Tables
              </h2>
              <button
                type="button"
                onClick={() => setShowNoticeBoard(false)}
                className="rounded-xl p-1 text-espresso-muted hover:bg-oat-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-2.5">
              {tables.map((t) => {
                const occ = t.seats.filter((s) => s.status !== "AVAILABLE").length;
                const hostSeat = t.hostUserId
                  ? t.seats.find((s) => s.occupantUserId === t.hostUserId)
                  : null;
                const isLive = t.status === "IN_PROGRESS" && Boolean(t.activeGameRoomId);
                return (
                  <div
                    key={t.tableId}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-oat-300 bg-white px-4 py-3 text-xs font-bold"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-espresso">{t.name}</div>
                      <div className="flex items-center gap-1.5 text-espresso-muted">
                        {t.selectedGameSlug ? (
                          <>
                            <GameIcon
                              name={gameSlugToIconName(t.selectedGameSlug)}
                              className="h-4 w-4 shrink-0"
                            />
                            <span>
                              {t.selectedGameSlug === "hearthvale"
                                ? "Hearthvale (2–5p)"
                                : t.selectedGameSlug === "velvet-masque"
                                  ? "Velvet Masque (3–8p)"
                                  : "Treasure Trails (3–8p)"}
                            </span>
                          </>
                        ) : (
                          <span>Casual Chat Table</span>
                        )}
                      </div>
                      {hostSeat && (
                        <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold text-amberwarm-600">
                          <Crown className="h-3 w-3" /> {hostSeat.occupantName} (Host)
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-oat-100 px-2.5 py-1">
                        <Users className="h-3.5 w-3.5 text-sage-700" /> {occ}/
                        {t.capacity}
                      </span>
                      {isLive ? (
                        <button
                          type="button"
                          onClick={() => {
                            setShowNoticeBoard(false);
                            cafeRoomRef.current?.send("table.spectate", {
                              tableId: t.tableId,
                            });
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-sage-500 px-2.5 py-1 text-[11px] font-extrabold text-white shadow-sm hover:bg-sage-700"
                        >
                          <Eye className="h-3 w-3" /> Watch
                        </button>
                      ) : (
                        <span className="rounded-lg bg-sage-100 px-2 py-1 text-[10px] text-sage-700">
                          {t.status}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Guest -> Full Account Modal */}
      {showUpgradeModal && profile?.isGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border-2 border-oat-300 bg-oat-50 p-6 shadow-cozy">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-xl font-bold text-espresso">
                <UserCheck className="h-5 w-5 text-sage-700" /> Save Your Guest
                Account
              </h2>
              <button
                type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="rounded-xl p-1 text-espresso-muted hover:bg-oat-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-xs text-espresso-soft">
              Keep your custom avatar and play history across devices.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setUpgradeError(null);
                try {
                  const res = await upgradeGuestAccount(upgradeEmail, upgradePassword);
                  setProfile(res.profile);
                  setShowUpgradeModal(false);
                  showToast("Account saved! Welcome to TableFolk.");
                } catch (err) {
                  setUpgradeError((err as Error).message);
                }
              }}
              className="mt-4 space-y-3"
            >
              <input
                type="email"
                value={upgradeEmail}
                onChange={(e) => setUpgradeEmail(e.target.value)}
                placeholder="Email address"
                required
                className="w-full rounded-xl border border-oat-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-sage-500"
              />
              <input
                type="password"
                value={upgradePassword}
                onChange={(e) => setUpgradePassword(e.target.value)}
                placeholder="Choose a password (6+ chars)"
                minLength={6}
                required
                className="w-full rounded-xl border border-oat-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-sage-500"
              />
              {upgradeError && (
                <div className="rounded-xl bg-terracotta-100 px-3 py-2 text-xs font-bold text-terracotta-700">
                  {upgradeError}
                </div>
              )}
              <button
                type="submit"
                className="w-full rounded-2xl bg-sage-500 py-2.5 font-display text-sm font-bold text-white hover:bg-sage-700"
              >
                Save Account
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Moderation: Mute & Report Modal */}
      {reportTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border-2 border-oat-300 bg-oat-50 p-5 shadow-cozy">
            <h3 className="font-display text-lg font-bold text-espresso">
              Moderation: {reportTarget.name}
            </h3>
            <div className="mt-3 space-y-3">
              <button
                type="button"
                onClick={() => {
                  setMutedUserIds((prev) => new Set(prev).add(reportTarget.userId));
                  showToast(`Muted ${reportTarget.name}`);
                  setReportTarget(null);
                }}
                className="w-full rounded-xl bg-oat-200 py-2 text-xs font-bold text-espresso hover:bg-oat-300"
              >
                Mute Player Locally
              </button>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await submitPlayerReport(reportTarget.userId, reportReason, {
                    roomId: roomMeta.roomId,
                  });
                  showToast("Report submitted to TableFolk moderators.");
                  setReportReason("");
                  setReportTarget(null);
                }}
                className="space-y-2 border-t border-oat-200 pt-3"
              >
                <textarea
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Describe abusive behavior..."
                  rows={2}
                  required
                  className="w-full rounded-xl border border-oat-300 bg-white p-2.5 text-xs outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setReportTarget(null)}
                    className="rounded-xl px-3 py-1.5 text-xs font-bold text-espresso-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-terracotta-500 px-4 py-1.5 text-xs font-bold text-white"
                  >
                    Submit Report
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE BOARD GAME OVERLAY (Hearthvale / Velvet Masque / Treasure Trails) */}
      {activeGame && profile &&
        (activeGame.gameSlug === "hearthvale" ? (
          <HearthvaleOverlay
            gameRoomId={activeGame.gameRoomId}
            myUserId={profile.userId}
            onExitGame={(info) => {
              const wasSpectator = Boolean(activeGame.isSpectator);
              setActiveGame(null);
              if (info?.notice) showToast(info.notice);
              if (wasSpectator) return;
              if (info?.finished) {
                setRejoinGame(null);
              } else {
                void fetchMyActiveGame()
                  .then((ag) => setRejoinGame(ag))
                  .catch(() => {});
              }
            }}
            onOpenTutorial={() => {
              setTutorialGameSlug("hearthvale");
              setShowCashierModal(true);
            }}
          />
        ) : activeGame.gameSlug === "velvet-masque" ? (
          <VelvetMasqueOverlay
            gameRoomId={activeGame.gameRoomId}
            myUserId={profile.userId}
            onExitGame={(info) => {
              const wasSpectator = Boolean(activeGame.isSpectator);
              setActiveGame(null);
              if (info?.notice) showToast(info.notice);
              if (wasSpectator) return;
              if (info?.finished) {
                setRejoinGame(null);
              } else {
                void fetchMyActiveGame()
                  .then((ag) => setRejoinGame(ag))
                  .catch(() => {});
              }
            }}
            onOpenTutorial={() => {
              setTutorialGameSlug("velvet-masque");
              setShowCashierModal(true);
            }}
          />
        ) : (
          <TreasureTrailsOverlay
            gameRoomId={activeGame.gameRoomId}
            myUserId={profile.userId}
            onExitGame={(info) => {
              const wasSpectator = Boolean(activeGame.isSpectator);
              setActiveGame(null);
              if (info?.notice) showToast(info.notice);
              if (wasSpectator) return;
              if (info?.finished) {
                setRejoinGame(null);
              } else {
                void fetchMyActiveGame()
                  .then((ag) => setRejoinGame(ag))
                  .catch(() => {});
              }
            }}
            onOpenTutorial={() => {
              setTutorialGameSlug("treasure-trails");
              setShowCashierModal(true);
            }}
          />
        ))}
    </div>
  );
}
