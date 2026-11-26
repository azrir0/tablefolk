"use client";

import React from "react";
import {
  getTileTemplate,
  rotateAnchor,
  type CardinalDir,
  type PlacedFolk,
  type PlayerColorId,
  type TileRotation,
} from "@tablefolk/game-hearthvale";

export const FOLK_COLOR_STYLES: Record<
  PlayerColorId,
  { fill: string; stroke: string; badgeBg: string; badgeText: string; label: string }
> = {
  terracotta: {
    fill: "#D9594C",
    stroke: "#7A261E",
    badgeBg: "bg-[#FCE6E3]",
    badgeText: "text-[#9A2E23]",
    label: "Red",
  },
  sage: {
    fill: "#3D9468",
    stroke: "#1D5237",
    badgeBg: "bg-[#E2F4EA]",
    badgeText: "text-[#1E613E]",
    label: "Green",
  },
  ocean: {
    fill: "#3A7CC4",
    stroke: "#1C4370",
    badgeBg: "bg-[#E3EFFC]",
    badgeText: "text-[#1F4E85]",
    label: "Blue",
  },
  honey: {
    fill: "#E5A020",
    stroke: "#855508",
    badgeBg: "bg-[#FDF3D7]",
    badgeText: "text-[#8A5A0A]",
    label: "Gold",
  },
  plum: {
    fill: "#8E5BB5",
    stroke: "#4E2A6B",
    badgeBg: "bg-[#F1E6FA]",
    badgeText: "text-[#58307A]",
    label: "Plum",
  },
};

interface HearthvaleTileSvgProps {
  templateId: string;
  rotation: TileRotation;
  folk?: PlacedFolk;
  /** Optional 1..9 neighbor count badge shown on Windmill tiles */
  shrineFill?: number;
  isGhost?: boolean;
  isScoringFlash?: boolean;
  compact?: boolean;
}

