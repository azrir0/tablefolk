"use client";

import React, { useState } from "react";
import { Bot, Check, Crown, LogOut, Play, Plus, Share2, Trash2 } from "lucide-react";
import type { SyncedTableSnapshot } from "@tablefolk/cafe-engine";

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
  }) => void;
  onResumeGame?: (gameRoomId: string) => void;
  onShareInvite?: () => void;
  onOpenTutorial: () => void;
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
}: TableLobbyDrawerProps) {
  const [rounds, setRounds] = useState<1 | 3>(1);
  const [deckSize, setDeckSize] = useState<36 | 54>(36);
  const [turnSeconds, setTurnSeconds] = useState<30 | 45 | 60 | 90>(45);
  const [mysteryRoles, setMysteryRoles] = useState(false);

  const isHost = table.hostUserId === myUserId;
  const isInProgress = table.status === "IN_PROGRESS" && Boolean(table.activeGameRoomId);
  const occupied = table.seats.filter((s) => s.status !== "AVAILABLE");
  const botCount = occupied.filter((s) => s.isBot).length;
  const humanCount = occupied.filter((s) => !s.isBot).length;

  const isHearthvale = table.selectedGameSlug === "hearthvale" || table.capacity < 3;
  const gameTitle = isHearthvale ? "Hearthvale" : "Treasure Trails";
  const minPlayers = isHearthvale ? 2 : 3;
  const maxPlayers = Math.min(table.capacity, isHearthvale ? 5 : 8);
  const hasEnoughPlayers = occupied.length >= minPlayers && occupied.length <= maxPlayers;
  const tooManyPlayers = occupied.length > maxPlayers;
  const nonHostUnreadyCount =
    occupied.filter((s) => !s.isBot && !s.isReady).length - (isHost ? 1 : 0);

  return (
    <div className="pointer-events-auto w-full max-w-md rounded-3xl border-2 border-oat-300 bg-oat-50/95 p-4 shadow-cozy backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-sage-100 px-2.5 py-0.5 text-[11px] font-bold text-sage-700">
              {table.name}
            </span>
            <span className="text-xs font-bold text-espresso-muted">
              {occupied.length}/{table.capacity} Seated
            </span>
          </div>
          <h3 className="mt-1 flex items-center gap-2 font-display text-lg font-bold text-espresso">
            <span>{isHearthvale ? "🌾 Hearthvale" : "🗺️ Treasure Trails"}</span>
            <span className="rounded-full bg-oat-200 px-2 py-0.5 text-[10px] font-bold text-espresso-soft">
              {isHearthvale ? "2–5p Tile Strategy" : "3–8p Hidden Role"}
            </span>
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          {onShareInvite && (
            <button
              type="button"
              onClick={onShareInvite}
              title="Share invite link with friends"
              className="inline-flex items-center gap-1 rounded-xl bg-amberwarm-100 px-2.5 py-1.5 text-xs font-bold text-espresso hover:bg-amberwarm-400"
            >
              <Share2 className="h-3.5 w-3.5" /> Invite
            </button>
          )}
          <button
            type="button"
            onClick={onStandUp}
            className="inline-flex items-center gap-1 rounded-xl bg-oat-200 px-3 py-1.5 text-xs font-bold text-espresso hover:bg-terracotta-100 hover:text-terracotta-700"
          >
            <LogOut className="h-3.5 w-3.5" /> Stand Up
          </button>
        </div>
      </div>

      {/* Seat Pills */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {table.seats.map((s) => {
          const isSeatHost =
            s.status !== "AVAILABLE" &&
            !s.isBot &&
            Boolean(table.hostUserId) &&
            s.occupantUserId === table.hostUserId;

          return (
            <div
              key={s.seatIndex}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-bold ${
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
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onResumeGame?.(table.activeGameRoomId)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-amberwarm-400 py-2.5 font-display text-sm font-bold text-espresso shadow-sm transition hover:bg-amberwarm-600 hover:text-white"
          >
            <Play className="h-4 w-4" /> Resume {gameTitle}
          </button>
          <button
            type="button"
            onClick={onStandUp}
            className="rounded-2xl bg-terracotta-100 px-3.5 py-2.5 text-xs font-bold text-terracotta-700 hover:bg-terracotta-500 hover:text-white"
          >
            {humanCount <= 1 ? "End & Stand Up" : "Leave Table"}
          </button>
        </div>
      ) : (
        <>
          {/* Host Match Settings & Practice Bot Controls */}
          {isHost && (
            <div className="mt-3 space-y-2.5 rounded-2xl bg-oat-100 p-3">
              <div className="flex items-center justify-between text-xs font-bold text-espresso">
                <span className="inline-flex items-center gap-1 text-amberwarm-600">
                  <Crown className="h-3.5 w-3.5" /> Table Host Controls
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onAddBot}
                    disabled={occupied.length >= maxPlayers}
                    className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-espresso shadow-sm hover:bg-sage-100 disabled:opacity-40"
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

              {/* Game Switcher (for 3+ seat tables) */}
              {table.capacity >= 3 && onSelectGame && (
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-white p-1 text-[11px] font-bold shadow-sm">
                  <button
                    type="button"
                    onClick={() => onSelectGame("treasure-trails")}
                    className={`rounded-lg px-2 py-1.5 transition ${
                      !isHearthvale
                        ? "bg-sage-500 text-white shadow-sm"
                        : "text-espresso-soft hover:bg-oat-100"
                    }`}
                  >
                    🗺️ Treasure Trails (3–8p)
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectGame("hearthvale")}
                    className={`rounded-lg px-2 py-1.5 transition ${
                      isHearthvale
                        ? "bg-amberwarm-600 text-white shadow-sm"
                        : "text-espresso-soft hover:bg-oat-100"
                    }`}
                  >
                    🌾 Hearthvale (2–5p)
                  </button>
                </div>
              )}

              {table.capacity < 3 && (
                <div className="rounded-lg bg-amberwarm-100/80 px-2.5 py-1.5 text-[11px] font-semibold text-espresso-soft">
                  🪟 Cozy 2-Seat Nook — perfect for head-to-head <strong>Hearthvale</strong>! Add a Bot to practice solo.
                </div>
              )}

              {/* Game-Specific Settings */}
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                {isHearthvale ? (
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

                {!isHearthvale && occupied.length >= 5 && (
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
          <div className="mt-3 flex items-center gap-2">
            {isHost ? (
              <button
                type="button"
                disabled={!hasEnoughPlayers}
                onClick={() =>
                  onStartGame({ rounds, turnSeconds, mysteryRoles, deckSize })
                }
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-2.5 font-display text-sm font-bold text-white shadow-sm transition disabled:bg-oat-300 disabled:text-espresso-muted ${
                  isHearthvale
                    ? "bg-amberwarm-600 hover:brightness-95"
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
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-2.5 font-display text-sm font-bold shadow-sm transition ${
                  myReady
                    ? "bg-amberwarm-400 text-espresso"
                    : "bg-sage-500 text-white hover:bg-sage-700"
                }`}
              >
                <Check className="h-4 w-4" />
                {myReady ? "Ready! (Click to Unready)" : "I'm Ready!"}
              </button>
            )}
            <button
              type="button"
              onClick={onOpenTutorial}
              className="rounded-2xl border border-oat-300 bg-oat-100 px-3.5 py-2.5 text-xs font-bold text-espresso hover:bg-oat-200"
            >
              Rules
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
