"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Client as ColyseusClient, type Room } from "colyseus.js";
import {
  BookOpen,
  Compass,
  Eye,
  EyeOff,
  Flame,
  LogOut,
  RotateCw,
  Send,
  Sparkles,
  Trash2,
  Wrench,
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
  onExitGame: () => void;
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
  kind: "PATH" | "HAZARD" | "REPAIR" | "FIELD_PATCH" | "SPYGLASS" | "VAULT" | "BOULDER_CLEAR" | "DISCARD";
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

const GEAR_META: Record<GearType, { label: string; icon: string }> = {
  lantern: { label: "Lantern", icon: "🏮" },
  compass: { label: "Compass", icon: "🧭" },
  grapple: { label: "Grapple", icon: "🪝" },
};

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

export function TreasureTrailsOverlay({
  gameRoomId,
  myUserId,
  onExitGame,
  onOpenTutorial,
}: TreasureTrailsOverlayProps) {
  const roomRef = useRef<Room | null>(null);
  const [pub, setPub] = useState<TreasureTrailsPublicState | null>(null);
  const [priv, setPriv] = useState<TreasureTrailsPrivateState | null>(null);
  const [turnEndsAt, setTurnEndsAt] = useState(0);
  const [introEndsAt, setIntroEndsAt] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());
  const [roleVisible, setRoleVisible] = useState(true);

  // Pre-round dramatic ceremony state: countdown (3-2-1) -> full-screen role reveal -> playing
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

  latestPubRef.current = pub;
  latestPrivRef.current = priv;
  introEndsAtRef.current = introEndsAt;

  // Fast timer tick for smooth countdown display
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const clearIntroTimers = useCallback(() => {
    for (const t of introTimersRef.current) clearTimeout(t);
    introTimersRef.current = [];
  }, []);

  useEffect(() => () => clearIntroTimers(), [clearIntroTimers]);

  const currentRound = pub?.currentRound ?? 0;
  const currentPhase = pub?.phase;
  const myRole = priv?.role;

  // Trigger dramatic 3 -> 2 -> 1 -> Full-Screen Role Reveal ceremony whenever a new round starts
  useEffect(() => {
    if (!currentRound || currentPhase !== "IN_PROGRESS" || !myRole) return;
    if (lastIntroRoundRef.current === currentRound) return;

    const currentTurn = latestPubRef.current?.turnNumber ?? 1;
    const remainingIntro = introEndsAtRef.current - Date.now();
    if (currentTurn > 1 && remainingIntro < 800) {
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
        x: typeof window !== "undefined" ? window.innerWidth / 2 : 480,
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

  const spawnFlying = useCallback((effect: Omit<FlyingCardEffect, "id">, durationMs = 740) => {
    const id = `fly_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setFlyingEffects((prev) => [...prev, { ...effect, id }]);
    setTimeout(() => {
      setFlyingEffects((prev) => prev.filter((e) => e.id !== id));
    }, durationMs);
  }, []);

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
          const cellEl = cellRefs.current.get(coordKey(ev.x, ev.y));
          const to = getCenterOf(cellEl);
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
          // Step 1: Spyglass flies from actor -> chosen Sealed Vault
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

          // Step 2: Sealed Vault lifts off the board -> flies to the scouting player -> returns to board!
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

  // Auto-fade floating action banner
  useEffect(() => {
    if (!actionBanner) return;
    const t = setTimeout(() => setActionBanner(null), 2600);
    return () => clearTimeout(t);
  }, [actionBanner]);

  // Connect to Colyseus GameRoom
  useEffect(() => {
    let active = true;
    const token = getStoredToken();
    if (!token) return;

    const client = new ColyseusClient(WS_BASE_URL);
    client
      .joinById(gameRoomId, { token })
      .then((room) => {
        if (!active) {
          void room.leave();
          return;
        }
        roomRef.current = room;

        room.onMessage(
          "game.publicState",
          (payload: {
            state: TreasureTrailsPublicState;
            turnEndsAt: number;
            introEndsAt?: number;
            events?: TreasureTrailsEvent[];
          }) => {
            setPub(payload.state);
            setTurnEndsAt(payload.turnEndsAt);
            if (typeof payload.introEndsAt === "number") {
              setIntroEndsAt(payload.introEndsAt);
            }

            const evs = payload.events ?? [];
            if (evs.length > 0) {
              // Run after React paints updated board cells so coordinates resolve accurately
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
        });
      })
      .catch((err) => {
        console.error("Failed to join GameRoom:", err);
        setErrorToast("Could not connect to game session.");
      });

    return () => {
      active = false;
      void roomRef.current?.leave();
      roomRef.current = null;
    };
  }, [gameRoomId, myUserId, animateEvents]);

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

  if (!pub) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-espresso/75 backdrop-blur-sm">
        <div className="rounded-3xl bg-oat-50 px-8 py-6 text-center shadow-cozy">
          <div className="font-display text-xl font-bold text-espresso">
            Dealing Treasure Trails...
          </div>
          <p className="mt-1 text-xs text-espresso-muted">
            Shuffling secret roles and hiding the Golden Compass
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#2D241E]/95 text-espresso backdrop-blur-md">
      {/* Top Game Header */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-oat-300/20 bg-oat-50 px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-display text-lg font-bold text-espresso">
            <Compass className="h-5 w-5 text-sage-700" />
            Treasure Trails
          </div>
          <span className="rounded-full bg-oat-200 px-2.5 py-0.5 text-xs font-bold text-espresso-soft">
            Round {pub.currentRound}/{pub.config.totalRounds}
          </span>
          <span
            ref={deckRef}
            className="rounded-full bg-amberwarm-100 px-2.5 py-0.5 text-xs font-bold text-amberwarm-600"
          >
            Deck: {pub.deckCount} · Discard: {pub.discardCount}
          </span>
          {pub.phase === "IN_PROGRESS" && (
            <span
              className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                inServerIntro
                  ? "bg-amberwarm-400 text-espresso"
                  : isMyTurn
                    ? "animate-pulse bg-sage-500 text-white"
                    : "bg-oat-200 text-espresso"
              }`}
            >
              {inServerIntro
                ? "Revealing Roles..."
                : isMyTurn
                  ? `Your Turn • ${secondsLeft}s`
                  : `${nameOf(pub.activePlayerId)}'s Turn • ${secondsLeft}s`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {priv && (
            <button
              type="button"
              onClick={() => setRoleVisible((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold shadow-sm transition ${
                !roleVisible
                  ? "bg-oat-200 text-espresso"
                  : priv.role === "TRICKSTER"
                    ? "bg-terracotta-500 text-white"
                    : "bg-sage-500 text-white"
              }`}
            >
              {roleVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {roleVisible
                ? priv.role === "TRICKSTER"
                  ? "Secret Role: TRICKSTER"
                  : "Secret Role: TRAILBLAZER"
                : "Role Hidden (Tap to Peek)"}
            </button>
          )}

          <button
            type="button"
            onClick={onOpenTutorial}
            className="inline-flex items-center gap-1 rounded-xl bg-oat-200 px-3 py-1.5 text-xs font-bold text-espresso hover:bg-oat-300"
          >
            <BookOpen className="h-3.5 w-3.5" /> Rules
          </button>

          <button
            type="button"
            onClick={onExitGame}
            className="inline-flex items-center gap-1 rounded-xl bg-oat-200 px-3 py-1.5 text-xs font-bold text-espresso hover:bg-terracotta-100 hover:text-terracotta-700"
          >
            <LogOut className="h-3.5 w-3.5" /> Back to Café
          </button>
        </div>
      </header>

      {/* Main Layout: Board + Right Sidebar */}
      <div className="grid flex-1 gap-3 overflow-hidden p-3 lg:grid-cols-12">
        <div className="flex flex-col gap-2.5 overflow-hidden lg:col-span-9">
          {/* Player Roster & Clickable Gear Slots */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {pub.players.map((p) => {
              const isActive =
                !inServerIntro &&
                pub.phase === "IN_PROGRESS" &&
                pub.activePlayerId === p.userId;
              const isMe = p.userId === myUserId;
              const isShaking = shakingPlayerId === p.userId;

              return (
                <div
                  key={p.userId}
                  ref={(el) => {
                    if (el) playerRefs.current.set(p.userId, el);
                    else playerRefs.current.delete(p.userId);
                  }}
                  className={`min-w-[152px] shrink-0 rounded-2xl border-2 px-3 py-2 transition ${
                    isShaking ? "animate-tt-shake border-terracotta-500 bg-terracotta-100" : ""
                  } ${
                    !isShaking && isActive
                      ? "border-amberwarm-400 bg-oat-50 shadow-md"
                      : !isShaking
                        ? "border-oat-300/60 bg-oat-50/85"
                        : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 text-xs font-bold">
                    <span className="truncate text-espresso">
                      {p.displayName} {isMe ? "(You)" : ""}
                    </span>
                    <span className="shrink-0 rounded-md bg-amberwarm-100 px-1.5 py-0.5 text-[10px] text-amberwarm-600">
                      ★ {p.score}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-espresso-muted">
                      🃏 {p.handCount}
                    </span>
                    <div className="flex gap-1">
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
                            className={`flex h-6 w-6 items-center justify-center rounded-lg border text-xs transition ${
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

          {/* 9x5 Expedition Board */}
          <div className="relative flex flex-1 items-center justify-center overflow-auto rounded-3xl border-2 border-[#594436] bg-[#3E3026] p-3 shadow-inner">
            {/* Live Floating Action Banner */}
            {actionBanner && !isIntroBlocking && (
              <div className="pointer-events-none absolute top-3 left-1/2 z-20 -translate-x-1/2 rounded-full border border-amberwarm-400/50 bg-espresso/90 px-4 py-1.5 text-xs font-bold text-oat-50 shadow-lg backdrop-blur">
                {actionBanner}
              </div>
            )}

            {/* Private Spyglass Vision Toast (visible ONLY to the player who peeked!) */}
            {spyglassVision && (
              <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-2xl border-2 border-amberwarm-400 bg-oat-50 px-5 py-3 text-center shadow-2xl">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-amberwarm-600">
                  🔭 Secret Spyglass Vision (Only You See This!)
                </div>
                <div className="mt-0.5 font-display text-lg font-bold text-espresso">
                  Vault ({spyglassVision.coord}) is{" "}
                  {spyglassVision.kind === "TRUE_RELIC" ? (
                    <span className="text-sage-700">★ THE GOLDEN COMPASS!</span>
                  ) : (
                    <span className="text-terracotta-700">🏺 a Hollow Decoy</span>
                  )}
                </div>
              </div>
            )}

            <div
              className="grid gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${BOARD_COLS}, minmax(52px, 76px))`,
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
                      className={`relative aspect-[3/4] rounded-xl transition ${
                        cell
                          ? ""
                          : canPlaceHere
                            ? "cursor-pointer border-2 border-dashed border-emerald-400 bg-emerald-400/25 hover:bg-emerald-400/40"
                            : "border border-white/10 bg-white/[0.04]"
                      } ${
                        canScoutHere
                          ? "cursor-pointer ring-4 ring-amberwarm-400"
                          : canClearHere
                            ? "cursor-pointer ring-4 ring-terracotta-500"
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
                        <span className="text-lg font-bold text-emerald-200">+</span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>

            {errorToast && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-terracotta-500 px-4 py-1.5 text-xs font-bold text-white shadow-lg">
                {errorToast}
              </div>
            )}

            {myPublic?.autoPass && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-amberwarm-400 px-4 py-1.5 text-xs font-bold text-espresso shadow-lg">
                <span>Auto-Pass Active</span>
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

        {/* Right Sidebar: Live Event Log + Table Bluff Chat */}
        <aside className="hidden flex-col overflow-hidden rounded-3xl border border-oat-300/30 bg-oat-50/95 lg:col-span-3 lg:flex">
          <div className="border-b border-oat-200 px-4 py-2.5 font-display text-sm font-bold text-espresso">
            Expedition Log & Table Talk
          </div>

          <div className="max-h-40 space-y-1.5 overflow-y-auto border-b border-oat-200 bg-oat-100/80 p-3 text-[11px] font-semibold text-espresso-soft">
            {pub.recentEvents.slice(-6).map((ev, i) => (
              <div key={i} className="rounded-lg bg-white/80 px-2.5 py-1.5">
                {describeEvent(ev, nameOf)}
              </div>
            ))}
          </div>

          <div className="flex-1 space-y-1.5 overflow-y-auto p-3 text-xs">
            {chatLog.length === 0 && (
              <p className="text-center text-[11px] text-espresso-muted">
                Discuss routes — or bluff the table!
              </p>
            )}
            {chatLog.map((m) => (
              <div key={m.id} className="rounded-xl bg-oat-100 px-2.5 py-1.5">
                <span className="font-bold text-sage-700">{m.senderName}: </span>
                <span className="text-espresso">{m.message}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-1 border-t border-oat-200 bg-oat-100/60 p-2">
            {QUICK_BLUFF_PILLS.slice(0, 6).map((pill) => (
              <button
                key={pill}
                type="button"
                onClick={() => roomRef.current?.send("game.quickBluff", { text: pill })}
                className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-espresso shadow-sm hover:bg-amberwarm-100"
              >
                {pill}
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
        </aside>
      </div>

      {/* Bottom Hand & Action Controls */}
      <footer className="border-t border-oat-300/30 bg-oat-50 px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div ref={handRef} className="flex flex-1 gap-2 overflow-x-auto py-1">
            {priv?.hand.map((card) => {
              const isSelected = fieldPatchMode
                ? patchCardIds.includes(card.id)
                : selectedCardId === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => handleCardSelect(card)}
                  className={`group relative flex h-28 w-20 shrink-0 flex-col items-center justify-between rounded-2xl border-2 p-1.5 text-center transition ${
                    isSelected
                      ? "-translate-y-2 border-sage-500 bg-sage-100 shadow-lg"
                      : "border-oat-300 bg-white hover:-translate-y-1 hover:border-amberwarm-400"
                  }`}
                >
                  {card.kind === "PATH" ? (
                    <div className="h-20 w-16">
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
                    <div className="flex flex-1 flex-col items-center justify-center gap-1">
                      <span className="text-2xl">
                        {card.kind === "HAZARD"
                          ? "⚡"
                          : card.kind === "REPAIR"
                            ? "🔧"
                            : card.kind === "SPYGLASS"
                              ? "🔭"
                              : "💥"}
                      </span>
                      <span className="text-[9px] font-extrabold uppercase tracking-wide text-espresso-muted">
                        {card.kind.replace("_", " ")}
                      </span>
                    </div>
                  )}
                  <span className="line-clamp-1 text-[9.5px] font-bold text-espresso">
                    {card.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedCard?.kind === "PATH" && !fieldPatchMode && (
              <button
                type="button"
                onClick={() => setRotation((r) => (r === 0 ? 180 : 0))}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amberwarm-400 px-3.5 py-2 text-xs font-bold text-espresso shadow-sm hover:bg-amberwarm-600 hover:text-white"
              >
                <RotateCw className="h-4 w-4" /> Flip 180° ({rotation}°)
              </button>
            )}

            {isMyTurn && selectedCard && !fieldPatchMode && (
              <button
                type="button"
                onClick={() =>
                  sendAction({ type: "DISCARD", cardId: selectedCard.id })
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-oat-200 px-3.5 py-2 text-xs font-bold text-espresso hover:bg-terracotta-100 hover:text-terracotta-700"
              >
                <Trash2 className="h-4 w-4" /> Discard Card
              </button>
            )}

            {isMyTurn && myBrokenGears.length > 0 && (priv?.hand.length ?? 0) >= 2 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setFieldPatchMode((v) => !v);
                    setPatchCardIds([]);
                    setSelectedCardId(null);
                    setPatchGear(myBrokenGears[0]!);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold shadow-sm ${
                    fieldPatchMode
                      ? "bg-espresso text-oat-50"
                      : "bg-terracotta-100 text-terracotta-700 hover:bg-terracotta-500 hover:text-white"
                  }`}
                >
                  <Wrench className="h-4 w-4" />
                  {fieldPatchMode
                    ? `Pick 2 Cards (${patchCardIds.length}/2)`
                    : "Field-Patch (2 Cards)"}
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
                    className="rounded-xl bg-sage-500 px-3.5 py-2 text-xs font-bold text-white hover:bg-sage-700"
                  >
                    Fix My {GEAR_META[patchGear].label}!
                  </button>
                )}
              </div>
            )}

            <div className="w-full text-[11px] font-bold text-espresso-soft sm:w-auto">
              {isIntroBlocking
                ? "Get ready for the expedition!"
                : !isMyTurn
                  ? `Waiting for ${nameOf(pub.activePlayerId)}...`
                  : fieldPatchMode
                    ? "Tap any 2 cards in your hand to Field-Patch your broken gear."
                    : !selectedCard
                      ? myBrokenGears.length > 0
                        ? "⚠️ Your gear is broken! Play a Repair, use Field-Patch, or Discard."
                        : "Select a card from your hand to play or discard."
                      : selectedCard.kind === "PATH"
                        ? myBrokenGears.length > 0
                          ? "Repair your broken gear before placing path tiles."
                          : "Tap a glowing green cell on the grid to place this path!"
                        : selectedCard.kind === "HAZARD"
                          ? `Tap an explorer's intact ${selectedCard.gear} icon above to break it!`
                          : selectedCard.kind === "REPAIR"
                            ? "Tap a broken gear icon above to repair it!"
                            : selectedCard.kind === "SPYGLASS"
                              ? "Tap any glowing Sealed Vault on the right edge to scout!"
                              : "Tap any placed path tile on the grid to clear it!"}
            </div>
          </div>
        </div>
      </footer>

      {/* FLYING CARD & IMPACT VFX STAGE (Fixed GPU Overlay) */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {flyingEffects.map((fx) => (
          <div
            key={fx.id}
            style={
              {
                "--from-x": `${fx.fromX - 36}px`,
                "--from-y": `${fx.fromY - 48}px`,
                "--to-x": `${fx.toX - 36}px`,
                "--to-y": `${fx.toY - 48}px`,
              } as React.CSSProperties
            }
            className={`fixed left-0 top-0 flex h-24 w-[72px] flex-col items-center justify-center rounded-2xl border-2 shadow-2xl ${
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
                <span className="text-3xl">{fx.icon}</span>
                <span className="mt-1 px-1 text-center text-[9px] font-extrabold leading-tight">
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
            className={`animate-tt-impact fixed flex h-16 w-16 items-center justify-center rounded-full border-4 text-2xl ${b.colorClass}`}
          >
            {b.icon}
          </div>
        ))}
      </div>

      {/* FULL-SCREEN COUNTDOWN + DRAMATIC SECRET ROLE REVEAL CEREMONY */}
      {isIntroBlocking && priv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1814]/90 p-6 backdrop-blur-md">
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
            <div className="animate-tt-role-card w-full max-w-md overflow-hidden rounded-[2rem] border-4 bg-oat-50 p-7 text-center shadow-2xl border-amberwarm-400">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-espresso-muted">
                Your Secret Role • Round {pub.currentRound}
              </div>
              <div
                className={`mx-auto mt-4 flex h-24 w-24 items-center justify-center rounded-3xl text-5xl shadow-inner ${
                  priv.role === "TRICKSTER"
                    ? "bg-terracotta-100 ring-4 ring-terracotta-500/30"
                    : "bg-sage-100 ring-4 ring-sage-500/30"
                }`}
              >
                {priv.role === "TRICKSTER" ? "🦊" : "🧭"}
              </div>
              <h2
                className={`mt-4 font-display text-4xl font-bold tracking-tight ${
                  priv.role === "TRICKSTER" ? "text-terracotta-700" : "text-sage-700"
                }`}
              >
                {priv.role === "TRICKSTER" ? "TRICKSTER" : "TRAILBLAZER"}
              </h2>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-espresso-soft">
                {priv.role === "TRICKSTER"
                  ? "Work in secret to jam explorer gear, drop dead-ends, and misdirect the crew until the Expedition Deck runs dry!"
                  : "Team up to build an unbroken open trail from Base Camp to the hidden Golden Compass Vault before supplies run out!"}
              </p>
              <div className="mt-5 rounded-2xl bg-oat-100 px-4 py-2.5 text-xs font-bold text-espresso-muted">
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
                className={`mt-5 w-full rounded-2xl py-3 font-display text-sm font-bold text-white shadow-sm transition ${
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
            <div className="w-full max-w-lg rounded-3xl border-2 border-amberwarm-400 bg-oat-50 p-6 text-center shadow-cozy">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amberwarm-100 text-3xl">
                {pub.lastRoundSummary.winningTeam === "TRAILBLAZER" ? "🧭" : "🦊"}
              </div>
              <h2 className="mt-3 font-display text-3xl font-bold text-espresso">
                {pub.lastRoundSummary.winningTeam === "TRAILBLAZER"
                  ? "Trailblazers Win!"
                  : "Tricksters Win!"}
              </h2>
              <p className="mt-1 text-sm font-semibold text-espresso-soft">
                {pub.lastRoundSummary.reason}
              </p>

              <div className="mt-5 space-y-2 text-left">
                {pub.players.map((p) => {
                  const role = pub.lastRoundSummary!.revealedRoles[p.userId];
                  const earned = pub.lastRoundSummary!.starsAwarded[p.userId] ?? 0;
                  return (
                    <div
                      key={p.userId}
                      className="flex items-center justify-between rounded-2xl bg-oat-100 px-4 py-2.5 text-sm font-bold"
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
                          Total: {p.score} ★
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex justify-center gap-3">
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
                    onClick={onExitGame}
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