function renderTownSegment(edges: CardinalDir[], hasCrest?: boolean) {
  const hasN = edges.includes("N");
  const hasE = edges.includes("E");
  const hasS = edges.includes("S");
  const hasW = edges.includes("W");
  const count = edges.length;

  let pathD = "";
  let wallD = "";
  let crestPos: { x: number; y: number } = { x: 50, y: 50 };

  if (count === 4) {
    pathD = "M 0 0 L 100 0 L 100 100 L 0 100 Z";
    crestPos = { x: 50, y: 50 };
  } else if (count === 3) {
    // 3-sided Keep (in our templates always N, E, W — South is open/road)
    if (!hasS) {
      pathD = "M 0 0 L 100 0 L 100 100 Q 50 62 0 100 Z";
      wallD = "M 0 100 Q 50 62 100 100";
      crestPos = { x: 50, y: 36 };
    } else if (!hasN) {
      pathD = "M 0 100 L 100 100 L 100 0 Q 50 38 0 0 Z";
      wallD = "M 0 0 Q 50 38 100 0";
      crestPos = { x: 50, y: 64 };
    } else if (!hasE) {
      pathD = "M 0 0 L 100 0 Q 62 50 100 100 L 0 100 Z";
      wallD = "M 100 0 Q 62 50 100 100";
      crestPos = { x: 36, y: 50 };
    } else {
      pathD = "M 100 0 L 0 0 Q 38 50 0 100 L 100 100 Z";
      wallD = "M 0 0 Q 38 50 0 100";
      crestPos = { x: 64, y: 50 };
    }
  } else if (count === 2) {
    if (hasE && hasW) {
      // Grand Bridge horizontal band connecting E & W
      pathD = "M 0 12 Q 50 26 100 12 L 100 88 Q 50 74 0 88 Z";
      wallD = "M 0 12 Q 50 26 100 12 M 0 88 Q 50 74 100 88";
      crestPos = { x: 50, y: 50 };
    } else if (hasN && hasS) {
      pathD = "M 12 0 Q 26 50 12 100 L 88 100 Q 74 50 88 0 Z";
      wallD = "M 12 0 Q 26 50 12 100 M 88 0 Q 74 50 88 100";
      crestPos = { x: 50, y: 50 };
    } else if (hasN && hasE) {
      pathD = "M 0 0 L 100 0 L 100 100 Q 44 56 0 0 Z";
      wallD = "M 0 0 Q 44 56 100 100";
      crestPos = { x: 68, y: 30 };
    } else if (hasE && hasS) {
      pathD = "M 100 0 L 100 100 L 0 100 Q 44 44 100 0 Z";
      wallD = "M 100 0 Q 44 44 0 100";
      crestPos = { x: 68, y: 70 };
    } else if (hasS && hasW) {
      pathD = "M 0 0 Q 56 44 100 100 L 0 100 Z";
      wallD = "M 0 0 Q 56 44 100 100";
      crestPos = { x: 32, y: 70 };
    } else {
      // N & W
      pathD = "M 0 0 L 100 0 Q 56 56 0 100 Z";
      wallD = "M 100 0 Q 56 56 0 100";
      crestPos = { x: 32, y: 30 };
    }
  } else if (count === 1) {
    if (hasN) {
      pathD = "M 0 0 L 100 0 Q 50 42 0 0 Z";
      wallD = "M 0 0 Q 50 42 100 0";
      crestPos = { x: 50, y: 14 };
    } else if (hasE) {
      pathD = "M 100 0 L 100 100 Q 58 50 100 0 Z";
      wallD = "M 100 0 Q 58 50 100 100";
      crestPos = { x: 86, y: 50 };
    } else if (hasS) {
      pathD = "M 0 100 L 100 100 Q 50 58 0 100 Z";
      wallD = "M 0 100 Q 50 58 100 100";
      crestPos = { x: 50, y: 86 };
    } else {
      pathD = "M 0 0 L 0 100 Q 42 50 0 0 Z";
      wallD = "M 0 0 Q 42 50 0 100";
      crestPos = { x: 14, y: 50 };
    }
  }

  return (
    <g>
      {/* Warm terracotta tiled town interior */}
      <path d={pathD} fill="#D97A58" />
      {/* Subtle sunlit roof patches inside town */}
      <path d={pathD} fill="url(#hvTownPattern)" opacity={0.35} />
      {/* Cream-stone defensive wall outline */}
      {wallD && (
        <>
          <path d={wallD} fill="none" stroke="#6E4A35" strokeWidth={5.2} strokeLinecap="round" />
          <path d={wallD} fill="none" stroke="#F6E6CD" strokeWidth={2.4} strokeLinecap="round" strokeDasharray="5 3" />
        </>
      )}
      {/* Golden Crest Shield (bonus +2 pts!) */}
      {hasCrest && (
        <g transform={`translate(${crestPos.x}, ${crestPos.y})`}>
          <path
            d="M 0 -9 L 8 -5 L 7 4 Q 0 10 0 10 Q 0 10 -7 4 L -8 -5 Z"
            fill="#F4C44E"
            stroke="#6C4511"
            strokeWidth={1.8}
          />
          <path
            d="M 0 -5 L 4 -2.5 L 3.5 2.5 L 0 5.5 L -3.5 2.5 L -4 -2.5 Z"
            fill="#2B679E"
          />
          <circle cx={0} cy={0} r={1.8} fill="#FFF7D6" />
        </g>
      )}
    </g>
  );
}

function edgeMidpoint(dir: CardinalDir): { x: number; y: number } {
  switch (dir) {
    case "N":
      return { x: 50, y: 0 };
    case "E":
      return { x: 100, y: 50 };
    case "S":
      return { x: 50, y: 100 };
    case "W":
      return { x: 0, y: 50 };
  }
}

function renderRoadSegment(edges: CardinalDir[], hasLantern?: boolean) {
  let d = "";
  let lanternPos = { x: 64, y: 36 };

  if (edges.length === 2) {
    const p1 = edgeMidpoint(edges[0]!);
    const p2 = edgeMidpoint(edges[1]!);
    if (p1.x === p2.x || p1.y === p2.y) {
      d = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
      lanternPos = p1.x === p2.x ? { x: 66, y: 46 } : { x: 50, y: 34 };
    } else {
      // Smooth curved bend
      d = `M ${p1.x} ${p1.y} Q 50 50 ${p2.x} ${p2.y}`;
      const cx = (p1.x + p2.x + 50) / 3;
      const cy = (p1.y + p2.y + 50) / 3;
      lanternPos = {
        x: cx > 50 ? 34 : 66,
        y: cy > 50 ? 34 : 66,
      };
    }
  } else if (edges.length === 1) {
    const p = edgeMidpoint(edges[0]!);
    d = `M ${p.x} ${p.y} L 50 50`;
  }

  return (
    <g>
      {/* Stone road edge */}
      <path d={d} fill="none" stroke="#85654B" strokeWidth={15} strokeLinecap="round" />
      {/* Warm cream cobble surface */}
      <path d={d} fill="none" stroke="#F4E3C5" strokeWidth={10.5} strokeLinecap="round" />
      {/* Subtle stone center tread */}
      <path
        d={d}
        fill="none"
        stroke="#DFC49C"
        strokeWidth={2.2}
        strokeDasharray="4 6"
        strokeLinecap="round"
      />
      {/* Glowing Roadside Lantern (doubles completed road points!) */}
      {hasLantern && (
        <g transform={`translate(${lanternPos.x}, ${lanternPos.y})`}>
          <circle cx={0} cy={0} r={11.5} fill="#F9C74F" opacity={0.35} />
          <circle cx={0} cy={0} r={7} fill="#FFE082" stroke="#9C5714" strokeWidth={1.6} />
          <circle cx={0} cy={0} r={3.2} fill="#FFFDF0" />
        </g>
      )}
    </g>
  );
}

