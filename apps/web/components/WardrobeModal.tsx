"use client";

import React, { useEffect, useState } from "react";
import { BookOpen, Clock, Film, PackageCheck, Users, X } from "lucide-react";
import type { GameCatalogueItemDTO } from "@tablefolk/shared";
import { fetchGameCatalogue } from "@/lib/api";
import { GameIcon, gameSlugToIconName } from "./GameIcons";

interface WardrobeModalProps {
  carryingSlug: string;
  onCarryGame: (slug: string | null) => void;
  onOpenTutorial: (slug: string, initialTab?: "rules" | "clips") => void;
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
            <h2 className="inline-flex items-center gap-2 font-display text-xl font-bold text-espresso">
              <GameIcon name="bookshelf" className="h-6 w-6" />
              Game Wardrobe
            </h2>
            <p className="text-xs text-espresso-muted">
              Check rules &amp; video walkthroughs first, then pick up a box to carry to any table!
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
            const canOpenRules = game.isAvailable || game.tutorialAvailable;
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
                  <h3 className="mt-3 flex items-center gap-2 font-display text-xl font-bold text-espresso">
                    {game.isAvailable && (
                      <GameIcon
                        name={gameSlugToIconName(game.slug)}
                        className="h-6 w-6"
                      />
                    )}
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
                    <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold text-espresso-muted">
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
                      {canOpenRules && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenTutorial(game.slug, "clips");
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-amberwarm-100 px-2 py-1 text-espresso transition hover:bg-amberwarm-400/35"
                        >
                          <Film className="h-3 w-3 text-amberwarm-600" />
                          Video &amp; Clips
                        </button>
                      )}
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
                        className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl py-2 text-xs font-bold transition ${
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
                        className="flex-1 cursor-not-allowed rounded-2xl bg-oat-200 py-2 text-xs font-bold text-espresso-muted"
                      >
                        Arriving in Wave 2
                      </button>
                    )}

                    {canOpenRules && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenTutorial(game.slug, "rules");
                        }}
                        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-2xl border border-oat-300 bg-oat-50 px-3.5 py-2 text-xs font-bold text-espresso shadow-sm transition hover:bg-oat-100"
                      >
                        <BookOpen className="h-3.5 w-3.5 text-sage-700" /> Rules
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
