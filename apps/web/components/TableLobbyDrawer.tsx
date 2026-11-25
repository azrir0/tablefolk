"use client";

import React, { useState } from "react";
import { Bot, Check, Crown, LogOut, Play, Plus, Trash2 } from "lucide-react";
import type { SyncedTableSnapshot } from "@tablefolk/cafe-engine";

interface TableLobbyDrawerProps {
  table: SyncedTableSnapshot;
  myUserId: string;
  myReady: boolean;
  onToggleReady: (ready: boolean) => void;
  onStandUp: () => void;
  onAddBot: () => void;
  onRemoveBot: () => void;
  onStartGame: (opts: {
    rounds: 1 | 3;
    turnSeconds: 30 | 45 | 60 | 90;
    mysteryRoles: boolean;
  }) => void;
  onResumeGame?: (gameRoomId: string) => void;
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
  onStartGame,
  onResumeGame,
  onOpenTutorial,
}: TableLobbyDrawerProps) {
  const [rounds, setRounds] = useState<1 | 3>(1);
  const [turnSeconds, setTurnSeconds] = useState<30 | 45 | 60 | 90>(45);
  const [mysteryRoles, setMysteryRoles] = useState(false);

  const isHost = table.hostUserId === myUserId;
  const isInProgress = table.status === "IN_PROGRESS" && Boolean(table.activeGameRoomId);
  const occupied = table.seats.filter((s) => s.status !== "AVAILABLE");
  const botCount = occupied.filter((s) => s.isBot).length;
  const humanCount = occupied.filter((s) => !s.isBot).length;
  const canPlayTreasureTrails = table.capacity >= 3;
  const hasEnoughPlayers = occupied.length >= 3 && occupied.length <= 8;
  const nonHostUnreadyCount = occupied.filter((s) => !s.isBot && !s.isReady).length - (isHost ? 1 : 0);

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
          <h3 className="mt-1 font-display text-lg font-bold text-espresso">
            {canPlayTreasureTrails ? "🗺️ Treasure Trails" : "☕ Cozy 2-Seat Table"}
          </h3>
        </div>
        <button
          type="button"
          onClick={onStandUp}
          className="inline-flex items-center gap-1 rounded-xl bg-oat-200 px-3 py-1.5 text-xs font-bold text-espresso hover:bg-terracotta-100 hover:text-terracotta-700"
        >
          <LogOut className="h-3.5 w-3.5" /> Stand Up
        </button>
      </div>

      {/* Seat Pills */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {table.seats.map((s) => (
          <div
            key={s.seatIndex}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-bold ${
              s.status === "AVAILABLE"
                ? "border-dashed border-oat-300 text-espresso-muted"
                : s.isBot
                  ? "border-amberwarm-400/50 bg-amberwarm-100 text-espresso"
                  : "border-sage-300 bg-sage-100 text-espresso"
            }`}
          >
            {s.status === "AVAILABLE" ? (
              <span>Chair {s.seatIndex + 1} (Open)</span>
            ) : (
              <>
                {s.isBot && <Bot className="h-3.5 w-3.5 text-amberwarm-600" />}
                <span>{s.occupantName}</span>
                {s.isReady && <Check className="h-3.5 w-3.5 text-sage-700" />}
              </>
            )}
          </div>
        ))}
      </div>

      {!canPlayTreasureTrails ? (
        <div className="mt-3 rounded-xl bg-amberwarm-100 p-3 text-xs font-semibold text-espresso-soft">
          Window Nook seats 2 players for cozy chatting. Walk over to{" "}
          <strong>Maple Table (4)</strong> or <strong>Grand Lantern Table (8)</strong>{" "}
          to play <strong>Treasure Trails (3–8 players)</strong>!
        </div>
      ) : isInProgress ? (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onResumeGame?.(table.activeGameRoomId)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-amberwarm-400 py-2.5 font-display text-sm font-bold text-espresso shadow-sm transition hover:bg-amberwarm-600 hover:text-white"
          >
            <Play className="h-4 w-4" /> Resume Active Match
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
                    disabled={occupied.length >= table.capacity}
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

              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
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

                {occupied.length >= 5 && (
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
                onClick={() => onStartGame({ rounds, turnSeconds, mysteryRoles })}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-sage-500 py-2.5 font-display text-sm font-bold text-white shadow-sm transition hover:bg-sage-700 disabled:bg-oat-300 disabled:text-espresso-muted"
              >
                <Play className="h-4 w-4" />
                {hasEnoughPlayers
                  ? "Start Treasure Trails!"
                  : `Need ${3 - occupied.length} More Player${3 - occupied.length > 1 ? "s" : ""}`}
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
              Waiting for {nonHostUnreadyCount} seated friend{nonHostUnreadyCount > 1 ? "s" : ""} to click Ready...
            </p>
          )}
        </>
      )}
    </div>
  );
}
