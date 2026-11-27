"use client";

import React from "react";
import {
  HEX_RADIUS,
  RESOURCE_META,
  getPipCount,
  type BuildingPiece,
  type HexTile,
  type IslandBoard,
  type ResourceType,
} from "@tablefolk/game-harborreach";
import { getPlayerColorMeta } from "@tablefolk/shared";

interface HarborreachBoardSvgProps {
  board: IslandBoard;
  buildings: Record<number, BuildingPiece>;
  roads: Record<number, string>;
  banditHexId: number;
  lastRollSum: number | null;
  playerColorById: Record<string, number>;
  validVertices: Set<number>;
  validEdges: Set<number>;
  canMoveBandit: boolean;
  onClickVertex?: (vertexId: number) => void;
  onClickEdge?: (edgeId: number) => void;
  onClickHex?: (hexId: number) => void;
}

function hexPolygonPoints(cx: number, cy: number, radius: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = ((60 * i - 30) * Math.PI) / 180;
    pts.push(`${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`);
  }
  return pts.join(" ");
}

function TerrainBackdropArt({ hex }: { hex: HexTile }) {
  const { cx, cy, terrain } = hex;
  if (terrain === "timber") {
    return (
      <g opacity="0.55" pointerEvents="none">
        <path d={`M${cx - 24} ${cy - 8}L${cx - 17} ${cy - 22}L${cx - 10} ${cy - 8}Z`} fill="#246E44" />
        <path d={`M${cx + 10} ${cy - 10}L${cx + 17} ${cy - 24}L${cx + 24} ${cy - 10}Z`} fill="#246E44" />
        <path d={`M${cx - 26} ${cy + 22}L${cx - 19} ${cy + 9}L${cx - 12} ${cy + 22}Z`} fill="#1D5D38" />
        <path d={`M${cx + 12} ${cy + 22}L${cx + 19} ${cy + 10}L${cx + 26} ${cy + 22}Z`} fill="#1D5D38" />
      </g>
    );
  }
  if (terrain === "clay") {
    return (
      <g opacity="0.48" pointerEvents="none">
        <rect x={cx - 26} y={cy - 22} width="14" height="7" rx="2" fill="#A9442B" />
        <rect x={cx + 10} y={cy - 18} width="15" height="7" rx="2" fill="#A9442B" />
        <rect x={cx - 22} y={cy + 15} width="15" height="7" rx="2" fill="#9A3B24" />
        <rect x={cx + 8} y={cy + 16} width="14" height="7" rx="2" fill="#9A3B24" />
      </g>
    );
  }
  if (terrain === "wool") {
    return (
      <g opacity="0.6" pointerEvents="none">
        <circle cx={cx - 20} cy={cy - 14} r="5.5" fill="#FFFDF8" />
        <circle cx={cx - 14} cy={cy - 15} r="5" fill="#FFFDF8" />
        <circle cx={cx + 17} cy={cy + 15} r="5" fill="#FFFDF8" />
        <circle cx={cx + 22} cy={cy + 15} r="4.5" fill="#FFFDF8" />
      </g>
    );
  }
  if (terrain === "grain") {
    return (
      <g opacity="0.45" stroke="#B67B12" strokeWidth="2.2" strokeLinecap="round" pointerEvents="none">
        <line x1={cx - 24} y1={cy - 16} x2={cx - 12} y2={cy - 16} />
        <line x1={cx + 12} y1={cy - 18} x2={cx + 24} y2={cy - 18} />
        <line x1={cx - 24} y1={cy + 18} x2={cx - 10} y2={cy + 18} />
        <line x1={cx + 10} y1={cy + 18} x2={cx + 24} y2={cy + 18} />
      </g>
    );
  }
  if (terrain === "ore") {
    return (
      <g opacity="0.55" pointerEvents="none">
        <path d={`M${cx - 28} ${cy - 4}L${cx - 16} ${cy - 24}L${cx - 5} ${cy - 4}Z`} fill="#526476" />
        <path d={`M${cx - 19} ${cy - 18}L${cx - 16} ${cy - 24}L${cx - 13} ${cy - 18}Z`} fill="#EFF6FC" />
        <path d={`M${cx + 6} ${cy + 22}L${cx + 17} ${cy + 4}L${cx + 28} ${cy + 22}Z`} fill="#48596A" />
      </g>
    );
  }
  // Desert Dune Cove
  return (
    <g opacity="0.55" pointerEvents="none">
      <path
        d={`M${cx - 28} ${cy + 12}Q${cx - 8} ${cy - 4} ${cx + 26} ${cy + 14}`}
        fill="none"
        stroke="#C4A064"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d={`M${cx - 20} ${cy - 14}Q${cx + 4} ${cy - 24} ${cx + 22} ${cy - 12}`}
        fill="none"
        stroke="#C4A064"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </g>
  );
}

