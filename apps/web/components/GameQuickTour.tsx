"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  Lightbulb,
  Sparkles,
  X,
} from "lucide-react";
import {
  getGameQuickTour,
  markQuickTourCompleted,
  type QuickTourStep,
} from "@/lib/gameQuickTours";
import type { SupportedGameSlug } from "@/lib/gameTutorials";
import { GameIcon } from "./GameIcons";

interface GameQuickTourProps {
  gameSlug: SupportedGameSlug;
  open: boolean;
  onClose: () => void;
  onOpenFullRules?: () => void;
}

interface RectBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

function renderBoldText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-extrabold text-espresso">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function accentBadgeClasses(accent: QuickTourStep["accent"]): string {
  if (accent === "terracotta") {
    return "bg-terracotta-100 text-terracotta-700 border-terracotta-500/30";
  }
  if (accent === "amber") {
    return "bg-amberwarm-100 text-amberwarm-600 border-amberwarm-400/50";
  }
  return "bg-sage-100 text-sage-700 border-sage-300";
}

function accentRingColor(accent: QuickTourStep["accent"]): string {
  if (accent === "terracotta") return "#E07A5F";
  if (accent === "amber") return "#E9A944";
  return "#62A87C";
}

/**
 * Interactive In-Game Live Spotlight Coachmark Walkthrough.
 * Anchors directly onto real game UI elements via `[data-tour="..."]` attributes,
 * dimming the surroundings with a crisp SVG cutout and auto-clamping the guide card
 * cleanly across desktop, portrait mobile, and short mobile landscape viewports.
 */
