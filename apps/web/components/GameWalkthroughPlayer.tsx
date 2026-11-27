"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  Film,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Subtitles,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  getOnboardingCurriculum,
  type SupportedGameSlug,
  type WalkthroughChapter,
} from "@/lib/gameTutorials";
import { GameIcon, ToolCardArt, ToolSlotIcon } from "./GameIcons";
import { PathTileSvg } from "./TreasureTrailsTileSvg";
import { HearthvaleTileSvg } from "./HearthvaleTileSvg";
import { VelvetMasqueCardSvg } from "./VelvetMasqueCardSvg";

function formatTime(sec: number): string {
  const clamped = Math.max(0, Math.floor(sec));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ============================================================================
 *  ANIMATED TABLETOP STAGE RENDERERS (Used by both Full Video & Short Clips!)
 * ============================================================================ */

function TreasureTrailsStage({
  sceneId,
  p,
}: {
  sceneId: string;
  /** Normalized progress 0..1 inside the current chapter or clip */
  p: number;
}) {
  // Scene 1: Secret Roles & Goal (tt-ch-1)
  if (sceneId === "tt-ch-1") {
    const showRoles = p > 0.14;
    const pulseTrail = p > 0.48;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 py-3">
        {/* Mini expedition board */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-12 sm:w-14 drop-shadow-md">
            <PathTileSvg
              kind="BASE_CAMP"
              edges={{ N: true, E: true, S: true, W: true }}
              connectedCenter
            />
          </div>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((idx) => (
              <div
                key={idx}
                className={`h-2 w-5 rounded-full transition-all duration-500 sm:w-8 ${
                  pulseTrail && p > 0.48 + idx * 0.12
                    ? "bg-amberwarm-400 shadow-[0_0_10px_rgba(244,193,69,0.9)]"
                    : "bg-oat-200/35"
                }`}
              />
            ))}
          </div>
          <div className="flex flex-col gap-1">
            {[0, 1, 2].map((v) => (
              <div
                key={v}
                className={`w-9 transition-transform duration-500 sm:w-10 ${
                  v === 1 && p > 0.72 ? "scale-110" : ""
                }`}
              >
                <PathTileSvg
                  kind="VAULT"
                  edges={{ N: true, E: true, S: true, W: true }}
                  connectedCenter
                  vaultRevealed={v === 1 && p > 0.78}
                  vaultKind={v === 1 ? "TRUE_RELIC" : "DECOY"}
                  compact
                />
              </div>
            ))}
          </div>
        </div>

        {/* Role cards */}
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <div
            className={`flex items-center gap-2 rounded-xl border-2 px-3 py-1.5 text-xs font-bold transition-all duration-500 ${
              showRoles
                ? "translate-y-0 border-sage-300 bg-sage-100/95 text-espresso opacity-100"
                : "translate-y-2 border-transparent bg-white/10 text-oat-200 opacity-30"
            }`}
          >
            <GameIcon name="role-explorer" className="h-5 w-5" />
            <div>
              <div className="leading-tight">Explorers</div>
              <div className="text-[10px] font-semibold text-sage-700">
                Reach the Treasure Chest
              </div>
            </div>
          </div>

          <div
            className={`flex items-center gap-2 rounded-xl border-2 px-3 py-1.5 text-xs font-bold transition-all duration-500 ${
              p > 0.34
                ? "translate-y-0 border-terracotta-500 bg-terracotta-100/95 text-espresso opacity-100"
                : "translate-y-2 border-transparent bg-white/10 text-oat-200 opacity-30"
            }`}
          >
            <GameIcon name="role-impostor" className="h-5 w-5" />
            <div>
              <div className="leading-tight">Impostors</div>
              <div className="text-[10px] font-semibold text-terracotta-700">
                Stall until deck runs dry
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Scene 2: Place & Flip Path Tiles (tt-ch-2 OR tt-connect-flip)
  if (sceneId === "tt-ch-2" || sceneId === "tt-connect-flip") {
    const flipped = p >= 0.32;
    const placed = p >= 0.58;
    const deadEndDemo = sceneId === "tt-connect-flip" && p >= 0.8;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 py-3">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="w-12 sm:w-14">
            <PathTileSvg
              kind="BASE_CAMP"
              edges={{ N: true, E: true, S: true, W: true }}
              connectedCenter
            />
          </div>
          <div className="w-12 sm:w-14">
            <PathTileSvg
              edges={{ N: false, E: true, S: false, W: true }}
              connectedCenter
            />
          </div>
          {/* Target highlighted slot */}
          <div
            className={`relative flex h-[64px] w-12 items-center justify-center rounded-lg border-2 transition-all duration-500 sm:h-[74px] sm:w-14 ${
              placed
                ? "border-amberwarm-400 bg-amberwarm-100/20 shadow-[0_0_16px_rgba(244,193,69,0.5)]"
                : "border-dashed border-emerald-400 bg-emerald-400/20"
            }`}
          >
            {placed ? (
              <PathTileSvg
                edges={{ N: true, E: true, S: false, W: true }}
                connectedCenter
              />
            ) : (
              <span className="text-[10px] font-extrabold text-emerald-200">
                TAP
              </span>
            )}
          </div>
          {/* Dead-end illustration for short clip */}
          {deadEndDemo && (
            <div className="w-12 animate-pulse sm:w-14">
              <PathTileSvg
                edges={{ N: false, E: false, S: false, W: true }}
                connectedCenter={false}
              />
            </div>
          )}
        </div>

        {/* Handheld card + Flip 180° pill */}
        <div className="flex items-center gap-3">
          {!placed ? (
            <>
              <div
                className="w-11 transition-transform duration-500 sm:w-12"
                style={{ transform: flipped ? "rotate(180deg)" : "rotate(0deg)" }}
              >
                <PathTileSvg
                  edges={{ N: false, E: true, S: true, W: true }}
                  connectedCenter
                />
              </div>
              <div
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-extrabold transition-all ${
                  flipped
                    ? "border-amberwarm-400 bg-amberwarm-400 text-espresso shadow"
                    : "border-oat-300/40 bg-white/15 text-oat-50"
                }`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {flipped ? "Flipped 180°!" : "Flip 180°"}
              </div>
            </>
          ) : (
            <div className="rounded-full bg-emerald-500/90 px-3.5 py-1 text-xs font-extrabold text-white shadow">
              {deadEndDemo
                ? "Dead-Ends block expansion until Blasted!"
                : "Trail Extended from Base Camp!"}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Scene 3: Break & Fix Tools 1-to-1 Matching (tt-ch-3 OR tt-tools-match)
  if (sceneId === "tt-ch-3" || sceneId === "tt-tools-match") {
    const pickaxeBroken = p >= 0.25 && p < 0.68;
    const fixingNow = p >= 0.6 && p < 0.85;
    const repaired = p >= 0.68;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 py-3">
        {/* Player tool status card */}
        <div className="flex items-center gap-3 rounded-2xl border-2 border-oat-300/80 bg-oat-50/95 px-4 py-2.5 shadow-md">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-espresso">
            <GameIcon name="role-explorer" className="h-5 w-5" />
            <span>Milo</span>
          </div>
          <div className="h-5 w-px bg-oat-300" />
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <ToolSlotIcon gear="lantern" broken={false} className="h-6 w-6" />
              <span className="text-[9px] font-bold text-espresso-muted">Lantern</span>
            </div>
            <div className="flex flex-col items-center">
              <ToolSlotIcon gear="compass" broken={false} className="h-6 w-6" />
              <span className="text-[9px] font-bold text-espresso-muted">Compass</span>
            </div>
            <div
              className={`flex flex-col items-center rounded-lg px-1.5 py-0.5 transition-all ${
                pickaxeBroken
                  ? "bg-terracotta-100 ring-2 ring-terracotta-500"
                  : repaired
                    ? "bg-sage-100 ring-2 ring-sage-500"
                    : ""
              }`}
            >
              <ToolSlotIcon gear="grapple" broken={pickaxeBroken} className="h-6 w-6" />
              <span className="text-[9px] font-bold text-espresso">Pickaxe</span>
            </div>
          </div>
        </div>

        {/* Matching 1-to-1 Card Showcase */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 rounded-xl border-2 px-3 py-1.5 transition-all duration-300 ${
              pickaxeBroken
                ? "scale-105 border-terracotta-500 bg-white shadow-lg"
                : "border-white/15 bg-white/10 opacity-55"
            }`}
          >
            <ToolCardArt kind="HAZARD" gears={["grapple"]} size="sm" />
            <div className="text-left">
              <div
                className={`text-[11px] font-extrabold ${
                  pickaxeBroken ? "text-terracotta-700" : "text-oat-100"
                }`}
              >
                Break Pickaxe
              </div>
              <div
                className={`text-[10px] font-semibold ${
                  pickaxeBroken ? "text-espresso-soft" : "text-oat-200/80"
                }`}
              >
                Locks path-laying!
              </div>
            </div>
          </div>

          <ChevronRight className="h-4 w-4 text-oat-200" />

          <div
            className={`flex items-center gap-2 rounded-xl border-2 px-3 py-1.5 transition-all duration-300 ${
              fixingNow || repaired
                ? "scale-105 border-sage-500 bg-white shadow-lg"
                : "border-white/15 bg-white/10 opacity-55"
            }`}
          >
            <ToolCardArt kind="REPAIR" gears={["grapple", "lantern"]} size="sm" />
            <div className="text-left">
              <div
                className={`text-[11px] font-extrabold ${
                  fixingNow || repaired ? "text-sage-700" : "text-oat-100"
                }`}
              >
                Fix / Dual Fix
              </div>
              <div
                className={`text-[10px] font-semibold ${
                  fixingNow || repaired ? "text-espresso-soft" : "text-oat-200/80"
                }`}
              >
                Exact matching icon!
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Scene 4: Peek Vault, Blast Tile & Quick Fix (tt-ch-4 OR tt-peek-blast OR tt-quick-fix)
  if (sceneId === "tt-quick-fix") {
    const fixed = p >= 0.58;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 py-3">
        <div className="flex items-center gap-3 rounded-2xl border-2 border-oat-300 bg-oat-50/95 px-4 py-2.5 shadow-md">
          <ToolSlotIcon gear="lantern" broken={!fixed} className="h-7 w-7" />
          <div className="text-left">
            <div className="text-xs font-extrabold text-espresso">
              {fixed ? "Lantern Repaired!" : "Lantern Broken — Stuck!"}
            </div>
            <div className="text-[10px] font-semibold text-espresso-soft">
              {fixed
                ? "Ready to lay paths again next turn"
                : "Discard 2 cards face-down with Quick Fix"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {[0, 1].map((idx) => (
            <div
              key={idx}
              className={`flex h-12 w-10 items-center justify-center rounded-lg border-2 text-[10px] font-extrabold transition-all duration-500 ${
                p >= 0.25 + idx * 0.14
                  ? "-translate-y-1 border-amberwarm-400 bg-amberwarm-100 text-espresso shadow"
                  : "border-oat-300/40 bg-white/15 text-oat-100"
              }`}
            >
              Card {idx + 1}
            </div>
          ))}
          <ChevronRight className="h-4 w-4 text-amberwarm-400" />
          <div
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold transition-all ${
              fixed
                ? "bg-sage-500 text-white shadow-lg"
                : "bg-amberwarm-400 text-espresso shadow"
            }`}
          >
            <GameIcon name="quick-fix" className="h-4 w-4" />
            {fixed ? "Self-Repaired!" : "Quick Fix (2 Cards)"}
          </div>
        </div>
      </div>
    );
  }

  if (sceneId === "tt-ch-4" || sceneId === "tt-peek-blast") {
    const scouted = p >= 0.25;
    const blasted = p >= 0.65;
    return (
      <div className="flex h-full w-full items-center justify-center gap-4 px-4 py-3 sm:gap-6">
        {/* Peek Vault side */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="inline-flex items-center gap-1 rounded-full bg-amberwarm-100/95 px-2.5 py-0.5 text-[10px] font-extrabold text-espresso">
            <GameIcon name="action-peek-vault" className="h-3.5 w-3.5" />
            Peek Vault
          </div>
          <div className="w-14 transition-transform duration-500 sm:w-16">
            <PathTileSvg
              kind="VAULT"
              edges={{ N: true, E: true, S: true, W: true }}
              connectedCenter
              vaultRevealed={false}
              privateScoutHint={scouted ? "TRUE_RELIC" : undefined}
            />
          </div>
          <span className="text-[10px] font-bold text-oat-100">
            {scouted ? "Private Intel: Only you see ★!" : "Inspect any sealed vault"}
          </span>
        </div>

        <div className="h-20 w-px bg-white/15" />

        {/* Blast Tile side */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="inline-flex items-center gap-1 rounded-full bg-terracotta-100/95 px-2.5 py-0.5 text-[10px] font-extrabold text-terracotta-700">
            <GameIcon name="action-blast-tile" className="h-3.5 w-3.5" />
            Blast Tile
          </div>
          <div className="relative flex h-[74px] w-14 items-center justify-center rounded-lg border-2 border-dashed border-oat-200/35 sm:h-[84px] sm:w-16">
            {!blasted ? (
              <PathTileSvg
                edges={{ N: false, E: false, S: false, W: true }}
                connectedCenter={false}
              />
            ) : (
              <div className="flex flex-col items-center text-amberwarm-400">
                <Sparkles className="h-6 w-6" />
                <span className="text-[9px] font-extrabold uppercase">Cleared!</span>
              </div>
            )}
          </div>
          <span className="text-[10px] font-bold text-oat-100">
            {blasted ? "Dead-End removed cleanly!" : "Clears any placed blocker"}
          </span>
        </div>
      </div>
    );
  }

  // Scene 5: Dramatic Vault Reveal & Victory (tt-ch-5)
  const connected = p >= 0.3;
  const revealed = p >= 0.55;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 py-3">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="w-12 sm:w-14">
          <PathTileSvg
            kind="BASE_CAMP"
            edges={{ N: true, E: true, S: true, W: true }}
            connectedCenter
          />
        </div>
        <div className="w-12 sm:w-14">
          <PathTileSvg
            edges={{ N: false, E: true, S: false, W: true }}
            connectedCenter
          />
        </div>
        <div
          className={`w-12 transition-all duration-500 sm:w-14 ${
            connected ? "scale-100 opacity-100" : "scale-90 opacity-30"
          }`}
        >
          <PathTileSvg
            edges={{ N: false, E: true, S: false, W: true }}
            connectedCenter
          />
        </div>
        <div
          className={`w-14 transition-transform duration-500 sm:w-16 ${
            revealed
              ? "scale-110 drop-shadow-[0_0_16px_rgba(244,193,69,0.9)]"
              : ""
          }`}
        >
          <PathTileSvg
            kind="VAULT"
            edges={{ N: true, E: true, S: true, W: true }}
            connectedCenter
            vaultRevealed={revealed}
            vaultKind="TRUE_RELIC"
          />
        </div>
      </div>
      <div
        className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-extrabold transition-all duration-500 ${
          revealed
            ? "bg-amberwarm-400 text-espresso shadow-lg"
            : "bg-white/15 text-oat-100"
        }`}
      >
        <GameIcon name="vault-treasure" className="h-4 w-4" />
        {revealed
          ? "Treasure Chest Uncovered! Explorers +2 ★ (+1 Clutch!)"
          : "Connecting final tile to Sealed Vault..."}
      </div>
    </div>
  );
}

function HearthvaleStage({ sceneId, p }: { sceneId: string; p: number }) {
  // Scene 1: Build the Sunlit Valley (hv-ch-1)
  if (sceneId === "hv-ch-1") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <div className="h-14 w-14 overflow-hidden rounded-lg shadow sm:h-16 sm:w-16">
            <HearthvaleTileSvg templateId="road_straight_lantern" rotation={90} />
          </div>
          <div className="h-14 w-14 overflow-hidden rounded-lg ring-2 ring-amberwarm-400 shadow sm:h-16 sm:w-16">
            <HearthvaleTileSvg templateId="start_town_road" rotation={0} />
          </div>
          <div
            className={`h-14 w-14 overflow-hidden rounded-lg shadow transition-all duration-500 sm:h-16 sm:w-16 ${
              p > 0.45 ? "scale-100 opacity-100" : "scale-90 opacity-30"
            }`}
          >
            <HearthvaleTileSvg templateId="windmill_meadow" rotation={0} shrineFill={5} />
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-oat-300/40 bg-oat-50/95 px-3 py-1.5 shadow">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-sage-700">
            2-Tile Hand:
          </span>
          <div className="h-9 w-9 overflow-hidden rounded border border-oat-300">
            <HearthvaleTileSvg templateId="town_corner_crest" rotation={0} compact />
          </div>
          <div className="h-9 w-9 overflow-hidden rounded border border-oat-300">
            <HearthvaleTileSvg templateId="road_curve_lantern" rotation={0} compact />
          </div>
          <span className="rounded-full bg-amberwarm-100 px-2 py-0.5 text-[10px] font-extrabold text-espresso">
            Cozy 36 · Grand 54
          </span>
        </div>
      </div>
    );
  }

  // Scene 2: Rotate 90° & Match Edges (hv-ch-2 OR hv-hand-rotate)
  if (sceneId === "hv-ch-2" || sceneId === "hv-hand-rotate") {
    const rot: 0 | 90 | 180 | 270 = p < 0.25 ? 0 : p < 0.48 ? 90 : 180;
    const placed = p >= 0.65;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 py-3">
        <div className="flex flex-col items-center gap-1">
          {/* Top slot above Valley Gate town edge (N) */}
          <div
            className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border-2 transition-all duration-500 sm:h-16 sm:w-16 ${
              placed
                ? "border-amberwarm-400 shadow-[0_0_16px_rgba(244,193,69,0.6)]"
                : "border-dashed border-emerald-400 bg-emerald-400/20"
            }`}
          >
            {placed ? (
              <HearthvaleTileSvg templateId="town_cap" rotation={180} isScoringFlash={p > 0.8} />
            ) : (
              <span className="text-[10px] font-extrabold text-emerald-200">MATCH N</span>
            )}
          </div>
          {/* Valley Gate start tile below */}
          <div className="h-14 w-14 overflow-hidden rounded-lg shadow sm:h-16 sm:w-16">
            <HearthvaleTileSvg templateId="start_town_road" rotation={0} />
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {!placed ? (
            <>
              <div className="h-10 w-10 overflow-hidden rounded-lg border-2 border-amberwarm-400 shadow">
                <HearthvaleTileSvg templateId="town_cap" rotation={rot} compact />
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amberwarm-400 px-3 py-1 text-[11px] font-extrabold text-espresso shadow">
                <RotateCcw className="h-3.5 w-3.5" />
                Rotate 90° → {rot}°
              </div>
            </>
          ) : (
            <div className="rounded-full bg-emerald-500/95 px-3.5 py-1 text-xs font-extrabold text-white shadow">
              Town Walls Match! Closed 2-Tile Town = +3 ★
            </div>
          )}
        </div>
      </div>
    );
  }

  // Scene 3: Claim with Villagers & Mayor (hv-ch-3)
  if (sceneId === "hv-ch-3") {
    const claimed = p >= 0.35;
    const isMayor = p >= 0.68;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-16 w-16 overflow-hidden rounded-xl border-2 border-amberwarm-400 shadow-lg sm:h-20 sm:w-20">
            <HearthvaleTileSvg
              templateId="town_keep_crest"
              rotation={0}
              folk={
                claimed
                  ? {
                      userId: "demo",
                      color: "sage",
                      kind: isMayor ? "MAYOR" : "VILLAGER",
                      segmentId: "town_new",
                    }
                  : undefined
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div
              className={`rounded-xl border px-3 py-1.5 text-xs font-extrabold transition-all ${
                claimed && !isMayor
                  ? "border-sage-300 bg-sage-100 text-espresso shadow"
                  : "border-white/20 bg-white/10 text-oat-100"
              }`}
            >
              5 Villagers · Strength 1
            </div>
            <div
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-extrabold transition-all ${
                isMayor
                  ? "border-amberwarm-400 bg-amberwarm-100 text-espresso shadow"
                  : "border-white/20 bg-white/10 text-oat-100"
              }`}
            >
              <GameIcon name="hv-mayor" className="h-4 w-4" />
              1 Mayor · Strength 2
            </div>
          </div>
        </div>
        <div className="text-[11px] font-bold text-oat-100">
          {isMayor
            ? "Mayor counts as TWO Villagers — returns when scored!"
            : claimed
              ? "Claim any unclaimed feature on the tile you just placed"
              : "Step 2: Optional Folk placement"}
        </div>
      </div>
    );
  }

  // Scene 4a: Lantern Road Short Clip (hv-lantern-road)
  if (sceneId === "hv-lantern-road") {
    const scored = p >= 0.55;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 py-3">
        <div className="flex items-center gap-1">
          <div className="h-14 w-14 overflow-hidden rounded-lg shadow sm:h-16 sm:w-16">
            <HearthvaleTileSvg templateId="road_t_junction" rotation={270} isScoringFlash={scored} />
          </div>
          <div className="h-14 w-14 overflow-hidden rounded-lg ring-2 ring-amberwarm-400 shadow sm:h-16 sm:w-16">
            <HearthvaleTileSvg
              templateId="road_straight_lantern"
              rotation={90}
              isScoringFlash={scored}
              folk={{
                userId: "demo",
                color: "ocean",
                kind: "VILLAGER",
                segmentId: "road_ns",
              }}
            />
          </div>
          <div className="h-14 w-14 overflow-hidden rounded-lg shadow sm:h-16 sm:w-16">
            <HearthvaleTileSvg templateId="road_t_junction" rotation={90} isScoringFlash={scored} />
          </div>
        </div>
        <div
          className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-extrabold transition-all ${
            scored
              ? "bg-amberwarm-400 text-espresso shadow-lg"
              : "bg-white/15 text-oat-100"
          }`}
        >
          <GameIcon name="hv-lantern" className="h-4 w-4" />
          {scored
            ? "3 Tiles × 2 (Lantern Bonus!) = +6 Stars!"
            : "Roadside Lantern doubles EVERY tile on this road"}
        </div>
      </div>
    );
  }

  // Scene 4b: Windmill 9-Star Ring (hv-windmill-ring) OR hv-ch-4 (Lanterns + Windmills)
  if (sceneId === "hv-windmill-ring" || sceneId === "hv-ch-4") {
    const fillCount = p < 0.25 ? 5 : p < 0.5 ? 7 : p < 0.72 ? 8 : 9;
    const done = fillCount === 9;
    return (
      <div className="flex h-full w-full items-center justify-center gap-5 px-4 py-3">
        {/* 3x3 mini Windmill ring */}
        <div className="grid grid-cols-3 gap-0.5 rounded-xl bg-espresso/40 p-1">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((cell) => {
            if (cell === 4) {
              return (
                <div key={cell} className="h-10 w-10 overflow-hidden rounded sm:h-11 sm:w-11">
                  <HearthvaleTileSvg
                    templateId="windmill_meadow"
                    rotation={0}
                    shrineFill={fillCount}
                    isScoringFlash={done}
                    folk={{
                      userId: "demo",
                      color: "honey",
                      kind: "VILLAGER",
                      segmentId: "shrine",
                    }}
                    compact
                  />
                </div>
              );
            }
            const filled =
              cell < 5 ||
              (cell === 5 && fillCount >= 7) ||
              (cell === 6 && fillCount >= 7) ||
              (cell === 7 && fillCount >= 8) ||
              (cell === 8 && fillCount >= 9);
            return (
              <div
                key={cell}
                className={`h-10 w-10 overflow-hidden rounded transition-all duration-300 sm:h-11 sm:w-11 ${
                  filled ? "opacity-100" : "border border-dashed border-oat-200/30 bg-white/5"
                }`}
              >
                {filled && (
                  <HearthvaleTileSvg
                    templateId={cell % 2 === 0 ? "road_straight_lantern" : "town_cap"}
                    rotation={0}
                    compact
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col items-start gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-amberwarm-100 px-2.5 py-0.5 text-[10px] font-extrabold text-espresso">
            <GameIcon name="hv-windmill" className="h-3.5 w-3.5" />
            Windmill {fillCount}/9
          </span>
          <div
            className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all ${
              done
                ? "bg-amberwarm-400 text-espresso shadow-lg"
                : "bg-white/15 text-oat-100"
            }`}
          >
            {done ? "All 8 Sides Filled → +9 ★!" : "Fill all 8 neighbors around it"}
          </div>
          {sceneId === "hv-ch-4" && (
            <div className="inline-flex items-center gap-1 text-[10px] font-bold text-amberwarm-100">
              <GameIcon name="hv-lantern" className="h-3.5 w-3.5" />
              Lantern Roads also score 2× per tile!
            </div>
          )}
        </div>
      </div>
    );
  }

  // Scene 5: Mayor Town Merger Takeover (hv-ch-5 OR hv-mayor-merge)
  const merged = p >= 0.45;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 py-3">
      <div className="flex items-center gap-1">
        <div className="h-14 w-14 overflow-hidden rounded-lg shadow sm:h-16 sm:w-16">
          <HearthvaleTileSvg
            templateId="town_cap"
            rotation={90}
            isScoringFlash={merged}
            folk={{ userId: "p1", color: "terracotta", kind: "VILLAGER", segmentId: "town_n" }}
          />
        </div>
        <div
          className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border-2 transition-all duration-500 sm:h-16 sm:w-16 ${
            merged
              ? "border-amberwarm-400 shadow-[0_0_14px_rgba(244,193,69,0.7)]"
              : "border-dashed border-emerald-400 bg-emerald-400/20"
          }`}
        >
          {merged ? (
            <HearthvaleTileSvg templateId="town_band_crest" rotation={0} isScoringFlash />
          ) : (
            <span className="text-[9px] font-extrabold text-emerald-200">BRIDGE</span>
          )}
        </div>
        <div className="h-14 w-14 overflow-hidden rounded-lg shadow sm:h-16 sm:w-16">
          <HearthvaleTileSvg
            templateId="town_cap"
            rotation={270}
            isScoringFlash={merged}
            folk={{ userId: "p2", color: "sage", kind: "MAYOR", segmentId: "town_n" }}
          />
        </div>
      </div>
      <div
        className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-extrabold transition-all ${
          merged
            ? "bg-sage-500 text-white shadow-lg"
            : "bg-white/15 text-oat-100"
        }`}
      >
        <GameIcon name="hv-mayor" className="h-4 w-4" />
        {merged
          ? "Merged! Sage Mayor (2) beats Red Villager (1) → +8 ★!"
          : "Claim separate towns, then connect to contest majority!"}
      </div>
    </div>
  );
}