function renderWindmill() {
  return (
    <g transform="translate(50, 48)">
      {/* Hilltop shadow */}
      <ellipse cx={0} cy={14} rx={17} ry={7} fill="#5C8547" opacity={0.45} />
      {/* Cozy stone tower */}
      <path
        d="M -9 13 L -6 -6 L 6 -6 L 9 13 Z"
        fill="#FAF1E0"
        stroke="#6B4C35"
        strokeWidth={2}
      />
      {/* Terracotta conical roof */}
      <path d="M -9 -5 L 0 -15 L 9 -5 Z" fill="#D56649" stroke="#6B3726" strokeWidth={1.8} />
      {/* Little wooden door */}
      <rect x={-2.5} y={5} width={5} height={8} rx={2.5} fill="#8D5D3B" />
      {/* 4 Windmill Sails */}
      <g transform="translate(0, -4) rotate(22)">
        <line x1={-17} y1={0} x2={17} y2={0} stroke="#5E3E28" strokeWidth={2.4} strokeLinecap="round" />
        <line x1={0} y1={-17} x2={0} y2={17} stroke="#5E3E28" strokeWidth={2.4} strokeLinecap="round" />
        <rect x={4} y={-4.5} width={11} height={4.5} rx={1} fill="#FFFDF7" stroke="#9C7A5B" strokeWidth={0.9} />
        <rect x={-15} y={0} width={11} height={4.5} rx={1} fill="#FFFDF7" stroke="#9C7A5B" strokeWidth={0.9} />
        <rect x={0} y={-15} width={4.5} height={11} rx={1} fill="#FFFDF7" stroke="#9C7A5B" strokeWidth={0.9} />
        <rect x={-4.5} y={4} width={4.5} height={11} rx={1} fill="#FFFDF7" stroke="#9C7A5B" strokeWidth={0.9} />
        <circle cx={0} cy={0} r={2.8} fill="#F4C44E" stroke="#6B4C35" strokeWidth={1.2} />
      </g>
    </g>
  );
}

