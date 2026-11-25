"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Client as ColyseusClient, type Room } from "colyseus.js";
import {
  BookOpen,
  Check,
  Coffee,
  Copy,
  Flag,
  Gamepad2,
  LogOut,
  MessageCircle,
  Send,
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
  fetchMyProfile,
  getStoredToken,
  loginAsGuest,
  resolvePrivateCafeCode,
  saveMyAvatar,
  submitPlayerReport,
  upgradeGuestAccount,
} from "@/lib/api";
import { soundEngine } from "@/lib/sound";
import { AvatarCustomizerModal } from "./AvatarCustomizerModal";
import { CafeLobbySwitcherModal } from "./CafeLobbySwitcherModal";
import { CashierTutorialModal } from "./CashierTutorialModal";
import { TableLobbyDrawer } from "./TableLobbyDrawer";
import { TreasureTrailsOverlay } from "./TreasureTrailsOverlay";
import { VirtualJoystick } from "./VirtualJoystick";
import { WardrobeModal } from "./WardrobeModal";

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

  // Auth & Profile state
  const [profile, setProfile] = useState<UserProfileDTO | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestAvatar, setGuestAvatar] = useState<AvatarConfig>(() =>
    generateRandomAvatarConfig()
  );

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
    "connecting" | "connected" | "error"
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
  const [showLobbySwitcher, setShowLobbySwitcher] = useState(false);
  const [showNoticeBoard, setShowNoticeBoard] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeEmail, setUpgradeEmail] = useState("");
  const [upgradePassword, setUpgradePassword] = useState("");
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  // Chat & Emotes & Moderation
  const [chatOpen, setChatOpen] = useState(true);
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

  // Active Treasure Trails game overlay
  const [activeGameRoomId, setActiveGameRoomId] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3600);
  }, []);

  // Detect touch devices for auto-showing mobile joystick
  useEffect(() => {
    if (typeof window !== "undefined" && "ontouchstart" in window) {
      setShowJoystick(true);
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

  // Pause Phaser canvas while playing Treasure Trails to save mobile battery!
  useEffect(() => {
    engineRef.current?.setPaused(Boolean(activeGameRoomId));
  }, [activeGameRoomId]);

  const handleInteract = useCallback((obj: InteractableDefinition) => {
    if (obj.type === "cashier") setShowCashierModal(true);
    else if (obj.type === "wardrobe") setShowWardrobeModal(true);
    else if (obj.type === "notice_board") setShowNoticeBoard(true);
    else if (obj.type === "exit") setShowLobbySwitcher(true);
  }, []);

  const [engineReady, setEngineReady] = useState(false);
  const connectSeqRef = useRef(0);
  const userId = profile?.userId ?? null;

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

  const connectToCafe = useCallback(
    async (opts?: { roomId?: string; accessCode?: string }) => {
      const token = getStoredToken();
      if (!token) return;

      const mySeq = ++connectSeqRef.current;
      setConnectionStatus("connecting");
      if (cafeRoomRef.current) {
        const old = cafeRoomRef.current;
        cafeRoomRef.current = null;
        await old.leave();
      }

      try {
        const client = new ColyseusClient(WS_BASE_URL);
        let room: Room;

        if (opts?.roomId) {
          room = await client.joinById(opts.roomId, {
            token,
            accessCode: opts.accessCode,
          });
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
          await room.leave();
          return;
        }

        cafeRoomRef.current = room;
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

        room.onMessage("chat.received", (msg: ChatMessageDTO) => {
          setChatMessages((prev) => [...prev.slice(-59), msg]);
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
            setActiveGameRoomId(p.gameRoomId);
          }
        );

        room.onLeave(() => {
          if (mySeq === connectSeqRef.current) {
            setConnectionStatus("connecting");
          }
        });
      } catch (err) {
        if (mySeq !== connectSeqRef.current) return;
        console.error("Cafe connection error:", err);
        setConnectionStatus("error");
        showToast((err as Error).message || "Could not connect to café server.");
      }
    },
    [showToast]
  );

  // Connect automatically once authenticated userId is ready
  useEffect(() => {
    if (!userId) return;
    void connectToCafe(
      inviteCodeParam ? { accessCode: inviteCodeParam } : undefined
    );
    return () => {
      connectSeqRef.current += 1;
      const current = cafeRoomRef.current;
      cafeRoomRef.current = null;
      void current?.leave();
    };
  }, [userId, inviteCodeParam, connectToCafe]);

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
              onClick={() => setGuestAvatar(generateRandomAvatarConfig(Date.now()))}
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

          {roomMeta.isPrivate && roomMeta.accessCode && (
            <button
              type="button"
              onClick={() => {
                const url = `${window.location.origin}/cafe?code=${roomMeta.accessCode}`;
                void navigator.clipboard.writeText(url);
                setCopiedCode(true);
                showToast(`Invite link copied! Code: ${roomMeta.accessCode}`);
                setTimeout(() => setCopiedCode(false), 2000);
              }}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-amberwarm-400 bg-amberwarm-100/95 px-3 py-2 text-xs font-bold text-espresso shadow-sm hover:bg-amberwarm-400"
            >
              {copiedCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              Code: {roomMeta.accessCode}
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

      {connectionStatus === "error" && (
        <div className="fixed left-1/2 top-24 z-30 -translate-x-1/2 rounded-2xl bg-terracotta-500 px-5 py-3 text-center text-xs font-bold text-white shadow-cozy">
          Disconnected from TableFolk server.
          <button
            type="button"
            onClick={() => void connectToCafe()}
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
      {mySeatedTable && profile && !activeGameRoomId && (
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
            onStartGame={(opts) =>
              cafeRoomRef.current?.send("table.startGame", {
                tableId: mySeatedTable.tableId,
                ...opts,
              })
            }
            onResumeGame={(gameRoomId) => setActiveGameRoomId(gameRoomId)}
            onOpenTutorial={() => setShowCashierModal(true)}
          />
        </div>
      )}

      {/* MOBILE VIRTUAL JOYSTICK */}
      {showJoystick && !mySeatedTable && !activeGameRoomId && (
        <div className="fixed bottom-20 left-5 z-20">
          <VirtualJoystick
            onVectorChange={(vx, vy) =>
              engineRef.current?.setJoystickVector(vx, vy)
            }
          />
        </div>
      )}

      {/* BOTTOM-RIGHT SOCIAL CHAT DRAWER */}
      {chatOpen && !activeGameRoomId && (
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

          <div className="flex-1 space-y-1.5 overflow-y-auto p-3 text-xs">
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
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-xl transition hover:scale-125 hover:bg-oat-200"
                >
                  {em.icon}
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
            onClick={() => setChatOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-oat-300 bg-oat-50/95 px-3.5 py-2 text-xs font-bold text-espresso shadow-cozy hover:bg-white"
          >
            <MessageCircle className="h-4 w-4 text-sage-700" /> Chat
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
          onOpenTutorial={() => setShowCashierModal(true)}
          onClose={() => setShowWardrobeModal(false)}
        />
      )}

      {showCashierModal && (
        <CashierTutorialModal onClose={() => setShowCashierModal(false)} />
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
              <h2 className="font-display text-xl font-bold text-espresso">
                📌 Open Café Tables
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
                return (
                  <div
                    key={t.tableId}
                    className="flex items-center justify-between rounded-2xl border border-oat-300 bg-white px-4 py-3 text-xs font-bold"
                  >
                    <div>
                      <div className="text-sm text-espresso">{t.name}</div>
                      <div className="text-espresso-muted">
                        {t.selectedGameSlug === "treasure-trails"
                          ? "Treasure Trails (3–8p)"
                          : "Casual Chat Table"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-oat-100 px-2.5 py-1">
                        <Users className="h-3.5 w-3.5 text-sage-700" /> {occ}/
                        {t.capacity}
                      </span>
                      <span
                        className={`rounded-lg px-2 py-1 text-[10px] ${
                          t.status === "IN_PROGRESS"
                            ? "bg-amberwarm-100 text-amberwarm-600"
                            : "bg-sage-100 text-sage-700"
                        }`}
                      >
                        {t.status}
                      </span>
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

      {/* ACTIVE TREASURE TRAILS GAME OVERLAY */}
      {activeGameRoomId && profile && (
        <TreasureTrailsOverlay
          gameRoomId={activeGameRoomId}
          myUserId={profile.userId}
          onExitGame={() => setActiveGameRoomId(null)}
          onOpenTutorial={() => setShowCashierModal(true)}
        />
      )}
    </div>
  );
}
