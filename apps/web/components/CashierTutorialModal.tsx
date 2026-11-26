"use client";

import React, { useEffect, useState } from "react";
import { BookOpen, HelpCircle, Layers, X } from "lucide-react";
import type { GameTutorialDTO } from "@tablefolk/shared";
import { fetchGameTutorial } from "@/lib/api";
import { GameIcon, TutorialCardIcon, type GameIconName } from "./GameIcons";

interface CashierTutorialModalProps {
  gameSlug?: string;
  onClose: () => void;
}

const AVAILABLE_RULEBOOKS: Array<{
  slug: string;
  label: string;
  icon: GameIconName;
}> = [
  { slug: "treasure-trails", label: "Treasure Trails", icon: "game-trails" },
  { slug: "hearthvale", label: "Hearthvale", icon: "game-hearthvale" },
  { slug: "velvet-masque", label: "Velvet Masque", icon: "game-masque" },
];

export function CashierTutorialModal({
  gameSlug = "treasure-trails",
  onClose,
}: CashierTutorialModalProps) {
  const [selectedSlug, setSelectedSlug] = useState<string>(gameSlug);
  const [tutorial, setTutorial] = useState<GameTutorialDTO | null>(null);
  const [tab, setTab] = useState<"rules" | "cards" | "faq">("rules");

  useEffect(() => {
    setSelectedSlug(gameSlug);
  }, [gameSlug]);

  useEffect(() => {
    let cancelled = false;
    setTutorial(null);
    fetchGameTutorial(selectedSlug)
      .then((data) => {
        if (!cancelled) setTutorial(data);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [selectedSlug]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/45 p-4 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border-2 border-oat-300 bg-oat-50 shadow-cozy">
        <div className="flex items-center justify-between border-b border-oat-200 px-6 py-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sage-700">
              <GameIcon name="cafe-cup" className="h-4 w-4" />
              Sage the Cashier&apos;s Rulebook
            </div>
            <h2 className="font-display text-xl font-bold text-espresso">
              {tutorial?.title ?? "Loading Guide..."}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-espresso-muted hover:bg-oat-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Game Rulebook Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-oat-200 bg-oat-100/70 px-6 py-2.5 text-xs font-bold">
          <div className="flex flex-wrap gap-1.5 rounded-xl bg-oat-200/70 p-0.5">
            {AVAILABLE_RULEBOOKS.map((book) => (
              <button
                key={book.slug}
                type="button"
                onClick={() => setSelectedSlug(book.slug)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 transition ${
                  selectedSlug === book.slug
                    ? "bg-espresso text-oat-50 shadow-sm"
                    : "text-espresso-soft hover:text-espresso"
                }`}
              >
                <GameIcon name={book.icon} className="h-4 w-4" />
                {book.label}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5">
            {(
              [
                ["rules", "How to Play", BookOpen],
                [
                  "cards",
                  selectedSlug === "hearthvale"
                    ? "Features & Scoring"
                    : selectedSlug === "velvet-masque"
                      ? "8-Mask Roster"
                      : "Card Reference",
                  Layers,
                ],
                ["faq", "FAQ", HelpCircle],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition ${
                  tab === id
                    ? "bg-sage-500 text-white"
                    : "bg-oat-50 text-espresso-soft hover:bg-oat-200"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!tutorial ? (
            <div className="py-12 text-center text-sm font-bold text-espresso-muted">
              Flipping open the guidebook...
            </div>
          ) : tab === "rules" ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-amberwarm-100/75 p-4 text-sm font-semibold leading-relaxed text-espresso">
                {tutorial.summary}
              </div>
              <div className="space-y-2.5 text-sm leading-relaxed text-espresso-soft">
                {tutorial.rulesMarkdown.split("\n").map((line, i) => {
                  if (line.startsWith("### ")) {
                    return (
                      <h3
                        key={i}
                        className="pt-2 font-display text-base font-bold text-espresso"
                      >
                        {line.replace("### ", "")}
                      </h3>
                    );
                  }
                  if (line.startsWith("- ") || /^\d+\./.test(line)) {
                    return (
                      <p key={i} className="pl-3">
                        {line.replace(/\*\*(.*?)\*\*/g, "$1")}
                      </p>
                    );
                  }
                  if (!line.trim()) return null;
                  return <p key={i}>{line}</p>;
                })}
              </div>
            </div>
          ) : tab === "cards" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {tutorial.cardReference.map((card) => (
                <div
                  key={card.name}
                  className="rounded-2xl border border-oat-300 bg-white p-4"
                >
                  <div className="flex items-center gap-2.5">
                    <TutorialCardIcon
                      icon={card.icon}
                      gameSlug={selectedSlug}
                      className="h-8 w-8"
                    />
                    <div>
                      <div className="font-display text-sm font-bold text-espresso">
                        {card.name}
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-sage-700">
                        {card.category}
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-espresso-soft">
                    {card.description}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {tutorial.faq.map((item) => (
                <div
                  key={item.q}
                  className="rounded-2xl border border-oat-300 bg-white p-4"
                >
                  <div className="font-display text-sm font-bold text-espresso">
                    {item.q}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-espresso-soft">
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