export function GameQuickTour({
  gameSlug,
  open,
  onClose,
  onOpenFullRules,
}: GameQuickTourProps) {
  const tour = useMemo(() => getGameQuickTour(gameSlug), [gameSlug]);
  const [stepIdx, setStepIdx] = useState(0);
  const [targetRect, setTargetRect] = useState<RectBox | null>(null);
  const [viewport, setViewport] = useState({ w: 1024, h: 768 });
  const [cardSize, setCardSize] = useState({ w: 340, h: 280 });
  const cardRef = useRef<HTMLDivElement | null>(null);

  const step = tour.steps[stepIdx] ?? tour.steps[0]!;
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === tour.steps.length - 1;

  // Reset to step 0 each time the tour opens
  useEffect(() => {
    if (open) {
      setStepIdx(0);
    }
  }, [open, gameSlug]);

  const finishAndClose = useCallback(() => {
    markQuickTourCompleted(gameSlug);
    onClose();
  }, [gameSlug, onClose]);

  const goNext = useCallback(() => {
    if (stepIdx < tour.steps.length - 1) {
      setStepIdx((i) => i + 1);
    } else {
      finishAndClose();
    }
  }, [stepIdx, tour.steps.length, finishAndClose]);

  const goPrev = useCallback(() => {
    setStepIdx((i) => Math.max(0, i - 1));
  }, []);

  // Keyboard navigation while open
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finishAndClose();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, finishAndClose, goNext, goPrev]);

  // Measure target UI element & viewport continuously on resize/step change
  const measureTarget = useCallback(() => {
    if (typeof window === "undefined") return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setViewport({ w: vw, h: vh });

    const el = document.querySelector<HTMLElement>(`[data-tour="${step.targetId}"]`);
    if (!el) {
      setTargetRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) {
      setTargetRect(null);
      return;
    }
    const pad = 6;
    const left = Math.max(4, r.left - pad);
    const top = Math.max(4, r.top - pad);
    const right = Math.min(vw - 4, r.right + pad);
    const bottom = Math.min(vh - 4, r.bottom + pad);
    setTargetRect({
      left,
      top,
      width: Math.max(16, right - left),
      height: Math.max(16, bottom - top),
    });
  }, [step.targetId]);

  useLayoutEffect(() => {
    if (!open) return;
    measureTarget();
    const raf = requestAnimationFrame(measureTarget);
    const timer = window.setTimeout(measureTarget, 160);
    window.addEventListener("resize", measureTarget);
    window.addEventListener("orientationchange", measureTarget);
    window.addEventListener("scroll", measureTarget, true);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.removeEventListener("resize", measureTarget);
      window.removeEventListener("orientationchange", measureTarget);
      window.removeEventListener("scroll", measureTarget, true);
    };
  }, [open, stepIdx, measureTarget]);

  useLayoutEffect(() => {
    if (!open || !cardRef.current) return;
    const r = cardRef.current.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      setCardSize({ w: r.width, h: r.height });
    }
  }, [open, stepIdx, viewport.w, viewport.h]);

  if (!open) return null;

  // Smart coachmark placement that never clips off-screen (portrait, desktop, or short landscape!)
  const margin = 10;
  const gap = 12;
  const isShort = viewport.h <= 540;
  const maxCardW = Math.min(isShort ? 330 : 376, viewport.w - margin * 2);
  const estW = Math.min(cardSize.w || maxCardW, maxCardW);
  const estH = Math.min(cardSize.h || (isShort ? 230 : 295), viewport.h - margin * 2);

  let cardLeft = Math.round((viewport.w - estW) / 2);
  let cardTop = Math.round((viewport.h - estH) / 2);

  if (targetRect) {
    const spaceBelow = viewport.h - (targetRect.top + targetRect.height) - margin;
    const spaceAbove = targetRect.top - margin;
    const spaceRight = viewport.w - (targetRect.left + targetRect.width) - margin;
    const spaceLeft = targetRect.left - margin;
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    if (isShort && spaceRight >= estW + gap) {
      cardLeft = targetRect.left + targetRect.width + gap;
      cardTop = targetCenterY - estH / 2;
    } else if (isShort && spaceLeft >= estW + gap) {
      cardLeft = targetRect.left - estW - gap;
      cardTop = targetCenterY - estH / 2;
    } else if (spaceBelow >= estH + gap) {
      cardLeft = targetCenterX - estW / 2;
      cardTop = targetRect.top + targetRect.height + gap;
    } else if (spaceAbove >= estH + gap) {
      cardLeft = targetCenterX - estW / 2;
      cardTop = targetRect.top - estH - gap;
    } else if (spaceRight >= estW + gap) {
      cardLeft = targetRect.left + targetRect.width + gap;
      cardTop = targetCenterY - estH / 2;
    } else if (spaceLeft >= estW + gap) {
      cardLeft = targetRect.left - estW - gap;
      cardTop = targetCenterY - estH / 2;
    } else {
      // Large spotlight target (e.g., full game board): dock card cleanly at bottom-right/center
      cardLeft = isShort ? viewport.w - estW - margin : (viewport.w - estW) / 2;
      cardTop =
        targetCenterY > viewport.h / 2
          ? margin + 4
          : viewport.h - estH - margin;
    }

    cardLeft = Math.max(margin, Math.min(viewport.w - estW - margin, Math.round(cardLeft)));
    cardTop = Math.max(margin, Math.min(viewport.h - estH - margin, Math.round(cardTop)));
  }

  const maskId = `tour-spotlight-mask-${gameSlug}`;
  const ringStroke = accentRingColor(step.accent);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${tour.title} Quick Tour — Step ${stepIdx + 1} of ${tour.steps.length}`}
      className="fixed inset-0 z-[70] select-none"
    >
      {/* Interactive Click Shield + Smooth SVG Spotlight Cutout */}
      <svg
        className="fixed inset-0 h-full w-full"
        width={viewport.w}
        height={viewport.h}
        aria-hidden="true"
      >
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx="16"
                ry="16"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(26, 18, 14, 0.62)"
          mask={`url(#${maskId})`}
        />
        {targetRect && (
          <rect
            x={targetRect.left}
            y={targetRect.top}
            width={targetRect.width}
            height={targetRect.height}
            rx="16"
            ry="16"
            fill="none"
            stroke={ringStroke}
            strokeWidth="3"
            className="animate-pulse"
          />
        )}
      </svg>

      {/* Spotlight Beacon Label */}
      {targetRect && targetRect.top > 28 && (
        <div
          style={{
            left: Math.max(10, Math.min(viewport.w - 130, targetRect.left + 8)),
            top: Math.max(6, targetRect.top - 24),
          }}
          className="pointer-events-none fixed inline-flex items-center gap-1 rounded-full bg-espresso px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amberwarm-400 shadow-lg"
        >
          <Sparkles className="h-3 w-3" />
          Step {stepIdx + 1}/{tour.steps.length}
        </div>
      )}

      {/* Auto-Positioned Coachmark Card */}
      <div
        ref={cardRef}
        style={{
          left: cardLeft,
          top: cardTop,
          width: maxCardW,
        }}
        className="fixed max-h-[calc(100dvh-20px)] overflow-y-auto rounded-3xl border-2 border-amberwarm-400 bg-oat-50 p-4 shadow-2xl transition-[left,top] duration-200 short:rounded-2xl short:p-3"
      >
        {/* Top Segmented Progress Bar */}
        <div className="mb-2.5 flex items-center gap-1 short:mb-2">
          {tour.steps.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStepIdx(idx)}
              aria-label={`Jump to step ${idx + 1}: ${s.title}`}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                idx === stepIdx
                  ? "bg-sage-500"
                  : idx < stepIdx
                    ? "bg-amberwarm-400"
                    : "bg-oat-300 hover:bg-oat-300/80"
              }`}
            />
          ))}
        </div>

        {/* Header Row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-oat-300 bg-white shadow-sm short:h-8 short:w-8 short:rounded-xl">
              <GameIcon name={step.icon} className="h-5 w-5 short:h-4 short:w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider ${accentBadgeClasses(step.accent)}`}
                >
                  <Compass className="h-2.5 w-2.5" />
                  {step.badge}
                </span>
                <span className="text-[10px] font-bold text-espresso-muted">
                  {stepIdx + 1} of {tour.steps.length}
                </span>
              </div>
              <h3 className="mt-0.5 font-display text-base font-bold leading-snug text-espresso short:text-sm">
                {step.title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={finishAndClose}
            aria-label="Close quick tour"
            className="shrink-0 rounded-xl p-1 text-espresso-muted transition hover:bg-oat-200 hover:text-espresso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Concise Explanation */}
        <p className="mt-2 text-xs font-medium leading-relaxed text-espresso-soft short:mt-1.5 short:text-[11px]">
          {renderBoldText(step.summary)}
        </p>

        {/* Core Feature Highlights */}
        <div className="mt-2.5 space-y-1.5 short:mt-2 short:space-y-1">
          {step.features.map((feat) => (
            <div
              key={feat.label}
              className="rounded-xl border border-oat-200 bg-white px-2.5 py-1.5 text-[11px] leading-snug text-espresso-soft shadow-sm short:px-2 short:py-1 short:text-[10.5px]"
            >
              <span className="font-extrabold text-espresso">{feat.label}:</span>{" "}
              {feat.detail}
            </div>
          ))}
        </div>

        {/* Actionable Pro Tip */}
        <div className="mt-2.5 flex items-start gap-1.5 rounded-xl bg-amberwarm-100/90 px-2.5 py-1.5 text-[11px] font-semibold text-espresso short:mt-2 short:py-1 short:text-[10px]">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amberwarm-600" />
          <span>{step.tryItHint}</span>
        </div>

        {/* Navigation Footer */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-oat-200 pt-2.5 short:mt-2 short:pt-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={finishAndClose}
              className="rounded-xl px-2 py-1 text-[11px] font-bold text-espresso-muted transition hover:bg-oat-200 hover:text-espresso"
            >
              Skip
            </button>
            {isLast && onOpenFullRules && (
              <button
                type="button"
                onClick={() => {
                  finishAndClose();
                  onOpenFullRules();
                }}
                className="inline-flex items-center gap-1 rounded-xl border border-oat-300 bg-white px-2 py-1 text-[11px] font-bold text-espresso hover:bg-oat-100"
              >
                <BookOpen className="h-3 w-3 text-sage-700" /> Full Rules
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {!isFirst && (
              <button
                type="button"
                onClick={goPrev}
                className="inline-flex items-center gap-0.5 rounded-xl bg-oat-200 px-2.5 py-1.5 text-xs font-bold text-espresso transition hover:bg-oat-300 short:py-1 short:text-[11px]"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              className={`inline-flex items-center gap-1 rounded-xl px-3.5 py-1.5 text-xs font-extrabold text-white shadow-sm transition short:px-3 short:py-1 short:text-[11px] ${
                isLast
                  ? "bg-sage-500 hover:bg-sage-700"
                  : "bg-espresso hover:bg-espresso-soft"
              }`}
            >
              {isLast ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Let&apos;s Play!
                </>
              ) : (
                <>
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
