"use client";

import React, { useState } from "react";
import { BookOpen, Compass, Film, Play } from "lucide-react";
import type { SupportedGameSlug } from "@/lib/gameTutorials";
import { CashierTutorialModal, type TutorialModalTab } from "./CashierTutorialModal";

interface GamesWardrobeRuleButtonProps {
  gameSlug: SupportedGameSlug;
}

/**
 * Interactive Quick Tour, Rules & Video Walkthrough launcher for the public /games "Game Wardrobe" page.
 * Matches the exact buttons inside the in-café Game Wardrobe & Table Lobby so players can
 * walk through core features step-by-step or watch the 55s walkthrough before entering Sunlit Oak Café.
 */
export function GamesWardrobeRuleButton({
  gameSlug,
}: GamesWardrobeRuleButtonProps) {
  const [openTab, setOpenTab] = useState<TutorialModalTab | null>(null);

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-oat-200/80 pt-4">
        <button
          type="button"
          onClick={() => setOpenTab("tour")}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-2xl bg-sage-500 px-4 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-sage-700"
        >
          <Compass className="h-3.5 w-3.5" />
          Quick Tour (6 Steps)
        </button>

        <button
          type="button"
          onClick={() => setOpenTab("rules")}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-2xl border border-oat-300 bg-oat-50 px-3.5 py-2 text-xs font-bold text-espresso shadow-sm transition hover:bg-white"
        >
          <BookOpen className="h-3.5 w-3.5 text-sage-700" />
          Rules &amp; Video
        </button>

        <button
          type="button"
          onClick={() => setOpenTab("clips")}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-2xl bg-amberwarm-100 px-3.5 py-2 text-xs font-bold text-espresso transition hover:bg-amberwarm-400/35"
        >
          <Film className="h-3.5 w-3.5 text-amberwarm-600" />
          4 Short Clips
        </button>

        <button
          type="button"
          onClick={() => setOpenTab("rules")}
          className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-sage-700 transition hover:text-espresso"
        >
          <Play className="h-3.5 w-3.5 fill-sage-700" />
          Watch 55s Guide
        </button>
      </div>

      {openTab && (
        <CashierTutorialModal
          gameSlug={gameSlug}
          initialTab={openTab}
          onClose={() => setOpenTab(null)}
        />
      )}
    </>
  );
}
