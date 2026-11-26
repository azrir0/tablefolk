"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Film,
  HelpCircle,
  Layers,
  PackageCheck,
  Sparkles,
  Trophy,
  Users,
  X,
} from "lucide-react";
import type { GameTutorialDTO } from "@tablefolk/shared";
import { fetchGameTutorial } from "@/lib/api";
import {
  getOnboardingCurriculum,
  type SupportedGameSlug,
} from "@/lib/gameTutorials";
import { GameIcon, TutorialCardIcon, type GameIconName } from "./GameIcons";
import {
  GameShortClipsPlayer,
  GameWalkthroughPlayer,
} from "./GameWalkthroughPlayer";

interface CashierTutorialModalProps {
  gameSlug?: string;
  initialTab?: "rules" | "clips" | "cards" | "faq";
  /** Optional Wardrobe round-trip props so users can inspect rules and carry the box seamlessly */
  carryingSlug?: string;
  onCarryGame?: (slug: string | null) => void;
  onBackToWardrobe?: () => void;
  onClose: () => void;
}

const AVAILABLE_RULEBOOKS: Array<{
  slug: SupportedGameSlug;
  label: string;
  icon: GameIconName;
}> = [
  { slug: "treasure-trails", label: "Treasure Trails", icon: "game-trails" },
  { slug: "hearthvale", label: "Hearthvale", icon: "game-hearthvale" },
  { slug: "velvet-masque", label: "Velvet Masque", icon: "game-masque" },
];

function normalizeSlug(slug?: string): SupportedGameSlug {
  if (slug === "hearthvale") return "hearthvale";
  if (slug === "velvet-masque") return "velvet-masque";
  return "treasure-trails";
}

