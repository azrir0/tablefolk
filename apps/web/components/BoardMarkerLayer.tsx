"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eraser, Pin, Sparkles, X } from "lucide-react";
import type { BoardMarkerMode, BoardMarkerStroke } from "@tablefolk/shared";

interface BoardMarkerLayerProps {
  /** Tile-space coordinate bounds matching the underlying grid */
  minX: number;
  minY: number;
  cols: number;
  rows: number;
  strokes: BoardMarkerStroke[];
  drawingEnabled: boolean;
  activeColor: string;
  activeMode: BoardMarkerMode;
  onCommitStroke: (
    points: Array<{ x: number; y: number }>,
    color: string,
    mode: BoardMarkerMode
  ) => void;
}

const FADE_LIFETIME_MS = 9000;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildSvgPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const p = points[0]!;
    return `M ${p.x} ${p.y} L ${p.x + 0.001} ${p.y}`;
  }
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const mx = (prev.x + curr.x) / 2;
    const my = (prev.y + curr.y) / 2;
    d += ` Q ${prev.x} ${prev.y} ${mx} ${my}`;
  }
  const last = points[points.length - 1]!;
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function downsamplePoints(
  pts: Array<{ x: number; y: number }>,
  maxCount: number
): Array<{ x: number; y: number }> {
  if (pts.length <= maxCount) return pts;
  const result: Array<{ x: number; y: number }> = [];
  const step = (pts.length - 1) / (maxCount - 1);
  for (let i = 0; i < maxCount; i++) {
    const p = pts[Math.round(i * step)]!;
    result.push({ x: round2(p.x), y: round2(p.y) });
  }
  return result;
}

function isPointPing(points: Array<{ x: number; y: number }>): boolean {
  if (points.length <= 1) return true;
  const first = points[0]!;
  let maxDist = 0;
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    const d = Math.hypot(p.x - first.x, p.y - first.y);
    if (d > maxDist) maxDist = d;
  }
  return maxDist < 0.14;
}

