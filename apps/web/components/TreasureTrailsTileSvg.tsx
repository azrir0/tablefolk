"use client";

import React from "react";
import type { PathEdges, VaultKind } from "@tablefolk/game-treasure-trails";

interface PathTileSvgProps {
  edges: PathEdges;
  connectedCenter: boolean;
  kind?: "BASE_CAMP" | "PATH" | "VAULT";
  vaultRevealed?: boolean;
  vaultKind?: VaultKind;
  privateScoutHint?: VaultKind;
  compact?: boolean;
}

/**
 * Crisp stylized botanical-ruins SVG tile artwork for Treasure Trails.
 * Renders cleanly at both board scale and handheld card scale.
 */
export function PathTileSvg({
  edges,
  connectedCenter,
  kind = "PATH",
  vaultRevealed = false,
  vaultKind,
  privateScoutHint,
  compact = false,
}: PathTileSvgProps) {
  // Unrevealed Sealed Vault
  if (kind === "VAULT" && !vaultRevealed) {
    return (
      <svg viewBox="0 0 60 80" className="h-full w-full select-none">
        <rect x="2" y="2" width="56" height="76" rx="8" fill="#5D4A3E" stroke="#3B2B26" strokeWidth="2.5" />
        <rect x="6" y="6" width="48" height="68" rx="5" fill="#756050" stroke="#9D846D" strokeWidth="1.5" strokeDasharray="3 2" />
        <circle cx="30" cy="40" r="15" fill="#3B2B26" opacity="0.38" />
        <text x="30" y="48" textAnchor="middle" fontSize="24" fontWeight="800" fill="#F5D076">
          ?
        </text>
        <text x="30" y="68" textAnchor="middle" fontSize="8" fontWeight="800" fill="#EFE2CE">
          VAULT
        </text>
        {privateScoutHint && (
          <g>
            <rect
              x="4"
              y="4"
              width="52"
              height="20"
              rx="5"
              fill={privateScoutHint === "TRUE_RELIC" ? "#F4C145" : "#E6D8C7"}
              stroke="#3B2B26"
              strokeWidth="1.6"
            />
            <text x="30" y="17.5" textAnchor="middle" fontSize="9.5" fontWeight="900" fill="#3B2B26">
              {privateScoutHint === "TRUE_RELIC" ? "★ RELIC" : "✕ DECOY"}
            </text>
          </g>
        )}
      </svg>
    );
  }

  // Revealed Vault (True Relic or Decoy Sanctuary)
  if (kind === "VAULT" && vaultRevealed) {
    const isRelic = vaultKind === "TRUE_RELIC";
    return (
      <svg viewBox="0 0 60 80" className="h-full w-full select-none">
        <rect
          x="2"
          y="2"
          width="56"
          height="76"
          rx="8"
          fill={isRelic ? "#FBE6A2" : "#D9CEBE"}
          stroke={isRelic ? "#B97D16" : "#5D4A3E"}
          strokeWidth="2.5"
        />
        {/* Connectors */}
        {edges.N && <rect x="23" y="2" width="14" height="24" fill="#E6C999" />}
        {edges.S && <rect x="23" y="54" width="14" height="24" fill="#E6C999" />}
        {edges.W && <rect x="2" y="33" width="24" height="14" fill="#E6C999" />}
        {edges.E && <rect x="34" y="33" width="24" height="14" fill="#E6C999" />}
        <circle
          cx="30"
          cy="40"
          r="16"
          fill={isRelic ? "#F5B82E" : "#A99B89"}
          stroke="#3B2B26"
          strokeWidth="2"
        />
        <text x="30" y="46" textAnchor="middle" fontSize="18">
          {isRelic ? "🧭" : "🏺"}
        </text>
        <text x="30" y="70" textAnchor="middle" fontSize="7" fontWeight="800" fill="#3B2B26">
          {isRelic ? "GOLDEN COMPASS" : "DECOY"}
        </text>
      </svg>
    );
  }

  const bgFill = kind === "BASE_CAMP" ? "#CFE5C8" : "#DFEAD4";
  const trailFill = "#EBD1A3";
  const trailStroke = "#B28B59";

  return (
    <svg viewBox="0 0 60 80" className="h-full w-full select-none">
      {/* Mossy ruin tile background */}
      <rect
        x="1.5"
        y="1.5"
        width="57"
        height="77"
        rx={compact ? "6" : "8"}
        fill={bgFill}
        stroke="#6B7E62"
        strokeWidth="2"
      />

      {/* Subtle mossy pebble accents */}
      <circle cx="11" cy="13" r="3" fill="#BBD1AC" />
      <circle cx="49" cy="67" r="3.5" fill="#BBD1AC" />

      {/* Trail Arms */}
      {edges.N && (
        <rect
          x="22"
          y="1.5"
          width="16"
          height={connectedCenter ? 39 : 24}
          fill={trailFill}
          stroke={trailStroke}
          strokeWidth="1.6"
        />
      )}
      {edges.S && (
        <rect
          x="22"
          y={connectedCenter ? 39.5 : 54.5}
          width="16"
          height={connectedCenter ? 39 : 24}
          fill={trailFill}
          stroke={trailStroke}
          strokeWidth="1.6"
        />
      )}
      {edges.W && (
        <rect
          x="1.5"
          y="32"
          width={connectedCenter ? 29 : 18}
          height="16"
          fill={trailFill}
          stroke={trailStroke}
          strokeWidth="1.6"
        />
      )}
      {edges.E && (
        <rect
          x={connectedCenter ? 29.5 : 40.5}
          y="32"
          width={connectedCenter ? 29 : 18}
          height="16"
          fill={trailFill}
          stroke={trailStroke}
          strokeWidth="1.6"
        />
      )}

      {/* Center Hub: Open Path vs Blocked Rockfall vs Base Camp */}
      {kind === "BASE_CAMP" ? (
        <g>
          <circle cx="30" cy="40" r="16" fill="#F2B84B" stroke="#5A3E24" strokeWidth="2.2" />
          <text x="30" y="45" textAnchor="middle" fontSize="16">
            ⛺
          </text>
          <text x="30" y="71" textAnchor="middle" fontSize="7" fontWeight="800" fill="#3B2B26">
            CAMP
          </text>
        </g>
      ) : connectedCenter ? (
        <circle cx="30" cy="40" r="9.5" fill={trailFill} />
      ) : (
        <g>
          {/* Jagged boulder / bramble dead-end */}
          <polygon
            points="18,45 23,29 37,28 43,43 34,52 22,51"
            fill="#8D7C72"
            stroke="#3B2B26"
            strokeWidth="2"
          />
          <line x1="25" y1="35" x2="35" y2="45" stroke="#D96E5B" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="35" y1="35" x2="25" y2="45" stroke="#D96E5B" strokeWidth="2.2" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