/** Properly renders **bold** and *italic* inline segments cleanly without raw asterisks */
function renderInlineRichText(text: string): React.ReactNode {
  const tokens = text.split(/(\*\*.*?\*\*|\*[^*]+?\*)/g);
  return tokens.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-extrabold text-espresso">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={idx} className="italic text-espresso-soft">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export function CashierTutorialModal({
  gameSlug = "treasure-trails",
  initialTab = "rules",
  carryingSlug,
  onCarryGame,
  onBackToWardrobe,
  onClose,
}: CashierTutorialModalProps) {
  const [selectedSlug, setSelectedSlug] = useState<SupportedGameSlug>(() =>
    normalizeSlug(gameSlug)
  );
  const curriculum = useMemo(
    () => getOnboardingCurriculum(selectedSlug),
    [selectedSlug]
  );

  // Instant fallback so rules, video walkthrough & clips render in 0ms
  const [tutorial, setTutorial] = useState<GameTutorialDTO>(
    curriculum.fallbackTutorial
  );
  const [tab, setTab] = useState<"rules" | "clips" | "cards" | "faq">(initialTab);

  useEffect(() => {
    setSelectedSlug(normalizeSlug(gameSlug));
  }, [gameSlug]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    let cancelled = false;
    setTutorial(curriculum.fallbackTutorial);
    fetchGameTutorial(selectedSlug)
      .then((data) => {
        if (!cancelled && data) setTutorial(data);
      })
      .catch(() => {
        // Fallback curriculum is already displayed seamlessly
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSlug, curriculum]);

  const isCarryingThis = carryingSlug === selectedSlug;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/50 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border-2 border-oat-300 bg-oat-50 shadow-cozy">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-oat-200 px-5 py-3.5 sm:px-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sage-700">
              <GameIcon name="cafe-cup" className="h-4 w-4" />
              Sage&apos;s Interactive Rulebook &amp; Walkthrough
            </div>
            <h2 className="mt-0.5 flex items-center gap-2 font-display text-xl font-bold text-espresso">
              <GameIcon name={curriculum.icon} className="h-6 w-6" />
              <span className="truncate">{tutorial.title}</span>
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close rulebook"
            className="shrink-0 rounded-xl p-1.5 text-espresso-muted transition hover:bg-oat-200 hover:text-espresso"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Game Switcher + Section Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-oat-200 bg-oat-100/75 px-5 py-2.5 text-xs font-bold sm:px-6">
          <div className="flex flex-wrap gap-1 rounded-xl bg-oat-200/75 p-0.5">
            {AVAILABLE_RULEBOOKS.map((book) => (
              <button
                key={book.slug}
                type="button"
                onClick={() => setSelectedSlug(book.slug)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 transition ${
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

          <div className="flex flex-wrap gap-1">
            {(
              [
                ["rules", "How to Play", BookOpen],
                ["clips", `Short Clips (${curriculum.shortClips.length})`, Film],
                [
                  "cards",
                  selectedSlug === "hearthvale"
                    ? "Tiles & Scoring"
                    : selectedSlug === "velvet-masque"
                      ? "8-Mask Roster"
                      : "Cards & Tools",
                  Layers,
                ],
                ["faq", "FAQ", HelpCircle],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1.5 transition ${
                  tab === id
                    ? "bg-sage-500 text-white shadow-sm"
                    : "bg-oat-50 text-espresso-soft hover:bg-oat-200"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {tab === "rules" ? (
            <div className="space-y-5">
              {/* 1. At-a-Glance Hero Strip */}
              <div
                className={`rounded-2xl border ${curriculum.accentBorder} bg-gradient-to-br ${curriculum.accentBg} p-4 shadow-sm`}
              >
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-extrabold text-espresso">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 shadow-sm">
                    <Users className="h-3.5 w-3.5 text-sage-700" />
                    {curriculum.atAGlance.players}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 shadow-sm">
                    <Clock className="h-3.5 w-3.5 text-amberwarm-600" />
                    {curriculum.atAGlance.duration}
                  </span>
                  <span className="rounded-full bg-white/85 px-2.5 py-1 text-espresso-soft shadow-sm">
                    {curriculum.atAGlance.category} · {curriculum.atAGlance.difficulty}
                  </span>
                </div>

                <p className="mt-2.5 text-sm font-bold leading-relaxed text-espresso">
                  {curriculum.atAGlance.winGoal}
                </p>

                <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-white/75 px-3 py-2 text-xs font-semibold text-espresso-soft">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amberwarm-600" />
                  <span>
                    <strong className="text-espresso">TableFolk Twist:</strong>{" "}
                    {curriculum.atAGlance.signatureTwist}
                  </span>
                </div>
              </div>

              {/* 2. Embedded 55s Guided Video Walkthrough */}
              <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-1.5 font-display text-base font-bold text-espresso">
                    <Film className="h-4 w-4 text-sage-700" />
                    Guided Video Walkthrough
                  </h3>
                  <button
                    type="button"
                    onClick={() => setTab("clips")}
                    className="inline-flex items-center gap-1 text-xs font-bold text-sage-700 hover:text-espresso"
                  >
                    Watch {curriculum.shortClips.length} Short Mechanic Clips →
                  </button>
                </div>

                <GameWalkthroughPlayer
                  gameSlug={selectedSlug}
                  onOpenClipsTab={() => setTab("clips")}
                />
              </section>

              {/* 3. Visual Turn Flow (Numbered Step Cards) */}
              <section className="space-y-2.5">
                <h3 className="font-display text-base font-bold text-espresso">
                  On Your Turn
                </h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  {curriculum.turnSteps.map((step) => {
                    const accentBadge =
                      step.accent === "sage"
                        ? "bg-sage-500 text-white"
                        : step.accent === "amber"
                          ? "bg-amberwarm-400 text-espresso"
                          : "bg-terracotta-500 text-white";
                    return (
                      <div
                        key={step.step}
                        className="flex flex-col rounded-2xl border border-oat-300 bg-white p-3.5 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${accentBadge}`}
                          >
                            {step.step}
                          </span>
                          <GameIcon name={step.icon} className="h-6 w-6" />
                        </div>
                        <h4 className="mt-2 font-display text-sm font-bold text-espresso">
                          {step.title}
                        </h4>
                        <p className="mt-1 text-xs leading-relaxed text-espresso-soft">
                          {renderInlineRichText(step.summary)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* 4. Scoring & Win Breakdown */}
              <section className="space-y-2.5">
                <h3 className="flex items-center gap-1.5 font-display text-base font-bold text-espresso">
                  <Trophy className="h-4 w-4 text-amberwarm-600" />
                  Scoring &amp; Win Conditions
                </h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  {curriculum.scoringPillars.map((pillar) => {
                    const toneCls =
                      pillar.tone === "sage"
                        ? "border-sage-300 bg-sage-100/60"
                        : pillar.tone === "amber"
                          ? "border-amberwarm-400/60 bg-amberwarm-100/65"
                          : "border-terracotta-500/45 bg-terracotta-100/60";
                    return (
                      <div
                        key={pillar.label}
                        className={`rounded-2xl border p-3.5 ${toneCls}`}
                      >
                        <div className="flex items-center gap-2">
                          <GameIcon name={pillar.icon} className="h-5 w-5" />
                          <span className="text-xs font-extrabold text-espresso">
                            {pillar.label}
                          </span>
                        </div>
                        <div className="mt-1.5 font-display text-base font-black text-espresso">
                          {pillar.value}
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-espresso-soft">
                          {pillar.detail}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* 5. First-Match Tips (Do / Watch Out) */}
              <section className="space-y-2">
                <h3 className="font-display text-base font-bold text-espresso">
                  First-Match Tips from Sage
                </h3>
                <div className="space-y-2">
                  {curriculum.firstMatchTips.map((tip, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 rounded-2xl border border-oat-300 bg-white px-3.5 py-2.5 text-xs leading-relaxed text-espresso-soft"
                    >
                      {tip.kind === "do" ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sage-700" />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amberwarm-600" />
                      )}
                      <span>{renderInlineRichText(tip.text)}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* 6. Complete Written Rulebook Reference (expandable so main view stays clean) */}
              <details className="rounded-2xl border border-oat-300 bg-white/80 p-4">
                <summary className="cursor-pointer font-display text-sm font-bold text-espresso select-none">
                  Full Written Rulebook Reference
                </summary>
                <div className="mt-3 space-y-2 text-xs leading-relaxed text-espresso-soft">
                  {tutorial.rulesMarkdown.split("\n").map((line, i) => {
                    if (line.startsWith("### ")) {
                      return (
                        <h4
                          key={i}
                          className="pt-2 font-display text-sm font-bold text-espresso"
                        >
                          {line.replace("### ", "")}
                        </h4>
                      );
                    }
                    if (line.startsWith("- ") || /^\d+\./.test(line)) {
                      return (
                        <p key={i} className="pl-3">
                          {renderInlineRichText(line)}
                        </p>
                      );
                    }
                    if (!line.trim()) return null;
                    return <p key={i}>{renderInlineRichText(line)}</p>;
                  })}
                </div>
              </details>
            </div>
          ) : tab === "clips" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-bold text-espresso">
                    Short Mechanic Clips with Explanations
                  </h3>
                  <p className="text-xs text-espresso-muted">
                    Tap any 10-second looping clip to master a key rule before your first turn!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTab("rules")}
                  className="text-xs font-bold text-sage-700 hover:text-espresso"
                >
                  ← Full Walkthrough &amp; Rules
                </button>
              </div>
              <GameShortClipsPlayer gameSlug={selectedSlug} />
            </div>
          ) : tab === "cards" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {tutorial.cardReference.map((card) => (
                <div
                  key={card.name}
                  className="rounded-2xl border border-oat-300 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-oat-200 bg-oat-50">
                      <TutorialCardIcon
                        icon={card.icon}
                        gameSlug={selectedSlug}
                        className="h-8 w-8"
                      />
                    </div>
                    <div>
                      <div className="font-display text-sm font-bold text-espresso">
                        {card.name}
                      </div>
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-sage-700">
                        {card.category}
                      </div>
                    </div>
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed text-espresso-soft">
                    {renderInlineRichText(card.description)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {tutorial.faq.map((item) => (
                <div
                  key={item.q}
                  className="rounded-2xl border border-oat-300 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start gap-2 font-display text-sm font-bold text-espresso">
                    <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-sage-700" />
                    <span>{item.q}</span>
                  </div>
                  <p className="mt-1.5 pl-6 text-xs leading-relaxed text-espresso-soft">
                    {renderInlineRichText(item.a)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Optional Wardrobe Action Footer (when opened from the Game Wardrobe!) */}
        {(onBackToWardrobe || onCarryGame) && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-oat-200 bg-oat-100/90 px-5 py-3 sm:px-6">
            {onBackToWardrobe ? (
              <button
                type="button"
                onClick={onBackToWardrobe}
                className="inline-flex items-center gap-1.5 rounded-xl border border-oat-300 bg-oat-50 px-3.5 py-2 text-xs font-bold text-espresso transition hover:bg-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Wardrobe
              </button>
            ) : (
              <div />
            )}

            {onCarryGame && (
              <button
                type="button"
                onClick={() => {
                  onCarryGame(isCarryingThis ? null : selectedSlug);
                  onClose();
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold shadow-sm transition ${
                  isCarryingThis
                    ? "bg-terracotta-100 text-terracotta-700 hover:bg-terracotta-500 hover:text-white"
                    : "bg-sage-500 text-white hover:bg-sage-700"
                }`}
              >
                <PackageCheck className="h-4 w-4" />
                {isCarryingThis
                  ? `Put ${tutorial.title} Back`
                  : `Carry ${tutorial.title} Box to Table`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
