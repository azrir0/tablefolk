"use client";

import React, { useState } from "react";
import { BookOpen, Film, Play } from "lucide-react";
import type { SupportedGameSlug } from "@/lib/gameTutorials";
import { CashierTutorialModal } from "./CashierTutorialModal";

interface GamesWardrobeRuleButtonProps {
  gameSlug: SupportedGameSlug;
}

/**
 * Interactive Rules & Video Walkthrough launcher for the public /games "Game Wardrobe" page.
 * Matches the exact Rules button inside the in-café Game Wardrobe & HUD so players can
 * watch the 55s walkthrough and short mechanic clips before entering Sunlit Oak Café.
 */
export function GamesWardrobeRuleButton({
  gameSlug,
}: GamesWardrobeRuleButtonProps) {
  const [openTab, setOpenTab] = useState<"rules" | "clips" | null>(null);

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-oat-200/80 pt-4">
        <button
          type="button"
          onClick={() => setOpenTab("rules")}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-2xl border border-oat-300 bg-oat-50 px-4 py-2 text-xs font-bold text-espresso shadow-sm transition hover:bg-white"
        >
          <BookOpen className="h-3.5 w-3.5 text-sage-700" />
          Rules &amp; Video Walkthrough
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
