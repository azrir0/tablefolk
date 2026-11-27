"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  Eye,
  EyeOff,
  Highlighter,
  Lightbulb,
  MessageCircle,
  RotateCw,
  Scale,
  Shuffle,
  Sparkles,
  Swords,
  ZoomIn,
} from "lucide-react";
import type { TileRotation } from "@tablefolk/game-hearthvale";
import {
  getGameQuickTour,
  markQuickTourCompleted,
  type QuickTourStep,
  type QuickTourVisualId,
} from "@/lib/gameQuickTours";
import type { SupportedGameSlug } from "@/lib/gameTutorials";
import { GameIcon, ToolCardArt, ToolSlotIcon } from "./GameIcons";
import { HearthvaleTileSvg } from "./HearthvaleTileSvg";
import { PathTileSvg } from "./TreasureTrailsTileSvg";
import { VelvetMasqueCardSvg } from "./VelvetMasqueCardSvg";

interface QuickTutorialStepperProps {
  gameSlug: SupportedGameSlug;
  onComplete?: () => void;
}

function renderBoldText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-extrabold text-espresso">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function accentBadgeClasses(accent: QuickTourStep["accent"]): string {
  if (accent === "terracotta") {
    return "bg-terracotta-100 text-terracotta-700 border-terracotta-500/30";
  }
  if (accent === "amber") {
    return "bg-amberwarm-100 text-amberwarm-600 border-amberwarm-400/50";
  }
  return "bg-sage-100 text-sage-700 border-sage-300";
}

/**
 * Interactive mini-playground for each step using real TableFolk tiles, tools & masks
 * so players can *try* each core mechanic hands-on before entering a live match!
 */