export function HarborreachBoardSvg({
  board,
  buildings,
  roads,
  banditHexId,
  lastRollSum,
  playerColorById,
  validVertices,
  validEdges,
  canMoveBandit,
  onClickVertex,
  onClickEdge,
  onClickHex,
}: HarborreachBoardSvgProps) {
  const getColor = (uid: string) => getPlayerColorMeta(playerColorById[uid] ?? 0).hex;

  return (
    <svg
      viewBox="-310 -278 620 556"
      className="h-full w-full select-none"
      role="img"
      aria-label="Harborreach Hex Island Board"
    >
      <defs>
        <radialGradient id="hrOceanGrad" cx="50%" cy="46%" r="60%">
          <stop offset="0%" stopColor="#9EDCE3" />
          <stop offset="62%" stopColor="#6DBAC8" />
          <stop offset="100%" stopColor="#4F9BAD" />
        </radialGradient>
        <filter id="hrSoftShadow" x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#2C221A" floodOpacity="0.22" />
        </filter>
      </defs>

      {/* Subtle Ocean Wave Ripples */}
      <g stroke="rgba(255,255,255,0.28)" strokeWidth="2.2" fill="none" strokeLinecap="round">
        <path d="M-265 -215Q-245 -223 -225 -215T-185 -215" />
        <path d="M180 -225Q200 -233 220 -225T260 -225" />
        <path d="M-275 190Q-255 182 -235 190T-195 190" />
        <path d="M195 215Q215 207 235 215T275 215" />
      </g>

      {/* Warm Coastal Sand Halo behind the 19-hex island */}
      <g filter="url(#hrSoftShadow)">
        {board.hexes.map((hex) => (
          <polygon
            key={`sand_${hex.id}`}
            points={hexPolygonPoints(hex.cx, hex.cy, HEX_RADIUS + 7)}
            fill="#F3DFB9"
          />
        ))}
      </g>

      {/* 9 Coastal Harbors: Wooden Pier Lines + Badges */}
      {board.harbors.map((h) => {
        const v1 = board.vertices[h.v1]!;
        const v2 = board.vertices[h.v2]!;
        const isAny = h.kind === "any";
        const meta = isAny ? null : RESOURCE_META[h.kind as ResourceType];
        const portLabel = isAny
          ? "ANY"
          : h.kind === "timber"
            ? "WOOD"
            : meta!.label.toUpperCase();
        return (
          <g key={`harbor_${h.id}`}>
            <line
              x1={h.badgeX}
              y1={h.badgeY}
              x2={v1.x}
              y2={v1.y}
              stroke="#9C6D46"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <line
              x1={h.badgeX}
              y1={h.badgeY}
              x2={v2.x}
              y2={v2.y}
              stroke="#9C6D46"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <circle
              cx={h.badgeX}
              cy={h.badgeY}
              r="18"
              fill={isAny ? "#FFF8E6" : meta!.softBg}
              stroke={isAny ? "#B88435" : meta!.hex}
              strokeWidth="2.6"
              filter="url(#hrSoftShadow)"
            />
            <text
              x={h.badgeX}
              y={h.badgeY - 2}
              textAnchor="middle"
              fontSize="10"
              fontWeight="900"
              fill={isAny ? "#6E4A16" : meta!.text}
            >
              {isAny ? "3:1" : "2:1"}
            </text>
            <text
              x={h.badgeX}
              y={h.badgeY + 9}
              textAnchor="middle"
              fontSize={portLabel.length >= 5 ? "6.6" : "7.2"}
              fontWeight="800"
              fill={isAny ? "#8B6428" : meta!.text}
            >
              {portLabel}
            </text>
          </g>
        );
      })}

      {/* 19 Land Hex Tiles */}
      {board.hexes.map((hex) => {
        const fill =
          hex.terrain === "desert"
            ? "#EAD5A8"
            : RESOURCE_META[hex.terrain].terrainFill;
        const isRolled =
          lastRollSum !== null &&
          hex.numberToken === lastRollSum &&
          hex.id !== banditHexId;
        const isBanditHere = hex.id === banditHexId;
        const isBanditTarget = canMoveBandit && !isBanditHere;
        const isRed = hex.numberToken === 6 || hex.numberToken === 8;
        const pips = getPipCount(hex.numberToken);

        return (
          <g
            key={`hex_${hex.id}`}
            onClick={isBanditTarget ? () => onClickHex?.(hex.id) : undefined}
            className={isBanditTarget ? "cursor-pointer" : undefined}
          >
            <polygon
              points={hexPolygonPoints(hex.cx, hex.cy, HEX_RADIUS - 1.5)}
              fill={fill}
              stroke={isRolled ? "#F59E0B" : isBanditTarget ? "#D9594C" : "#F8EFE0"}
              strokeWidth={isRolled ? 4.2 : isBanditTarget ? 3.2 : 2.6}
            />

            <TerrainBackdropArt hex={hex} />

            {/* Subtle hover overlay when picking Bandit destination */}
            {isBanditTarget && (
              <polygon
                points={hexPolygonPoints(hex.cx, hex.cy, HEX_RADIUS - 4)}
                fill="rgba(217, 89, 76, 0.14)"
                className="transition hover:fill-[rgba(217,89,76,0.32)]"
              />
            )}

            {/* Number Probability Token */}
            {hex.numberToken !== null && (
              <g pointerEvents="none">
                <circle
                  cx={hex.cx}
                  cy={hex.cy}
                  r="17"
                  fill={isRolled ? "#FEF08A" : "#FFFDF6"}
                  stroke={isRolled ? "#D97706" : isRed ? "#C93B3B" : "#7A5E48"}
                  strokeWidth={isRolled ? 2.8 : 1.9}
                />
                <text
                  x={hex.cx}
                  y={hex.cy + 2}
                  textAnchor="middle"
                  fontSize="14.5"
                  fontWeight="900"
                  fill={isRed ? "#C53030" : "#3E2C22"}
                >
                  {hex.numberToken}
                </text>
                <text
                  x={hex.cx}
                  y={hex.cy + 12}
                  textAnchor="middle"
                  fontSize="7.5"
                  fontWeight="900"
                  letterSpacing="0.5"
                  fill={isRed ? "#C53030" : "#7A5E48"}
                >
                  {"•".repeat(pips)}
                </text>
              </g>
            )}

            {/* Bandit Fox Piece */}
            {isBanditHere && (
              <g transform={`translate(${hex.cx + (hex.numberToken ? 20 : 0)}, ${hex.cy - (hex.numberToken ? 14 : 0)})`} pointerEvents="none">
                <circle cx="0" cy="0" r="14" fill="#2E221D" stroke="#FDE047" strokeWidth="2.4" />
                <path d="M-7 -6L-2 -2H2L7 -6L6.5 4L0 8.5L-6.5 4Z" fill="#E06D37" stroke="#FFF8EC" strokeWidth="1" />
                <rect x="-5" y="-1.5" width="10" height="3" rx="1.5" fill="#2E221D" />
                <circle cx="-2.4" cy="0" r="0.9" fill="#FDE047" />
                <circle cx="2.4" cy="0" r="0.9" fill="#FDE047" />
              </g>
            )}
          </g>
        );
      })}

      {/* 72 Edges: Built Roads + Glowing Interactive Road Targets */}
      {board.edges.map((edge) => {
        const owner = roads[edge.id];
        const isValid = validEdges.has(edge.id);
        if (!owner && !isValid) return null;

        if (owner) {
          return (
            <g key={`road_${edge.id}`} pointerEvents="none">
              <line
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                stroke="#3A281E"
                strokeWidth="10.5"
                strokeLinecap="round"
              />
              <line
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                stroke={getColor(owner)}
                strokeWidth="6.5"
                strokeLinecap="round"
              />
            </g>
          );
        }

        // Valid road placement target!
        return (
          <g
            key={`road_target_${edge.id}`}
            onClick={() => onClickEdge?.(edge.id)}
            className="cursor-pointer"
          >
            {/* Large invisible hit zone for easy mobile tapping */}
            <line
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke="transparent"
              strokeWidth="20"
              strokeLinecap="round"
            />
            <line
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke="#10B981"
              strokeWidth="8"
              strokeOpacity="0.45"
              strokeLinecap="round"
              className="animate-pulse"
            />
            <line
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke="#ECFDF5"
              strokeWidth="3.2"
              strokeDasharray="4 4"
              strokeLinecap="round"
            />
          </g>
        );
      })}

      {/* 54 Vertices: Cottages, Towns & Glowing Interactive Vertex Targets */}
      {board.vertices.map((v) => {
        const b = buildings[v.id];
        const isValid = validVertices.has(v.id);
        if (!b && !isValid) return null;

        if (b && !isValid) {
          const fill = getColor(b.ownerId);
          return (
            <g key={`bldg_${v.id}`} transform={`translate(${v.x}, ${v.y})`} pointerEvents="none" filter="url(#hrSoftShadow)">
              {b.kind === "cottage" ? (
                <>
                  <path
                    d="M-9 2L0 -9L9 2V10H-9Z"
                    fill={fill}
                    stroke="#2E2019"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                  />
                  <rect x="-2.5" y="3" width="5" height="6.5" rx="1" fill="#FFF8EC" />
                </>
              ) : (
                <>
                  {/* Bustling Two-Tier Harbor Town */}
                  <path
                    d="M-12 10V-2L-5 -7L0 -3V-11L6 -15L12 -11V10Z"
                    fill={fill}
                    stroke="#2E2019"
                    strokeWidth="2.3"
                    strokeLinejoin="round"
                  />
                  <circle cx="6" cy="-5" r="2.2" fill="#FDE047" />
                  <rect x="-8" y="3" width="4" height="6" rx="1" fill="#FFF8EC" />
                  <rect x="3" y="2" width="4.5" height="7" rx="1" fill="#FFF8EC" />
                </>
              )}
            </g>
          );
        }

        // Interactive valid vertex (either empty Cottage slot OR upgradeable Cottage -> Town!)
        return (
          <g
            key={`v_target_${v.id}`}
            transform={`translate(${v.x}, ${v.y})`}
            onClick={() => onClickVertex?.(v.id)}
            className="cursor-pointer"
          >
            <circle cx="0" cy="0" r="16" fill="transparent" />
            <circle
              cx="0"
              cy="0"
              r={b ? 14 : 11}
              fill={b ? "rgba(245, 158, 11, 0.35)" : "rgba(16, 185, 129, 0.32)"}
              stroke={b ? "#D97706" : "#059669"}
              strokeWidth="2.4"
              className="animate-pulse"
            />
            {b ? (
              <path
                d="M-8 2L0 -8L8 2V9H-8Z"
                fill={getColor(b.ownerId)}
                stroke="#FDE047"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            ) : (
              <circle cx="0" cy="0" r="4.5" fill="#ECFDF5" stroke="#059669" strokeWidth="1.8" />
            )}
          </g>
        );
      })}
    </svg>
  );
}