function VelvetMasqueStage({ sceneId, p }: { sceneId: string; p: number }) {
  // Scene 1: 6-Second Curtain Call (vm-ch-1)
  if (sceneId === "vm-ch-1") {
    const faceUp = p < 0.62;
    const countdown = Math.max(0, Math.ceil((0.62 - p) * 10));
    const masks = ["monarch", "patron", "magistrate", "jester"] as const;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 py-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-amberwarm-100/95 px-3 py-1 text-[11px] font-extrabold text-espresso shadow">
          <GameIcon name="game-masque" className="h-4 w-4" />
          {faceUp
            ? `Curtain Call: Memorize Masks! (${countdown}s)`
            : "Curtain Closed — All Masks Flip Face-Down!"}
        </div>
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          {masks.map((m, i) => (
            <div
              key={m}
              className="flex flex-col items-center gap-1 transition-transform duration-500"
              style={{
                transform: faceUp ? "rotateY(0deg)" : "scale(0.96)",
              }}
            >
              <div className="w-12 sm:w-14">
                <VelvetMasqueCardSvg
                  maskId={faceUp ? m : undefined}
                  highlight={faceUp && i === 0 ? "gold" : "none"}
                  compact
                />
              </div>
              <span className="text-[10px] font-bold text-oat-100">
                {["You (6g)", "Ava (6g)", "Leo (6g)", "Stage"][i]}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Scene 2: Under the Velvet Cloak — Swap or Fake-Swap (vm-ch-2 OR vm-cloak-swap)
  if (sceneId === "vm-ch-2" || sceneId === "vm-cloak-swap") {
    const curtainClosed = p >= 0.22 && p < 0.78;
    const done = p >= 0.78;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 py-3">
        <div className="relative flex items-center justify-center gap-8 sm:gap-12">
          <div
            className="w-14 transition-transform duration-500 sm:w-16"
            style={{
              transform: curtainClosed ? "translateX(22px) rotate(-6deg)" : "translateX(0)",
            }}
          >
            <VelvetMasqueCardSvg juggled={done} highlight={done ? "crimson" : "none"} compact />
          </div>
          <div
            className="w-14 transition-transform duration-500 sm:w-16"
            style={{
              transform: curtainClosed ? "translateX(-22px) rotate(6deg)" : "translateX(0)",
            }}
          >
            <VelvetMasqueCardSvg juggled={done} highlight={done ? "crimson" : "none"} compact />
          </div>

          {curtainClosed && (
            <div className="absolute inset-x-0 -inset-y-1 flex flex-col items-center justify-center rounded-2xl border-2 border-amberwarm-400 bg-[#6B1D2E]/95 px-4 py-2 text-center shadow-xl">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-amberwarm-400">
                Secretly Under the Cloak
              </div>
              <div className="mt-1.5 flex gap-2">
                <span className="rounded-lg bg-amberwarm-400 px-2.5 py-1 text-[11px] font-extrabold text-espresso shadow">
                  Really Swap
                </span>
                <span className="rounded-lg border border-oat-200/50 bg-white/15 px-2.5 py-1 text-[11px] font-extrabold text-oat-50">
                  Fake Swap
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="text-[11px] font-bold text-oat-100">
          {done
            ? "Rivals only see 'JUGGLED' — only YOU know if the masks swapped!"
            : "Pull any rival or Stage card behind the crimson curtain"}
        </div>
      </div>
    );
  }

  // Scene 3: Unchallenged Bluff / 3 Actions (vm-ch-3 OR vm-bluff-slide)
  if (sceneId === "vm-ch-3" || sceneId === "vm-bluff-slide") {
    const claimed = p >= 0.22;
    const paid = p >= 0.65;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <div className="w-14 sm:w-16">
              <VelvetMasqueCardSvg
                maskId={sceneId === "vm-ch-3" && p < 0.25 ? "jester" : undefined}
                highlight={claimed ? "gold" : "none"}
                compact
              />
            </div>
            <span className="text-[10px] font-bold text-oat-200">
              Stays face-down!
            </span>
          </div>

          <div className="flex flex-col gap-1.5 text-left">
            <div className="rounded-xl border border-amberwarm-400 bg-oat-50/95 px-3 py-1.5 text-xs font-extrabold text-espresso shadow">
              &ldquo;I announce <span className="text-amberwarm-600">Monarch (+3 Gold)</span>!&rdquo;
            </div>
            <div className="flex gap-1.5">
              <span
                className={`rounded-lg px-2.5 py-1 text-[10px] font-extrabold ${
                  claimed ? "bg-sage-500 text-white" : "bg-white/15 text-oat-200"
                }`}
              >
                Rivals: Let It Slide ✓
              </span>
            </div>
            {paid && (
              <div className="inline-flex items-center gap-1 rounded-full bg-amberwarm-400 px-3 py-0.5 text-xs font-extrabold text-espresso shadow">
                <GameIcon name="coin-gold" className="h-4 w-4" />
                +3 Gold! Bluff Succeeded Hidden!
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Scene 4: Simultaneous 7s Showdown & Fine Box (vm-ch-4 OR vm-showdown-fines)
  if (sceneId === "vm-ch-4" || sceneId === "vm-showdown-fines") {
    const flipped = p >= 0.45;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2.5 px-4 py-3">
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Announcer (bluffing) */}
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 sm:w-14">
              <VelvetMasqueCardSvg
                maskId={flipped ? "jester" : undefined}
                highlight={flipped ? "crimson" : "gold"}
                compact
              />
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                flipped ? "bg-terracotta-500 text-white" : "bg-amberwarm-400 text-espresso"
              }`}
            >
              {flipped ? "Wrong! -1g Fine" : "Claims Monarch"}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <span className="rounded-lg bg-terracotta-700 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow">
              {flipped ? "SHOWDOWN!" : "CHALLENGE!"}
            </span>
            <span className="text-[10px] font-bold text-amberwarm-100">
              Fine Box +1g
            </span>
          </div>

          {/* Challenger (true holder!) */}
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 sm:w-14">
              <VelvetMasqueCardSvg
                maskId={flipped ? "monarch" : undefined}
                highlight={flipped ? "emerald" : "crimson"}
                compact
              />
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                flipped ? "bg-sage-500 text-white" : "bg-white/20 text-oat-50"
              }`}
            >
              {flipped ? "True Monarch! +3g" : "\"No, I AM!\""}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Scene 5: Comeback Masks & Race to 13 Gold (vm-ch-5 OR vm-comeback-masks)
  const won = p >= 0.6;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="w-12 sm:w-14">
          <VelvetMasqueCardSvg maskId="magistrate" highlight="gold" compact />
        </div>
        <div className="w-12 sm:w-14">
          <VelvetMasqueCardSvg maskId="illusionist" highlight="violet" compact />
        </div>
        <div className="w-12 sm:w-14">
          <VelvetMasqueCardSvg maskId="smuggler" highlight={won ? "emerald" : "none"} compact />
        </div>
      </div>
      <div className="w-full max-w-xs space-y-1">
        <div className="flex items-center justify-between text-[11px] font-extrabold text-oat-100">
          <span>Your Gold</span>
          <span className="text-amberwarm-400">
            {won ? "13 / 13 Gold — VELVET CROWN!" : "9 / 13 Gold (0g never knocks you out!)"}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amberwarm-400 to-yellow-300 transition-all duration-500"
            style={{ width: won ? "100%" : `${Math.round(45 + p * 60)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function SunstoneGuildStage({ sceneId, p }: { sceneId: string; p: number }) {
  const showGems = sceneId === "sg-intro" || sceneId === "sg-bank";
  const showPatron = sceneId === "sg-patrons";
  const showReserve = sceneId === "sg-reserve";

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-3 overflow-hidden bg-gradient-to-br from-[#233E75] via-[#2F528F] to-[#1D325E] p-4 text-white">
      <div className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold text-amberwarm-100">
        <GameIcon name="game-sunstone" className="h-4 w-4" />
        <span>
          {showPatron
            ? "Royal Patrons Auto-Visit (+3★)"
            : showReserve
              ? "Reserve Relics + Wild Sunstone Gold"
              : showGems
                ? "Draft 3 Different or 2 Matching Gems"
                : "Permanent Relic Discounts & ⚡ Catalysts"}
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        {(["sg-ruby", "sg-sapphire", "sg-emerald", "sg-amethyst", "sg-pearl", "sg-gold"] as const).map(
          (icon, idx) => {
            const lift = Math.sin(p * Math.PI * 2 + idx * 0.7) > 0.35;
            return (
              <div
                key={icon}
                className={`flex h-11 w-11 items-center justify-center rounded-2xl border-2 bg-white/95 shadow-md transition-transform duration-300 ${
                  lift ? "-translate-y-1.5 border-amberwarm-400" : "border-white/50"
                }`}
              >
                <GameIcon name={icon} className="h-6 w-6" />
              </div>
            );
          }
        )}
      </div>

      <div className="w-4/5 max-w-xs overflow-hidden rounded-full bg-white/20 p-0.5">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-amberwarm-400 to-emerald-400 transition-all duration-300"
          style={{ width: `${Math.min(100, Math.round(25 + p * 75))}%` }}
        />
      </div>
    </div>
  );
}

function HarborreachStage({ sceneId, p }: { sceneId: string; p: number }) {
  const showBandit = sceneId === "hr-ch-5" || sceneId === "hr-bandit-scrolls";
  const showTrade = sceneId === "hr-ch-3" || sceneId === "hr-trading";
  const showCompass = sceneId === "hr-ch-2" || sceneId === "hr-compass-twist";
  const showBuild = sceneId === "hr-ch-4";
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-3 overflow-hidden bg-gradient-to-br from-[#175B62] via-[#1E7D74] to-[#13464A] p-4 text-white">
      <div className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold text-amberwarm-100">
        <GameIcon name="game-harbor" className="h-4 w-4" />
        <span>
          {showBandit
            ? "Bandit Fox (7) · Ranger Scouts · Island Awards (+2★)"
            : showTrade
              ? "4:1 Bank · 3:1 / 2:1 Coastal Harbors · Player Offers"
              : showCompass
                ? "Roll 2d6 Harvest · Dry-Spell Compass (3 → Wild!)"
                : showBuild
                  ? "Build Roads, Cottages (+1★), Towns (+2★) & Scrolls"
                  : "Founding Snake Draft on the 19-Hex Coastal Island"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {(
          ["hr-timber", "hr-clay", "hr-wool", "hr-grain", "hr-ore", "hr-cottage"] as const
        ).map((icon, idx) => {
          const lift = Math.sin(p * Math.PI * 2 + idx * 0.75) > 0.35;
          return (
            <div
              key={icon}
              className={`flex h-11 w-11 items-center justify-center rounded-2xl border-2 bg-white/95 shadow-md transition-transform duration-300 ${
                lift ? "-translate-y-1.5 border-amberwarm-400" : "border-white/50"
              }`}
            >
              <GameIcon name={icon} className="h-6 w-6" />
            </div>
          );
        })}
      </div>

      <div className="w-4/5 max-w-xs overflow-hidden rounded-full bg-white/20 p-0.5">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-amberwarm-400 to-emerald-400 transition-all duration-300"
          style={{ width: `${Math.min(100, Math.round(25 + p * 75))}%` }}
        />
      </div>
    </div>
  );
}

function DawnspireStage({ sceneId, p }: { sceneId: string; p: number }) {
  const showScience = sceneId === "ds-ch-5" || sceneId === "ds-science-guilds";
  const showMilitary = sceneId === "ds-ch-4";
  const showWonder = sceneId === "ds-ch-3" || sceneId === "ds-wonder-caravan";
  const showTrade = sceneId === "ds-ch-2" || sceneId === "ds-trade-chain";
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-3 overflow-hidden bg-gradient-to-br from-[#6B2648] via-[#8B3A62] to-[#461830] p-4 text-white">
      <div className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold text-amberwarm-100">
        <GameIcon name="game-dawnspire" className="h-4 w-4" />
        <span>
          {showScience
            ? "Science Sets (n² + 7★) · Grand Guilds · 7-Path Score"
            : showMilitary
              ? "End-of-Era Shield Clashes (+1★ / +3★ / +5★)"
              : showWonder
                ? "Raise Sunlit/Starlit Wonder · Sunlit Caravan (+4g)"
                : showTrade
                  ? "Free Chaining · Auto Neighbor Trade (2g / 1g)"
                  : "Zero-Downtime Simultaneous Drafting Across 3 Eras"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {(
          ["ds-wonder", "ds-civic", "ds-commerce", "ds-military", "ds-science", "ds-guild"] as const
        ).map((icon, idx) => {
          const lift = Math.sin(p * Math.PI * 2 + idx * 0.75) > 0.35;
          return (
            <div
              key={icon}
              className={`flex h-11 w-11 items-center justify-center rounded-2xl border-2 bg-white/95 shadow-md transition-transform duration-300 ${
                lift ? "-translate-y-1.5 border-amberwarm-400" : "border-white/50"
              }`}
            >
              <GameIcon name={icon} className="h-6 w-6" />
            </div>
          );
        })}
      </div>

      <div className="w-4/5 max-w-xs overflow-hidden rounded-full bg-white/20 p-0.5">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-amberwarm-400 to-emerald-400 transition-all duration-300"
          style={{ width: `${Math.min(100, Math.round(25 + p * 75))}%` }}
        />
      </div>
    </div>
  );
}

function renderGameStage(slug: SupportedGameSlug, sceneId: string, progress: number) {
  if (slug === "hearthvale") {
    return <HearthvaleStage sceneId={sceneId} p={progress} />;
  }
  if (slug === "velvet-masque") {
    return <VelvetMasqueStage sceneId={sceneId} p={progress} />;
  }
  if (slug === "sunstone-guild") {
    return <SunstoneGuildStage sceneId={sceneId} p={progress} />;
  }
  if (slug === "harborreach") {
    return <HarborreachStage sceneId={sceneId} p={progress} />;
  }
  if (slug === "dawnspire") {
    return <DawnspireStage sceneId={sceneId} p={progress} />;
  }
  return <TreasureTrailsStage sceneId={sceneId} p={progress} />;
}

/* ============================================================================
 *  1. FULL GUIDED VIDEO WALKTHROUGH PLAYER (55s, 5 Chapters, Scrub + Voiceover)
 * ============================================================================ */

interface GameWalkthroughPlayerProps {
  gameSlug: SupportedGameSlug;
  onOpenClipsTab?: () => void;
}

export function GameWalkthroughPlayer({
  gameSlug,
  onOpenClipsTab,
}: GameWalkthroughPlayerProps) {
  const curriculum = useMemo(() => getOnboardingCurriculum(gameSlug), [gameSlug]);
  const duration = curriculum.walkthroughDurationSec;
  const chapters = curriculum.walkthroughChapters;

  const [currentSec, setCurrentSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<0.75 | 1 | 1.25>(1);
  const [showCaptions, setShowCaptions] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  const lastFrameRef = useRef<number | null>(null);
  const lastSpokenChapterRef = useRef<string | null>(null);

  useEffect(() => {
    setSpeechSupported(
      typeof window !== "undefined" && "speechSynthesis" in window
    );
  }, []);

  // Reset timeline when switching games
  useEffect(() => {
    setCurrentSec(0);
    setIsPlaying(false);
    lastSpokenChapterRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, [gameSlug]);

  // Cleanup voiceover on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // 60fps requestAnimationFrame playback loop
  useEffect(() => {
    if (!isPlaying) {
      lastFrameRef.current = null;
      return;
    }

    let rafId = 0;
    const step = (now: number) => {
      if (lastFrameRef.current !== null) {
        const dt = Math.min((now - lastFrameRef.current) / 1000, 0.1);
        setCurrentSec((prev) => {
          const next = prev + dt * speed;
          if (next >= duration) {
            setIsPlaying(false);
            return duration;
          }
          return next;
        });
      }
      lastFrameRef.current = now;
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, speed, duration]);

  const activeChapterIndex = useMemo(() => {
    const idx = chapters.findIndex(
      (ch) => currentSec >= ch.startSec && currentSec < ch.endSec
    );
    return idx === -1 ? chapters.length - 1 : idx;
  }, [chapters, currentSec]);

  const activeChapter: WalkthroughChapter = chapters[activeChapterIndex]!;
  const chapterSpan = Math.max(0.1, activeChapter.endSec - activeChapter.startSec);
  const chapterProgress = Math.min(
    1,
    Math.max(0, (currentSec - activeChapter.startSec) / chapterSpan)
  );

  // Optional Sage Voiceover synchronized to chapter changes
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (!voiceEnabled || !isPlaying) {
      window.speechSynthesis.cancel();
      lastSpokenChapterRef.current = null;
      return;
    }
    if (lastSpokenChapterRef.current !== activeChapter.id) {
      lastSpokenChapterRef.current = activeChapter.id;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(activeChapter.narration);
      utter.rate = speed === 1.25 ? 1.15 : speed === 0.75 ? 0.9 : 1.02;
      window.speechSynthesis.speak(utter);
    }
  }, [voiceEnabled, isPlaying, activeChapter, speed]);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((playing) => {
      if (!playing && currentSec >= duration - 0.05) {
        setCurrentSec(0);
      }
      return !playing;
    });
  }, [currentSec, duration]);

  const handleSeek = useCallback(
    (sec: number, autoPlay = false) => {
      const clamped = Math.max(0, Math.min(duration, sec));
      setCurrentSec(clamped);
      lastSpokenChapterRef.current = null;
      if (autoPlay) setIsPlaying(true);
    },
    [duration]
  );

  const cycleSpeed = () => {
    setSpeed((s) => (s === 1 ? 1.25 : s === 1.25 ? 0.75 : 1));
  };

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-espresso/20 bg-[#271C18] shadow-cozy">
      {/* 16:9 Cinema Stage */}
      <div className="relative flex min-h-[225px] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#3C2A22] via-[#2F211B] to-[#1F1612] sm:min-h-[250px]">
        {/* Subtle tabletop vignette */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 42%, rgba(251, 224, 152, 0.35), transparent 68%)",
          }}
        />

        {/* Top video overlay pills */}
        <div className="relative z-10 flex items-center justify-between gap-2 px-3.5 pt-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-bold text-oat-50 backdrop-blur-sm">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amberwarm-400 text-[10px] font-black text-espresso">
              {activeChapterIndex + 1}
            </span>
            <span>{activeChapter.title}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-sage-500/90 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
              {activeChapter.badge}
            </span>
            {onOpenClipsTab && (
              <button
                type="button"
                onClick={onOpenClipsTab}
                className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold text-oat-50 transition hover:bg-white/25"
              >
                <Film className="h-3 w-3" /> 4 Short Clips
              </button>
            )}
          </div>
        </div>

        {/* Interactive Animated Stage */}
        <div
          onClick={handleTogglePlay}
          className="relative z-10 flex flex-1 cursor-pointer items-center justify-center py-2"
        >
          {renderGameStage(gameSlug, activeChapter.id, chapterProgress)}

          {/* Big Center Play / Replay Overlay when paused */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px] transition hover:bg-black/20">
              <div className="flex items-center gap-2.5 rounded-full border-2 border-amberwarm-400 bg-espresso/95 px-5 py-2.5 text-sm font-extrabold text-oat-50 shadow-xl">
                {currentSec >= duration - 0.05 ? (
                  <>
                    <RotateCcw className="h-5 w-5 text-amberwarm-400" />
                    Replay Walkthrough
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5 fill-amberwarm-400 text-amberwarm-400" />
                    {currentSec === 0
                      ? `Watch ${duration}s Video Walkthrough`
                      : "Resume Walkthrough"}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Synchronized Subtitle Track */}
        {showCaptions && (
          <div className="relative z-10 px-3.5 pb-2.5">
            <div className="rounded-xl bg-black/65 px-3 py-1.5 text-center text-xs font-medium leading-snug text-oat-50 backdrop-blur-sm">
              {activeChapter.caption}
            </div>
          </div>
        )}
      </div>

      {/* Video Player Controls Bar */}
      <div className="space-y-2 border-t border-white/10 bg-[#1F1612] px-3.5 py-2.5">
        {/* Scrubbing Progress Bar with Chapter Ticks */}
        <div
          role="slider"
          aria-label="Walkthrough timeline"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={Math.round(currentSec)}
          tabIndex={0}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            handleSeek(ratio * duration, true);
          }}
          className="group relative h-2.5 w-full cursor-pointer rounded-full bg-white/15"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-amberwarm-400 to-sage-300 transition-[width] duration-75"
            style={{ width: `${(currentSec / duration) * 100}%` }}
          />
          {chapters.slice(1).map((ch) => (
            <span
              key={ch.id}
              title={ch.title}
              className="pointer-events-none absolute top-0 h-full w-0.5 bg-[#1F1612]"
              style={{ left: `${(ch.startSec / duration) * 100}%` }}
            />
          ))}
        </div>

        {/* Control Buttons Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-oat-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTogglePlay}
              className="inline-flex items-center gap-1 rounded-lg bg-amberwarm-400 px-2.5 py-1 font-extrabold text-espresso hover:bg-amber-300"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-3.5 w-3.5" /> Pause
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-espresso" /> Play
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleSeek(0, true)}
              title="Restart walkthrough"
              className="rounded-lg bg-white/10 p-1.5 text-oat-100 hover:bg-white/20"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <span className="font-mono text-[11px] font-bold text-oat-200">
              {formatTime(currentSec)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={cycleSpeed}
              className="rounded-lg bg-white/10 px-2 py-1 text-[11px] font-bold text-oat-100 hover:bg-white/20"
              title="Playback speed"
            >
              {speed}x
            </button>
            <button
              type="button"
              onClick={() => setShowCaptions((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                showCaptions
                  ? "bg-sage-500 text-white"
                  : "bg-white/10 text-oat-200 hover:bg-white/20"
              }`}
              title="Toggle subtitles"
            >
              <Subtitles className="h-3.5 w-3.5" /> CC
            </button>
            {speechSupported && (
              <button
                type="button"
                onClick={() => setVoiceEnabled((v) => !v)}
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                  voiceEnabled
                    ? "bg-amberwarm-400 text-espresso"
                    : "bg-white/10 text-oat-200 hover:bg-white/20"
                }`}
                title="Toggle Sage voiceover narration"
              >
                {voiceEnabled ? (
                  <>
                    <Volume2 className="h-3.5 w-3.5" /> Voice On
                  </>
                ) : (
                  <>
                    <VolumeX className="h-3.5 w-3.5" /> Voice
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Clickable Chapter Jump Strip */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 pt-1">
          {chapters.map((ch, idx) => {
            const isActive = idx === activeChapterIndex;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => handleSeek(ch.startSec + 0.05, true)}
                className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                  isActive
                    ? "bg-amberwarm-400/20 text-amberwarm-400 ring-1 ring-amberwarm-400/60"
                    : "bg-white/5 text-oat-200/80 hover:bg-white/15 hover:text-white"
                }`}
              >
                {idx + 1}. {ch.title}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 *  2. LOOPING SHORT MECHANIC CLIPS WITH EXPLANATIONS (4 Focused Clips / Game)
 * ============================================================================ */

export function GameShortClipsPlayer({
  gameSlug,
}: {
  gameSlug: SupportedGameSlug;
}) {
  const curriculum = useMemo(() => getOnboardingCurriculum(gameSlug), [gameSlug]);
  const clips = curriculum.shortClips;

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [clipSec, setClipSec] = useState(0);
  const [playing, setPlaying] = useState(true);
  const lastFrameRef = useRef<number | null>(null);

  useEffect(() => {
    setSelectedIndex(0);
    setClipSec(0);
    setPlaying(true);
  }, [gameSlug]);

  const activeClip = clips[selectedIndex] ?? clips[0]!;

  // Smooth looping animation for active short clip
  useEffect(() => {
    if (!playing) {
      lastFrameRef.current = null;
      return;
    }
    let rafId = 0;
    const step = (now: number) => {
      if (lastFrameRef.current !== null) {
        const dt = Math.min((now - lastFrameRef.current) / 1000, 0.1);
        setClipSec((prev) => (prev + dt) % activeClip.durationSec);
      }
      lastFrameRef.current = now;
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [playing, activeClip.durationSec]);

  const selectClip = (idx: number) => {
    setSelectedIndex(idx);
    setClipSec(0);
    setPlaying(true);
  };

  const progress = Math.min(1, Math.max(0, clipSec / activeClip.durationSec));

  return (
    <div className="space-y-4">
      {/* Spotlight Looping Clip + Structured Explanation */}
      <div className="overflow-hidden rounded-2xl border-2 border-oat-300 bg-white shadow-sm">
        <div className="grid md:grid-cols-12">
          {/* Left: Looping Visual Clip Stage */}
          <div className="flex flex-col justify-between bg-gradient-to-br from-[#3C2A22] via-[#2F211B] to-[#1F1612] md:col-span-7">
            <div className="flex items-center justify-between px-3.5 pt-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-amberwarm-400 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-espresso">
                <Film className="h-3 w-3" />
                Clip {selectedIndex + 1}/{clips.length} · {activeClip.tag}
              </span>
              <span className="rounded-full bg-black/45 px-2 py-0.5 font-mono text-[10px] font-bold text-oat-100">
                {formatTime(clipSec)} / {formatTime(activeClip.durationSec)} · Loop
              </span>
            </div>

            <div className="flex min-h-[190px] items-center justify-center py-2">
              {renderGameStage(gameSlug, activeClip.id, progress)}
            </div>

            {/* Clip Mini Control Bar */}
            <div className="space-y-1.5 bg-[#1F1612] px-3.5 py-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-amberwarm-400 transition-[width] duration-75"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-bold text-oat-100">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPlaying((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2 py-0.5 hover:bg-white/25"
                  >
                    {playing ? (
                      <>
                        <Pause className="h-3 w-3" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3" /> Play
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setClipSec(0);
                      setPlaying(true);
                    }}
                    className="rounded-lg bg-white/10 p-1 hover:bg-white/20"
                    title="Replay clip"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => selectClip((selectedIndex + 1) % clips.length)}
                  className="inline-flex items-center gap-1 rounded-lg bg-sage-500 px-2.5 py-0.5 text-white hover:bg-sage-700"
                >
                  Next Clip <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Right: Clear Explanation & Pro Tip */}
          <div className="flex flex-col justify-between gap-3 p-4 md:col-span-5">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-oat-300 bg-oat-100">
                  <GameIcon name={activeClip.icon} className="h-5 w-5" />
                </div>
                <h3 className="font-display text-base font-bold leading-snug text-espresso">
                  {activeClip.title}
                </h3>
              </div>

              <p className="mt-2.5 text-xs leading-relaxed text-espresso-soft">
                {activeClip.explanation}
              </p>
            </div>

            <div className="rounded-xl border border-amberwarm-400/50 bg-amberwarm-100/70 p-3">
              <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-amberwarm-600">
                <Lightbulb className="h-3.5 w-3.5" /> Pro Tip
              </div>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-espresso">
                {activeClip.proTip}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Clip Selector Cards */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        {clips.map((clip, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <button
              key={clip.id}
              type="button"
              onClick={() => selectClip(idx)}
              className={`flex items-start gap-3 rounded-2xl border-2 p-3 text-left transition ${
                isSelected
                  ? "border-sage-500 bg-sage-100/65 shadow-sm"
                  : "border-oat-300 bg-white hover:border-sage-300 hover:bg-oat-50"
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                  isSelected
                    ? "border-sage-300 bg-sage-100"
                    : "border-oat-300 bg-oat-100"
                }`}
              >
                <GameIcon name={clip.icon} className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-oat-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-sage-700">
                    {clip.tag}
                  </span>
                  <span className="font-mono text-[10px] font-bold text-espresso-muted">
                    {formatTime(clip.durationSec)}
                  </span>
                </div>
                <div className="mt-1 font-display text-sm font-bold leading-snug text-espresso">
                  {idx + 1}. {clip.title}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