function StepInteractiveStage({ visualId }: { visualId: QuickTourVisualId }) {
  // Interactive mini-states (reset automatically when visualId changes via key!)
  const [roleView, setRoleView] = useState<"explorer" | "impostor">("explorer");
  const [ttFlipped, setTtFlipped] = useState(false);
  const [ttPlaced, setTtPlaced] = useState(false);
  const [pickaxeBroken, setPickaxeBroken] = useState(true);
  const [vaultPeeked, setVaultPeeked] = useState(false);
  const [hvRotation, setHvRotation] = useState<TileRotation>(0);
  const [hvSelectedIdx, setHvSelectedIdx] = useState<0 | 1>(0);
  const [vmCurtainClosed, setVmCurtainClosed] = useState(false);
  const [vmCloakMode, setVmCloakMode] = useState<"swap" | "keep">("swap");
  const [vmChallenged, setVmChallenged] = useState(false);

  switch (visualId) {
    /* ========================= TREASURE TRAILS ========================= */
    case "tt-roles":
      return (
        <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-oat-300 bg-gradient-to-br from-[#3E3026] to-[#2B211A] p-3.5 text-oat-50">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRoleView("explorer")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
                roleView === "explorer"
                  ? "bg-sage-500 text-white shadow-sm ring-2 ring-white/50"
                  : "bg-white/10 text-oat-200 hover:bg-white/20"
              }`}
            >
              <GameIcon name="role-explorer" className="h-4 w-4" /> Explorer
            </button>
            <button
              type="button"
              onClick={() => setRoleView("impostor")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
                roleView === "impostor"
                  ? "bg-terracotta-500 text-white shadow-sm ring-2 ring-white/50"
                  : "bg-white/10 text-oat-200 hover:bg-white/20"
              }`}
            >
              <GameIcon name="role-impostor" className="h-4 w-4" /> Impostor
            </button>
          </div>
          <div className="flex w-full items-center gap-3 rounded-xl bg-oat-50/95 px-3 py-2.5 text-left text-espresso">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                roleView === "explorer" ? "bg-sage-100" : "bg-terracotta-100"
              }`}
            >
              <GameIcon
                name={roleView === "explorer" ? "vault-treasure" : "action-blast-tile"}
                className="h-7 w-7"
              />
            </span>
            <div className="min-w-0">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-espresso-muted">
                {roleView === "explorer" ? "Explorer Win Goal" : "Impostor Win Goal"}
              </div>
              <p className="text-xs font-bold leading-snug text-espresso">
                {roleView === "explorer"
                  ? "Link Base Camp to the hidden Treasure Chest Vault (+2 Stars each +1 Clutch Star!)."
                  : "Break tools, lay dead ends, and drain the deck before the Chest is reached (+2 to +4 Stars!)."}
              </p>
            </div>
          </div>
        </div>
      );

    case "tt-board-flip": {
      const tileEdges = ttFlipped
        ? { N: false, E: true, S: true, W: true }
        : { N: true, E: true, S: false, W: false };
      const connectsWest = tileEdges.W;
      return (
        <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-[#594436] bg-[#3E3026] p-3.5 text-oat-50">
          <div className="flex items-center gap-2">
            {/* Base Camp */}
            <div className="flex flex-col items-center gap-1">
              <div className="h-[68px] w-[52px]">
                <PathTileSvg
                  kind="BASE_CAMP"
                  edges={{ N: true, E: true, S: true, W: true }}
                  connectedCenter
                  compact
                />
              </div>
              <span className="text-[9px] font-bold text-amberwarm-400">Base Camp</span>
            </div>

            {/* Target Slot */}
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (connectsWest) setTtPlaced(true);
                }}
                className={`flex h-[68px] w-[52px] items-center justify-center rounded-lg border-2 transition ${
                  ttPlaced
                    ? "border-amberwarm-400 bg-transparent"
                    : connectsWest
                      ? "animate-pulse border-sage-300 bg-sage-500/35 hover:bg-sage-500/50"
                      : "border-dashed border-oat-300/40 bg-black/25"
                }`}
              >
                {ttPlaced ? (
                  <PathTileSvg edges={tileEdges} connectedCenter compact />
                ) : (
                  <span className="text-center text-[10px] font-extrabold text-oat-50">
                    {connectsWest ? "Tap!" : "No W"}
                  </span>
                )}
              </button>
              <span className="text-[9px] font-bold text-sage-300">
                {ttPlaced ? "Connected!" : connectsWest ? "Glowing Slot" : "Flip First"}
              </span>
            </div>

            {/* Sealed Vault */}
            <div className="flex flex-col items-center gap-1">
              <div className="h-[68px] w-[52px]">
                <PathTileSvg
                  kind="VAULT"
                  edges={{ N: true, E: true, S: true, W: true }}
                  connectedCenter
                  compact
                />
              </div>
              <span className="text-[9px] font-bold text-oat-200">Sealed Vault</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setTtFlipped((v) => !v);
                setTtPlaced(false);
              }}
              className="inline-flex items-center gap-1 rounded-xl bg-amberwarm-400 px-3 py-1 text-[11px] font-extrabold text-espresso shadow-sm transition hover:bg-amberwarm-600 hover:text-white"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Try Flip 180°
            </button>
            <span className="text-[11px] font-bold text-oat-200">
              {ttPlaced
                ? "Nice! Path links straight out of Base Camp."
                : connectsWest
                  ? "West edge open — tap the green slot!"
                  : "Tap Flip 180° to align the West edge."}
            </span>
          </div>
        </div>
      );
    }

    case "tt-tools":
      return (
        <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-oat-300 bg-oat-100 p-3.5">
          <div className="flex items-center gap-3 rounded-2xl border border-oat-300 bg-white px-4 py-2.5 shadow-sm">
            <span className="text-xs font-extrabold text-espresso">Your Tools:</span>
            <div className="flex items-center gap-2">
              {(["lantern", "compass", "grapple"] as const).map((g) => {
                const broken = g === "grapple" && pickaxeBroken;
                return (
                  <div
                    key={g}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl border-2 transition ${
                      broken
                        ? "border-terracotta-500 bg-terracotta-100"
                        : "border-sage-300 bg-sage-100"
                    }`}
                  >
                    <ToolSlotIcon gear={g} broken={broken} className="h-5 w-5" />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <div className="scale-90">
              <ToolCardArt kind="REPAIR" gears={["grapple"]} size="sm" />
            </div>
            <button
              type="button"
              onClick={() => setPickaxeBroken((v) => !v)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-extrabold text-white shadow-sm transition ${
                pickaxeBroken
                  ? "bg-sage-500 hover:bg-sage-700"
                  : "bg-terracotta-500 hover:bg-terracotta-700"
              }`}
            >
              {pickaxeBroken ? "Tap to Play Fix Pickaxe!" : "Repaired! (Break Again)"}
            </button>
          </div>
          <p className="text-[11px] font-bold text-espresso-soft">
            {pickaxeBroken
              ? "Slashed Pickaxe blocks Path Tiles until repaired with a matching Fix card."
              : "All 3 tools intact — you can lay Path Tiles again!"}
          </p>
        </div>
      );

    case "tt-actions":
      return (
        <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-[#594436] bg-[#3E3026] p-3.5 text-oat-50">
          <div className="flex items-center gap-4">
            <div className="h-[74px] w-[56px]">
              <PathTileSvg
                kind="VAULT"
                edges={{ N: true, E: true, S: true, W: true }}
                connectedCenter
                privateScoutHint={vaultPeeked ? "TRUE_RELIC" : undefined}
                compact
              />
            </div>
            <div className="space-y-1.5 text-left">
              <button
                type="button"
                onClick={() => setVaultPeeked((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amberwarm-400 px-3 py-1.5 text-xs font-extrabold text-espresso shadow-sm transition hover:bg-amberwarm-600 hover:text-white"
              >
                <GameIcon name="action-peek-vault" className="h-4 w-4" />
                {vaultPeeked ? "Hide Private Intel" : "Try Peek Vault!"}
              </button>
              <p className="max-w-[200px] text-[11px] font-semibold text-oat-200">
                {vaultPeeked
                  ? "Only YOU see the private Chest badge — teammates still see '?'!"
                  : "Tap to secretly scout whether this vault holds the Treasure Chest."}
              </p>
            </div>
          </div>
        </div>
      );

    case "tt-quickfix":
      return (
        <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-terracotta-500/30 bg-terracotta-100/50 p-3.5">
          <div className="flex items-center gap-1.5">
            <div className="flex h-12 w-9 items-center justify-center rounded-lg border-2 border-oat-300 bg-white text-[10px] font-extrabold text-espresso shadow-sm">
              Card 1
            </div>
            <span className="text-xs font-black text-espresso-muted">+</span>
            <div className="flex h-12 w-9 items-center justify-center rounded-lg border-2 border-oat-300 bg-white text-[10px] font-extrabold text-espresso shadow-sm">
              Card 2
            </div>
          </div>
          <span className="text-sm font-black text-terracotta-700">→</span>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-sage-300 bg-white px-3 py-2 shadow-sm">
            <GameIcon name="quick-fix" className="h-5 w-5" />
            <div className="text-left">
              <div className="text-[11px] font-extrabold text-espresso">Quick Fix!</div>
              <div className="text-[10px] font-semibold text-sage-700">
                Repairs 1 of your own broken tools
              </div>
            </div>
          </div>
        </div>
      );

    /* ========================= HEARTHVALE ========================= */
    case "hv-goal":
      return (
        <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-amberwarm-400/50 bg-amberwarm-100/60 p-3.5">
          <div className="rounded-xl bg-white p-2.5 shadow-sm">
            <div className="inline-flex items-center gap-1 rounded-full bg-sage-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
              Step 1
            </div>
            <div className="mt-1.5 font-display text-xs font-bold text-espresso">
              Place 1 Valley Tile
            </div>
            <p className="mt-0.5 text-[10.5px] font-medium text-espresso-soft">
              Match touching Towns, Roads, and Meadows seamlessly.
            </p>
          </div>
          <div className="rounded-xl bg-white p-2.5 shadow-sm">
            <div className="inline-flex items-center gap-1 rounded-full bg-amberwarm-400 px-2 py-0.5 text-[10px] font-extrabold text-espresso">
              Step 2 (Optional)
            </div>
            <div className="mt-1.5 font-display text-xs font-bold text-espresso">
              Drop 1 Villager / Mayor
            </div>
            <p className="mt-0.5 text-[10.5px] font-medium text-espresso-soft">
              Claim an unclaimed feature on that tile — or Skip to save Folk!
            </p>
          </div>
        </div>
      );

    case "hv-folk":
      return (
        <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-sage-300 bg-sage-100/60 p-3.5">
          <div className="flex items-center gap-2 rounded-xl border border-oat-300 bg-white px-3 py-2 shadow-sm">
            <GameIcon name="hv-villager" className="h-6 w-6" />
            <div>
              <div className="text-xs font-extrabold text-espresso">6 Villagers</div>
              <div className="text-[10px] font-bold text-espresso-muted">Strength ×1</div>
            </div>
          </div>
          <span className="rounded-full bg-espresso px-2 py-0.5 text-[10px] font-extrabold text-amberwarm-400">
            VS
          </span>
          <div className="flex items-center gap-2 rounded-xl border-2 border-amberwarm-400 bg-amberwarm-100/90 px-3 py-2 shadow-sm">
            <GameIcon name="hv-mayor" className="h-6 w-6" />
            <div>
              <div className="text-xs font-extrabold text-espresso">1 Mayor</div>
              <div className="text-[10px] font-bold text-amberwarm-600">
                Strength ×2 (Wins Ties!)
              </div>
            </div>
          </div>
        </div>
      );

    case "hv-match-rotate": {
      // start_town_road has E = ROAD. road_straight_lantern has N & S = ROAD at rot 0, E & W = ROAD at rot 90/270!
      const matches = hvRotation === 90 || hvRotation === 270;
      return (
        <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-oat-300 bg-[#3B3028] p-3.5 text-oat-50">
          <div className="flex items-center gap-1">
            <div className="h-16 w-16 overflow-hidden rounded-lg border-2 border-oat-200">
              <HearthvaleTileSvg templateId="start_town_road" rotation={0} compact />
            </div>
            <div
              className={`h-16 w-16 overflow-hidden rounded-lg border-2 transition ${
                matches
                  ? "border-sage-300 ring-2 ring-sage-500/60"
                  : "border-terracotta-500/80 ring-2 ring-terracotta-500/40"
              }`}
            >
              <HearthvaleTileSvg
                templateId="road_straight_lantern"
                rotation={hvRotation}
                compact
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setHvRotation(((hvRotation + 90) % 360) as TileRotation)}
              className="inline-flex items-center gap-1 rounded-xl bg-amberwarm-400 px-3 py-1 text-[11px] font-extrabold text-espresso shadow-sm hover:bg-amberwarm-600 hover:text-white"
            >
              <RotateCw className="h-3.5 w-3.5" /> Try Rotate 90° ({hvRotation}°)
            </button>
            <span
              className={`text-[11px] font-extrabold ${
                matches ? "text-sage-300" : "text-amberwarm-400"
              }`}
            >
              {matches ? "✓ Roads connect cleanly!" : "Rotate to connect the Road →"}
            </span>
          </div>
        </div>
      );
    }

    case "hv-architect-hand": {
      const tiles = [
        {
          id: "town_corner_crest",
          title: "Crested Corner",
          badge: "+2 Crest Bonus",
          spots: "5 spots",
        },
        {
          id: "windmill_meadow",
          title: "Sunlit Windmill",
          badge: "9 pts surrounded",
          spots: "4 spots",
        },
      ] as const;
      return (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-oat-300 bg-oat-100 p-3">
          <div className="grid w-full grid-cols-2 gap-2">
            {tiles.map((t, idx) => {
              const active = hvSelectedIdx === idx;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setHvSelectedIdx(idx as 0 | 1)}
                  className={`flex items-center gap-2 rounded-xl border-2 p-2 text-left transition ${
                    active
                      ? "border-sage-500 bg-sage-100 shadow-sm"
                      : "border-oat-300 bg-white hover:border-amberwarm-400"
                  }`}
                >
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-oat-300">
                    <HearthvaleTileSvg templateId={t.id} rotation={0} compact />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-extrabold text-espresso">
                      {t.title}
                    </div>
                    <div className="text-[9.5px] font-bold text-amberwarm-600">{t.badge}</div>
                    <div className="text-[9.5px] font-bold text-espresso-muted">{t.spots}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <span className="text-[10.5px] font-bold text-espresso-soft">
            Tap either tile to compare bonuses &amp; valid spots before placing!
          </span>
        </div>
      );
    }

    case "hv-scoring":
      return (
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-oat-300 bg-oat-100 p-3 text-center">
          <div className="flex flex-col items-center rounded-xl bg-white p-2 shadow-sm">
            <div className="h-10 w-10 overflow-hidden rounded-lg border border-oat-200">
              <HearthvaleTileSvg templateId="town_corner_crest" rotation={0} compact />
            </div>
            <div className="mt-1 text-[11px] font-extrabold text-espresso">Town</div>
            <div className="text-[9.5px] font-bold text-sage-700">2/tile + 2 Crest</div>
          </div>
          <div className="flex flex-col items-center rounded-xl bg-white p-2 shadow-sm">
            <div className="h-10 w-10 overflow-hidden rounded-lg border border-oat-200">
              <HearthvaleTileSvg templateId="road_straight_lantern" rotation={90} compact />
            </div>
            <div className="mt-1 text-[11px] font-extrabold text-espresso">Road</div>
            <div className="text-[9.5px] font-bold text-amberwarm-600">1/tile (×2 Lantern)</div>
          </div>
          <div className="flex flex-col items-center rounded-xl bg-white p-2 shadow-sm">
            <div className="h-10 w-10 overflow-hidden rounded-lg border border-oat-200">
              <HearthvaleTileSvg templateId="windmill_meadow" rotation={0} compact />
            </div>
            <div className="mt-1 text-[11px] font-extrabold text-espresso">Windmill</div>
            <div className="text-[9.5px] font-bold text-terracotta-700">9 pts (all 8)</div>
          </div>
        </div>
      );

    /* ========================= VELVET MASQUE ========================= */
    case "vm-goal":
      return (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-[#7A3548] bg-gradient-to-br from-[#491927] to-[#2B0E18] p-3.5 text-oat-50">
          <div className="flex w-full items-center justify-between text-xs font-extrabold">
            <span className="inline-flex items-center gap-1 text-oat-200">
              <GameIcon name="coin-gold" className="h-4 w-4" /> Start: 6g
            </span>
            <span className="inline-flex items-center gap-1 text-amberwarm-400">
              <GameIcon name="trophy" className="h-4 w-4" /> Goal: 13g Win!
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-black/40 p-0.5">
            <div className="h-full w-[48%] rounded-full bg-gradient-to-r from-amberwarm-400 to-amberwarm-600" />
          </div>
          <p className="text-[11px] font-semibold text-oat-200">
            Hit the Gold Goal first — OR if any rival hits <strong className="text-amberwarm-400">0g</strong>, the richest guest wins!
          </p>
        </div>
      );

    case "vm-curtain":
      return (
        <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-[#7A3548] bg-[#3A1320] p-3.5 text-oat-50">
          <div className="flex items-center gap-3">
            {(["monarch", "magistrate", "trickster"] as const).map((mId) => (
              <div key={mId} className="h-[74px] w-[54px]">
                <VelvetMasqueCardSvg
                  maskId={vmCurtainClosed ? undefined : mId}
                  highlight={vmCurtainClosed ? "none" : "gold"}
                  compact
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setVmCurtainClosed((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amberwarm-400 px-3.5 py-1.5 text-xs font-extrabold text-espresso shadow-sm transition hover:bg-amberwarm-600 hover:text-white"
          >
            {vmCurtainClosed ? (
              <>
                <Eye className="h-3.5 w-3.5" /> Re-Open Curtain
              </>
            ) : (
              <>
                <EyeOff className="h-3.5 w-3.5" /> Close the Curtain!
              </>
            )}
          </button>
          <span className="text-[10.5px] font-semibold text-oat-200">
            {vmCurtainClosed
              ? "Curtain closed! Remember where Monarch, Magistrate & Trickster sit?"
              : "Memorize every face-up mask before the curtain drops!"}
          </span>
        </div>
      );

    case "vm-stage-fine":
      return (
        <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-[#7A3548] bg-[#3A1320] p-3.5 text-oat-50">
          <div className="flex items-center gap-2 rounded-xl border border-amberwarm-400/50 bg-[#2A0D16] px-3 py-2">
            <Scale className="h-4 w-4 text-amberwarm-400" />
            <div>
              <div className="text-[9px] font-extrabold uppercase tracking-wider text-oat-200/75">
                Fine Box
              </div>
              <div className="inline-flex items-center gap-1 font-display text-sm font-bold text-amberwarm-400">
                <GameIcon name="coin-gold" className="h-4 w-4" /> 3 Gold
              </div>
            </div>
          </div>
          <span className="text-xs font-extrabold text-amberwarm-400">→</span>
          <div className="flex items-center gap-2">
            <div className="h-14 w-10">
              <VelvetMasqueCardSvg maskId="magistrate" highlight="gold" compact />
            </div>
            <div className="h-14 w-10">
              <VelvetMasqueCardSvg compact />
            </div>
          </div>
        </div>
      );

    case "vm-cloak-swap":
      return (
        <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-[#7A3548] bg-[#3A1320] p-3.5 text-oat-50">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setVmCloakMode("swap")}
              className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
                vmCloakMode === "swap"
                  ? "bg-sage-500 text-white shadow-sm"
                  : "bg-white/10 text-oat-200 hover:bg-white/20"
              }`}
            >
              <Shuffle className="h-3.5 w-3.5" /> Actually Swap
            </button>
            <button
              type="button"
              onClick={() => setVmCloakMode("keep")}
              className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
                vmCloakMode === "keep"
                  ? "bg-amberwarm-400 text-espresso shadow-sm"
                  : "bg-white/10 text-oat-200 hover:bg-white/20"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" /> Fake-Swap (Keep!)
            </button>
          </div>
          <p className="text-center text-[11px] font-semibold text-oat-200">
            {vmCloakMode === "swap"
              ? "Both masks silently trade seats under the Velvet Cloak — rivals can only guess!"
              : "You juggle both cards under the cloak and put them RIGHT BACK — ultimate mind game!"}
          </p>
        </div>
      );

    case "vm-challenge":
      return (
        <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-[#7A3548] bg-[#3A1320] p-3.5 text-oat-50">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setVmChallenged(false)}
              className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
                !vmChallenged
                  ? "bg-sage-500 text-white shadow-sm"
                  : "bg-white/10 text-oat-200 hover:bg-white/20"
              }`}
            >
              Everyone Passes
            </button>
            <button
              type="button"
              onClick={() => setVmChallenged(true)}
              className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
                vmChallenged
                  ? "bg-terracotta-500 text-white shadow-sm"
                  : "bg-white/10 text-oat-200 hover:bg-white/20"
              }`}
            >
              <Swords className="h-3.5 w-3.5" /> Someone Challenges!
            </button>
          </div>
          <div className="w-full rounded-xl bg-oat-50/95 px-3 py-2 text-center text-xs font-bold text-espresso">
            {vmChallenged
              ? "Claimed cards flip face-up! The true Mask holder activates the power — every fake pays 1 Gold into the Fine Box."
              : "No cards flip! The announced Mask power triggers immediately — even if it was a total bluff!"}
          </div>
        </div>
      );

    /* ========================= SHARED TABLE TOOLS ========================= */
    case "tt-table-tools":
    case "hv-table-tools":
    case "vm-table-tools":
      return (
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-oat-300 bg-oat-100 p-3 text-center">
          <div className="flex flex-col items-center rounded-xl bg-white p-2.5 shadow-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amberwarm-100 text-amberwarm-600">
              <Highlighter className="h-4 w-4" />
            </span>
            <div className="mt-1.5 text-[11px] font-extrabold text-espresso">Board Marker</div>
            <div className="text-[9.5px] font-semibold text-espresso-muted">
              Draw &amp; ping live
            </div>
          </div>
          <div className="flex flex-col items-center rounded-xl bg-white p-2.5 shadow-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sage-100 text-sage-700">
              <MessageCircle className="h-4 w-4" />
            </span>
            <div className="mt-1.5 text-[11px] font-extrabold text-espresso">Quick Chat</div>
            <div className="text-[9.5px] font-semibold text-espresso-muted">
              1-tap table banter
            </div>
          </div>
          <div className="flex flex-col items-center rounded-xl bg-white p-2.5 shadow-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-terracotta-100 text-terracotta-700">
              <ZoomIn className="h-4 w-4" />
            </span>
            <div className="mt-1.5 text-[11px] font-extrabold text-espresso">Zoom &amp; Tour</div>
            <div className="text-[9.5px] font-semibold text-espresso-muted">
              Replay anytime
            </div>
          </div>
        </div>
      );
  }
}

