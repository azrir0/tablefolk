"use client";

import React, { useState } from "react";
import {
  BookOpen,
  Bot,
  Check,
  Compass,
  Crown,
  LogOut,
  Play,
  Plus,
  Share2,
  Trash2,
} from "lucide-react";
import type { SyncedTableSnapshot } from "@tablefolk/cafe-engine";
import { GameIcon } from "./GameIcons";

interface TableLobbyDrawerProps {
  table: SyncedTableSnapshot;
  myUserId: string;
  myReady: boolean;
  onToggleReady: (ready: boolean) => void;
  onStandUp: () => void;
  onAddBot: () => void;
  onRemoveBot: () => void;
  onSelectGame?: (gameSlug: string) => void;
  onStartGame: (opts: {
    rounds: 1 | 3;
    turnSeconds: 30 | 45 | 60 | 90;
    mysteryRoles: boolean;
    deckSize: 36 | 54;
    targetCoins: 10 | 13;
    targetPrestige: 12 | 15;
    targetVP: 8 | 10;
    wonderSide: "sunlit" | "starlit";
  }) => void;
  onResumeGame?: (gameRoomId: string) => void;
  onShareInvite?: () => void;
  onOpenTutorial: () => void;
  onOpenQuickTour?: () => void;
}

export function TableLobbyDrawer({
  table,
  myUserId,
  myReady,
  onToggleReady,
  onStandUp,
  onAddBot,
  onRemoveBot,
  onSelectGame,
  onStartGame,
  onResumeGame,
  onShareInvite,
  onOpenTutorial,
  onOpenQuickTour,
}: TableLobbyDrawerProps) {
  const [rounds, setRounds] = useState<1 | 3>(1);
  const [deckSize, setDeckSize] = useState<36 | 54>(36);
  const [targetCoins, setTargetCoins] = useState<10 | 13>(13);
  const [targetPrestige, setTargetPrestige] = useState<12 | 15>(15);
  const [targetVP, setTargetVP] = useState<8 | 10>(10);
  const [wonderSide, setWonderSide] = useState<"sunlit" | "starlit">("sunlit");
  const [turnSeconds, setTurnSeconds] = useState<30 | 45 | 60 | 90>(45);
  const [mysteryRoles, setMysteryRoles] = useState(false);

  const isHost = table.hostUserId === myUserId;
  const isInProgress = table.status === "IN_PROGRESS" && Boolean(table.activeGameRoomId);
  const occupied = table.seats.filter((s) => s.status !== "AVAILABLE");
  const botCount = occupied.filter((s) => s.isBot).length;
  const humanCount = occupied.filter((s) => !s.isBot).length;

  const isDawnspire = table.selectedGameSlug === "dawnspire";
  const isHarborreach = !isDawnspire && table.selectedGameSlug === "harborreach";
  const isSunstoneGuild =
    !isDawnspire && !isHarborreach && table.selectedGameSlug === "sunstone-guild";
  const isHearthvale =
    !isDawnspire &&
    !isHarborreach &&
    !isSunstoneGuild &&
    (table.selectedGameSlug === "hearthvale" || table.capacity < 3);
  const isVelvetMasque =
    !isDawnspire &&
    !isHarborreach &&
    !isSunstoneGuild &&
    !isHearthvale &&
    table.selectedGameSlug === "velvet-masque";
  const gameTitle = isDawnspire
    ? "Dawnspire"
    : isHarborreach
      ? "Harborreach"
      : isSunstoneGuild
        ? "Sunstone Guild"
        : isHearthvale
          ? "Hearthvale"
          : isVelvetMasque
            ? "Velvet Masque"
            : "Treasure Trails";
  const minPlayers =
    isHearthvale || isSunstoneGuild || isHarborreach || isDawnspire ? 2 : 3;
  const maxPlayers = Math.min(
    table.capacity,
    isSunstoneGuild || isHarborreach
      ? 4
      : isHearthvale
        ? 5
        : isDawnspire
          ? 7
          : 8
  );
  const hasEnoughPlayers = occupied.length >= minPlayers && occupied.length <= maxPlayers;
  const tooManyPlayers = occupied.length > maxPlayers;
  const nonHostUnreadyCount =
    occupied.filter((s) => !s.isBot && !s.isReady).length - (isHost ? 1 : 0);

  return (
    <div className="pointer-events-auto max-h-[calc(100dvh-6rem)] w-full max-w-md overflow-y-auto rounded-3xl border-2 border-oat-300 bg-oat-50/95 p-4 shadow-cozy backdrop-blur short:max-h-full short:max-w-lg short:rounded-2xl short:p-2.5">
      {/* Row 1: Table Identity & Quick Actions (Clean Single-Line Utility Bar) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate rounded-full bg-sage-100 px-2.5 py-0.5 text-[11px] font-bold leading-tight text-sage-700">
            {table.name}
          </span>
          <span className="shrink-0 whitespace-nowrap text-[11px] font-bold text-espresso-muted">
            {occupied.length}/{table.capacity} Seated
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {onShareInvite && (
            <button
              type="button"
              onClick={onShareInvite}
              title="Share invite link with friends"
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl bg-amberwarm-100 px-2.5 py-1.5 text-[11px] font-bold leading-none text-espresso transition hover:bg-amberwarm-400 short:py-1"
            >
              <Share2 className="h-3.5 w-3.5 shrink-0" /> Invite
            </button>
          )}
          <button
            type="button"
            onClick={onStandUp}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl bg-oat-200 px-2.5 py-1.5 text-[11px] font-bold leading-none text-espresso transition hover:bg-terracotta-100 hover:text-terracotta-700 short:py-1"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" /> Stand Up
          </button>
        </div>
      </div>

      {/* Row 2: Hero Game Title + Crisp Single-Line Player/Genre Pill */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 short:mt-1.5">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold leading-tight text-espresso short:text-base">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border shadow-sm short:h-6 short:w-6 ${
              isDawnspire
                ? "border-[#8B3A62]/60 bg-[#8B3A62]/15"
                : isHarborreach
                  ? "border-[#1E7D74]/60 bg-[#1E7D74]/15"
                  : isSunstoneGuild
                    ? "border-amberwarm-400/70 bg-[#2B5096]/15"
                    : isHearthvale
                      ? "border-amberwarm-400/60 bg-amberwarm-100"
                      : isVelvetMasque
                        ? "border-terracotta-500/40 bg-terracotta-100"
                        : "border-sage-300 bg-sage-100"
            }`}
          >
            <GameIcon
              name={
                isDawnspire
                  ? "game-dawnspire"
                  : isHarborreach
                    ? "game-harbor"
                    : isSunstoneGuild
                      ? "game-sunstone"
                      : isHearthvale
                        ? "game-hearthvale"
                        : isVelvetMasque
                          ? "game-masque"
                          : "game-trails"
              }
              className="h-4 w-4"
            />
          </span>
          <span className="whitespace-nowrap">{gameTitle}</span>
        </h3>

        <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-oat-300/80 bg-oat-100 px-2.5 py-1 text-[11px] font-bold leading-none text-espresso-soft">
          <span>
            {isDawnspire
              ? "2–7p"
              : isHarborreach || isSunstoneGuild
                ? "2–4p"
                : isHearthvale
                  ? "2–5p"
                  : "3–8p"}
          </span>
          <span className="text-oat-300" aria-hidden="true">
            ·
          </span>
          <span>
            {isDawnspire
              ? "Card Drafting"
              : isHarborreach
                ? "Island Strategy"
                : isSunstoneGuild
                  ? "Gem Engine"
                  : isHearthvale
                    ? "Tile Strategy"
                    : isVelvetMasque
                      ? "Bluff & Memory"
                      : "Hidden Role"}
          </span>
        </span>
      </div>

      {/* Seat Pills */}
      <div className="mt-3 flex flex-wrap gap-1.5 short:mt-1.5 short:gap-1">
        {table.seats.map((s) => {
          const isSeatHost =
            s.status !== "AVAILABLE" &&
            !s.isBot &&
            Boolean(table.hostUserId) &&
            s.occupantUserId === table.hostUserId;

          return (
            <div
              key={s.seatIndex}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-bold short:px-2 short:py-0.5 short:text-[11px] ${
                s.status === "AVAILABLE"
                  ? "border-dashed border-oat-300 text-espresso-muted"
                  : s.isBot
                    ? "border-amberwarm-400/50 bg-amberwarm-100 text-espresso"
                    : isSeatHost
                      ? "border-amberwarm-400 bg-amberwarm-100/90 text-espresso shadow-sm"
                      : "border-sage-300 bg-sage-100 text-espresso"
              }`}
            >
              {s.status === "AVAILABLE" ? (
                <span>Chair {s.seatIndex + 1} (Open)</span>
              ) : (
                <>
                  {s.isBot && <Bot className="h-3.5 w-3.5 text-amberwarm-600" />}
                  {isSeatHost && <Crown className="h-3.5 w-3.5 text-amberwarm-600" />}
                  <span>
                    {s.occupantName}
                    {isSeatHost && (
                      <span className="ml-1 text-[10px] font-extrabold text-amberwarm-600">
                        (Host)
                      </span>
                    )}
                  </span>
                  {s.isReady && !isSeatHost && (
                    <Check className="h-3.5 w-3.5 text-sage-700" />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {isInProgress ? (
        <div className="mt-3 flex items-center gap-2 short:mt-2">
          <button
            type="button"
            onClick={() => onResumeGame?.(table.activeGameRoomId)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-amberwarm-400 py-2.5 font-display text-sm font-bold text-espresso shadow-sm transition hover:bg-amberwarm-600 hover:text-white short:py-1.5"
          >
            <Play className="h-4 w-4" /> Resume {gameTitle}
          </button>
          <button
            type="button"
            onClick={onStandUp}
            className="rounded-2xl bg-terracotta-100 px-3.5 py-2.5 text-xs font-bold text-terracotta-700 hover:bg-terracotta-500 hover:text-white short:py-1.5"
          >
            {humanCount <= 1 ? "End & Stand Up" : "Leave Table"}
          </button>
        </div>
      ) : (
        <>
          {/* Host Match Settings & Practice Bot Controls */}
          {isHost && (
            <div className="mt-3 space-y-2.5 rounded-2xl bg-oat-100 p-3 short:mt-1.5 short:space-y-1.5 short:p-2">
              <div className="flex items-center justify-between text-xs font-bold text-espresso">
                <span className="inline-flex items-center gap-1 text-amberwarm-600">
                  <Crown className="h-3.5 w-3.5" /> Table Host Controls
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onAddBot}
                    disabled={occupied.length >= maxPlayers}
                    className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-espresso shadow-sm hover:bg-sage-100 disabled:opacity-40 short:py-0.5"
                  >
                    <Plus className="h-3 w-3" /> Add Practice Bot
                  </button>
                  {botCount > 0 && (
                    <button
                      type="button"
                      onClick={onRemoveBot}
                      className="rounded-lg bg-white p-1 text-terracotta-700 shadow-sm hover:bg-terracotta-100"
                      title="Remove Bot"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Game Switcher (2-seat tables: 4 head-to-head games; 3+ seats: all 6!) */}
              {onSelectGame &&
                (table.capacity >= 3 ? (
                  <div className="grid grid-cols-3 gap-1 rounded-xl bg-white p-1 text-[10px] font-bold shadow-sm sm:text-[11px] short:p-0.5">
                    <button
                      type="button"
                      onClick={() => onSelectGame("treasure-trails")}
                      className={`inline-flex items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 transition short:py-1 ${
                        !isHearthvale &&
                        !isVelvetMasque &&
                        !isSunstoneGuild &&
                        !isHarborreach &&
                        !isDawnspire
                          ? "bg-sage-500 text-white shadow-sm"
                          : "text-espresso-soft hover:bg-oat-100"
                      }`}
                    >
                      <GameIcon name="game-trails" className="h-3.5 w-3.5 shrink-0" /> Trails
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectGame("hearthvale")}
                      className={`inline-flex items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 transition short:py-1 ${
                        isHearthvale
                          ? "bg-amberwarm-600 text-white shadow-sm"
                          : "text-espresso-soft hover:bg-oat-100"
                      }`}
                    >
                      <GameIcon name="game-hearthvale" className="h-3.5 w-3.5 shrink-0" /> Hearthvale
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectGame("velvet-masque")}
                      className={`inline-flex items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 transition short:py-1 ${
                        isVelvetMasque
                          ? "bg-terracotta-500 text-white shadow-sm"
                          : "text-espresso-soft hover:bg-oat-100"
                      }`}
                    >
                      <GameIcon name="game-masque" className="h-3.5 w-3.5 shrink-0" /> Masque
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectGame("sunstone-guild")}
                      className={`inline-flex items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 transition short:py-1 ${
                        isSunstoneGuild
                          ? "bg-[#2B5096] text-white shadow-sm"
                          : "text-espresso-soft hover:bg-oat-100"
                      }`}
                    >
                      <GameIcon name="game-sunstone" className="h-3.5 w-3.5 shrink-0" /> Sunstone
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectGame("harborreach")}
                      className={`inline-flex items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 transition short:py-1 ${
                        isHarborreach
                          ? "bg-[#1E7D74] text-white shadow-sm"
                          : "text-espresso-soft hover:bg-oat-100"
                      }`}
                    >
                      <GameIcon name="game-harbor" className="h-3.5 w-3.5 shrink-0" /> Harbor
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectGame("dawnspire")}
                      className={`inline-flex items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 transition short:py-1 ${
                        isDawnspire
                          ? "bg-[#8B3A62] text-white shadow-sm"
                          : "text-espresso-soft hover:bg-oat-100"
                      }`}
                    >
                      <GameIcon name="game-dawnspire" className="h-3.5 w-3.5 shrink-0" /> Dawnspire
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-white p-1 text-[10.5px] font-bold shadow-sm short:p-0.5">
                    <button
                      type="button"
                      onClick={() => onSelectGame("hearthvale")}
                      className={`inline-flex items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 transition short:py-1 ${
                        isHearthvale
                          ? "bg-amberwarm-600 text-white shadow-sm"
                          : "text-espresso-soft hover:bg-oat-100"
                      }`}
                    >
                      <GameIcon name="game-hearthvale" className="h-3.5 w-3.5 shrink-0" /> Hearthvale
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectGame("sunstone-guild")}
                      className={`inline-flex items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 transition short:py-1 ${
                        isSunstoneGuild
                          ? "bg-[#2B5096] text-white shadow-sm"
                          : "text-espresso-soft hover:bg-oat-100"
                      }`}
                    >
                      <GameIcon name="game-sunstone" className="h-3.5 w-3.5 shrink-0" /> Sunstone
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectGame("harborreach")}
                      className={`inline-flex items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 transition short:py-1 ${
                        isHarborreach
                          ? "bg-[#1E7D74] text-white shadow-sm"
                          : "text-espresso-soft hover:bg-oat-100"
                      }`}
                    >
                      <GameIcon name="game-harbor" className="h-3.5 w-3.5 shrink-0" /> Harborreach
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectGame("dawnspire")}
                      className={`inline-flex items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 transition short:py-1 ${
                        isDawnspire
                          ? "bg-[#8B3A62] text-white shadow-sm"
                          : "text-espresso-soft hover:bg-oat-100"
                      }`}
                    >
                      <GameIcon name="game-dawnspire" className="h-3.5 w-3.5 shrink-0" /> Dawnspire
                    </button>
                  </div>
                ))}

              {table.capacity < 3 && (
                <div className="flex items-center gap-2 rounded-lg bg-amberwarm-100/80 px-2.5 py-1.5 text-[11px] font-semibold text-espresso-soft">
                  <GameIcon name="window-nook" className="h-4 w-4 shrink-0" />
                  <span>
                    Cozy 2-Seat Nook — great for head-to-head <strong>Hearthvale</strong>,{" "}
                    <strong>Sunstone</strong>, <strong>Harborreach</strong>, or{" "}
                    <strong>Dawnspire</strong>!
                  </span>
                </div>
              )}

              {/* Game-Specific Settings */}
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                {isDawnspire ? (
                  <div className="flex rounded-lg bg-white p-0.5 shadow-sm">
                    {(
                      [
                        ["sunlit", "☀ Sunlit"],
                        ["starlit", "✦ Starlit"],
                      ] as const
                    ).map(([side, label]) => (
                      <button
                        key={side}
                        type="button"
                        onClick={() => setWonderSide(side)}
                        className={`rounded-md px-2.5 py-1 ${
                          wonderSide === side ? "bg-[#8B3A62] text-white" : "text-espresso-soft"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : isHarborreach ? (
                  <div className="flex rounded-lg bg-white p-0.5 shadow-sm">
                    {(
                      [
                        [8, "Quick (8★)"],
                        [10, "Classic (10★)"],
                      ] as const
                    ).map(([goal, label]) => (
                      <button
                        key={goal}
                        type="button"
                        onClick={() => setTargetVP(goal)}
                        className={`rounded-md px-2.5 py-1 ${
                          targetVP === goal ? "bg-[#1E7D74] text-white" : "text-espresso-soft"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : isSunstoneGuild ? (
                  <div className="flex rounded-lg bg-white p-0.5 shadow-sm">
                    {(
                      [
                        [12, "Quick (12★)"],
                        [15, "Classic (15★)"],
                      ] as const
                    ).map(([goal, label]) => (
                      <button
                        key={goal}
                        type="button"
                        onClick={() => setTargetPrestige(goal)}
                        className={`rounded-md px-2.5 py-1 ${
                          targetPrestige === goal
                            ? "bg-[#2B5096] text-white"
                            : "text-espresso-soft"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : isHearthvale ? (
                  <div className="flex rounded-lg bg-white p-0.5 shadow-sm">
                    {(
                      [
                        [36, "Cozy (36 tiles)"],
                        [54, "Grand (54 tiles)"],
                      ] as const
                    ).map(([sz, label]) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setDeckSize(sz)}
                        className={`rounded-md px-2.5 py-1 ${
                          deckSize === sz
                            ? "bg-amberwarm-600 text-white"
                            : "text-espresso-soft"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : isVelvetMasque ? (
                  <div className="flex rounded-lg bg-white p-0.5 shadow-sm">
                    {(
                      [
                        [10, "Blitz (10g)"],
                        [13, "Classic (13g)"],
                      ] as const
                    ).map(([goal, label]) => (
                      <button
                        key={goal}
                        type="button"
                        onClick={() => setTargetCoins(goal)}
                        className={`rounded-md px-2.5 py-1 ${
                          targetCoins === goal
                            ? "bg-terracotta-500 text-white"
                            : "text-espresso-soft"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex rounded-lg bg-white p-0.5 shadow-sm">
                    {([1, 3] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRounds(r)}
                        className={`rounded-md px-2.5 py-1 ${
                          rounds === r ? "bg-sage-500 text-white" : "text-espresso-soft"
                        }`}
                      >
                        {r === 1 ? "Quick (1 Rd)" : "Full (3 Rds)"}
                      </button>
                    ))}
                  </div>
                )}

                <select
                  value={turnSeconds}
                  onChange={(e) =>
                    setTurnSeconds(Number(e.target.value) as 30 | 45 | 60 | 90)
                  }
                  className="rounded-lg bg-white px-2 py-1 text-espresso shadow-sm outline-none"
                >
                  <option value={30}>30s / turn</option>
                  <option value={45}>45s / turn</option>
                  <option value={60}>60s / turn</option>
                  <option value={90}>90s / turn</option>
                </select>

                {!isHearthvale &&
                  !isVelvetMasque &&
                  !isSunstoneGuild &&
                  !isHarborreach &&
                  !isDawnspire &&
                  occupied.length >= 5 && (
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-white px-2 py-1 shadow-sm">
                      <input
                        type="checkbox"
                        checked={mysteryRoles}
                        onChange={(e) => setMysteryRoles(e.target.checked)}
                      />
                      Mystery Roles
                    </label>
                  )}
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="mt-3 flex items-center gap-2 short:mt-2">
            {isHost ? (
              <button
                type="button"
                disabled={!hasEnoughPlayers}
                onClick={() =>
                  onStartGame({
                    rounds,
                    turnSeconds,
                    mysteryRoles,
                    deckSize,
                    targetCoins,
                    targetPrestige,
                    targetVP,
                    wonderSide,
                  })
                }
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-2.5 font-display text-sm font-bold text-white shadow-sm transition disabled:bg-oat-300 disabled:text-espresso-muted short:py-1.5 short:text-xs ${
                  isDawnspire
                    ? "bg-[#8B3A62] hover:brightness-110"
                    : isHarborreach
                      ? "bg-[#1E7D74] hover:brightness-110"
                      : isSunstoneGuild
                        ? "bg-[#2B5096] hover:brightness-110"
                        : isHearthvale
                          ? "bg-amberwarm-600 hover:brightness-95"
                          : isVelvetMasque
                            ? "bg-terracotta-500 hover:bg-terracotta-700"
                            : "bg-sage-500 hover:bg-sage-700"
                }`}
              >
                <Play className="h-4 w-4" />
                {hasEnoughPlayers
                  ? `Start ${gameTitle}!`
                  : tooManyPlayers
                    ? `Max ${maxPlayers} Players for ${gameTitle}`
                    : `Need ${minPlayers - occupied.length} More Player${
                        minPlayers - occupied.length > 1 ? "s" : ""
                      }`}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onToggleReady(!myReady)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-2.5 font-display text-sm font-bold shadow-sm transition short:py-1.5 short:text-xs ${
                  myReady
                    ? "bg-amberwarm-400 text-espresso"
                    : "bg-sage-500 text-white hover:bg-sage-700"
                }`}
              >
                <Check className="h-4 w-4" />
                {myReady ? "Ready! (Click to Unready)" : "I'm Ready!"}
              </button>
            )}
            {onOpenQuickTour && (
              <button
                type="button"
                onClick={onOpenQuickTour}
                title="Take a 6-step interactive Quick Tour before starting"
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-2xl border border-sage-300 bg-sage-100 px-3 py-2.5 text-xs font-extrabold text-sage-700 shadow-sm transition hover:bg-sage-300/60 short:px-2.5 short:py-1.5"
              >
                <Compass className="h-3.5 w-3.5" /> Tour
              </button>
            )}
            <button
              type="button"
              onClick={onOpenTutorial}
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-2xl border border-oat-300 bg-oat-50 px-3 py-2.5 text-xs font-bold text-espresso shadow-sm transition hover:bg-white short:px-2.5 short:py-1.5"
            >
              <BookOpen className="h-3.5 w-3.5 text-sage-700" /> Rules
            </button>
          </div>
          {isHost && hasEnoughPlayers && nonHostUnreadyCount > 0 && (
            <p className="mt-1.5 text-center text-[11px] font-semibold text-espresso-muted">
              Waiting for {nonHostUnreadyCount} seated friend
              {nonHostUnreadyCount > 1 ? "s" : ""} to click Ready...
            </p>
          )}
          {!isHost && table.hostUserId && (
            <p className="mt-1.5 text-center text-[11px] font-semibold text-espresso-muted">
              {myReady
                ? `Waiting for ${
                    table.seats.find((s) => s.occupantUserId === table.hostUserId)
                      ?.occupantName ?? "the Host"
                  } (Host) to start...`
                : `Click Ready when set — ${
                    table.seats.find((s) => s.occupantUserId === table.hostUserId)
                      ?.occupantName ?? "the Host"
                  } (Host) starts the match!`}
            </p>
          )}
        </>
      )}
    </div>
  );
}
