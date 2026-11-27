"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Lightbulb,
  LogOut,
  Minimize2,
  Maximize2,
  Sparkles,
} from "lucide-react";
import type { GuidedCoachModel } from "@/lib/guidedTutorials";
import { soundEngine } from "@/lib/sound";
import { GameIcon, gameSlugToIconName } from "./GameIcons";

interface GuidedTutorialCoachProps {
  model: GuidedCoachModel;
  onOpenRules?: () => void;
  onExitTutorial?: () => void;
}

interface TargetBox {
  left: number;
  top: number;
  width: number;
  height: number;
  viewportH: number;
}

/**
 * Non-blocking, live state-reactive Step-by-Step Interactive Tutorial Coach.
 * Runs right alongside a real game against Café Bots:
 * - Highlights the exact live UI region (`[data-tour="..."]`) with a pulsing golden ring
 *   that NEVER intercepts clicks (`pointer-events-none`) so players play naturally!
 * - Tracks live learning milestones automatically as the player takes turns.
 * - Automatically docks Top or Bottom to stay clear of the highlighted region,
 *   plus 1-click Top/Bottom flip and Minimize-to-Pill.
 */
export function GuidedTutorialCoach({
  model,
  onOpenRules,
  onExitTutorial,
}: GuidedTutorialCoachProps) {
  const [userDock, setUserDock] = useState<"bottom" | "top" | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [manualStepIdx, setManualStepIdx] = useState<number | null>(null);
  const [targetBox, setTargetBox] = useState<TargetBox | null>(null);
  const prevDoneCountRef = useRef(0);

  const completedCount = model.steps.filter((s) => s.done).length;

  // Celebratory subtle chime whenever a new guided milestone checks off!
  useEffect(() => {
    if (completedCount > prevDoneCountRef.current) {
      soundEngine.playTurnChime();
    }
    prevDoneCountRef.current = completedCount;
  }, [completedCount]);

  // If the live step advances naturally, snap back to auto-follow so user stays synced
  const prevLiveStepRef = useRef(model.liveStepIndex);
  useEffect(() => {
    if (prevLiveStepRef.current !== model.liveStepIndex) {
      prevLiveStepRef.current = model.liveStepIndex;
      setManualStepIdx(null);
    }
  }, [model.liveStepIndex]);

  const isAutoFollow = manualStepIdx === null;
  const activeStepIdx = isAutoFollow
    ? model.liveStepIndex
    : Math.max(0, Math.min(model.steps.length - 1, manualStepIdx));
  const activeStep = model.steps[activeStepIdx] ?? model.steps[0]!;

  const displayTitle = isAutoFollow ? model.liveTitle : activeStep.title;
  const displayInstruction = isAutoFollow
    ? model.liveInstruction
    : activeStep.instruction;
  const displayActionChip = isAutoFollow
    ? model.liveActionChip
    : activeStep.actionChip;
  const displayTip = isAutoFollow ? model.liveTip : activeStep.tip;
  const activeTargetId = isAutoFollow ? model.liveTargetId : activeStep.targetId;

  // Reset manual dock override whenever the highlighted UI region changes
  // so smart auto-avoidance keeps the newly highlighted target unobstructed
  useEffect(() => {
    setUserDock(null);
  }, [activeTargetId]);

  // Track highlighted target rect without blocking any pointer interactions
  const measure = useCallback(() => {
    if (typeof window === "undefined" || minimized || model.isComplete) {
      setTargetBox(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(`[data-tour="${activeTargetId}"]`);
    if (!el) {
      setTargetBox(null);
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) {
      setTargetBox(null);
      return;
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 4;
    const left = Math.max(2, r.left - pad);
    const top = Math.max(2, r.top - pad);
    const right = Math.min(vw - 2, r.right + pad);
    const bottom = Math.min(vh - 2, r.bottom + pad);
    setTargetBox({
      left,
      top,
      width: Math.max(16, right - left),
      height: Math.max(16, bottom - top),
      viewportH: vh,
    });
  }, [activeTargetId, minimized, model.isComplete]);

  useLayoutEffect(() => {
    measure();
    const id = window.setInterval(measure, 450);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  // Smart Auto-Avoidance: if the highlighted region sits in the lower strip
  // (e.g. Sunstone Guild Gem Bank, Dawnspire Hand, Hearthvale Tile Dock) and
  // leaves clearance up top, automatically dock the Coach at Top!
  const autoDock: "bottom" | "top" =
    targetBox &&
    targetBox.top + targetBox.height >
      targetBox.viewportH - Math.min(200, targetBox.viewportH * 0.36) &&
    targetBox.top > Math.min(180, targetBox.viewportH * 0.34)
      ? "top"
      : "bottom";
  const dock = userDock ?? autoDock;

  return (
    <div className="pointer-events-none fixed inset-0 z-[55]">
      {/* Non-blocking Pulsing Golden Highlight Frame around active UI region */}
      {targetBox && (
        <div
          style={{
            left: targetBox.left,
            top: targetBox.top,
            width: targetBox.width,
            height: targetBox.height,
          }}
          className="pointer-events-none fixed rounded-2xl border-[3px] border-[#F2B749] shadow-[0_0_0_2px_rgba(59,43,38,0.25),0_0_20px_rgba(242,183,73,0.65)] transition-all duration-300"
        >
          <span className="absolute -top-3 left-3 inline-flex items-center gap-1 rounded-full border border-espresso/20 bg-[#F2B749] px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-espresso shadow-sm">
            <Sparkles className="h-2.5 w-2.5" />
            Step {activeStepIdx + 1} · Look Here
          </span>
        </div>
      )}

      {/* Floating Collapsible Step-by-Step Coach Bar */}
      <div
        className={`pointer-events-none fixed inset-x-0 flex justify-center px-2.5 sm:px-4 ${
          dock === "bottom"
            ? "bottom-2.5 short:bottom-1.5"
            : "top-14 short:top-10"
        }`}
      >
        {minimized ? (
          <button
            type="button"
            onClick={() => setMinimized(false)}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border-2 border-[#F2B749] bg-[#232D47]/95 px-4 py-2 text-xs font-extrabold text-oat-50 shadow-cozy backdrop-blur transition hover:scale-105"
          >
            <GraduationCap className="h-4 w-4 text-[#FDE68A]" />
            <span>
              Coach ({completedCount}/{model.steps.length}): {displayTitle}
            </span>
            <Maximize2 className="h-3.5 w-3.5 text-[#FDE68A]" />
          </button>
        ) : (
          <div className="pointer-events-auto w-full max-w-2xl overflow-hidden rounded-3xl border-2 border-[#F2B749] bg-oat-50/95 text-espresso shadow-[0_14px_38px_rgba(24,20,18,0.35)] backdrop-blur-md short:max-w-xl short:rounded-2xl">
            {/* Compact Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 bg-[#232D47] px-3 py-1.5 text-oat-50 short:px-2.5 short:py-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <GameIcon
                  name={gameSlugToIconName(model.gameSlug)}
                  className="h-4 w-4 shrink-0"
                />
                <span className="inline-flex items-center gap-1 whitespace-nowrap font-display text-xs font-bold text-[#FDE68A] short:text-[11px]">
                  <GraduationCap className="h-3.5 w-3.5" />
                  Guided Tutorial
                </span>
                <span
                  className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider ${
                    model.isComplete
                      ? "bg-emerald-500 text-white"
                      : model.isYourTurn
                        ? "bg-[#F2B749] text-espresso"
                        : "bg-white/15 text-oat-100"
                  }`}
                >
                  {model.statusLabel}
                </span>
                <span className="hidden truncate text-[10px] font-semibold text-oat-200/85 sm:inline short:hidden">
                  · {model.botSummary}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {!isAutoFollow && (
                  <button
                    type="button"
                    onClick={() => setManualStepIdx(null)}
                    className="rounded-lg bg-[#F2B749] px-2 py-0.5 text-[10px] font-black text-espresso hover:brightness-105"
                  >
                    Live Sync
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setUserDock(dock === "bottom" ? "top" : "bottom")}
                  title={dock === "bottom" ? "Move Coach to Top" : "Move Coach to Bottom"}
                  className="inline-flex items-center gap-0.5 rounded-lg bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-oat-100 hover:bg-white/20"
                >
                  {dock === "bottom" ? (
                    <>
                      <ArrowUp className="h-3 w-3" /> Top
                    </>
                  ) : (
                    <>
                      <ArrowDown className="h-3 w-3" /> Bottom
                    </>
                  )}
                </button>
                {onOpenRules && (
                  <button
                    type="button"
                    onClick={onOpenRules}
                    title="Open Full Rulebook"
                    className="inline-flex items-center gap-0.5 rounded-lg bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-oat-100 hover:bg-white/20"
                  >
                    <BookOpen className="h-3 w-3 text-[#FDE68A]" /> Rules
                  </button>
                )}
                {onExitTutorial && (
                  <button
                    type="button"
                    onClick={onExitTutorial}
                    title="Exit Guided Tutorial back to Café"
                    className="inline-flex items-center gap-0.5 rounded-lg bg-rose-600/80 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-rose-600"
                  >
                    <LogOut className="h-3 w-3" /> Exit
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMinimized(true)}
                  title="Minimize Coach to compact pill"
                  className="rounded-lg bg-white/10 p-1 text-oat-100 hover:bg-white/20"
                >
                  <Minimize2 className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Step-by-Step Progress Strip */}
            <div className="flex items-center gap-1 overflow-x-auto border-b border-oat-200 bg-oat-100/90 px-3 py-1 short:px-2.5 short:py-0.5">
              {model.steps.map((st, idx) => {
                const isActive = idx === activeStepIdx;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() =>
                      setManualStepIdx(idx === model.liveStepIndex ? null : idx)
                    }
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold transition ${
                      isActive
                        ? "bg-[#232D47] text-[#FDE68A] shadow-sm"
                        : st.done
                          ? "bg-sage-100 text-sage-700 hover:bg-sage-200"
                          : "bg-white text-espresso-muted hover:bg-oat-200"
                    }`}
                  >
                    <span
                      className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-black ${
                        st.done
                          ? "bg-sage-500 text-white"
                          : isActive
                            ? "bg-[#F2B749] text-espresso"
                            : "bg-oat-200 text-espresso-soft"
                      }`}
                    >
                      {st.done ? <Check className="h-2.5 w-2.5 stroke-[3]" /> : idx + 1}
                    </span>
                    {st.shortTitle}
                  </button>
                );
              })}

              <div className="ml-auto flex shrink-0 items-center gap-0.5 pl-1">
                <button
                  type="button"
                  disabled={activeStepIdx <= 0}
                  onClick={() => setManualStepIdx(Math.max(0, activeStepIdx - 1))}
                  className="rounded-md bg-white p-0.5 text-espresso hover:bg-oat-200 disabled:opacity-35"
                  title="Previous Step Tip"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={activeStepIdx >= model.steps.length - 1}
                  onClick={() =>
                    setManualStepIdx(Math.min(model.steps.length - 1, activeStepIdx + 1))
                  }
                  className="rounded-md bg-white p-0.5 text-espresso hover:bg-oat-200 disabled:opacity-35"
                  title="Next Step Tip"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Live Coaching Body */}
            <div className="px-3.5 py-2.5 short:px-2.5 short:py-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <h3 className="font-display text-sm font-bold leading-snug text-espresso short:text-xs">
                  {displayTitle}
                </h3>
                <span className="inline-flex items-center gap-1 rounded-xl border border-sage-300 bg-sage-100 px-2.5 py-0.5 text-[10.5px] font-extrabold text-sage-700 short:text-[9.5px]">
                  <Sparkles className="h-3 w-3 shrink-0" />
                  {displayActionChip}
                </span>
              </div>

              <p className="mt-1 text-xs font-medium leading-relaxed text-espresso-soft short:text-[11px] short:leading-snug">
                {displayInstruction}
              </p>

              <div className="mt-1.5 flex items-start gap-1.5 rounded-xl bg-amberwarm-100/80 px-2.5 py-1 text-[11px] font-semibold text-espresso short:hidden">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amberwarm-600" />
                <span>{displayTip}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