export function BoardMarkerLayer({
  minX,
  minY,
  cols,
  rows,
  strokes,
  drawingEnabled,
  activeColor,
  activeMode,
  onCommitStroke,
}: BoardMarkerLayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [draftPoints, setDraftPoints] = useState<Array<{ x: number; y: number }>>([]);
  const draftRef = useRef<Array<{ x: number; y: number }>>([]);
  const drawingPointerIdRef = useRef<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Lightweight 1-second sweep to unmount faded strokes cleanly
  const hasFadingStrokes = useMemo(
    () => strokes.some((s) => s.mode === "fade"),
    [strokes]
  );

  useEffect(() => {
    if (!hasFadingStrokes) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasFadingStrokes]);

  const visibleStrokes = useMemo(
    () =>
      strokes.filter(
        (s) => s.mode === "sticky" || nowMs - s.createdAt < FADE_LIFETIME_MS
      ),
    [strokes, nowMs]
  );

  const clientToTile = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      return {
        x: round2(minX + nx * cols),
        y: round2(minY + ny * rows),
      };
    },
    [minX, minY, cols, rows]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawingEnabled) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const pt = clientToTile(e.clientX, e.clientY);
    if (!pt) return;
    e.preventDefault();
    e.stopPropagation();
    drawingPointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore if capture unavailable
    }
    draftRef.current = [pt];
    setDraftPoints([pt]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawingEnabled || drawingPointerIdRef.current !== e.pointerId) return;
    const pt = clientToTile(e.clientX, e.clientY);
    if (!pt) return;
    e.preventDefault();
    const prev = draftRef.current[draftRef.current.length - 1];
    if (!prev || Math.hypot(pt.x - prev.x, pt.y - prev.y) >= 0.08) {
      const next = [...draftRef.current, pt];
      draftRef.current = next;
      setDraftPoints(next);
    }
  };

  const finishStroke = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drawingPointerIdRef.current !== e.pointerId) return;
    drawingPointerIdRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const raw = draftRef.current;
    draftRef.current = [];
    setDraftPoints([]);
    if (raw.length === 0) return;

    const finalPoints = isPointPing(raw) ? [raw[0]!] : downsamplePoints(raw, 60);
    onCommitStroke(finalPoints, activeColor, activeMode);
  };

  const tileToPct = (pt: { x: number; y: number }) => ({
    leftPct: ((pt.x - minX) / Math.max(cols, 1)) * 100,
    topPct: ((pt.y - minY) / Math.max(rows, 1)) * 100,
  });

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishStroke}
      onPointerCancel={finishStroke}
      className={`absolute inset-0 z-30 overflow-visible rounded-lg ${
        drawingEnabled
          ? "pointer-events-auto cursor-crosshair touch-none ring-2 ring-amberwarm-400/80 ring-offset-1 ring-offset-transparent"
          : "pointer-events-none"
      }`}
    >
      {/* Resolution-independent SVG Freehand Layer in Tile Space */}
      <svg
        viewBox={`${minX} ${minY} ${cols} ${rows}`}
        preserveAspectRatio="none"
        className="pointer-events-none h-full w-full overflow-visible"
      >
        {visibleStrokes.map((s) => {
          if (isPointPing(s.points)) return null;
          const d = buildSvgPath(s.points);
          const elapsedSec = Math.max(0, (Date.now() - s.createdAt) / 1000);
          return (
            <g
              key={s.id}
              className={s.mode === "fade" ? "animate-tt-marker-fade" : undefined}
              style={
                s.mode === "fade"
                  ? { animationDelay: `-${elapsedSec.toFixed(2)}s` }
                  : undefined
              }
            >
              {/* Crisp light halo so every player color pops on dark tabletop AND sunlit tiles */}
              <path
                d={d}
                fill="none"
                stroke="#FFF8EC"
                strokeOpacity={0.74}
                strokeWidth={7.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={d}
                fill="none"
                stroke={s.color}
                strokeOpacity={0.98}
                strokeWidth={4.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}

        {/* Active Live Draft Stroke while Dragging */}
        {draftPoints.length > 1 && (
          <g>
            <path
              d={buildSvgPath(draftPoints)}
              fill="none"
              stroke="#FFF8EC"
              strokeOpacity={0.7}
              strokeWidth={7.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={buildSvgPath(draftPoints)}
              fill="none"
              stroke={activeColor}
              strokeOpacity={0.98}
              strokeWidth={4.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}
      </svg>

      {/* Crisp Non-Stretched HTML Layer for Tap-Pings & Author Name Pills */}
      {visibleStrokes.map((s) => {
        const anchor = s.points[s.points.length - 1]!;
        const { leftPct, topPct } = tileToPct(anchor);
        // Skip anchors outside current viewport bounds
        if (leftPct < -5 || leftPct > 105 || topPct < -5 || topPct > 105) {
          return null;
        }
        const ping = isPointPing(s.points);
        const elapsedSec = Math.max(0, (Date.now() - s.createdAt) / 1000);

        return (
          <div
            key={`${s.id}_label`}
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              ...(s.mode === "fade"
                ? { animationDelay: `-${elapsedSec.toFixed(2)}s` }
                : {}),
            }}
            className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 ${
              s.mode === "fade" ? "animate-tt-marker-fade" : ""
            }`}
          >
            {ping && (
              <div className="relative flex items-center justify-center">
                <span
                  style={{ borderColor: s.color }}
                  className="animate-tt-marker-ping h-9 w-9 rounded-full border-[3px] shadow-[0_0_12px_rgba(255,248,236,0.75)] sm:h-11 sm:w-11"
                />
                <span
                  style={{ backgroundColor: s.color }}
                  className="absolute h-3 w-3 rounded-full border-2 border-white shadow"
                />
              </div>
            )}
            <span
              style={{ borderColor: s.color }}
              className={`absolute left-1/2 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border bg-espresso/92 px-1.5 py-[1px] text-[8px] font-extrabold leading-tight text-oat-50 shadow-md sm:text-[9px] ${
                ping ? "top-5 sm:top-6" : "-top-4"
              }`}
            >
              <span
                style={{ backgroundColor: s.color }}
                className="h-2 w-2 shrink-0 rounded-full border border-white/80"
              />
              {s.mode === "sticky" && (
                <Pin className="h-2.5 w-2.5 shrink-0 text-amberwarm-400" />
              )}
              {s.displayName}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface BoardMarkerToolbarProps {
  activeColor: string;
  colorLabel?: string;
  activeMode: BoardMarkerMode;
  myStrokeCount: number;
  totalStrokeCount: number;
  onSelectMode: (mode: BoardMarkerMode) => void;
  onClearMine: () => void;
  onClearAll: () => void;
  onClose: () => void;
}

export function BoardMarkerToolbar({
  activeColor,
  colorLabel,
  activeMode,
  myStrokeCount,
  totalStrokeCount,
  onSelectMode,
  onClearMine,
  onClearAll,
  onClose,
}: BoardMarkerToolbarProps) {
  return (
    <div className="absolute left-1/2 top-2 z-30 flex max-w-[calc(100%-16px)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-2xl border-2 border-amberwarm-400 bg-espresso/95 px-2.5 py-1.5 text-[10px] font-bold text-oat-50 shadow-2xl backdrop-blur sm:gap-2 sm:px-3 sm:text-[11px]">
      {/* Fixed Player Color Pen Indicator */}
      <div
        title="Your personal marker color matches your player badge"
        className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-2 py-0.5 text-oat-50"
      >
        <span
          style={{ backgroundColor: activeColor }}
          className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white shadow-sm"
        />
        <span>{colorLabel ? `${colorLabel} Pen` : "Your Pen"}</span>
      </div>

      <span className="hidden h-4 w-px bg-oat-300/30 sm:inline-block" />

      {/* Fade (Default) vs Sticky Pin Toggle */}
      <div className="flex rounded-xl bg-white/10 p-0.5">
        <button
          type="button"
          onClick={() => onSelectMode("fade")}
          title="Marks glow for 9 seconds then fade cleanly"
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 transition ${
            activeMode === "fade"
              ? "bg-amberwarm-400 text-espresso shadow-sm"
              : "text-oat-200 hover:text-white"
          }`}
        >
          <Sparkles className="h-3 w-3" /> Fade 9s
        </button>
        <button
          type="button"
          onClick={() => onSelectMode("sticky")}
          title="Pinned marks stay until cleared or next round"
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 transition ${
            activeMode === "sticky"
              ? "bg-amberwarm-400 text-espresso shadow-sm"
              : "text-oat-200 hover:text-white"
          }`}
        >
          <Pin className="h-3 w-3" /> Pin
        </button>
      </div>

      {/* Clear Controls */}
      {myStrokeCount > 0 && (
        <button
          type="button"
          onClick={onClearMine}
          title="Clear your drawings"
          className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2 py-0.5 text-oat-100 hover:bg-terracotta-500 hover:text-white"
        >
          <Eraser className="h-3 w-3" /> Clear
        </button>
      )}
      {totalStrokeCount > myStrokeCount && (
        <button
          type="button"
          onClick={onClearAll}
          title="Clear everyone's drawings on the board"
          className="rounded-lg bg-white/10 px-2 py-0.5 text-oat-200 hover:bg-terracotta-500 hover:text-white"
        >
          Clear All
        </button>
      )}

      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center gap-0.5 rounded-lg bg-sage-500 px-2 py-0.5 font-extrabold text-white hover:bg-sage-700"
      >
        Done <X className="h-3 w-3" />
      </button>
    </div>
  );
}
