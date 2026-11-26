"use client";

import React from "react";
import { MASQUE_DEFINITIONS, type MasqueId } from "@tablefolk/game-velvet-masque";
import { masqueToIconName, renderIconArt } from "./GameIcons";

interface VelvetMasqueCardSvgProps {
  /** Undefined means face-down velvet card back */
  maskId?: MasqueId;
  compact?: boolean;
  highlight?: "none" | "gold" | "crimson" | "emerald" | "violet";
  juggled?: boolean;
}

/**
 * Ornate hand-crafted SVG artwork for Velvet Masque cards (face-down velvet back
 * and 8 illustrated Venetian-style gala mask faces).
 */
export function VelvetMasqueCardSvg({
  maskId,
  compact = false,
  highlight = "none",
  juggled = false,
}: VelvetMasqueCardSvgProps) {
  const ringStroke =
    highlight === "gold"
      ? "#FBBF24"
      : highlight === "crimson"
        ? "#F87171"
        : highlight === "emerald"
          ? "#34D399"
          : highlight === "violet"
            ? "#C084FC"
            : "#D4A359";

  // Face-Down Crimson Velvet Card Back
  if (!maskId) {
    return (
      <svg viewBox="0 0 80 112" className="h-full w-full select-none drop-shadow-md">
        <defs>
          <linearGradient id="vmBackGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6B1D2E" />
            <stop offset="55%" stopColor="#4A1220" />
            <stop offset="100%" stopColor="#2D0A14" />
          </linearGradient>
        </defs>
        <rect
          x="2"
          y="2"
          width="76"
          height="108"
          rx="10"
          fill="url(#vmBackGrad)"
          stroke={ringStroke}
          strokeWidth={highlight !== "none" ? "3.2" : "2.2"}
        />
        <rect
          x="7"
          y="7"
          width="66"
          height="98"
          rx="7"
          fill="none"
          stroke="#E9C27B"
          strokeOpacity="0.55"
          strokeWidth="1.2"
          strokeDasharray="3 2"
        />
        {/* Filigree corner diamonds */}
        <circle cx="13" cy="13" r="2.2" fill="#E9C27B" opacity="0.7" />
        <circle cx="67" cy="13" r="2.2" fill="#E9C27B" opacity="0.7" />
        <circle cx="13" cy="99" r="2.2" fill="#E9C27B" opacity="0.7" />
        <circle cx="67" cy="99" r="2.2" fill="#E9C27B" opacity="0.7" />

        {/* Stylized golden masquerade mask emblem */}
        <circle cx="40" cy="52" r="21" fill="#2A0A13" stroke="#E9C27B" strokeWidth="1.4" opacity="0.85" />
        <path
          d="M 22 50 C 26 40, 35 42, 40 46 C 45 42, 54 40, 58 50 C 57 59, 49 62, 43 56 L 40 53 L 37 56 C 31 62, 23 59, 22 50 Z"
          fill="#E9C27B"
          stroke="#7A4F16"
          strokeWidth="1.3"
        />
        <ellipse cx="32" cy="50.5" rx="4.2" ry="2.6" fill="#3B0F1A" />
        <ellipse cx="48" cy="50.5" rx="4.2" ry="2.6" fill="#3B0F1A" />

        <text
          x="40"
          y="89"
          textAnchor="middle"
          fontSize="7.5"
          fontWeight="800"
          letterSpacing="1.2"
          fill="#F3D69A"
          opacity="0.85"
        >
          {juggled ? "JUGGLED" : "MASQUE"}
        </text>
      </svg>
    );
  }

  const def = MASQUE_DEFINITIONS[maskId];

  return (
    <svg viewBox="0 0 80 112" className="h-full w-full select-none drop-shadow-md">
      {/* Warm porcelain cream face */}
      <rect
        x="2"
        y="2"
        width="76"
        height="108"
        rx="10"
        fill="#FFFBF2"
        stroke={highlight !== "none" ? ringStroke : def.accentHex}
        strokeWidth={highlight !== "none" ? "3.4" : "2.6"}
      />
      {/* Tinted inner theatrical arch */}
      <rect
        x="6.5"
        y="6.5"
        width="67"
        height="99"
        rx="7"
        fill={def.bgHex}
        stroke={def.accentHex}
        strokeOpacity="0.45"
        strokeWidth="1.2"
      />

      {/* Decorative top ribbon */}
      <rect
        x="11"
        y="10"
        width="58"
        height="14"
        rx="5"
        fill={def.accentHex}
      />
      <text
        x="40"
        y="19.5"
        textAnchor="middle"
        fontSize="8.2"
        fontWeight="900"
        letterSpacing="0.4"
        fill="#FFFFFF"
      >
        {def.name.toUpperCase()}
      </text>

      {/* Center medallion with custom illustrated vector emblem */}
      <circle
        cx="40"
        cy="51"
        r="21"
        fill="#FFFDF7"
        stroke={def.accentHex}
        strokeWidth="2.2"
      />
      <g transform="translate(23.2, 34.2) scale(1.05)">
        {renderIconArt(masqueToIconName(maskId))}
      </g>

      {/* Power footer pill */}
      {!compact && (
        <>
          <rect
            x="9"
            y="78"
            width="62"
            height="22"
            rx="6"
            fill="#2E201B"
            fillOpacity="0.9"
          />
          <text
            x="40"
            y="91.5"
            textAnchor="middle"
            fontSize="7.4"
            fontWeight="800"
            fill="#FDE68A"
          >
            {def.shortPower}
          </text>
        </>
      )}
      {compact && (
        <text
          x="40"
          y="94"
          textAnchor="middle"
          fontSize="7.8"
          fontWeight="900"
          fill="#3B2B26"
        >
          {def.shortPower}
        </text>
      )}
    </svg>
  );
}