/**
 * Interactive Pre-Match Step-by-Step Quick Tutorial Stepper.
 * Lets players interactively step through all 6 core features of any game
 * right from the Wardrobe, Cashier Rulebook, Table Lobby, or /games page.
 */
export function QuickTutorialStepper({
  gameSlug,
  onComplete,
}: QuickTutorialStepperProps) {
  const tour = useMemo(() => getGameQuickTour(gameSlug), [gameSlug]);
  const [stepIdx, setStepIdx] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    setStepIdx(0);
    setCompleted(false);
  }, [gameSlug]);

  const step = tour.steps[stepIdx] ?? tour.steps[0]!;
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === tour.steps.length - 1;

  const handleNext = () => {
    if (!isLast) {
      setStepIdx((i) => i + 1);
    } else {
      markQuickTourCompleted(gameSlug);
      setCompleted(true);
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Progress Header & Clickable Step Pills */}
      <div className="rounded-2xl border border-oat-300 bg-white px-3.5 py-2.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-sage-100 px-2.5 py-0.5 text-[11px] font-extrabold text-sage-700">
              <Compass className="h-3.5 w-3.5" />
              Interactive Quick Tour (~{tour.estimatedSec}s)
            </span>
            <span className="text-xs font-bold text-espresso-muted">
              Step {stepIdx + 1} of {tour.steps.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {tour.steps.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setStepIdx(idx);
                  setCompleted(false);
                }}
                title={`${idx + 1}. ${s.title}`}
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold transition ${
                  idx === stepIdx
                    ? "bg-sage-500 text-white shadow-sm ring-2 ring-sage-300"
                    : idx < stepIdx || completed
                      ? "bg-amberwarm-100 text-amberwarm-600 hover:bg-amberwarm-400 hover:text-espresso"
                      : "bg-oat-200 text-espresso-muted hover:bg-oat-300"
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Continuous Progress Bar */}
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-oat-200">
          <div
            style={{
              width: `${completed ? 100 : ((stepIdx + 1) / tour.steps.length) * 100}%`,
            }}
            className="h-full rounded-full bg-gradient-to-r from-sage-500 to-amberwarm-400 transition-all duration-300"
          />
        </div>
      </div>

      {/* Main Active Step Card */}
      <div className="rounded-3xl border-2 border-oat-300 bg-white p-3.5 shadow-sm sm:p-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-oat-200 bg-oat-50 shadow-sm">
            <GameIcon name={step.icon} className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider ${accentBadgeClasses(step.accent)}`}
            >
              {step.badge}
            </span>
            <h3 className="font-display text-base font-bold text-espresso sm:text-lg">
              {step.title}
            </h3>
          </div>
        </div>

        <p className="mt-2 text-xs font-medium leading-relaxed text-espresso-soft sm:text-[13px]">
          {renderBoldText(step.summary)}
        </p>

        {/* Interactive Hands-On Visual Playground */}
        <div className="mt-2.5">
          <StepInteractiveStage key={step.visualId} visualId={step.visualId} />
        </div>

        {/* Core Features Breakdown */}
        <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
          {step.features.map((feat) => (
            <div
              key={feat.label}
              className="rounded-xl border border-oat-200 bg-oat-50 px-3 py-2 text-xs leading-snug text-espresso-soft"
            >
              <div className="font-extrabold text-espresso">{feat.label}</div>
              <p className="mt-0.5">{feat.detail}</p>
            </div>
          ))}
        </div>

        {/* Pro Tip Strip */}
        <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-amberwarm-100/80 px-3 py-2 text-xs font-semibold text-espresso">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amberwarm-600" />
          <span>{step.tryItHint}</span>
        </div>

        {/* Stepper Footer Controls */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-oat-200 pt-2.5">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => {
              setStepIdx((i) => Math.max(0, i - 1));
              setCompleted(false);
            }}
            className="inline-flex items-center gap-1 rounded-xl bg-oat-200 px-3.5 py-1.5 text-xs font-bold text-espresso transition hover:bg-oat-300 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>

          {completed ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-100 px-3 py-1 text-xs font-extrabold text-sage-700">
                <CheckCircle2 className="h-4 w-4" /> Ready to play {tour.title}!
              </span>
              {onComplete && (
                <button
                  type="button"
                  onClick={onComplete}
                  className="rounded-xl bg-sage-500 px-4 py-1.5 text-xs font-extrabold text-white shadow-sm hover:bg-sage-700"
                >
                  Done
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className={`inline-flex items-center gap-1 rounded-xl px-4 py-1.5 text-xs font-extrabold text-white shadow-sm transition ${
                isLast
                  ? "bg-sage-500 hover:bg-sage-700"
                  : "bg-espresso hover:bg-espresso-soft"
              }`}
            >
              {isLast ? (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Finish Quick Tour
                </>
              ) : (
                <>
                  Next Step <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
