"use client";

import React, { useEffect, useState } from "react";
import { BookOpen, Clock, PackageCheck, Users, X } from "lucide-react";
import type { GameCatalogueItemDTO } from "@tablefolk/shared";
import { fetchGameCatalogue } from "@/lib/api";

interface WardrobeModalProps {
  carryingSlug: string;
  onCarryGame: (slug: string | null) => void;
  onOpenTutorial: (slug: string) => void;
  onClose: () => void;
}

export function WardrobeModal({
  carryingSlug,
  onCarryGame,
  onOpenTutorial,
  onClose,
}: WardrobeModalProps) {
  const [games, setGames] = useState<GameCatalogueItemDTO[]>([]);
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGameCatalogue()
      .then(setGames)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const categories = ["All", ...Array.from(new Set(games.map((g) => g.category)))];
  const filtered =
    category === "All" ? games : games.filter((g) => g.category === category);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/45 p-4 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border-2 border-oat-300 bg-oat-50 shadow-cozy">
        <div className="flex items-center justify-between border-b border-oat-200 px-6 py-4">
          <div>
            <h2 className="font-display text-xl font-bold text-espresso">
              📚 Game Wardrobe
            </h2>
            <p className="text-xs text-espresso-muted">
              Pick up a board game box and carry it to any compatible café table!
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-espresso-muted hover:bg-oat-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-oat-200 bg-oat-100/70 px-6 py-3">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`rounded-full px-3.5 py-1 text-xs font-bold transition ${
                category === cat
                  ? "bg-espresso text-oat-50"
                  : "bg-oat-50 text-espresso-soft hover:bg-oat-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid flex-1 gap-4 overflow-y-auto p-6 sm:grid-cols-2">
          {loading && (
            <div className="col-span-2 py-12 text-center text-sm font-bold text-espresso-muted">
              Opening the wooden shelves...
            </div>
          )}

          {filtered.map((game) => {
            const isCarrying = carryingSlug === game.slug;
            return (
              <div
                key={game.id}
                className="flex flex-col justify-between overflow-hidden rounded-2xl border border-oat-300 bg-white shadow-sm"
              >
                <div className={`bg-gradient-to-br ${game.coverTheme} p-4`}>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-white/85 px-2.5 py-0.5 text-[11px] font-bold text-espresso">
                      {game.category}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        game.isAvailable
                          ? "bg-sage-500 text-white"
                          : "bg-espresso/15 text-espresso-soft"
                      }`}
                    >
                      {game.isAvailable ? "Playable Now" : "Coming Soon"}
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-xl font-bold text-espresso">
                    {game.title}
                  </h3>
                  <p className="mt-0.5 text-xs font-semibold text-espresso-soft">
                    {game.tagline}
                  </p>
                </div>

                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <p className="text-xs leading-relaxed text-espresso-soft">
                      {game.description}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-espresso-muted">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-oat-100 px-2 py-1">
                        <Users className="h-3.5 w-3.5 text-sage-700" />
                        {game.minPlayers}–{game.maxPlayers} Players
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-oat-100 px-2 py-1">
                        <Clock className="h-3.5 w-3.5 text-amberwarm-600" />~
                        {game.estimatedMinutes}m
                      </span>
                      <span className="rounded-lg bg-oat-100 px-2 py-1">
                        {game.difficulty}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    {game.isAvailable ? (
                      <button
                        type="button"
                        onClick={() => {
                          onCarryGame(isCarrying ? null : game.slug);
                          if (!isCarrying) onClose();
                        }}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
                          isCarrying
                            ? "bg-terracotta-100 text-terracotta-700 hover:bg-terracotta-500 hover:text-white"
                            : "bg-sage-500 text-white hover:bg-sage-700"
                        }`}
                      >
                        <PackageCheck className="h-4 w-4" />
                        {isCarrying ? "Put Box Back" : "Carry Box to Table"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="flex-1 cursor-not-allowed rounded-xl bg-oat-200 py-2 text-xs font-bold text-espresso-muted"
                      >
                        Arriving in Wave 2
                      </button>
                    )}

                    {game.tutorialAvailable && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenTutorial(game.slug);
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-oat-300 bg-oat-100 px-3 py-2 text-xs font-bold text-espresso hover:bg-oat-200"
                      >
                        <BookOpen className="h-3.5 w-3.5" /> Rules
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