export function HearthvaleTileSvg({
  templateId,
  rotation,
  folk,
  shrineFill,
  isGhost = false,
  isScoringFlash = false,
  compact = false,
}: HearthvaleTileSvgProps) {
  const tpl = getTileTemplate(templateId);
  const roadSegments = tpl.segments.filter((s) => s.kind === "ROAD");
  const townSegments = tpl.segments.filter((s) => s.kind === "TOWN");
  const hasJunction = roadSegments.length >= 3;

  // Compute upright Folk pawn position after rotating its segment anchor
  let folkPos: { ax: number; ay: number } | null = null;
  if (folk) {
    const seg = tpl.segments.find((s) => s.id === folk.segmentId);
    if (seg) {
      folkPos = rotateAnchor(seg.ax, seg.ay, rotation);
    }
  }

  return (
    <svg
      viewBox="0 0 100 100"
      className={`h-full w-full overflow-hidden rounded-[inherit] ${
        isGhost ? "opacity-85" : ""
      }`}
    >
      <defs>
        <pattern
          id="hvTownPattern"
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
        >
          <rect width="14" height="14" fill="#D97A58" />
          <rect x="1" y="1" width="6" height="5" rx="1" fill="#E69270" />
          <rect x="8" y="7" width="5" height="6" rx="1" fill="#C46243" />
        </pattern>
      </defs>

      {/* Rotatable Terrain Group */}
      <g transform={`rotate(${rotation} 50 50)`}>
        {/* Sunlit pastoral meadow background */}
        <rect width="100" height="100" fill="#A2CB82" />
        {/* Soft sunlit wildflower & grass tufts */}
        <circle cx="20" cy="24" r="3" fill="#8BB86A" opacity={0.55} />
        <circle cx="78" cy="76" r="3.5" fill="#8BB86A" opacity={0.55} />
        <circle cx="24" cy="78" r="2" fill="#FFF2A8" opacity={0.75} />
        <circle cx="76" cy="22" r="1.8" fill="#FFF2A8" opacity={0.7} />

        {/* Roads first, then Towns on top so castle gates meet roads crisply */}
        {roadSegments.map((seg) => (
          <React.Fragment key={seg.id}>
            {renderRoadSegment(seg.edges, seg.hasLantern)}
          </React.Fragment>
        ))}

        {/* Village crossroads stone plaza marker so separate road endpoints are unmistakable */}
        {hasJunction && (
          <g>
            <circle cx={50} cy={50} r={11} fill="#D4B087" stroke="#7A5A3E" strokeWidth={2.2} />
            <circle cx={50} cy={50} r={4.5} fill="#8C6244" />
          </g>
        )}

        {townSegments.map((seg) => (
          <React.Fragment key={seg.id}>
            {renderTownSegment(seg.edges, seg.hasCrest)}
          </React.Fragment>
        ))}

        {tpl.hasShrine && renderWindmill()}
      </g>

      {/* Subtle wooden tile bevel border */}
      <rect
        x="0.75"
        y="0.75"
        width="98.5"
        height="98.5"
        rx="4"
        fill="none"
        stroke={isScoringFlash ? "#F7C948" : "rgba(75, 52, 35, 0.28)"}
        strokeWidth={isScoringFlash ? 5 : 1.5}
      />

      {/* Windmill progress ring pill (always upright!) */}
      {tpl.hasShrine && typeof shrineFill === "number" && (
        <g transform="translate(81, 18)">
          <rect
            x={-14}
            y={-9}
            width={28}
            height={17}
            rx={8}
            fill={shrineFill === 9 ? "#F4C44E" : "rgba(59, 43, 38, 0.85)"}
            stroke="#FFF8EB"
            strokeWidth={1.4}
          />
          <text
            x={0}
            y={3.2}
            textAnchor="middle"
            fontSize={9.5}
            fontWeight={800}
            fill={shrineFill === 9 ? "#3B2B26" : "#FFF8EB"}
          >
            {shrineFill}/9
          </text>
        </g>
      )}

      {/* Placed Villager / Mayor Pawn (always upright!) */}
      {folk && folkPos && (
        <g transform={`translate(${folkPos.ax}, ${folkPos.ay})`}>
          {/* Soft drop shadow */}
          <ellipse cx={0} cy={9} rx={10} ry={4.5} fill="rgba(30, 18, 12, 0.35)" />
          {/* Pawn body */}
          <path
            d={
              folk.kind === "MAYOR"
                ? "M -10 9 L -7 -3 Q 0 -7 7 -3 L 10 9 Z"
                : "M -8.5 8.5 L -6 -2 Q 0 -5 6 -2 L 8.5 8.5 Z"
            }
            fill={FOLK_COLOR_STYLES[folk.color].fill}
            stroke="#FFFDF9"
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          {/* Pawn head */}
          <circle
            cx={0}
            cy={folk.kind === "MAYOR" ? -9 : -7.5}
            r={folk.kind === "MAYOR" ? 6.2 : 5.4}
            fill={FOLK_COLOR_STYLES[folk.color].fill}
            stroke="#FFFDF9"
            strokeWidth={2.2}
          />
          {/* Gleaming golden crown + strength-2 indicator for Mayor! */}
          {folk.kind === "MAYOR" && (
            <>
              <path
                d="M -6 -15 L -4 -21 L 0 -17.5 L 4 -21 L 6 -15 Z"
                fill="#FFD54F"
                stroke="#7A4E0B"
                strokeWidth={1.4}
                strokeLinejoin="round"
              />
              {!compact && (
                <text
                  x={0}
                  y={5.5}
                  textAnchor="middle"
                  fontSize={8.5}
                  fontWeight={900}
                  fill="#FFFDF9"
                >
                  2
                </text>
              )}
            </>
          )}
        </g>
      )}
    </svg>
  );
}
